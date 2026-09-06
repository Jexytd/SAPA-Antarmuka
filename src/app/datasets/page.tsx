'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import {
  Button,
  StatusBadge,
  SearchInput,
  Select,
  Pagination,
  EmptyState,
  TableSkeleton,
  Toast,
} from '@/components/ui';
import {
  DatasetRepo,
  RecordRepo,
  subscribe,
  subscribeBackendStatus,
  getBackendStatus,
  syncWithBackend,
  BackendConnectionState,
} from '@/lib/repository';
import { CATEGORIES } from '@/lib/mock-data';
import { Dataset, DataStatus, UserRole } from '@/lib/types';
import { formatDateShort, getPeriodRange, formatNumber } from '@/lib/utils';
import {
  Plus,
  Database,
  ChevronRight,
  Filter,
  Trash2,
  Pencil,
  ServerOff,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { MorphSortIcon } from '@/components/ui/morph-icon';
import { Badge } from '@/components/ui/badge';
import EditDatasetModal from '@/components/datasets/EditDatasetModal';

const PAGE_SIZE = 10;

export default function DatasetsPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [backendState, setBackendState] = useState<BackendConnectionState>(() => getBackendStatus());
  const [isRetrying, setIsRetrying] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>(() => {
    // Jangan tampilkan data lokal jika backend belum terverifikasi aktif
    if (getBackendStatus().isConnected) {
      try {
        return DatasetRepo.getAll();
      } catch {
        return [];
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'updated_at' | 'name'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);

  const handleDeleteDataset = async (e: React.MouseEvent, ds: Dataset) => {
    e.stopPropagation();
    e.preventDefault();
    if (!backendState.isConnected) {
      setToast({ msg: 'Operasi tidak diizinkan saat server offline.', type: 'error' });
      return;
    }
    if (user?.role !== UserRole.REVIEWER && ds.created_by !== user?.id) {
      setToast({ msg: 'Hanya pembuat dataset atau reviewer yang dapat menghapus.', type: 'error' });
      return;
    }
    if (
      confirm(
        `HAPUS DATASET?\n\nNama: "${ds.name}" (${ds.code})\n\nSeluruh data di dalam dataset ini akan dihapus dari sistem. Gunakan opsi ini jika salah membuat dataset.`
      )
    ) {
      if (user) {
        await DatasetRepo.delete(ds.id, user.id, user.name);
        setDatasets(DatasetRepo.getAll());
        setToast({ msg: `Dataset "${ds.name}" berhasil dihapus.`, type: 'success' });
      }
    }
  };

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const unsubBackend = subscribeBackendStatus((state) => {
      setBackendState(state);
      if (state.isConnected) {
        setDatasets(DatasetRepo.getAll());
      } else if (state.hasCheckedInitial) {
        setDatasets([]);
      }
    });

    // Periksa status koneksi backend awal jika belum dicek
    if (!getBackendStatus().hasCheckedInitial) {
      setLoading(true);
      syncWithBackend().finally(() => {
        setLoading(false);
      });
    }

    function loadData() {
      if (getBackendStatus().isConnected) {
        setDatasets(DatasetRepo.getAll());
      } else {
        setDatasets([]);
      }
      setLoading(false);
    }

    const unsubRepo = subscribe(loadData);
    return () => {
      unsubBackend();
      unsubRepo();
    };
  }, [isAuthenticated, isLoading, router]);

  const handleRetryBackend = async () => {
    setIsRetrying(true);
    try {
      const isLive = await syncWithBackend();
      if (isLive) {
        setDatasets(DatasetRepo.getAll());
        setToast({ msg: 'Berhasil terhubung ke server backend!', type: 'success' });
      } else {
        setDatasets([]);
        setToast({
          msg: 'Server backend masih offline atau belum dapat dihubungi.',
          type: 'error',
        });
      }
    } catch {
      setDatasets([]);
      setToast({ msg: 'Gagal menghubungi server backend.', type: 'error' });
    } finally {
      setIsRetrying(false);
    }
  };

  const filtered = useMemo(() => {
    if (!backendState.isConnected) return [];
    let result = [...datasets];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q)
      );
    }

    if (filterCategory) {
      result = result.filter((d) => d.category === filterCategory);
    }

    if (filterStatus) {
      result = result.filter((d) => d.status === filterStatus);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [datasets, search, filterCategory, filterStatus, sortBy, sortOrder, backendState.isConnected]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const [prevFilter, setPrevFilter] = useState({ search, filterCategory, filterStatus });
  if (
    prevFilter.search !== search ||
    prevFilter.filterCategory !== filterCategory ||
    prevFilter.filterStatus !== filterStatus
  ) {
    setPrevFilter({ search, filterCategory, filterStatus });
    setCurrentPage(1);
  }

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <PageContent
        datasets={paginated}
        totalCount={filtered.length}
        loading={loading}
        backendState={backendState}
        isRetrying={isRetrying}
        onRetryBackend={handleRetryBackend}
        search={search}
        onSearchChange={setSearch}
        filterCategory={filterCategory}
        onFilterCategory={setFilterCategory}
        filterStatus={filterStatus}
        onFilterStatus={setFilterStatus}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={(field) => {
          if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            setSortBy(field);
            setSortOrder('desc');
          }
        }}
        onDeleteDataset={handleDeleteDataset}
        onEditDataset={(ds) => setEditingDataset(ds)}
      />
      {editingDataset && (
        <EditDatasetModal
          dataset={editingDataset}
          open={!!editingDataset}
          onClose={() => setEditingDataset(null)}
          onSuccess={(updated) => {
            setDatasets(DatasetRepo.getAll());
            setToast({
              msg: `Dataset "${updated.name}" berhasil diperbarui.`,
              type: 'success',
            });
          }}
        />
      )}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </AppLayout>
  );
}

function PageContent({
  datasets,
  totalCount,
  loading,
  backendState,
  isRetrying,
  onRetryBackend,
  search,
  onSearchChange,
  filterCategory,
  onFilterCategory,
  filterStatus,
  onFilterStatus,
  currentPage,
  onPageChange,
  sortBy,
  sortOrder,
  onSort,
  onDeleteDataset,
  onEditDataset,
  onMobileMenuOpen,
}: {
  datasets: Dataset[];
  totalCount: number;
  loading: boolean;
  backendState: BackendConnectionState;
  isRetrying: boolean;
  onRetryBackend: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  filterCategory: string;
  onFilterCategory: (value: string) => void;
  filterStatus: string;
  onFilterStatus: (value: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  sortBy: 'updated_at' | 'name';
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'updated_at' | 'name') => void;
  onDeleteDataset: (e: React.MouseEvent, ds: Dataset) => void;
  onEditDataset: (ds: Dataset) => void;
  onMobileMenuOpen?: () => void;
}) {
  const isChecking = loading || (!backendState.hasCheckedInitial && backendState.isSyncing);
  const isOffline = backendState.hasCheckedInitial && !backendState.isConnected;

  return (
    <>
      <Header
        title="Katalog Dataset"
        subtitle="Daftar dataset statistik makro Kabupaten Bangka"
        onMobileMenuOpen={onMobileMenuOpen || (() => { })}
        actions={
          backendState.isConnected ? (
            <Link href="/datasets/new">
              <Button icon={<Plus size={14} />}>Buat Dataset</Button>
            </Link>
          ) : null
        }
      />
      <div className="page-content">
        {isChecking ? (
          <div>
            <div
              style={{
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#64748b',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <RefreshCw size={14} className="animate-spin text-blue-600" />
              <span>Memeriksa status koneksi server backend...</span>
            </div>
            <TableSkeleton rows={6} cols={6} />
          </div>
        ) : isOffline ? (
          <div
            style={{
              maxWidth: 620,
              margin: '36px auto',
              padding: '40px 32px',
              borderRadius: 16,
              background: '#ffffff',
              border: '1px solid #fee2e2',
              boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.06)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <ServerOff size={32} />
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 9999,
                background: '#fee2e2',
                color: '#b91c1c',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#ef4444',
                }}
              />
              Server Offline
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>
              Server Backend Sedang Offline
            </h2>

            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 20 }}>
              Data dataset tidak ditampilkan karena server backend tidak aktif atau offline, dan database saat ini masih menggunakan penyimpanan lokal.
            </p>

            <div
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#b45309',
                fontSize: 13,
                lineHeight: 1.5,
                marginBottom: 24,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2, color: '#d97706' }} />
              <div>
                <strong>Perhatian:</strong> Untuk mencegah ketidaksinkronan data dan menjaga keaslian data statistik makro BPS, katalog dataset hanya dapat diakses saat layanan server terhubung.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button
                variant="primary"
                icon={<RefreshCw size={14} className={isRetrying ? 'animate-spin' : ''} />}
                loading={isRetrying}
                onClick={onRetryBackend}
              >
                Coba Hubungkan Kembali
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Filters & Actions Bar */}
            <div className="filter-bar">
              <SearchInput
                value={search}
                onChange={onSearchChange}
                placeholder="Cari dataset, kode, atau kategori..."
              />
              <Select
                options={CATEGORIES.map((c) => ({ value: c.name, label: c.name }))}
                placeholder="Semua Kategori"
                value={filterCategory}
                onChange={(e) => onFilterCategory(e.target.value)}
              />
              <Select
                options={[
                  { value: DataStatus.DRAFT, label: 'Draf (Draft)' },
                  { value: DataStatus.REVIEW, label: 'Menunggu Review' },
                  { value: DataStatus.PUBLISHED, label: 'Terpublikasi (Published)' },
                  { value: DataStatus.ARCHIVED, label: 'Diarsipkan' },
                ]}
                placeholder="Semua Status"
                value={filterStatus}
                onChange={(e) => onFilterStatus(e.target.value)}
              />
            </div>

            {datasets.length === 0 ? (
              <EmptyState
                icon={<Database size={36} />}
                title={search || filterCategory || filterStatus ? 'Tidak ada hasil yang cocok' : 'Belum ada dataset'}
                description={
                  search || filterCategory || filterStatus
                    ? 'Tidak ditemukan dataset yang sesuai kriteria pencarian. Coba ubah kata kunci atau reset filter.'
                    : 'Mulai dengan membuat dataset statistik baru untuk wilayah Kabupaten Bangka.'
                }
                actions={
                  !search && !filterCategory && !filterStatus ? (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Link href="/datasets/new">
                        <Button icon={<Plus size={14} />}>Buat Dataset Baru</Button>
                      </Link>
                      <Link href="/import">
                        <Button variant="secondary">Import dari Excel</Button>
                      </Link>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        onSearchChange('');
                        onFilterCategory('');
                        onFilterStatus('');
                      }}
                    >
                      Reset Semua Filter
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="data-table-wrapper">
                  <table className="data-table data-table-sticky">
                    <thead>
                      <tr>
                        <th
                          className="sortable"
                          onClick={() => onSort('name')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Nama Dataset & Kode
                            <MorphSortIcon direction={sortBy === 'name' ? sortOrder : null} size={14} />
                          </div>
                        </th>
                        <th>Kategori</th>
                        <th>Rentang Periode</th>
                        <th className="cell-numeric">Jumlah Data</th>
                        <th>Status Validasi</th>
                        <th
                          className="sortable"
                          onClick={() => onSort('updated_at')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Terakhir Update
                            <MorphSortIcon direction={sortBy === 'updated_at' ? sortOrder : null} size={14} />
                          </div>
                        </th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {datasets.map((ds) => {
                        const records = RecordRepo.getByDataset(ds.id);
                        const periodRange = getPeriodRange(records);

                        return (
                          <tr key={ds.id}>
                            <td>
                              <div>
                                <Link
                                  href={`/datasets/${ds.id}`}
                                  className="row-link"
                                >
                                  {ds.name}
                                </Link>
                                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2, fontFamily: 'monospace' }}>
                                  {ds.code}
                                </div>
                              </div>
                            </td>
                            <td>
                              <Badge variant="secondary" className="font-normal text-xs">
                                {ds.category}
                              </Badge>
                            </td>
                            <td style={{ fontSize: 12.5, color: '#475569' }}>{periodRange}</td>
                            <td className="cell-numeric">
                              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                {formatNumber(ds.record_count || 0)}
                              </span>
                              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>data</span>
                            </td>
                            <td>
                              <StatusBadge status={ds.status} size="sm" />
                            </td>
                            <td style={{ fontSize: 12, color: '#64748b' }}>{formatDateShort(ds.updated_at)}</td>
                            <td className="cell-actions">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    onEditDataset(ds);
                                  }}
                                  title="Edit Dataset & Metadata"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--primary-color)',
                                    cursor: 'pointer',
                                    padding: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderRadius: 4,
                                  }}
                                >
                                  <Pencil size={14} />
                                </button>
                                <Link href={`/datasets/${ds.id}`} title="Buka Detail">
                                  <Button variant="ghost" size="sm" style={{ padding: '0 6px', height: 28 }}>
                                    <ChevronRight size={16} />
                                  </Button>
                                </Link>
                                <button
                                  type="button"
                                  onClick={(e) => onDeleteDataset(e, ds)}
                                  title="Hapus Dataset"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--error-text)',
                                    cursor: 'pointer',
                                    padding: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderRadius: 4,
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  current={currentPage}
                  total={totalCount}
                  pageSize={PAGE_SIZE}
                  onChange={onPageChange}
                />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
