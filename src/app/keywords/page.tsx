'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { Button, Toast, EmptyState, ServerOfflineState } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ChatbotTemplateRepo,
  DatasetRepo,
  RecordRepo,
  subscribe,
  subscribeBackendStatus,
  getBackendStatus,
  syncWithBackend,
  BackendConnectionState,
} from '@/lib/repository';
import { ChatbotTemplate, DataStatus, Dataset, DataRecord } from '@/lib/types';
import { BackendApi } from '@/lib/apiClient';
import {
  MessageSquare,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Send,
  Smartphone,
  Bot,
  Search,
  CheckCheck,
  RefreshCw,
  Hash,
  Lock,
  Eye,
  ExternalLink,
  Layers,
  FileSpreadsheet,
  HelpCircle,
} from 'lucide-react';

export default function KeywordsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [backendState, setBackendState] = useState<BackendConnectionState>(() => getBackendStatus());
  const [isRetrying, setIsRetrying] = useState(false);
  const [templates, setTemplates] = useState<ChatbotTemplate[]>(() => {
    if (getBackendStatus().isConnected) {
      try {
        return ChatbotTemplateRepo.getAll();
      } catch {
        return [];
      }
    }
    return [];
  });

  const [search, setSearch] = useState('');
  const [selectedSource, setSelectedSource] = useState<'ALL' | 'DATASET' | 'MANUAL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Modal Add / Edit Template
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChatbotTemplate | null>(null);
  const [formKeyword, setFormKeyword] = useState('');
  const [formResponse, setFormResponse] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Modal Preview (Read-Only)
  const [previewTemplate, setPreviewTemplate] = useState<ChatbotTemplate | null>(null);

  // WhatsApp Simulator State
  const [simMessages, setSimMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: 'Halo! Selamat datang di layanan *SAPA BPS Kab. Bangka* 😊\n\nKetik kata kunci data statistik (contoh: *penduduk*, *kemiskinan*, *ipm*, atau *menu*) untuk melihat template balasan otomatis.',
      time: '08:00',
    },
  ]);
  const [simInput, setSimInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [simSubmenu, setSimSubmenu] = useState<{
    category: string;
    datasets: { id: string; name: string; code: string; response?: string }[];
  } | null>(null);

  // Bot Connection Status
  const [botStatus, setBotStatus] = useState<{ state: string; phoneNumber?: string }>({ state: 'connected' });

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const unsubBackend = subscribeBackendStatus((state) => {
      setBackendState(state);
      if (state.isConnected) {
        setTemplates(ChatbotTemplateRepo.getAll());
        ChatbotTemplateRepo.syncWithBackendFaqs().then(() => {
          setTemplates(ChatbotTemplateRepo.getAll());
        });
        BackendApi.getBotStatus().then((st) => {
          if (st) setBotStatus(st);
        });
      } else if (state.hasCheckedInitial) {
        setTemplates([]);
      }
    });

    if (!getBackendStatus().hasCheckedInitial) {
      syncWithBackend().finally(() => {});
    }

    function reload() {
      if (getBackendStatus().isConnected) {
        setTemplates(ChatbotTemplateRepo.getAll());
      } else {
        setTemplates([]);
      }
    }

    const unsubRepo = subscribe(reload);
    return () => {
      unsubBackend();
      unsubRepo();
    };
  }, [isAuthenticated, isLoading, router]);

  // Helper untuk membersihkan label 'Resmi BPS' menjadi 'Layanan & FAQ BPS'
  const getCleanCategory = (cat?: string) => {
    if (!cat || cat === 'Resmi BPS') return 'Layanan & FAQ BPS';
    return cat;
  };

  // Categories list (Menggantikan 'Resmi BPS' secara konsisten)
  const categories = useMemo(() => {
    const set = new Set(
      templates.map((t) => getCleanCategory(t.category))
    );
    return ['ALL', ...Array.from(set)];
  }, [templates]);

  // Metrics count
  const datasetCount = useMemo(() => templates.filter((t) => t.source_type === 'DATASET').length, [templates]);
  const manualCount = useMemo(() => templates.filter((t) => t.source_type === 'MANUAL').length, [templates]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchSearch =
        t.keyword.toLowerCase().includes(search.toLowerCase()) ||
        t.response.toLowerCase().includes(search.toLowerCase());
      const matchSource =
        selectedSource === 'ALL' ||
        (selectedSource === 'DATASET' && t.source_type === 'DATASET') ||
        (selectedSource === 'MANUAL' && t.source_type === 'MANUAL');
      const cleanCategory = getCleanCategory(t.category);
      const matchCat = selectedCategory === 'ALL' || cleanCategory === selectedCategory;
      return matchSearch && matchSource && matchCat;
    });
  }, [templates, search, selectedSource, selectedCategory]);

  const handleOpenModal = (tpl?: ChatbotTemplate) => {
    if (tpl) {
      if (tpl.source_type === 'DATASET') {
        // Dataset template is read-only, open preview instead
        setPreviewTemplate(tpl);
        return;
      }
      setEditingTemplate(tpl);
      setFormKeyword(tpl.keyword);
      setFormResponse(tpl.response);
      setFormCategory(tpl.category || 'Umum');
    } else {
      setEditingTemplate(null);
      setFormKeyword('');
      setFormResponse('');
      setFormCategory('Informasi Umum');
    }
    setIsModalOpen(true);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKeyword.trim() || !formResponse.trim()) {
      setToast({ msg: 'Kata kunci dan isi template pesan balasan wajib diisi.', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      if (editingTemplate) {
        ChatbotTemplateRepo.update(editingTemplate.id, {
          keyword: formKeyword.trim(),
          response: formResponse.trim(),
          category: formCategory.trim() || 'Umum',
        });
        setToast({ msg: 'Template balasan chatbot berhasil diperbarui.', type: 'success' });
      } else {
        ChatbotTemplateRepo.create({
          keyword: formKeyword.trim(),
          response: formResponse.trim(),
          category: formCategory.trim() || 'Umum',
        });
        setToast({ msg: 'Kata kunci baru berhasil didaftarkan ke chatbot WhatsApp.', type: 'success' });
      }
      setIsModalOpen(false);
      setTemplates(ChatbotTemplateRepo.getAll());
    } catch {
      setToast({ msg: 'Gagal menyimpan template chatbot.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = (tpl: ChatbotTemplate) => {
    if (tpl.source_type === 'DATASET') {
      alert('Template yang berasal dari dataset resmi bersifat otomatis dan tidak dapat dihapus.');
      return;
    }
    if (tpl.id === 'tpl-system-menu') {
      if (confirm('Kembalikan template "Menu Utama" ke susunan menu default otomatis dari pangkalan data BPS?')) {
        ChatbotTemplateRepo.delete(tpl.id);
        setTemplates(ChatbotTemplateRepo.getAll());
        setToast({ msg: 'Template "Menu Utama" berhasil di-reset ke default pangkalan data BPS.', type: 'success' });
      }
      return;
    }
    if (confirm(`Hapus template kata kunci "${tpl.keyword}" dari bot WhatsApp?`)) {
      ChatbotTemplateRepo.delete(tpl.id);
      setTemplates(ChatbotTemplateRepo.getAll());
      setToast({ msg: `Kata kunci "${tpl.keyword}" berhasil dihapus.`, type: 'success' });
    }
  };

  // WhatsApp Simulator Action
  const handleSimSend = (textToSend?: string) => {
    const text = textToSend || simInput;
    if (!text.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Add user message
    setSimMessages((prev) => [...prev, { sender: 'user', text, time: timeStr }]);
    if (!textToSend) setSimInput('');
    setIsBotTyping(true);

    // Find match in templates & dynamic menu
    setTimeout(() => {
      const clean = text.trim().toLowerCase();

      // Bangun daftar menu dinamis: Mengelompokkan berdasarkan Kategori dataset resmi BPS (hanya yang memiliki data riil)
      const allPublishedDs = DatasetRepo.getAll().filter((d) => {
        if (d.status !== DataStatus.PUBLISHED) return false;
        const recCount = RecordRepo.getByDataset(d.id).filter(
          (r: DataRecord) => r.status === DataStatus.PUBLISHED && !r.is_deleted && r.value !== null
        ).length;
        return recCount > 0;
      });
      const datasetTemplates = templates.filter((t) => t.source_type === 'DATASET' && t.id !== 'tpl-system-menu');
      const seenCategories = new Set<string>();
      let mIdx = 1;
      const dynamicItems: { num: number; label: string; category: string; type: 'dataset' | 'service'; response?: string }[] = [];

      allPublishedDs.forEach((ds) => {
        const cat = ds.category || ds.name;
        const lower = cat.trim().toLowerCase();
        if (!seenCategories.has(lower)) {
          seenCategories.add(lower);
          const tpl = datasetTemplates.find(
            (t) => (t.category && t.category.trim().toLowerCase() === lower) || t.keyword.trim().toLowerCase() === lower
          );
          dynamicItems.push({
            num: mIdx++,
            label: cat,
            category: cat,
            type: 'dataset',
            response: tpl?.response,
          });
        }
      });

      const s1Num = mIdx++;
      dynamicItems.push({
        num: s1Num,
        label: 'Apa saja layanan BPS?',
        category: 'Layanan',
        type: 'service',
        response:
          `🏛️ *LAYANAN RESMI BPS KABUPATEN BANGKA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n1. Pelayanan Statistik Terpadu (PST) & Konsultasi\n2. Rekomendasi Kegiatan Statistik (Romantik)\n3. Permintaan Data Mikro dan Publikasi Statistik Resmi\n4. Layanan Pengaduan & Informasi Publik\n\n_Ketik *petugas* untuk berbicara dengan admin PST._`,
      });

      const s2Num = mIdx++;
      dynamicItems.push({
        num: s2Num,
        label: 'Hubungi Petugas PST BPS',
        category: 'Kontak',
        type: 'service',
        response:
          `🏛️ *LAYANAN KONSULTASI STATISTIK TERPADU (PST)*\n*BPS Kabupaten Bangka*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🏢 *Alamat:* Jl. Ahmad Yani Jalur Dua Sungailiat\n⏰ *Jam Layanan:* Senin – Jumat (08.00 – 15.30 WIB)\n📞 *WhatsApp PST:* https://wa.me/6281234567890\n✉️ *Email:* bps1901@bps.go.id\n🌐 *Portal:* bangkakab.bps.go.id`,
      });

      const customMenuTpl = templates.find(
        (t) => t.id === 'tpl-system-menu' || t.keyword.trim().toLowerCase() === 'menu utama'
      );

      const dynamicMenuStr =
        customMenuTpl?.response ||
        (`📋 *MENU UTAMA LAYANAN DATA SAPA BPS*\n🏛️ *BPS KABUPATEN BANGKA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Silakan pilih topik informasi statistik resmi BPS Kab. Bangka berikut:\n\n` +
        dynamicItems.map((it) => `${it.num}. *${it.label}*`).join('\n') +
        `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 _Balas dengan angka *1* - *${s2Num}*, atau ketik kata kunci pertanyaan langsung._`);

      let reply = '';

      // 1. Jika pengguna sedang berada di dalam Sub-menu pemilihan dataset rinci
      if (simSubmenu) {
        if (['menu', 'batal', 'kembali', 'exit', 'keluar', 'p'].includes(clean)) {
          setSimSubmenu(null);
          reply = dynamicMenuStr;
        } else if (/^\d+$/.test(clean)) {
          const subNum = parseInt(clean, 10);
          if (subNum >= 1 && subNum <= simSubmenu.datasets.length) {
            const chosen = simSubmenu.datasets[subNum - 1];
            setSimSubmenu(null);
            const foundTpl = templates.find((t) => t.dataset_id === chosen.id || t.keyword.toLowerCase() === chosen.name.toLowerCase());
            reply = foundTpl ? foundTpl.response : chosen.response || `📊 *DATA: ${chosen.name}* (${chosen.code})`;
          } else {
            reply =
              `⚠️ Pilihan nomor *${subNum}* tidak tersedia.\n\n` +
              `Silakan balas dengan angka *1* - *${simSubmenu.datasets.length}*, atau ketik *menu* untuk kembali ke Menu Utama.`;
          }
        } else {
          setSimSubmenu(null);
        }
      }

      // 2. Jika tidak dalam submenu
      if (!reply) {
        if (clean === 'menu' || clean === 'menu utama' || clean === 'bantuan' || clean === 'help') {
          reply = dynamicMenuStr;
        } else if (/^\d+$/.test(clean)) {
          const num = parseInt(clean, 10);
          const item = dynamicItems.find((d) => d.num === num);
          if (item) {
            if (item.type === 'service') {
              reply = item.response || '';
            } else {
              // Cek apakah ada lebih dari 1 dataset dalam kategori ini
              const catLower = item.category.trim().toLowerCase();
              const matchedDatasets = allPublishedDs.filter((d) => {
                const dCat = (d.category || '').trim().toLowerCase();
                return dCat === catLower;
              });

              if (matchedDatasets.length > 1) {
                const subDs = matchedDatasets.map((d) => {
                  const tpl = datasetTemplates.find((t) => t.dataset_id === d.id);
                  return {
                    id: d.id,
                    name: d.name,
                    code: d.code,
                    response: tpl?.response,
                  };
                });
                setSimSubmenu({ category: item.label, datasets: subDs });
                const lines = subDs.map((d, i) => `${i + 1}. *${d.name}* (${d.code})`);
                reply =
                  `📊 *PILIHAN DATASET: ${item.label.toUpperCase()}*\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `Terdapat *${subDs.length} dataset statistik resmi* dalam kategori ini. Silakan balas dengan nomor dataset yang ingin Anda lihat lebih rinci:\n\n` +
                  lines.join('\n') +
                  `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `💡 _Balas dengan angka *1* - *${subDs.length}*, atau ketik *menu* untuk kembali ke Menu Utama._`;
              } else {
                const singleDs = matchedDatasets[0];
                const tpl = singleDs ? datasetTemplates.find((t) => t.dataset_id === singleDs.id) : null;
                reply = tpl?.response || item.response || '';
              }
            }
          } else {
            reply = `Maaf, pilihan nomor *${num}* belum tersedia.\n\n${dynamicMenuStr}`;
          }
        } else if (clean === 'menu' || clean === 'sapa' || clean === 'halo' || clean === 'p') {
          reply = dynamicMenuStr;
        } else {
          // Cek apakah kata kunci mengetik nama kategori yang memiliki > 1 dataset
          const matchedCategoryDs: Dataset[] = allPublishedDs.filter(
            (d: Dataset) => (d.category && d.category.trim().toLowerCase() === clean) || clean.includes((d.category || '').toLowerCase())
          );
          const uniqueCats: string[] = Array.from(new Set(matchedCategoryDs.map((d: Dataset) => d.category)));
          if (uniqueCats.length === 1 && matchedCategoryDs.length > 1) {
            const catName = uniqueCats[0];
            const subDs = matchedCategoryDs.map((d: Dataset) => {
              const tpl = datasetTemplates.find((t) => t.dataset_id === d.id);
              return {
                id: d.id,
                name: d.name,
                code: d.code,
                response: tpl?.response,
              };
            });
            setSimSubmenu({ category: catName, datasets: subDs });
            const lines = subDs.map((d, i: number) => `${i + 1}. *${d.name}* (${d.code})`);
            reply =
              `📊 *PILIHAN DATASET: ${catName.toUpperCase()}*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Terdapat *${subDs.length} dataset statistik resmi* dalam kategori ini. Silakan balas dengan nomor dataset yang ingin Anda lihat lebih rinci:\n\n` +
              lines.join('\n') +
              `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `💡 _Balas dengan angka *1* - *${subDs.length}*, atau ketik *menu* untuk kembali ke Menu Utama._`;
          } else {
            let matched = templates.find((t) => t.keyword.toLowerCase() === clean);
            if (!matched) {
              matched = templates.find(
                (t) => clean.includes(t.keyword.toLowerCase()) || t.keyword.toLowerCase().includes(clean)
              );
            }

            if (matched) {
              reply = matched.response;
            } else {
              reply =
                `Mohon maaf, kata kunci *"${text}"* belum terdaftar dalam template cepat kami.\n\n` +
                `💡 _Ketik *menu* untuk melihat daftar topik data resmi BPS Kab. Bangka, atau ketik *petugas* untuk konsultasi PST._`;
            }
          }
        }
      }

      setSimMessages((prev) => [...prev, { sender: 'bot', text: reply, time: timeStr }]);
      setIsBotTyping(false);
    }, 450);
  };

  if (isLoading || !isAuthenticated) return null;

  const isOffline = backendState.hasCheckedInitial && !backendState.isConnected;

  if (isOffline) {
    return (
      <AppLayout>
        <Header
          title="Template Chatbot & Kata Kunci"
          subtitle="Kelola kata kunci pemicu serta respons otomatis bot WhatsApp SAPA BPS"
        />
        <div className="page-content" style={{ padding: '24px 16px' }}>
          <ServerOfflineState
            title="Server Backend Sedang Offline"
            message="Data kata kunci dan template balasan otomatis chatbot tidak dapat ditampilkan karena server backend tidak aktif atau offline, dan database saat ini masih menggunakan penyimpanan lokal."
            hint="Silakan pastikan layanan server backend telah diaktifkan agar daftar kata kunci dan template WhatsApp dapat disinkronkan dan diuji coba."
            isRetrying={isRetrying}
            onRetry={async () => {
              setIsRetrying(true);
              try {
                const live = await syncWithBackend();
                if (live) {
                  setTemplates(ChatbotTemplateRepo.getAll());
                  setToast({ msg: 'Server backend berhasil terhubung!', type: 'success' });
                } else {
                  setToast({ msg: 'Server backend masih offline.', type: 'error' });
                }
              } finally {
                setIsRetrying(false);
              }
            }}
          />
        </div>
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

  return (
    <AppLayout>
      <Header
        title="Template Chatbot & Kata Kunci"
        subtitle="Kelola kata kunci pemicu serta respons otomatis bot WhatsApp SAPA BPS"
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => handleOpenModal()}
          >
            Tambah Kata Kunci Manual
          </Button>
        }
      />

      <div className="page-content" style={{ maxWidth: 1320 }}>
        {/* Modern Stats Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <Card className="p-0 border-slate-200">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium m-0">
                  Total Template Aktif
                </p>
                <h3 className="text-2xl font-bold mt-1 mb-0 text-slate-900">
                  {templates.length} Keyword
                </h3>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <MessageSquare size={20} />
              </div>
            </CardContent>
          </Card>

          <Card className="p-0 border-slate-200">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium m-0">
                  Dari Dataset Resmi BPS
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <h3 className="text-xl font-bold m-0 text-sky-700">
                    {datasetCount} Template
                  </h3>
                  <Badge variant="secondary" className="text-[10px] font-semibold bg-sky-100 text-sky-700">
                    Preview Only
                  </Badge>
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <FileSpreadsheet size={20} />
              </div>
            </CardContent>
          </Card>

          <Card className="p-0 border-slate-200">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium m-0">
                  Template Kustom / Manual
                </p>
                <h3 className="text-2xl font-bold mt-1 mb-0 text-slate-900">
                  {manualCount} Template
                </h3>
              </div>
              <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <Edit2 size={18} />
              </div>
            </CardContent>
          </Card>

          <Card className="p-0 border-slate-200">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium m-0">
                  Status WhatsApp Bot
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`w-2 h-2 rounded-full inline-block ${botStatus.state === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  />
                  <h3 className="text-sm font-semibold m-0 text-slate-900">
                    {botStatus.state === 'connected' ? 'Aktif Terhubung' : 'Standby / QR'}
                  </h3>
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Bot size={20} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 2 Columns: Template List & Live WhatsApp Simulator */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.45fr) minmax(350px, 1fr)',
            gap: 24,
            alignItems: 'start',
          }}
          className="chatbot-layout-grid"
        >
          {/* Left Column: Template List */}
          <div>
            <div className="section" style={{ marginBottom: 0 }}>
              <div className="section-header" style={{ flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 className="section-title">
                    <Hash size={18} style={{ color: 'var(--primary-600)' }} />
                    Daftar Kata Kunci & Template Balasan
                  </h2>
                  <p className="section-subtitle">
                    Kategorisasi keyword pemicu chat. Template dari dataset resmi terlindungi dan dapat di-preview.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => handleOpenModal()}
                >
                  Tambah Template
                </Button>
              </div>

              <div className="section-body" style={{ padding: '16px 20px' }}>
                {/* Source Filter Tabs */}
                <div style={{ marginBottom: 16 }}>
                  <Tabs
                    value={selectedSource}
                    onValueChange={(v) => setSelectedSource(v as 'ALL' | 'DATASET' | 'MANUAL')}
                  >
                    <TabsList className="h-9">
                      <TabsTrigger value="ALL" className="text-xs">
                        Semua ({templates.length})
                      </TabsTrigger>
                      <TabsTrigger value="DATASET" className="text-xs flex items-center gap-1.5">
                        <Lock size={12} /> Dari Dataset Resmi ({datasetCount})
                      </TabsTrigger>
                      <TabsTrigger value="MANUAL" className="text-xs flex items-center gap-1.5">
                        <Edit2 size={12} /> Template Manual ({manualCount})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Search Bar & Category Filter */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                    <Search
                      size={15}
                      style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)', zIndex: 1 }}
                    />
                    <Input
                      type="text"
                      placeholder="Cari kata kunci atau isi template chat..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>

                  <div className="select-wrapper" style={{ minWidth: 200 }}>
                    <select
                      className="select-input"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      style={{ height: 38, fontSize: 13 }}
                    >
                      <option value="ALL">Semua Topik ({templates.length})</option>
                      {categories
                        .filter((cat) => cat !== 'ALL')
                        .map((cat) => {
                          const count = templates.filter((t) => getCleanCategory(t.category) === cat).length;
                          return (
                            <option key={cat} value={cat}>
                              {cat} ({count})
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>

                {/* Templates List */}
                {filteredTemplates.length === 0 ? (
                  <EmptyState
                    title="Tidak Ada Template Chatbot"
                    description={search ? `Tidak ada template yang cocok dengan "${search}".` : 'Belum ada kata kunci pada filter ini.'}
                    actions={
                      <Button variant="primary" size="sm" onClick={() => handleOpenModal()}>
                        Tambah Template Manual
                      </Button>
                    }
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {filteredTemplates.map((tpl) => {
                      const isFromDataset = tpl.source_type === 'DATASET';

                      return (
                        <div
                          key={tpl.id}
                          style={{
                            background: '#ffffff',
                            border: isFromDataset ? '1.5px solid #bae6fd' : '1px solid var(--slate-200)',
                            borderRadius: 'var(--radius-xl)',
                            padding: '18px 20px',
                            boxShadow: 'var(--shadow-subtle)',
                            transition: 'border-color 150ms, box-shadow 150ms',
                          }}
                        >
                          {/* Header of each Card */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: 'var(--slate-900)',
                                    background: isFromDataset ? '#f0f9ff' : 'var(--slate-100)',
                                    padding: '3px 10px',
                                    borderRadius: 'var(--radius-md)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  💬 &quot;{tpl.keyword}&quot;
                                </span>

                                {/* Source Badge */}
                                {isFromDataset ? (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: '#0369a1',
                                      background: '#e0f2fe',
                                      border: '1px solid #7dd3fc',
                                      padding: '2px 8px',
                                      borderRadius: 999,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <Lock size={11} /> Dari Dataset Resmi (Hanya Preview)
                                  </span>
                                ) : tpl.id === 'tpl-system-menu' ? (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: '#047857',
                                      background: '#ecfdf5',
                                      border: '1px solid #a7f3d0',
                                      padding: '2px 8px',
                                      borderRadius: 999,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <Edit2 size={11} /> Menu Utama (Dapat Diedit)
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: '#475569',
                                      background: '#f1f5f9',
                                      padding: '2px 8px',
                                      borderRadius: 999,
                                    }}
                                  >
                                    ✏️ Template Manual
                                  </span>
                                )}

                                {tpl.category && (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 500,
                                      color: 'var(--slate-600)',
                                      background: 'var(--slate-50)',
                                      padding: '2px 8px',
                                      borderRadius: 999,
                                      border: '1px solid var(--slate-200)',
                                    }}
                                  >
                                    {getCleanCategory(tpl.category)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => handleSimSend(tpl.keyword)}
                                title="Uji coba balasan di Simulator"
                                style={{
                                  padding: '5px 10px',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: 'var(--primary-700)',
                                  background: 'var(--primary-50)',
                                  border: '1px solid var(--primary-200)',
                                  borderRadius: 'var(--radius-md)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Sparkles size={13} /> Coba di Simulator
                              </button>

                              {isFromDataset ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewTemplate(tpl)}
                                    title="Lihat Preview Lengkap"
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      color: '#0369a1',
                                      background: '#f0f9ff',
                                      border: '1px solid #bae6fd',
                                      borderRadius: 'var(--radius-md)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <Eye size={13} /> Preview
                                  </button>
                                  {tpl.dataset_id && (
                                    <Link href={`/datasets/${tpl.dataset_id}`}>
                                      <button
                                        type="button"
                                        title="Buka Halaman Dataset Asli"
                                        style={{
                                          padding: '5px 8px',
                                          color: 'var(--slate-600)',
                                          background: 'transparent',
                                          border: 'none',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                        }}
                                      >
                                        <ExternalLink size={14} />
                                      </button>
                                    </Link>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewTemplate(tpl)}
                                    title="Lihat Preview Lengkap"
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      color: '#0369a1',
                                      background: '#f0f9ff',
                                      border: '1px solid #bae6fd',
                                      borderRadius: 'var(--radius-md)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <Eye size={13} /> Preview
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenModal(tpl)}
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      color: '#0f766e',
                                      background: '#f0fdfa',
                                      border: '1px solid #99f6e4',
                                      borderRadius: 'var(--radius-md)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                    title={tpl.id === 'tpl-system-menu' ? 'Ubah Teks Menu Utama' : 'Edit Template Manual'}
                                  >
                                    <Edit2 size={13} /> Ubah
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTemplate(tpl)}
                                    style={{
                                      padding: '5px 8px',
                                      color: 'var(--error-text)',
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                    title={tpl.id === 'tpl-system-menu' ? 'Reset ke Menu Default' : 'Hapus Template'}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Message Content Preview Box */}
                          <div
                            style={{
                              background: isFromDataset ? '#f8fafc' : '#fcfcfd',
                              border: '1px solid var(--slate-150)',
                              borderRadius: 'var(--radius-lg)',
                              padding: '12px 16px',
                              fontSize: 12.5,
                              color: 'var(--slate-700)',
                              whiteSpace: 'pre-wrap',
                              maxHeight: 120,
                              overflowY: 'auto',
                              lineHeight: 1.5,
                            }}
                          >
                            {tpl.response}
                          </div>

                          {/* Footer Info */}
                          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--slate-400)' }}>
                            <span>
                              {isFromDataset
                                ? '🔒 Template otomatis tersinkronisasi dari pangkalan data BPS.'
                                : tpl.id === 'tpl-system-menu'
                                ? '✏️ Template Menu Utama dapat diedit dan disesuaikan secara bebas.'
                                : '✏️ Template kustom buatan operator.'}
                            </span>
                            <span>{tpl.updated_at ? `Diperbarui: ${tpl.updated_at.slice(0, 10)}` : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: WhatsApp Live Simulator */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid var(--slate-200)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                height: 620,
              }}
            >
              {/* WhatsApp Simulator Header */}
              <div
                style={{
                  background: '#075e54',
                  color: '#ffffff',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: '#128c7e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                  }}
                >
                  🤖
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
                    SAPA BPS Kab. Bangka
                  </h4>
                  <span style={{ fontSize: 11, color: '#a7f3d0' }}>
                    {isBotTyping ? 'sedang mengetik...' : 'online (Asisten Statistik)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSimMessages([
                      {
                        sender: 'bot',
                        text: 'Halo! Selamat datang di layanan *SAPA BPS Kab. Bangka* 😊\n\nKetik kata kunci data statistik (contoh: *penduduk*, *kemiskinan*, *ipm*, atau *menu*) untuk mencoba balasan.',
                        time: '08:00',
                      },
                    ])
                  }
                  style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', opacity: 0.8 }}
                  title="Reset Obrolan Simulator"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* Chat Body (WhatsApp look) */}
              <div
                style={{
                  flex: 1,
                  background: '#efeae2',
                  padding: '14px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ textAlign: 'center', margin: '4px 0' }}>
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.85)',
                      padding: '3px 10px',
                      borderRadius: 6,
                      fontSize: 10.5,
                      color: '#54656f',
                      boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
                    }}
                  >
                    Simulator Chatbot WhatsApp SAPA BPS
                  </span>
                </div>

                {simMessages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      background: msg.sender === 'user' ? '#d9fdd3' : '#ffffff',
                      borderRadius: msg.sender === 'user' ? '8px 0px 8px 8px' : '0px 8px 8px 8px',
                      padding: '8px 12px',
                      boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                      fontSize: 12.5,
                      lineHeight: 1.45,
                      color: '#111b21',
                      wordBreak: 'break-word',
                    }}
                  >
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                    <div
                      style={{
                        textAlign: 'right',
                        fontSize: 10,
                        color: '#667781',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 3,
                      }}
                    >
                      {msg.time}
                      {msg.sender === 'user' && <CheckCheck size={12} color="#53bdeb" />}
                    </div>
                  </div>
                ))}

                {isBotTyping && (
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      background: '#ffffff',
                      borderRadius: '0px 8px 8px 8px',
                      padding: '8px 14px',
                      fontSize: 11.5,
                      color: '#667781',
                      fontStyle: 'italic',
                    }}
                  >
                    Bot sedang merangkai data...
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div
                style={{
                  background: '#f0f2f5',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  placeholder="Ketik kata kunci untuk menguji..."
                  value={simInput}
                  onChange={(e) => setSimInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSimSend();
                  }}
                  style={{
                    flex: 1,
                    background: '#ffffff',
                    border: '1px solid #d1d7db',
                    borderRadius: 20,
                    padding: '8px 14px',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSimSend()}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#00a884',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Kirim Pesan"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Add / Edit Template (MANUAL ONLY) */}
      <Dialog open={isModalOpen} onOpenChange={(open) => setIsModalOpen(open)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingTemplate ? 'Edit Template Chatbot' : 'Tambah Kata Kunci & Template Balasan'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Template kustom buatan operator yang dapat disesuaikan isinya
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTemplate} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block" htmlFor="kw">
                Kata Kunci Pemicu (Trigger Keyword)<span className="text-red-500 ml-0.5">*</span>
              </label>
              <Input
                id="kw"
                type="text"
                required
                placeholder="Contoh: Jadwal Rilis BPS, Konsultasi Statistik, Kontak PST"
                value={formKeyword}
                onChange={(e) => setFormKeyword(e.target.value)}
                autoFocus
              />
              <p className="text-[11px] text-slate-500 mt-1">Jika pengguna WhatsApp mengetik kalimat ini, bot akan langsung membalas dengan template di bawah.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block" htmlFor="cat">
                Kategori / Topik
              </label>
              <Input
                id="cat"
                type="text"
                list="category-suggestions"
                placeholder="Pilih atau ketik kategori baru (contoh: Layanan & Kontak, Ekonomi Makro)"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              />
              <datalist id="category-suggestions">
                {categories.filter((c) => c !== 'ALL').map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <div className="flex gap-1.5 flex-wrap mt-2">
                {['Layanan & Kontak', 'Ekonomi Makro', 'Sosial & Kependudukan', 'Indikator Makro', 'Informasi Umum'].map((quickCat) => (
                  <button
                    key={quickCat}
                    type="button"
                    onClick={() => setFormCategory(quickCat)}
                    className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors cursor-pointer ${
                      formCategory === quickCat
                        ? 'bg-blue-50 border-blue-600 text-blue-700 font-medium'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {quickCat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700" htmlFor="resp">
                  Isi Pesan Balasan WhatsApp (Template)<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setFormResponse((prev) => prev + '*Teks Tebal*')}
                    className="text-[11px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200 cursor-pointer font-bold"
                  >
                    *B*
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormResponse((prev) => prev + '_Teks Miring_')}
                    className="text-[11px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200 cursor-pointer italic"
                  >
                    _I_
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormResponse((prev) => prev + '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')}
                    className="text-[11px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200 cursor-pointer text-slate-600"
                  >
                    Garis
                  </button>
                </div>
              </div>
              <Textarea
                id="resp"
                required
                rows={6}
                placeholder="Tuliskan isi pesan balasan resmi..."
                value={formResponse}
                onChange={(e) => setFormResponse(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 mt-1">Mendukung format WhatsApp: *tebal*, _miring_, dan emoji.</p>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" loading={isSaving} icon={<Sparkles size={14} />}>
                Simpan Template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Preview Read-Only (FOR DATASET TEMPLATES) */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}>
        <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
          {previewTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Lock size={18} />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-slate-900">
                      Preview Template Dataset Resmi
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                      Keyword: <strong className="text-slate-800">&quot;{previewTemplate.keyword}&quot;</strong>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Read-Only Banner */}
              <div className="bg-sky-50 border border-sky-200 rounded-md p-3 text-[12.5px] text-sky-800 leading-relaxed my-2">
                🔒 <strong>Template ini tidak dapat diedit secara manual</strong> karena datanya dihasilkan otomatis secara dinamis dari Katalog Dataset BPS. Jika ingin memperbarui angka atau rinciannya, perbarui data melalui menu <strong>Katalog Dataset</strong>.
              </div>

              {/* Formatted Preview Box */}
              <div className="bg-[#efeae2] rounded-xl p-4 my-2">
                <div className="bg-white rounded-tr-lg rounded-br-lg rounded-bl-lg p-3 text-[13px] leading-relaxed text-[#111b21] shadow-xs whitespace-pre-wrap">
                  {previewTemplate.response}
                </div>
              </div>

              {/* Modal Actions */}
              <DialogFooter className="flex-row justify-between items-center sm:justify-between pt-2">
                {previewTemplate.dataset_id ? (
                  <Link href={`/datasets/${previewTemplate.dataset_id}`}>
                    <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
                      Buka Dataset Asli
                    </Button>
                  </Link>
                ) : <div />}

                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Sparkles size={14} />}
                    onClick={() => {
                      handleSimSend(previewTemplate.keyword);
                      setPreviewTemplate(null);
                    }}
                  >
                    Uji di Simulator WhatsApp
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(null)}>
                    Tutup
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
