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

// --- Datasets ---

export const MOCK_DATASETS: Dataset[] = [
];

// --- Data Records ---

export const MOCK_RECORDS: DataRecord[] = [
];

// --- Review Requests ---

export const MOCK_REVIEWS: ReviewRequest[] = [
];

// --- Audit Logs ---

export const MOCK_AUDIT_LOGS: AuditLog[] = [
];
