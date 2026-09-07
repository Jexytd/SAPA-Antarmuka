// ============================================================
// SAPA BPS 1901 IN — Customer Service Ticket API Client
// ============================================================

import {
  Ticket,
  TicketMessage,
  TicketEvent,
  TicketDetailResponse,
  CsAdmin,
  CsSettings,
  TicketQueryParams,
} from './ticketTypes';

export const RAW_API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://localhost:8000'
).replace(/\/$/, '');

const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

export class TicketConflictError extends Error {
  statusCode: number;
  constructor(message = 'Tiket ini baru saja diambil oleh petugas admin lain.') {
    super(message);
    this.name = 'TicketConflictError';
    this.statusCode = 409;
  }
}

// Default Fallback Data (Kosong / Tanpa data dummy)
const INITIAL_MOCK_ADMINS: CsAdmin[] = [];
const INITIAL_MOCK_TICKETS: Ticket[] = [];
const INITIAL_MOCK_MESSAGES: Record<string, TicketMessage[]> = {};
const INITIAL_MOCK_EVENTS: Record<string, TicketEvent[]> = {};

// In-Memory Storage
export const DEFAULT_CS_TEMPLATES = {
  template_waiting: '🎫 *Tiket Bantuan Customer Service Dibuat*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNomor Tiket: *#{ticket_number}*\nStatus: *Menunggu Petugas (WAITING)*\n\nPermintaan Anda telah kami terima. Petugas Customer Service BPS Kab. Bangka akan segera bergabung dalam obrolan ini.\n\n_Ketik #selesai kapan saja jika Anda ingin membatalkan dan kembali ke asisten bot otomatis._',
  template_assigned: '💬 *Customer Service Terhubung*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCustomer Service *{admin_name}* telah mengambil tiket Anda (*#{ticket_number}*) dan siap melayani.\n\nSilakan sampaikan pertanyaan atau kendala Anda secara rinci.',
  template_pending: '⏳ *Status Tiket Ditunda (PENDING)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTiket *#{ticket_number}* saat ini berstatus PENDING.\n{reason}\n\nPetugas kami sedang menindaklanjuti permintaan Anda. Mohon ditunggu.',
  template_resolved: '✅ *Konsultasi Selesai (Tiket #{ticket_number})*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCustomer Service telah menandai percakapan ini selesai.\n\nTerima kasih telah berkonsultasi dengan Layanan PST BPS Kab. Bangka. Layanan asisten bot otomatis kini telah aktif kembali. Silakan ketik *menu* jika membutuhkan informasi lainnya.',
  template_closed: '🔒 *Percakapan Ditutup*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nPercakapan untuk Tiket *#{ticket_number}* telah ditutup.\n\nTerima kasih telah menghubungi Layanan BPS Kab. Bangka. Asisten bot otomatis kini telah aktif kembali. Silakan ketik *menu* jika ingin memulai interaksi baru.',
  template_admin_message: '{message}',
};

let mockTickets: Ticket[] = [];
let mockMessages: Record<string, TicketMessage[]> = {};
let mockEvents: Record<string, TicketEvent[]> = {};
let mockAdmins: CsAdmin[] = [];
let mockSettings: CsSettings = {
  autoCloseMinutes: 15,
  soundEnabled: true,
  desktopNotification: true,
  greetingTemplate: 'Halo, saya {adminName} dari Pelayanan Statistik Terpadu (PST) BPS Kabupaten Bangka. Ada yang dapat kami bantu?',
  awayMessage: 'Mohon maaf, saat ini layanan CS di luar jam operasional. Silakan tinggalkan pesan atau gunakan menu bot otomatis.',
  ...DEFAULT_CS_TEMPLATES,
};

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; total?: number; error?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  let fullUrl: string;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    fullUrl = endpoint;
  } else {
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    fullUrl = `${RAW_API_URL}${cleanPath}`;
  }

  console.log(`[TicketApi] Requesting: ${options.method || 'GET'} ${fullUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(fullUrl, {
      cache: 'no-store',
      signal: options.signal || controller.signal,
      ...options,
      headers,
    });
    clearTimeout(timeoutId);

    if (res.status === 409) {
      const errJson = await res.json().catch(() => ({}));
      const errDetail = errJson.error || errJson.message || 'Maaf, tiket ini baru saja diambil oleh petugas admin lain.';
      console.warn(`[TicketApi] 409 Conflict pada ${fullUrl}:`, errDetail);
      throw new TicketConflictError(errDetail);
    }

    if (res.ok) {
      const json = await res.json();
      return json;
    }

    const errJson = await res.json().catch(() => ({}));
    const errMsg = errJson.error || errJson.message || `HTTP ${res.status}`;
    console.error(`[TicketApi] HTTP ${res.status} pada ${fullUrl}:`, errMsg, errJson);
    return { success: false, error: errMsg };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof TicketConflictError) {
      throw err;
    }
    console.error(`[TicketApi] Network/fetch fail pada ${fullUrl}:`, err?.message || err);
    // Network fail or server down -> mark as offline
    return { success: false, error: 'OFFLINE_FALLBACK' };
  }
}

/**
 * Pastikan adminId yang dikirim adalah ID valid di tabel database CS admins (misal 'admin-bps-1')
 */
export function sanitizeAdminId(adminId?: string): string {
  if (!adminId || adminId === 'user-1' || adminId === 'admin-1' || adminId.startsWith('user-')) {
    return 'admin-bps-1';
  }
  return adminId;
}

// ============================================================
// Data Normalizer Functions (Backend Snake_case -> Frontend CamelCase)
// ============================================================

export function normalizeTicket(raw: any): Ticket {
  if (!raw) return raw;
  return {
    id: String(raw.id || ''),
    ticketNumber: String(raw.ticket_number || raw.ticketNumber || raw.id || ''),
    customerPhone: String(raw.user_phone || raw.customerPhone || raw.phone || ''),
    customerName: String(raw.user_name || raw.customerName || raw.name || 'Pengguna'),
    status: (raw.status || 'WAITING') as any,
    adminId: raw.assigned_to || raw.adminId || null,
    adminName: raw.admin_name || raw.adminName || null,
    priority: (raw.priority || 'NORMAL') as any,
    unreadCount: Number(raw.unread_admin_count ?? raw.unreadCount ?? 0),
    lastMessage: raw.last_message || raw.lastMessage || undefined,
    lastMessageAt: raw.last_message_at || raw.lastMessageAt || raw.updated_at || raw.updatedAt || undefined,
    pendingReason: raw.pending_reason || raw.pendingReason || undefined,
    resolveNotes: raw.resolve_notes || raw.resolveNotes || undefined,
    closeReason: raw.close_reason || raw.closeReason || undefined,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updated_at || raw.updatedAt || new Date().toISOString(),
  };
}

export function normalizeMessage(raw: any): TicketMessage {
  if (!raw) return raw;
  return {
    id: String(raw.id || ''),
    ticketId: String(raw.ticket_id || raw.ticketId || ''),
    senderType: (raw.sender_type || raw.senderType || 'SYSTEM') as any,
    senderId: raw.sender_id || raw.senderId || undefined,
    senderName: raw.sender_name || raw.senderName || undefined,
    message: String(raw.message ?? raw.content ?? ''),
    messageType: (raw.message_type || raw.messageType || 'TEXT') as any,
    mediaUrl: raw.media_url || raw.mediaUrl || undefined,
    isRead: Boolean(raw.is_read ?? raw.isRead ?? false),
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
  };
}

export function normalizeEvent(raw: any): TicketEvent {
  if (!raw) return raw;
  let notes = raw.notes;
  if (!notes && raw.metadata) {
    notes = typeof raw.metadata === 'string' ? raw.metadata : (raw.metadata.reason || raw.metadata.notes);
  }
  return {
    id: String(raw.id || ''),
    ticketId: String(raw.ticket_id || raw.ticketId || ''),
    eventType: (raw.action || raw.eventType || 'STATUS_CHANGE') as any,
    actorType: (raw.actor_type || raw.actorType || 'SYSTEM') as any,
    actorId: raw.actor_id || raw.actorId || undefined,
    actorName: raw.actor_name || raw.actorName || undefined,
    notes: notes || undefined,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
  };
}

export function normalizeAdmin(raw: any): CsAdmin {
  if (!raw) return raw;
  return {
    id: String(raw.id || ''),
    name: String(raw.name || raw.username || 'Petugas CS'),
    email: raw.email || undefined,
    role: raw.role || undefined,
    isOnline: Boolean(raw.is_active ?? raw.isOnline ?? true),
    activeTicketCount: raw.active_ticket_count ?? raw.activeTicketCount ?? 0,
    avatarUrl: raw.avatar_url || raw.avatarUrl || undefined,
  };
}

export const ticketApi = {
  /**
   * 1. GET /api/tickets
   */
  async getTickets(params?: TicketQueryParams): Promise<{ total: number; data: Ticket[] }> {
    const query = new URLSearchParams();
    // Hanya teruskan status jika bukan filter custom antarmuka
    if (params?.status && params.status !== 'ALL' && params.status !== 'MY_TICKETS') {
      query.set('status', params.status);
    }
    // Jangan filter adminId jika sedang di antrean WAITING atau ALL
    if (params?.adminId && params.status === 'MY_TICKETS') {
      query.set('adminId', params.adminId);
    }
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const res = await apiRequest<any[]>(`/api/tickets?${query.toString()}`);
    if (res.success && Array.isArray(res.data)) {
      let mapped = res.data.map(normalizeTicket);
      if (params?.status === 'MY_TICKETS' && params.adminId) {
        mapped = mapped.filter((t) => t.adminId === params.adminId && t.status !== 'CLOSED');
      }
      return { total: res.total ?? mapped.length, data: mapped };
    }

    // Mock Fallback
    let filtered = [...mockTickets];
    if (params?.status && params.status !== 'ALL') {
      if (params.status === 'MY_TICKETS') {
        filtered = filtered.filter((t) => t.adminId === params.adminId && t.status !== 'CLOSED');
      } else {
        filtered = filtered.filter((t) => t.status === params.status);
      }
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.customerName.toLowerCase().includes(q) ||
          t.customerPhone.includes(q) ||
          t.ticketNumber.toLowerCase().includes(q) ||
          (t.lastMessage && t.lastMessage.toLowerCase().includes(q))
      );
    }

    // Sort: WAITING first, then latest updated
    filtered.sort((a, b) => {
      if (a.status === 'WAITING' && b.status !== 'WAITING') return -1;
      if (b.status === 'WAITING' && a.status !== 'WAITING') return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return { total: filtered.length, data: filtered.map(normalizeTicket) };
  },

  /**
   * 2. GET /api/tickets/:id
   */
  async getTicketDetail(id: string): Promise<TicketDetailResponse> {
    const res = await apiRequest<any>(`/api/tickets/${id}`);
    if (res.success && res.data) {
      const rawTicket = res.data.ticket || res.data;
      const rawMessages = Array.isArray(res.data.messages) ? res.data.messages : [];
      const rawEvents = Array.isArray(res.data.events) ? res.data.events : [];
      return {
        ticket: normalizeTicket(rawTicket),
        messages: rawMessages.map(normalizeMessage),
        events: rawEvents.map(normalizeEvent),
      };
    }

    // Mock Fallback
    const ticket = mockTickets.find((t) => t.id === id);
    if (!ticket) {
      throw new Error(`Tiket dengan ID ${id} tidak ditemukan.`);
    }

    const messages = mockMessages[id] || [];
    const events = mockEvents[id] || [];

    return { ticket, messages, events };
  },

  /**
   * 3. POST /api/tickets/:id/assign
   */
  async assignTicket(
    id: string,
    adminId: string,
    assignedBy?: string
  ): Promise<{ success: boolean; ticket?: Ticket }> {
    const validAdminId = sanitizeAdminId(adminId);
    const res = await apiRequest<any>(`/api/tickets/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ adminId: validAdminId, assignedBy }),
    });

    if (res.success && res.data) {
      const rawTicket = res.data.ticket || res.data;
      return { success: true, ticket: normalizeTicket(rawTicket) };
    }

    if (res.error && res.error !== 'OFFLINE_FALLBACK') {
      throw new Error(res.error);
    }

    // Mock Fallback
    const target = mockTickets.find((t) => t.id === id);
    if (!target) throw new Error('Tiket tidak ditemukan');

    // Simulate 409 Conflict if taken by another admin
    if (target.adminId && target.adminId !== validAdminId && target.status !== 'WAITING') {
      throw new TicketConflictError(
        `Maaf, tiket #${target.ticketNumber} baru saja diambil oleh ${target.adminName || 'admin lain'}.`
      );
    }

    const admin = mockAdmins.find((a) => a.id === validAdminId) || { name: 'Admin CS' };
    target.adminId = validAdminId;
    target.adminName = admin.name;
    target.status = 'ACTIVE';
    target.updatedAt = new Date().toISOString();

    const newEvt: TicketEvent = {
      id: `evt-${Date.now()}`,
      ticketId: id,
      eventType: 'ASSIGNED',
      actorType: 'ADMIN',
      actorId: validAdminId,
      actorName: admin.name,
      notes: `Tiket diambil oleh ${admin.name}`,
      createdAt: new Date().toISOString(),
    };
    mockEvents[id] = [...(mockEvents[id] || []), newEvt];

    return { success: true, ticket: normalizeTicket(target) };
  },

  /**
   * 4. POST /api/tickets/:id/messages
   */
  async sendMessage(
    id: string,
    data: { adminId: string; message: string; messageType?: 'TEXT' | 'IMAGE' | 'DOCUMENT' }
  ): Promise<{ success: boolean; message?: TicketMessage }> {
    const validAdminId = sanitizeAdminId(data.adminId);
    const res = await apiRequest<any>(`/api/tickets/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ ...data, adminId: validAdminId }),
    });

    if (res.success && res.data) {
      const rawMsg = res.data.message || res.data;
      return { success: true, message: normalizeMessage(rawMsg) };
    }

    if (res.error && res.error !== 'OFFLINE_FALLBACK') {
      throw new Error(res.error);
    }

    // Mock Fallback
    const admin = mockAdmins.find((a) => a.id === validAdminId);
    const newMsg: TicketMessage = {
      id: `msg-${Date.now()}`,
      ticketId: id,
      senderType: 'ADMIN',
      senderId: validAdminId,
      senderName: admin?.name || 'Petugas CS',
      message: data.message,
      messageType: data.messageType || 'TEXT',
      createdAt: new Date().toISOString(),
      isRead: true,
    };

    mockMessages[id] = [...(mockMessages[id] || []), newMsg];

    const target = mockTickets.find((t) => t.id === id);
    if (target) {
      target.lastMessage = data.message;
      target.lastMessageAt = newMsg.createdAt;
      target.updatedAt = newMsg.createdAt;
      if (target.status === 'ASSIGNED') {
        target.status = 'ACTIVE';
      }
    }

    return { success: true, message: normalizeMessage(newMsg) };
  },

  /**
   * 5. POST /api/tickets/:id/pending
   */
  async pendingTicket(
    id: string,
    adminId: string,
    reason?: string
  ): Promise<{ success: boolean; ticket?: Ticket }> {
    const validAdminId = sanitizeAdminId(adminId);
    const res = await apiRequest<any>(`/api/tickets/${id}/pending`, {
      method: 'POST',
      body: JSON.stringify({ adminId: validAdminId, reason }),
    });

    if (res.success && res.data) {
      const rawTicket = res.data.ticket || res.data;
      return { success: true, ticket: normalizeTicket(rawTicket) };
    }

    if (res.error && res.error !== 'OFFLINE_FALLBACK') {
      throw new Error(res.error);
    }

    // Mock Fallback
    const target = mockTickets.find((t) => t.id === id);
    if (target) {
      target.status = 'PENDING';
      target.pendingReason = reason || 'Menunggu tindak lanjut seksi teknis';
      target.updatedAt = new Date().toISOString();

      const admin = mockAdmins.find((a) => a.id === validAdminId);
      mockEvents[id] = [
        ...(mockEvents[id] || []),
        {
          id: `evt-${Date.now()}`,
          ticketId: id,
          eventType: 'PENDING',
          actorType: 'ADMIN',
          actorId: validAdminId,
          actorName: admin?.name || 'Admin CS',
          notes: `Tiket di-pending. Alasan: ${target.pendingReason}`,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return { success: true, ticket: normalizeTicket(target) };
  },

  /**
   * 6. POST /api/tickets/:id/resolve
   */
  async resolveTicket(
    id: string,
    adminId: string,
    notes?: string
  ): Promise<{ success: boolean; ticket?: Ticket }> {
    const validAdminId = sanitizeAdminId(adminId);
    const res = await apiRequest<any>(`/api/tickets/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ adminId: validAdminId, notes }),
    });

    if (res.success && res.data) {
      const rawTicket = res.data.ticket || res.data;
      return { success: true, ticket: normalizeTicket(rawTicket) };
    }

    if (res.error && res.error !== 'OFFLINE_FALLBACK') {
      throw new Error(res.error);
    }

    // Mock Fallback
    const target = mockTickets.find((t) => t.id === id);
    if (target) {
      target.status = 'RESOLVED';
      target.resolveNotes = notes || 'Pertanyaan telah terjawab secara tuntas.';
      target.updatedAt = new Date().toISOString();

      const admin = mockAdmins.find((a) => a.id === validAdminId);
      mockEvents[id] = [
        ...(mockEvents[id] || []),
        {
          id: `evt-${Date.now()}`,
          ticketId: id,
          eventType: 'RESOLVED',
          actorType: 'ADMIN',
          actorId: validAdminId,
          actorName: admin?.name || 'Admin CS',
          notes: `Tiket ditandai selesai. Catatan: ${target.resolveNotes}`,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return { success: true, ticket: normalizeTicket(target) };
  },

  /**
   * 7. POST /api/tickets/:id/close
   */
  async closeTicket(
    id: string,
    closedById: string,
    closeReason?: string
  ): Promise<{ success: boolean; ticket?: Ticket }> {
    const validAdminId = sanitizeAdminId(closedById);
    const res = await apiRequest<any>(`/api/tickets/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({
        closedByType: 'ADMIN',
        closedById: validAdminId,
        closeReason,
      }),
    });

    if (res.success && res.data) {
      const rawTicket = res.data.ticket || res.data;
      return { success: true, ticket: normalizeTicket(rawTicket) };
    }

    if (res.error && res.error !== 'OFFLINE_FALLBACK') {
      throw new Error(res.error);
    }

    // Mock Fallback
    const target = mockTickets.find((t) => t.id === id);
    if (target) {
      target.status = 'CLOSED';
      target.closeReason = closeReason || 'Percakapan ditutup oleh CS.';
      target.updatedAt = new Date().toISOString();

      const admin = mockAdmins.find((a) => a.id === validAdminId);
      mockEvents[id] = [
        ...(mockEvents[id] || []),
        {
          id: `evt-${Date.now()}`,
          ticketId: id,
          eventType: 'CLOSED',
          actorType: 'ADMIN',
          actorId: validAdminId,
          actorName: admin?.name || 'Admin CS',
          notes: `Tiket ditutup permanen. Mode bot otomatis kembali aktif.`,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return { success: true, ticket: normalizeTicket(target) };
  },

  /**
   * 8. POST /api/tickets/:id/release
   */
  async releaseTicket(
    id: string,
    adminId: string,
    reason?: string
  ): Promise<{ success: boolean; ticket?: Ticket }> {
    const validAdminId = sanitizeAdminId(adminId);
    const res = await apiRequest<any>(`/api/tickets/${id}/release`, {
      method: 'POST',
      body: JSON.stringify({ adminId: validAdminId, reason }),
    });

    if (res.success && res.data) {
      const rawTicket = res.data.ticket || res.data;
      return { success: true, ticket: normalizeTicket(rawTicket) };
    }

    if (res.error && res.error !== 'OFFLINE_FALLBACK') {
      throw new Error(res.error);
    }

    // Mock Fallback
    const target = mockTickets.find((t) => t.id === id);
    if (target) {
      const prevAdmin = target.adminName;
      target.adminId = null;
      target.adminName = null;
      target.status = 'WAITING';
      target.updatedAt = new Date().toISOString();

      mockEvents[id] = [
        ...(mockEvents[id] || []),
        {
          id: `evt-${Date.now()}`,
          ticketId: id,
          eventType: 'RELEASED',
          actorType: 'ADMIN',
          actorId: validAdminId,
          notes: `Tiket dilepaskan oleh ${prevAdmin || 'CS'} kembali ke antrean Waiting. Alasan: ${reason || 'Perlu penanganan admin lain'}`,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return { success: true, ticket: normalizeTicket(target) };
  },

  /**
   * 9. POST /api/tickets/:id/transfer
   */
  async transferTicket(
    id: string,
    fromAdminId: string,
    toAdminId: string,
    reason?: string
  ): Promise<{ success: boolean; ticket?: Ticket }> {
    const validFromId = sanitizeAdminId(fromAdminId);
    const validToId = toAdminId || 'admin-bps-2';
    const res = await apiRequest<any>(`/api/tickets/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ fromAdminId: validFromId, toAdminId: validToId, reason }),
    });

    if (res.success && res.data) {
      const rawTicket = res.data.ticket || res.data;
      return { success: true, ticket: normalizeTicket(rawTicket) };
    }

    if (res.error && res.error !== 'OFFLINE_FALLBACK') {
      throw new Error(res.error);
    }

    // Mock Fallback
    const target = mockTickets.find((t) => t.id === id);
    const toAdmin = mockAdmins.find((a) => a.id === toAdminId);
    const fromAdmin = mockAdmins.find((a) => a.id === fromAdminId);

    if (target && toAdmin) {
      target.adminId = toAdminId;
      target.adminName = toAdmin.name;
      target.updatedAt = new Date().toISOString();

      mockEvents[id] = [
        ...(mockEvents[id] || []),
        {
          id: `evt-${Date.now()}`,
          ticketId: id,
          eventType: 'TRANSFERRED',
          actorType: 'ADMIN',
          actorId: fromAdminId,
          actorName: fromAdmin?.name,
          notes: `Tiket dialihkan ke ${toAdmin.name}. Alasan: ${reason || 'Eskalasi ke spesialis data'}`,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return { success: true, ticket: normalizeTicket(target) };
  },

  /**
   * 10. POST /api/tickets/:id/read
   */
  async markAsRead(id: string): Promise<{ success: boolean }> {
    const res = await apiRequest<{ success: boolean }>(`/api/tickets/${id}/read`, {
      method: 'POST',
      body: JSON.stringify({ reader: 'ADMIN' }),
    });

    if (res.success) return { success: true };

    // Mock Fallback
    const target = mockTickets.find((t) => t.id === id);
    if (target) {
      target.unreadCount = 0;
    }
    const msgs = mockMessages[id];
    if (msgs) {
      msgs.forEach((m) => {
        if (m.senderType === 'USER') m.isRead = true;
      });
    }

    return { success: true };
  },

  /**
   * 11. GET /api/cs/admins
   */
  async getAdmins(): Promise<CsAdmin[]> {
    const res = await apiRequest<any[]>('/api/cs/admins');
    if (res.success && Array.isArray(res.data)) {
      return res.data.map(normalizeAdmin);
    }
    return mockAdmins;
  },

  /**
   * 12. GET & PUT /api/cs/settings
   */
  async getSettings(): Promise<CsSettings> {
    const res = await apiRequest<any>('/api/cs/settings');
    if (res.success && res.data) {
      const d = res.data;
      return {
        autoCloseMinutes: Number(d.auto_close_inactive_minutes || d.autoCloseMinutes || 15),
        soundEnabled: d.soundEnabled ?? true,
        desktopNotification: d.desktopNotification ?? true,
        greetingTemplate: d.greetingTemplate || 'Halo, saya {adminName} dari Pelayanan Statistik Terpadu (PST) BPS Kabupaten Bangka. Ada yang dapat kami bantu?',
        awayMessage: d.awayMessage || undefined,
      };
    }
    return mockSettings;
  },

  async updateSettings(settings: Partial<CsSettings>): Promise<CsSettings> {
    const payload: Record<string, any> = { ...settings };
    if (settings.autoCloseMinutes !== undefined) {
      payload.auto_close_inactive_minutes = String(settings.autoCloseMinutes);
    }
    const res = await apiRequest<any>('/api/cs/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: payload, ...payload }),
    });
    if (res.success && res.data) {
      const d = res.data;
      return {
        autoCloseMinutes: Number(d.auto_close_inactive_minutes || d.autoCloseMinutes || 15),
        soundEnabled: d.soundEnabled !== undefined ? String(d.soundEnabled) === 'true' : true,
        desktopNotification: d.desktopNotification !== undefined ? String(d.desktopNotification) === 'true' : true,
        greetingTemplate: d.greetingTemplate || 'Halo, saya {adminName} dari Pelayanan Statistik Terpadu (PST) BPS Kabupaten Bangka. Ada yang dapat kami bantu?',
        awayMessage: d.awayMessage || undefined,
      };
    }
    mockSettings = { ...mockSettings, ...settings };
    return mockSettings;
  },

  /**
   * Helper to simulate an incoming message from user (useful for testing & demo)
   */
  simulateIncomingUserMessage(ticketId: string, text: string): TicketMessage {
    const newMsg: TicketMessage = {
      id: `msg-${Date.now()}`,
      ticketId,
      senderType: 'USER',
      message: text,
      messageType: 'TEXT',
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    mockMessages[ticketId] = [...(mockMessages[ticketId] || []), newMsg];
    const target = mockTickets.find((t) => t.id === ticketId);
    if (target) {
      target.lastMessage = text;
      target.lastMessageAt = newMsg.createdAt;
      target.updatedAt = newMsg.createdAt;
      target.unreadCount = (target.unreadCount || 0) + 1;
    }
    return newMsg;
  },
};
