// ============================================================
// SAPA BPS 1901 IN — Customer Service Ticket List (Panel Kiri 30%)
// ============================================================

import React from 'react';
import {
  Ticket,
  TicketFilterTab,
  TICKET_STATUS_CONFIG,
} from '@/lib/ticketTypes';
import { RealtimeStatus } from '@/lib/useCsRealtime';
import {
  Search,
  Volume2,
  VolumeX,
  Settings,
  User,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { cn, formatTime } from '@/lib/utils';

interface CsTicketListProps {
  tickets: Ticket[];
  selectedTicketId: string | null;
  onSelectTicket: (ticket: Ticket) => void;
  activeTab: TicketFilterTab;
  onTabChange: (tab: TicketFilterTab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  realtimeStatus: RealtimeStatus;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  currentAdminId?: string;
  isLoading?: boolean;
}

export function CsTicketList({
  tickets,
  selectedTicketId,
  onSelectTicket,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  realtimeStatus,
  soundEnabled,
  onToggleSound,
  onOpenSettings,
  currentAdminId,
  isLoading,
}: CsTicketListProps) {
  // Counts by filter
  const waitingCount = tickets.filter((t) => t.status === 'WAITING').length;
  const myTicketsCount = currentAdminId
    ? tickets.filter((t) => t.adminId === currentAdminId && t.status !== 'CLOSED').length
    : 0;
  const activeCount = tickets.filter(
    (t) => t.status === 'ACTIVE' || t.status === 'ASSIGNED'
  ).length;
  const pendingCount = tickets.filter((t) => t.status === 'PENDING').length;
  const resolvedCount = tickets.filter((t) => t.status === 'RESOLVED').length;
  const closedCount = tickets.filter((t) => t.status === 'CLOSED').length;
  const totalCount = tickets.length;

  const tabs: { key: TicketFilterTab; label: string; count: number; alert?: boolean }[] = [
    { key: 'WAITING', label: 'Waiting', count: waitingCount, alert: waitingCount > 0 },
    { key: 'MY_TICKETS', label: 'Tiket Saya', count: myTicketsCount },
    { key: 'ACTIVE', label: 'Active', count: activeCount },
    { key: 'PENDING', label: 'Pending', count: pendingCount },
    { key: 'RESOLVED', label: 'Resolved', count: resolvedCount },
    { key: 'CLOSED', label: 'Closed', count: closedCount },
    { key: 'ALL', label: 'Semua', count: totalCount },
  ];

  // Helper formatting relative time
  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Baru saja';
      if (mins < 60) return `${mins}m lalu`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}j lalu`;
      return formatTime(isoString);
    } catch {
      return '';
    }
  };

  return (
    <div className="cs-panel-left">
      {/* Header Panel Kiri */}
      <div className="cs-left-header">
        <div className="cs-left-title-row">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <Inbox size={18} className="text-blue-600" />
              Inbox Percakapan
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Realtime Indicator */}
            {realtimeStatus === 'CONNECTED' ? (
              <span className="cs-status-indicator cs-status-online" title="Realtime WebSocket Aktif">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : realtimeStatus === 'RECONNECTING' || realtimeStatus === 'CONNECTING' ? (
              <span className="cs-status-indicator cs-status-reconnecting" title="Mencoba Menghubungkan Kembali...">
                <RefreshCw size={11} className="animate-spin" />
                Sync
              </span>
            ) : realtimeStatus === 'FALLBACK_SSE' ? (
              <span className="cs-status-indicator cs-status-online" title="Realtime Menggunakan SSE Stream">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                SSE
              </span>
            ) : (
              <span className="cs-status-indicator cs-status-offline" title="Mode Offline (Sinkronisasi Standalone)">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Offline
              </span>
            )}

            {/* Audio Notification Toggle */}
            <button
              onClick={onToggleSound}
              className={cn(
                'p-1.5 rounded-lg border transition-colors',
                soundEnabled
                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'border-slate-200 bg-slate-100 text-slate-400 hover:text-slate-600'
              )}
              title={soundEnabled ? 'Notifikasi Suara Aktif (Klik untuk mute)' : 'Notifikasi Suara Dimatikan (Klik untuk aktifkan)'}
              type="button"
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            {/* CS Settings Modal trigger */}
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              title="Pengaturan Customer Service"
              type="button"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>

        {/* Search Bar Input */}
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
            placeholder="Cari nama, no HP, atau tiket..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              type="button"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Tabs Scrollable List */}
        <div
          className="cs-tabs-list"
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={cn('cs-tab-pill', isActive && 'cs-tab-pill-active')}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'cs-badge-count',
                    isActive
                      ? 'cs-badge-count-active'
                      : tab.alert
                      ? 'cs-badge-count-waiting'
                      : 'bg-slate-200 text-slate-700'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ticket Cards List Scrollable */}
      <div className="cs-ticket-list-scroll">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw size={20} className="animate-spin text-blue-500" />
            <span>Memuat daftar tiket...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2 h-48">
            <Inbox size={32} className="text-slate-300" />
            <p className="font-semibold text-slate-700">Tidak ada tiket</p>
            <p className="text-slate-400 max-w-[200px]">
              {searchQuery
                ? `Tidak ada tiket yang cocok dengan "${searchQuery}"`
                : 'Tidak ada tiket pada kategori filter ini saat ini.'}
            </p>
          </div>
        ) : (
          tickets.map((ticket) => {
            const isSelected = selectedTicketId === ticket.id;
            const statusConfig = TICKET_STATUS_CONFIG[ticket.status];
            const borderClass =
              ticket.status === 'WAITING'
                ? 'cs-ticket-card-waiting'
                : ticket.status === 'PENDING'
                ? 'cs-ticket-card-pending'
                : ticket.status === 'RESOLVED'
                ? 'cs-ticket-card-resolved'
                : ticket.status === 'CLOSED'
                ? 'cs-ticket-card-closed'
                : 'cs-ticket-card-active';

            return (
              <div
                key={ticket.id}
                onClick={() => onSelectTicket(ticket)}
                className={cn(
                  'cs-ticket-card',
                  borderClass,
                  isSelected && 'cs-ticket-card-selected'
                )}
              >
                {/* Baris Atas: Nomor Tiket & Waktu */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 tracking-tight">
                      #{ticket.ticketNumber}
                    </span>
                    {ticket.status === 'WAITING' && (
                      <span className="badge-waiting-pulse">
                        <span className="dot-waiting-pulse" />
                        Waiting
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400 font-medium">
                    {getRelativeTime(ticket.lastMessageAt || ticket.updatedAt)}
                  </span>
                </div>

                {/* Nama Kontak WhatsApp & Nomor HP */}
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-800 truncate">
                    {ticket.customerName || 'Pengguna WhatsApp'}
                  </div>

                  {ticket.unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white font-bold text-[10px] leading-none animate-pulse">
                      {ticket.unreadCount} baru
                    </span>
                  )}
                </div>

                {/* Preview Cuplikan Pesan Terakhir */}
                <p className="text-[11.5px] text-slate-500 line-clamp-2 leading-relaxed">
                  {ticket.lastMessage || 'Tidak ada riwayat pesan.'}
                </p>

                {/* Baris Bawah: Petugas CS & Status Badge */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1 truncate">
                    <User size={12} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate">
                      {ticket.adminName ? ticket.adminName : 'Belum Ditugaskan'}
                    </span>
                  </div>

                  {ticket.status !== 'WAITING' && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                        statusConfig.bgClass,
                        statusConfig.textClass,
                        statusConfig.borderClass
                      )}
                    >
                      {statusConfig.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
