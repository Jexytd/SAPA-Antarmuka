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

const RAW_API_URL = (
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

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
      throw new TicketConflictError(
        errJson.message || 'Maaf, tiket ini baru saja diambil oleh petugas admin lain.'
      );
    }

    if (res.ok) {
      const json = await res.json();
      return json;
    }

    console.warn(`[TicketApi] HTTP ${res.status} pada ${fullUrl}`);
    return { success: false, error: `HTTP ${res.status}` };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof TicketConflictError) {
      throw err;
    }
    // Network fail or server down -> mark as offline
    return { success: false, error: 'OFFLINE_FALLBACK' };
  }
}

export const ticketApi = {
  /**
   * 1. GET /api/tickets
   */
  async getTickets(params?: TicketQueryParams): Promise<{ total: number; data: Ticket[] }> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.adminId) query.set('adminId', params.adminId);
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const res = await apiRequest<Ticket[]>(`/api/tickets?${query.toString()}`);
    if (res.success && res.data) {
      return { total: res.total ?? res.data.length, data: res.data };
    }

    // Mock Fallback
    let filtered = [...mockTickets];
    if (params?.status && params.status !== 'ALL') {
      if (params.status === 'MY_TICKETS') {
        filtered = filtered.filter((t) => t.adminId === params.adminId);
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

    return { total: filtered.length, data: filtered };
  },

  /**
   * 2. GET /api/tickets/:id
   */
  async getTicketDetail(id: string): Promise<TicketDetailResponse> {
    const res = await apiRequest<TicketDetailResponse>(`/api/tickets/${id}`);
    if (res.success && res.data) {
      return res.data;
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
    const res = await apiRequest<{ ticket: Ticket }>(`/api/tickets/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ adminId, assignedBy }),
    });

    if (res.success && res.data) {
      return { success: true, ticket: res.data.ticket };
    }

    // Mock Fallback
    const target = mockTickets.find((t) => t.id === id);
    if (!target) throw new Error('Tiket tidak ditemukan');

    // Simulate 409 Conflict if taken by another admin
    if (target.adminId && target.adminId !== adminId && target.status !== 'WAITING') {
      throw new TicketConflictError(
        `Maaf, tiket #${target.ticketNumber} baru saja diambil oleh ${target.adminName || 'admin lain'}.`
      );
    }

    const admin = mockAdmins.find((a) => a.id === adminId) || { name: 'Admin CS' };
    target.adminId = adminId;
    target.adminName = admin.name;
    target.status = 'ACTIVE';
    target.updatedAt = new Date().toISOString();

    const newEvt: TicketEvent = {
      id: `evt-${Date.now()}`,
      ticketId: id,
      eventType: 'ASSIGNED',
      actorType: 'ADMIN',
      actorId: adminId,
      actorName: admin.name,
      notes: `Tiket diambil oleh ${admin.name}`,
      createdAt: new Date().toISOString(),
    };
    mockEvents[id] = [...(mockEvents[id] || []), newEvt];

    return { success: true, ticket: target };
  },

  /**
   * 4. POST /api/tickets/:id/messages
   */
  async sendMessage(
    id: string,
    data: { adminId: string; message: string; messageType?: 'TEXT' | 'IMAGE' | 'DOCUMENT' }
  ): Promise<{ success: boolean; message?: TicketMessage }> {
    const res = await apiRequest<{ message: TicketMessage }>(`/api/tickets/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (res.success && res.data) {
      return { success: true, message: res.data.message };
    }

    // Mock Fallback
    const admin = mockAdmins.find((a) => a.id === data.adminId);
    const newMsg: TicketMessage = {
      id: `msg-${Date.now()}`,
      ticketId: id,
      senderType: 'ADMIN',
      senderId: data.adminId,
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

    return { success: true, message: newMsg };
  },

  /**
   * 5. POST /api/tickets/:id/pending
   */
  async pendingTicket(
    id: string,
    adminId: string,
    reason?: string
  ): Promise<{ success: boolean; ticket?: Ticket }> {
    const res = await apiRequest<{ ticket: Ticket }>(`/api/tickets/${id}/pending`, {
      method: 'POST',
      body: JSON.stringify({ adminId, reason }),
    });

    if (res.success && res.data) {
      return { success: true, ticket: res.data.ticket };
    }

    // Mock Fallback
    const target = mockTickets.find((t) => t.id === id);
    if (target) {
      target.status = 'PENDING';
      target.pendingReason = reason || 'Menunggu tindak lanjut seksi teknis';
      target.updatedAt = new Date().toISOString();

      const admin = mockAdmins.find((a) => a.id === adminId);
      mockEvents[id] = [
        ...(mockEvents[id] || []),
        {
          id: `evt-${Date.now()}`,
          ticketId: id,
          eventType: 'PENDING',
          actorType: 'ADMIN',
          actorId: adminId,
          actorName: admin?.name || 'Admin CS',
          notes: `Tiket di-pending. Alasan: ${target.pendingReason}`,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return { success: true, ticket: target };
  },

  /**
   * 6. POST /api/tickets/:id/resolve
   */
  async resolveTicket(
    id: string,
    adminId: string,
    notes?: string
  ): Promise<{ success: boolean; ticket?: Ticket }> {
    const res = await apiRequest<{ ticket: Ticket }>(`/api/tickets/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ adminId, notes }),
    });

    if (res.success && res.data) {
      return { success: true, ticket: res.data.ticket };
    }

    // Mock Fallback
    const target = mockTickets.find((t) => t.id === id);
    if (target) {
      target.status = 'RESOLVED';
      target.resolveNotes = notes || 'Pertanyaan telah terjawab secara tuntas.';
      target.updatedAt = new Date().toISOString();

      const admin = mockAdmins.find((a) => a.id === adminId);
      mockEvents[id] = [
        ...(mockEvents[id] || []),
        {
          id: `evt-${Date.now()}`,
          ticketId: id,
          eventType: 'RESOLVED',
          actorType: 'ADMIN',
          actorId: adminId,
          actorName: admin?.name || 'Admin CS',
          notes: `Tiket ditandai selesai. Catatan: ${target.resolveNotes}`,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return { success: true, ticket: target };
  },

  /**
   * 7. POST /api/tickets/:id/close
   */
  async closeTicket(
    id: string,
    closedById: string,
    closeReason?: string
  ): Promise<{ success: boolean; ticket?: Ticket }> {
    const res = await apiRequest<{ ticket: Ticket }>(`/api/tickets/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({
        closedByType: 'ADMIN',
        closedById,
        closeReason,
      }),
    });

    if (res.success && res.data) {
      return { success: true, ticket: res.data.ticket };
    }

    // Mock Fallback
    const target = mockTickets.find((t) => t.id === id);
    if (target) {
      target.status = 'CLOSED';
      target.closeReason = closeReason || 'Percakapan ditutup oleh CS.';
      target.updatedAt = new Date().toISOString();

      const admin = mockAdmins.find((a) => a.id === closedById);
      mockEvents[id] = [
        ...(mockEvents[id] || []),
        {
          id: `evt-${Date.now()}`,
          ticketId: id,
          eventType: 'CLOSED',
          actorType: 'ADMIN',
          actorId: closedById,
          actorName: admin?.name || 'Admin CS',
          notes: `Tiket ditutup permanen. Mode bot otomatis kembali aktif.`,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return { success: true, ticket: target };
  },

  /**
   * 8. POST /api/tickets/:id/release
   */
  async releaseTicket(
    id: string,
    adminId: string,
    reason?: string
  ): Promise<{ success: boolean; ticket?: Ticket }> {
    const res = await apiRequest<{ ticket: Ticket }>(`/api/tickets/${id}/release`, {
      method: 'POST',
      body: JSON.stringify({ adminId, reason }),
    });

    if (res.success && res.data) {
      return { success: true, ticket: res.data.ticket };
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
          actorId: adminId,
          notes: `Tiket dilepaskan oleh ${prevAdmin || 'CS'} kembali ke antrean Waiting. Alasan: ${reason || 'Perlu penanganan admin lain'}`,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return { success: true, ticket: target };
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
    const res = await apiRequest<{ ticket: Ticket }>(`/api/tickets/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ fromAdminId, toAdminId, reason }),
    });

    if (res.success && res.data) {
      return { success: true, ticket: res.data.ticket };
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

    return { success: true, ticket: target };
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
    const res = await apiRequest<CsAdmin[]>('/api/cs/admins');
    if (res.success && res.data) {
      return res.data;
    }
    return mockAdmins;
  },

  /**
   * 12. GET & PUT /api/cs/settings
   */
  async getSettings(): Promise<CsSettings> {
    const res = await apiRequest<CsSettings>('/api/cs/settings');
    if (res.success && res.data) {
      return res.data;
    }
    return mockSettings;
  },

  async updateSettings(settings: Partial<CsSettings>): Promise<CsSettings> {
    const res = await apiRequest<CsSettings>('/api/cs/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    if (res.success && res.data) {
      return res.data;
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
