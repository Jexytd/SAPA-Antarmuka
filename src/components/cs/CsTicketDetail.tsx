// ============================================================
// SAPA BPS 1901 IN — Customer Service Ticket Detail (Panel Kanan 25%)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  Ticket,
  TicketEvent,
  CsAdmin,
  TICKET_STATUS_CONFIG,
} from '@/lib/ticketTypes';
import { Button } from '@/components/ui';
import {
  User,
  Phone,
  Clock,
  UserCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRightLeft,
  ExternalLink,
  History,
  ShieldCheck,
  Info,
  Sparkles,
} from 'lucide-react';
import { cn, formatDate, formatTime } from '@/lib/utils';

interface CsTicketDetailProps {
  ticket: Ticket | null;
  events: TicketEvent[];
  admins: CsAdmin[];
  currentAdminId: string;
  onAssign: () => Promise<void>;
  onOpenPending: () => void;
  onOpenResolve: () => void;
  onOpenClose: () => void;
  onOpenRelease: () => void;
  onOpenTransfer: () => void;
  isAssigning?: boolean;
}

export function CsTicketDetail({
  ticket,
  events,
  admins,
  currentAdminId,
  onAssign,
  onOpenPending,
  onOpenResolve,
  onOpenClose,
  onOpenRelease,
  onOpenTransfer,
  isAssigning = false,
}: CsTicketDetailProps) {
  const [activeDuration, setActiveDuration] = useState<string>('');

  // Live calculation of conversation active duration
  useEffect(() => {
    if (!ticket) {
      setActiveDuration('');
      return;
    }

    const calculate = () => {
      const start = new Date(ticket.createdAt).getTime();
      const diffMs = Math.max(0, Date.now() - start);
      const totalSec = Math.floor(diffMs / 1000);
      const m = Math.floor(totalSec / 60);
      const h = Math.floor(m / 60);

      if (h > 0) {
        setActiveDuration(`${h} jam ${m % 60} menit`);
      } else {
        setActiveDuration(`${m} menit`);
      }
    };

    calculate();
    const interval = setInterval(calculate, 30000); // update every 30s
    return () => clearInterval(interval);
  }, [ticket?.createdAt, ticket?.id]);

  if (!ticket) {
    return (
      <div className="cs-panel-right flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <Info size={28} className="text-slate-300 mb-2" />
        <p className="text-xs">Detail tiket akan muncul di sini setelah tiket dipilih.</p>
      </div>
    );
  }

  const statusConfig = TICKET_STATUS_CONFIG[ticket.status];
  const isWaiting = ticket.status === 'WAITING';
  const isClosed = ticket.status === 'CLOSED';

  // Format WhatsApp clean phone for wa.me link
  const cleanPhone = ticket.customerPhone.replace(/[^0-9]/g, '');
  const waUrl = `https://wa.me/${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}`;

  return (
    <div className="cs-panel-right">
      {/* 1. Profil Pengguna WhatsApp */}
      <div className="cs-right-section">
        <div className="cs-right-section-title">
          <User size={14} className="text-blue-600" />
          <span>Informasi Pengguna</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-sm flex-shrink-0">
            {ticket.customerName ? ticket.customerName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate">
              {ticket.customerName || 'Pengguna WhatsApp'}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              <Phone size={12} className="text-slate-400" />
              <span>{ticket.customerPhone}</span>
            </div>
          </div>
        </div>

        {/* Action Buka WhatsApp Web */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-emerald-200 bg-emerald-50/70 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors"
        >
          <ExternalLink size={13} />
          <span>Buka di WhatsApp Web</span>
        </a>
      </div>

      {/* 2. Info Penugasan & Waktu */}
      <div className="cs-right-section">
        <div className="cs-right-section-title">
          <ShieldCheck size={14} className="text-blue-600" />
          <span>Status & Penugasan</span>
        </div>

        <div className="flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Status Saat Ini:</span>
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
                statusConfig.bgClass,
                statusConfig.textClass,
                statusConfig.borderClass
              )}
            >
              {statusConfig.label}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Petugas CS:</span>
            <span className="font-semibold text-slate-900">
              {ticket.adminName || 'Belum Ditugaskan'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Waktu Dibuat:</span>
            <span className="font-medium text-slate-800">
              {formatTime(ticket.createdAt)} ({formatDate(ticket.createdAt)})
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Durasi Aktif:</span>
            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {activeDuration || '0 menit'}
            </span>
          </div>

          {ticket.pendingReason && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 mt-1">
              <span className="font-semibold text-[11px] block text-amber-800">Alasan Pending:</span>
              <p className="text-[11.5px] mt-0.5 leading-relaxed">{ticket.pendingReason}</p>
            </div>
          )}

          {ticket.resolveNotes && (
            <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 mt-1">
              <span className="font-semibold text-[11px] block text-teal-800">Catatan Solusi:</span>
              <p className="text-[11.5px] mt-0.5 leading-relaxed">{ticket.resolveNotes}</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Tombol Operasi Penting (Aksi Tiket) */}
      <div className="cs-right-section">
        <div className="cs-right-section-title">
          <Sparkles size={14} className="text-blue-600" />
          <span>Operasi & Kontrol Tiket</span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Ambil Tiket */}
          {isWaiting && (
            <Button
              variant="primary"
              size="sm"
              loading={isAssigning}
              onClick={onAssign}
              icon={<UserCheck size={14} />}
              className="w-full justify-center"
            >
              Ambil Tiket Ini
            </Button>
          )}

          {/* Pending */}
          {!isWaiting && ticket.status !== 'PENDING' && !isClosed && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenPending}
              icon={<Clock size={14} />}
              className="w-full justify-center"
            >
              Tunda Tiket (Pending)
            </Button>
          )}

          {/* Selesaikan */}
          {!isWaiting && ticket.status !== 'RESOLVED' && !isClosed && (
            <Button
              variant="success"
              size="sm"
              onClick={onOpenResolve}
              icon={<CheckCircle2 size={14} />}
              className="w-full justify-center"
            >
              Tandai Selesai (Resolve)
            </Button>
          )}

          {/* Alihkan Tiket */}
          {!isWaiting && !isClosed && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenTransfer}
              icon={<ArrowRightLeft size={14} />}
              className="w-full justify-center"
            >
              Alihkan ke CS Lain
            </Button>
          )}

          {/* Lepas Tiket */}
          {!isWaiting && !isClosed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenRelease}
              icon={<RotateCcw size={14} />}
              className="w-full justify-center text-slate-600 hover:text-amber-700"
            >
              Lepas ke Antrean Waiting
            </Button>
          )}

          {/* Tutup Percakapan */}
          {!isClosed && (
            <Button
              variant="danger"
              size="sm"
              onClick={onOpenClose}
              icon={<XCircle size={14} />}
              className="w-full justify-center mt-1"
            >
              Tutup Percakapan (Ke Bot)
            </Button>
          )}
        </div>
      </div>

      {/* 4. Audit Trail Event Log */}
      <div className="cs-right-section flex-1">
        <div className="cs-right-section-title">
          <History size={14} className="text-blue-600" />
          <span>Audit Trail Log</span>
        </div>

        {events.length === 0 ? (
          <p className="text-xs text-slate-400">Belum ada riwayat aktivitas.</p>
        ) : (
          <div className="cs-timeline mt-2">
            {events.map((evt) => {
              let nodeClass = 'cs-timeline-node';
              if (evt.eventType === 'ASSIGNED' || evt.eventType === 'STATUS_CHANGE') {
                nodeClass = 'cs-timeline-node cs-timeline-node-active';
              } else if (evt.eventType === 'PENDING') {
                nodeClass = 'cs-timeline-node cs-timeline-node-pending';
              } else if (evt.eventType === 'CLOSED') {
                nodeClass = 'cs-timeline-node cs-timeline-node-closed';
              }

              return (
                <div key={evt.id} className="cs-timeline-item">
                  <span className={nodeClass} />
                  <div className="flex items-center justify-between text-[11px]">
                    <strong className="text-slate-800 font-semibold">
                      {evt.eventType}
                    </strong>
                    <span className="text-slate-400">{formatTime(evt.createdAt)}</span>
                  </div>
                  <p className="text-[11.5px] text-slate-600 leading-snug">
                    {evt.notes || `Aktivitas ${evt.eventType} oleh ${evt.actorName || evt.actorType}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
