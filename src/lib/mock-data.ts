// ============================================================
// SAPA BPS 1901 IN — Mock / Seed Data
// ============================================================
// DEMO / SAMPLE DATA — Bukan data resmi BPS
// ============================================================

import {
  Dataset,
  DataRecord,
  DataStatus,
  PeriodType,
  User,
  UserRole,
  Category,
  ReviewRequest,
  AuditLog,
  AuditAction,
} from './types';

// --- Categories ---

export const CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Jumlah Penduduk', code: 'POP', description: 'Data kependudukan dan demografi' },
  { id: 'cat-2', name: 'Data Kemiskinan', code: 'POV', description: 'Data kemiskinan dan kesejahteraan' },
  { id: 'cat-3', name: 'Pertumbuhan Ekonomi', code: 'GROWTH', description: 'Data pertumbuhan ekonomi regional' },
  { id: 'cat-4', name: 'Indeks Pembangunan Manusia (IPM)', code: 'HDI', description: 'Indeks pembangunan manusia' },
  { id: 'cat-5', name: 'Tenaga Kerja', code: 'LABOR', description: 'Data ketenagakerjaan dan pengangguran' },
  { id: 'cat-6', name: 'Produk Domestik Regional Bruto (PDRB)', code: 'GRDP', description: 'Data produk domestik regional bruto' },
  { id: 'cat-7', name: 'Indeks Pembangunan Gender (IPG)', code: 'GDI', description: 'Indeks pembangunan gender' },
  { id: 'cat-8', name: 'Angka Partisipasi Sekolah', code: 'EDU', description: 'Data partisipasi pendidikan' },
];

// --- Users ---

export const MOCK_USERS: User[] = [
  {
    id: 'user-1',
    name: 'Ahmad Fauzi',
    email: 'ahmad.fauzi@bps.go.id',
    role: UserRole.DATA_ENTRY,
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    name: 'Siti Nurhaliza',
    email: 'siti.nurhaliza@bps.go.id',
    role: UserRole.REVIEWER,
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'user-3',
    name: 'Budi Santoso',
    email: 'budi.santoso@bps.go.id',
    role: UserRole.DATA_ENTRY,
    created_at: '2025-03-15T00:00:00Z',
  },
];

// --- Review Requests ---

export const MOCK_REVIEWS: ReviewRequest[] = [
  {
    id: 'rev-1',
    dataset_id: 'ds-5',
    dataset_name: 'Tingkat Pengangguran Terbuka Kabupaten Bangka',
    record_ids: ['rec-labor-2021', 'rec-labor-2022', 'rec-labor-2023', 'rec-labor-2024'],
    description: 'Penambahan data tingkat pengangguran terbuka tahun 2021–2024',
    submitted_by: 'user-3',
    submitted_by_name: 'Budi Santoso',
    submitted_at: '2026-08-20T10:00:00Z',
    status: 'PENDING',
  },
];

// --- Audit Logs ---

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    entity_type: 'dataset',
    entity_id: 'ds-1',
    entity_name: 'Jumlah Penduduk Kabupaten Bangka',
    action: AuditAction.CREATE,
    changes: [],
    user_id: 'user-1',
    user_name: 'Ahmad Fauzi',
    created_at: '2026-06-01T08:00:00Z',
  },
  {
    id: 'log-2',
    entity_type: 'record',
    entity_id: 'rec-pop-2025',
    entity_name: 'Jumlah Penduduk 2025',
    action: AuditAction.CREATE,
    changes: [
      { field: 'value', old_value: null, new_value: 320500 },
    ],
    user_id: 'user-1',
    user_name: 'Ahmad Fauzi',
    created_at: '2026-09-01T08:00:00Z',
  },
  {
    id: 'log-3',
    entity_type: 'dataset',
    entity_id: 'ds-1',
    entity_name: 'Jumlah Penduduk Kabupaten Bangka',
    action: AuditAction.PUBLISH,
    changes: [
      { field: 'status', old_value: 'REVIEW', new_value: 'PUBLISHED' },
    ],
    user_id: 'user-2',
    user_name: 'Siti Nurhaliza',
    created_at: '2026-09-01T09:00:00Z',
  },
  {
    id: 'log-4',
    entity_type: 'record',
    entity_id: 'rec-pov-2025',
    entity_name: 'Persentase Penduduk Miskin 2025',
    action: AuditAction.UPDATE,
    changes: [
      { field: 'value', old_value: 4.35, new_value: 4.28 },
    ],
    user_id: 'user-1',
    user_name: 'Ahmad Fauzi',
    reason: 'Revisi data resmi BPS',
    created_at: '2026-08-30T14:00:00Z',
  },
  {
    id: 'log-5',
    entity_type: 'dataset',
    entity_id: 'ds-5',
    entity_name: 'Tingkat Pengangguran Terbuka Kabupaten Bangka',
    action: AuditAction.SUBMIT_REVIEW,
    changes: [
      { field: 'status', old_value: 'DRAFT', new_value: 'REVIEW' },
    ],
    user_id: 'user-3',
    user_name: 'Budi Santoso',
    created_at: '2026-08-20T10:00:00Z',
  },
];
