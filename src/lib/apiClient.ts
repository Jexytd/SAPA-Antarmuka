// ============================================================
// SAPA BPS 1901 IN — Backend API Client Integration
// ============================================================

import {
  Dataset,
  DataRecord,
  ReviewRequest,
  AuditLog,
  User,
  Category,
  DashboardSummary,
} from './types';

export interface BotErrorStatus {
  code?: number | string;
  title: string;
  message: string;
  rawMessage?: string;
  timestamp: string;
  suggestedAction?: string;
}

export interface BotStatusData {
  state: 'connecting' | 'connected' | 'qr_ready' | 'scanning' | 'disconnected';
  qr: string | null;
  phoneNumber?: string;
  connectedAt?: string;
  qrUpdatedAt?: number;
  qrExpiresAt?: number;
  qrLifetimeMs?: number;
  isScanning?: boolean;
  scanDetectedAt?: string;
  scanMessage?: string;
  lastError?: BotErrorStatus | null;
  mode?: 'ACTIVE' | 'SUSPENDED';
  serverTime?: string;
}

// ============================================================
// Konfigurasi Terpusat Base URL Backend WhatsApp & REST API
// ============================================================

// URL Endpoint Backend Service diambil murni dari Environment Variable:
// 1. NEXT_PUBLIC_API_URL (standar Next.js untuk client-side browser di Vercel/Hosting)
// 2. NEXT_PUBLIC_BACKEND_URL
// 3. BACKEND_URL
const RAW_API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  ''
).replace(/\/$/, '');

const BASE_URL = RAW_API_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

export function getEffectiveBackendUrl(): string {
  if (BASE_URL) return BASE_URL;
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

async function safeFetch<T>(url: string, options?: RequestInit & { timeoutMs?: number }): Promise<T | null> {
  const { timeoutMs = 6000, ...fetchOptions } = options || {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  // Pastikan URL terbentuk secara valid:
  // 1. Jika url sudah diawali 'http://' atau 'https://', gunakan langsung
  // 2. Jika url berupa path relatif (misal '/api/datasets'), sambungkan dengan BASE_URL jika tersedia
  let fullUrl: string;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    fullUrl = url;
  } else {
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    fullUrl = BASE_URL ? `${BASE_URL}${cleanPath}` : cleanPath;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(fullUrl, {
      cache: 'no-store',
      signal: fetchOptions.signal || controller.signal,
      ...fetchOptions,
      headers,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      return json?.data !== undefined ? json.data : json;
    }

    console.warn(`[API] HTTP ${res.status} pada ${fullUrl}`);
    return null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[API Network Error] Gagal menghubungi backend di ${fullUrl}:`, err);
    return null;
  }
}

export const BackendApi = {
  // Datasets
  async getDatasets(): Promise<Dataset[] | null> {
    return safeFetch<Dataset[]>(`${BASE_URL}/api/datasets`);
  },

  async getDatasetById(id: string): Promise<Dataset | null> {
    return safeFetch<Dataset>(`${BASE_URL}/api/datasets/${id}`);
  },

  async createDataset(dataset: Partial<Dataset>): Promise<Dataset | null> {
    return safeFetch<Dataset>(`${BASE_URL}/api/datasets`, {
      method: 'POST',
      body: JSON.stringify(dataset),
    });
  },

  async updateDataset(id: string, dataset: Partial<Dataset>): Promise<Dataset | null> {
    return safeFetch<Dataset>(`${BASE_URL}/api/datasets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dataset),
    });
  },

  async deleteDataset(id: string): Promise<boolean> {
    const res = await safeFetch<{ success: boolean }>(`${BASE_URL}/api/datasets/${id}`, {
      method: 'DELETE',
    });
    return !!res?.success;
  },

  // Records
  async getRecords(datasetId?: string): Promise<DataRecord[] | null> {
    const q = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    return safeFetch<DataRecord[]>(`${BASE_URL}/api/records${q}`);
  },

  async getRecordById(id: string): Promise<DataRecord | null> {
    return safeFetch<DataRecord>(`${BASE_URL}/api/records/${id}`);
  },

  async createRecord(record: Partial<DataRecord>): Promise<DataRecord | null> {
    return safeFetch<DataRecord>(`${BASE_URL}/api/records`, {
      method: 'POST',
      body: JSON.stringify(record),
    });
  },

  async updateRecord(id: string, record: Partial<DataRecord>): Promise<DataRecord | null> {
    return safeFetch<DataRecord>(`${BASE_URL}/api/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    });
  },

  async deleteRecord(id: string): Promise<boolean> {
    const res = await safeFetch<{ success: boolean }>(`${BASE_URL}/api/records/${id}`, {
      method: 'DELETE',
    });
    return !!res?.success;
  },

  async bulkSaveRecords(datasetId: string, records: Partial<DataRecord>[]): Promise<DataRecord[] | null> {
    return safeFetch<DataRecord[]>(`${BASE_URL}/api/records/bulk`, {
      method: 'POST',
      body: JSON.stringify({ dataset_id: datasetId, records }),
    });
  },

  // Reviews
  async getReviews(): Promise<ReviewRequest[] | null> {
    return safeFetch<ReviewRequest[]>(`${BASE_URL}/api/reviews`);
  },

  async getReviewById(id: string): Promise<ReviewRequest | null> {
    return safeFetch<ReviewRequest>(`${BASE_URL}/api/reviews/${id}`);
  },

  async submitReview(data: {
    dataset_id: string;
    dataset_name?: string;
    record_ids?: string[];
    description?: string;
    submitted_by?: string;
  }): Promise<ReviewRequest | null> {
    return safeFetch<ReviewRequest>(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async approveReview(id: string, reviewerId?: string): Promise<ReviewRequest | null> {
    return safeFetch<ReviewRequest>(`${BASE_URL}/api/reviews/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewer_id: reviewerId }),
    });
  },

  async rejectReview(id: string, reviewerId?: string, reason?: string): Promise<ReviewRequest | null> {
    return safeFetch<ReviewRequest>(`${BASE_URL}/api/reviews/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reviewer_id: reviewerId, reason }),
    });
  },

  async deleteReview(id: string): Promise<boolean> {
    const res = await safeFetch<{ success: boolean }>(`${BASE_URL}/api/reviews/${id}`, {
      method: 'DELETE',
    });
    return !!res?.success;
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[] | null> {
    return safeFetch<AuditLog[]>(`${BASE_URL}/api/audit-logs`);
  },

  async logAudit(log: Partial<AuditLog>): Promise<AuditLog | null> {
    return safeFetch<AuditLog>(`${BASE_URL}/api/audit-logs`, {
      method: 'POST',
      body: JSON.stringify(log),
    });
  },

  async clearAuditLogs(id?: string): Promise<boolean> {
    const q = id ? `?id=${encodeURIComponent(id)}` : '';
    const res = await safeFetch<{ success: boolean }>(`${BASE_URL}/api/audit-logs${q}`, {
      method: 'DELETE',
    });
    return !!res?.success;
  },

  // Users & Categories & Summary
  async getUsers(): Promise<User[] | null> {
    return safeFetch<User[]>(`${BASE_URL}/api/users`);
  },

  async getUserById(id: string): Promise<User | null> {
    return safeFetch<User>(`${BASE_URL}/api/users/${id}`);
  },

  async createUser(user: Partial<User>): Promise<User | null> {
    return safeFetch<User>(`${BASE_URL}/api/users`, {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  async updateUser(id: string, user: Partial<User>): Promise<User | null> {
    return safeFetch<User>(`${BASE_URL}/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  },

  async deleteUser(id: string): Promise<boolean> {
    const res = await safeFetch<{ success: boolean }>(`${BASE_URL}/api/users/${id}`, {
      method: 'DELETE',
    });
    return !!res?.success;
  },

  async getCategories(): Promise<Category[] | null> {
    return safeFetch<Category[]>(`${BASE_URL}/api/categories`);
  },

  async getCategoryById(id: string): Promise<Category | null> {
    return safeFetch<Category>(`${BASE_URL}/api/categories/${id}`);
  },

  async createCategory(category: Partial<Category>): Promise<Category | null> {
    return safeFetch<Category>(`${BASE_URL}/api/categories`, {
      method: 'POST',
      body: JSON.stringify(category),
    });
  },

  async updateCategory(id: string, category: Partial<Category>): Promise<Category | null> {
    return safeFetch<Category>(`${BASE_URL}/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(category),
    });
  },

  async deleteCategory(id: string): Promise<boolean> {
    const res = await safeFetch<{ success: boolean }>(`${BASE_URL}/api/categories/${id}`, {
      method: 'DELETE',
    });
    return !!res?.success;
  },

  async getStoreSnapshot(): Promise<{
    datasets: Dataset[];
    records: DataRecord[];
    categories: Category[];
    users: User[];
    reviews: ReviewRequest[];
    auditLogs: AuditLog[];
  } | null> {
    return safeFetch<{
      datasets: Dataset[];
      records: DataRecord[];
      categories: Category[];
      users: User[];
      reviews: ReviewRequest[];
      auditLogs: AuditLog[];
    }>(`${BASE_URL}/api/sync/store`);
  },

  async syncStore(snapshot: {
    datasets?: Dataset[];
    records?: DataRecord[];
    categories?: Category[];
    users?: User[];
    reviews?: ReviewRequest[];
    auditLogs?: AuditLog[];
    deleted_dataset_ids?: string[];
    deleted_record_ids?: string[];
  }): Promise<{
    datasets: Dataset[];
    records: DataRecord[];
    categories: Category[];
    users: User[];
    reviews: ReviewRequest[];
    auditLogs: AuditLog[];
  } | null> {
    return safeFetch<{
      datasets: Dataset[];
      records: DataRecord[];
      categories: Category[];
      users: User[];
      reviews: ReviewRequest[];
      auditLogs: AuditLog[];
    }>(`${BASE_URL}/api/sync/store`, {
      method: 'POST',
      body: JSON.stringify(snapshot),
    });
  },

  async getDashboardSummary(): Promise<DashboardSummary | null> {
    return safeFetch<DashboardSummary>(`${BASE_URL}/api/dashboard/summary`);
  },

  // Health Check & Diagnostics
  async getHealth(): Promise<{
    status: string;
    service: string;
    port: string;
    timestamp: string;
    uptime: number;
    botState: string;
    phoneNumber: string | null;
  } | null> {
    return safeFetch<{
      status: string;
      service: string;
      port: string;
      timestamp: string;
      uptime: number;
      botState: string;
      phoneNumber: string | null;
    }>(`${BASE_URL}/health?_t=${Date.now()}`, { cache: 'no-store' });
  },

  // Bot Status & Chat Integration
  async getBotStatus(): Promise<BotStatusData | null> {
    return safeFetch<BotStatusData>(`${BASE_URL}/api/bot/status?_t=${Date.now()}`, { cache: 'no-store' });
  },

  async refreshBotQR(reason?: string): Promise<{ success: boolean; message: string; data?: BotStatusData } | null> {
    return safeFetch<{ success: boolean; message: string; data?: BotStatusData }>(`${BASE_URL}/api/bot/refresh-qr`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Manual refresh dari antarmuka web' }),
    });
  },

  async resetBotSession(): Promise<{ success: boolean; message: string } | null> {
    return safeFetch<{ success: boolean; message: string }>(`${BASE_URL}/api/bot/reset`, {
      method: 'POST',
    });
  },

  async logoutBot(): Promise<{ success: boolean; message: string } | null> {
    return safeFetch<{ success: boolean; message: string }>(`${BASE_URL}/api/bot/logout`, {
      method: 'POST',
    });
  },

  async requestPairingCode(phone: string): Promise<{ success: boolean; code?: string; message?: string } | null> {
    return safeFetch<{ success: boolean; code?: string; message?: string }>(`${BASE_URL}/api/bot/pairing-code`, {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  async sendChatMessage(message: string): Promise<{ response: string } | null> {
    return safeFetch<{ response: string }>(`${BASE_URL}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async getFaqs(): Promise<Array<{ pertanyaan: string; jawaban: string }> | null> {
    return safeFetch<Array<{ pertanyaan: string; jawaban: string }>>(`${BASE_URL}/api/faqs`);
  },

  async saveFaq(pertanyaan: string, jawaban: string, old_pertanyaan?: string): Promise<{ status: string; message: string } | null> {
    return safeFetch<{ status: string; message: string }>(`${BASE_URL}/api/faqs/save`, {
      method: 'POST',
      body: JSON.stringify({ pertanyaan, jawaban, old_pertanyaan }),
    });
  },

  async deleteFaq(pertanyaan: string): Promise<{ status: string; message: string } | null> {
    return safeFetch<{ status: string; message: string }>(`${BASE_URL}/api/faqs/delete`, {
      method: 'POST',
      body: JSON.stringify({ pertanyaan }),
    });
  }
};
