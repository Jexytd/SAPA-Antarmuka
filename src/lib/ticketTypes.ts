// ============================================================
// SAPA BPS 1901 IN — Customer Service Ticketing Type Definitions
// ============================================================

export type TicketStatus =
  | 'WAITING'
  | 'ASSIGNED'
  | 'ACTIVE'
  | 'PENDING'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketMessageType = 'TEXT' | 'IMAGE' | 'DOCUMENT';

export type TicketSenderType = 'USER' | 'ADMIN' | 'SYSTEM';

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderType: TicketSenderType;
  senderId?: string;
  senderName?: string;
  message: string;
  messageType: TicketMessageType;
  mediaUrl?: string;
  isRead?: boolean;
  createdAt: string; // ISO 8601
}

export interface TicketEvent {
  id: string;
  ticketId: string;
  eventType:
    | 'CREATED'
    | 'ASSIGNED'
    | 'STATUS_CHANGE'
    | 'PENDING'
    | 'RESOLVED'
    | 'CLOSED'
    | 'RELEASED'
    | 'TRANSFERRED'
    | 'MESSAGE';
  actorType: TicketSenderType;
  actorId?: string;
  actorName?: string;
  notes?: string;
  createdAt: string; // ISO 8601
}

export interface Ticket {
  id: string;
  ticketNumber: string; // e.g. "TK-001" or "TK-2026-0042"
  customerPhone: string; // e.g. "081234567890" or "6281234567890"
  customerName: string; // e.g. "Budi Santoso"
  status: TicketStatus;
  adminId?: string | null;
  adminName?: string | null;
  priority?: TicketPriority;
  unreadCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
  pendingReason?: string;
  resolveNotes?: string;
  closeReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CsAdmin {
  id: string;
  name: string;
  email?: string;
  role?: string;
  isOnline?: boolean;
  activeTicketCount?: number;
  avatarUrl?: string;
}

export interface CsSettings {
  autoCloseMinutes: number;
  soundEnabled: boolean;
  desktopNotification: boolean;
  greetingTemplate: string;
  awayMessage?: string;
  max_assigned_tickets_per_admin?: number;
  resolved_grace_period_minutes?: number;
  template_waiting?: string;
  template_assigned?: string;
  template_pending?: string;
  template_resolved?: string;
  template_closed?: string;
  template_admin_message?: string;
}

export type TicketFilterTab =
  | 'WAITING'
  | 'MY_TICKETS'
  | 'ACTIVE'
  | 'PENDING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'ALL';

export interface TicketQueryParams {
  status?: string;
  adminId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TicketDetailResponse {
  ticket: Ticket;
  messages: TicketMessage[];
  events: TicketEvent[];
}

export interface RealtimeTicketEvent {
  event:
    | 'ticket.created'
    | 'ticket.assigned'
    | 'ticket.message'
    | 'ticket.status_changed'
    | 'ticket.closed'
    | 'ticket.released'
    | 'ticket.transferred'
    | 'connection.ack';
  ticket?: Ticket;
  ticketId?: string;
  message?: TicketMessage;
  adminId?: string;
  adminName?: string;
  status?: TicketStatus;
  reason?: string;
  timestamp?: string;
  data?: any;
}

export const TICKET_STATUS_CONFIG: Record<
  TicketStatus,
  {
    label: string;
    description: string;
    badgeClass: string;
    dotClass: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
  }
> = {
  WAITING: {
    label: 'Menunggu CS',
    description: 'Tiket baru dari pengguna, belum diambil oleh petugas CS',
    badgeClass: 'badge-waiting-pulse',
    dotClass: 'dot-waiting-pulse',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-400/40',
  },
  ASSIGNED: {
    label: 'Ditugaskan',
    description: 'Tiket telah diambil oleh petugas CS, sedang dipersiapkan',
    badgeClass: 'badge-assigned',
    dotClass: 'dot-assigned',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-400/40',
  },
  ACTIVE: {
    label: 'Sedang Berjalan',
    description: 'Percakapan aktif interaktif antara CS dan pengguna WhatsApp',
    badgeClass: 'badge-active',
    dotClass: 'dot-active',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-400/40',
  },
  PENDING: {
    label: 'Tertunda (Pending)',
    description: 'Menunggu data tambahan dari seksi teknis atau balasan user',
    badgeClass: 'badge-pending',
    dotClass: 'dot-pending',
    bgClass: 'bg-yellow-500/10',
    textClass: 'text-yellow-800 dark:text-yellow-300',
    borderClass: 'border-yellow-400/40',
  },
  RESOLVED: {
    label: 'Selesai Diselesaikan',
    description: 'Permintaan data atau pertanyaan telah dijawab tuntas',
    badgeClass: 'badge-resolved',
    dotClass: 'dot-resolved',
    bgClass: 'bg-teal-500/10',
    textClass: 'text-teal-700 dark:text-teal-300',
    borderClass: 'border-teal-400/40',
  },
  CLOSED: {
    label: 'Ditutup (Bot Aktif)',
    description: 'Tiket ditutup permanen, mode nomor kembali otomatis ke bot AI',
    badgeClass: 'badge-closed',
    dotClass: 'dot-closed',
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-600 dark:text-slate-400',
    borderClass: 'border-slate-300/40',
  },
};
