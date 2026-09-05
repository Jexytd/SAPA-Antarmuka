// ============================================================
// SAPA BPS 1901 IN — Customer Service Chat Room (Panel Tengah 45%)
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Ticket,
  TicketMessage,
  TICKET_STATUS_CONFIG,
} from '@/lib/ticketTypes';
import { Button } from '@/components/ui';
import {
  Send,
  CheckCheck,
  Clock,
  CheckCircle2,
  Sparkles,
  ArrowDown,
  MessageSquare,
  UserCheck,
} from 'lucide-react';
import { cn, formatTime, formatDate } from '@/lib/utils';

interface CsChatRoomProps {
  ticket: Ticket | null;
  messages: TicketMessage[];
  currentAdminId: string;
  onSendMessage: (text: string, type?: 'TEXT' | 'IMAGE' | 'DOCUMENT') => Promise<void>;
  onAssignTicket: () => Promise<void>;
  onOpenPendingModal: () => void;
  onOpenResolveModal: () => void;
  onOpenImageModal: (url: string, caption?: string) => void;
  isSending?: boolean;
}

const QUICK_REPLIES = [
  {
    title: 'Salam PST BPS',
    text: 'Halo, selamat datang di Layanan Pelayanan Statistik Terpadu (PST) BPS Kabupaten Bangka. Ada data atau statistik yang dapat kami bantu?',
  },
  {
    title: 'Minta Detail Wilayah',
    text: 'Untuk penelusuran data yang lebih akurat, mohon informasikan wilayah kecamatan/desa serta tahun data yang Bapak/Ibu butuhkan.',
  },
  {
    title: 'Info Jam Layanan',
    text: 'Jam pelayanan online PST BPS Kabupaten Bangka aktif setiap hari Senin - Jumat pukul 08.00 - 15.30 WIB.',
  },
  {
    title: 'Tautan Portal Web',
    text: 'Bapak/Ibu juga dapat mengunduh publikasi dan tabel data statistik resmi kami secara mandiri melalui laman resmi https://bangkakab.bps.go.id.',
  },
  {
    title: 'Salam Penutup',
    text: 'Terima kasih telah menghubungi BPS Kabupaten Bangka. Semoga data yang diberikan bermanfaat. Salam sehat dan sukses selalu!',
  },
];

export function CsChatRoom({
  ticket,
  messages,
  currentAdminId,
  onSendMessage,
  onAssignTicket,
  onOpenPendingModal,
  onOpenResolveModal,
  onOpenImageModal,
  isSending = false,
}: CsChatRoomProps) {
  const [inputText, setInputText] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll logic: scroll down if user is near bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  // Handle scroll event to show/hide "Scroll to Bottom" button
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceToBottom > 150);
  };

  // On new message arrival
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    // If user is reasonably close to bottom, keep them pinned
    if (distanceToBottom < 200) {
      scrollToBottom('smooth');
    }
  }, [messages.length, scrollToBottom]);

  // Initial scroll when ticket changes
  useEffect(() => {
    scrollToBottom('auto');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [ticket?.id, scrollToBottom]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;
    setInputText('');
    await onSendMessage(text, 'TEXT');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApplyQuickReply = (text: string) => {
    setInputText(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleAssignClick = async () => {
    setIsAssigning(true);
    try {
      await onAssignTicket();
    } finally {
      setIsAssigning(false);
    }
  };

  if (!ticket) {
    return (
      <div className="cs-panel-center flex flex-col items-center justify-center p-8 text-center text-slate-500">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-sm border border-blue-100">
          <MessageSquare size={32} />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">
          Pilih Percakapan untuk Membuka Obrolan
        </h3>
        <p className="text-xs text-slate-500 max-w-sm">
          Pilih salah satu tiket dari panel kiri untuk melihat riwayat pesan WhatsApp, merespon pengguna, atau memperbarui status penanganan.
        </p>
      </div>
    );
  }

  const statusConfig = TICKET_STATUS_CONFIG[ticket.status];
  const isAssignedToMe = ticket.adminId === currentAdminId;
  const isWaiting = ticket.status === 'WAITING';
  const isClosed = ticket.status === 'CLOSED';

  return (
    <div className="cs-panel-center">
      {/* Header Panel Tengah */}
      <div className="cs-chat-header">
        <div className="flex items-center gap-3">
          {/* Avatar User */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold flex items-center justify-center text-sm shadow-sm flex-shrink-0">
            {ticket.customerName ? ticket.customerName.charAt(0).toUpperCase() : 'U'}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                {ticket.customerName || 'Pengguna WhatsApp'}
              </h3>
              <span className="text-xs font-semibold text-slate-500">
                #{ticket.ticketNumber}
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10.5px] font-semibold border',
                  statusConfig.bgClass,
                  statusConfig.textClass,
                  statusConfig.borderClass
                )}
              >
                {statusConfig.label}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>{ticket.customerPhone}</span>
              <span>•</span>
              <span className="text-[11px]">
                Penanggung jawab: <strong>{ticket.adminName || 'Belum ada'}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2">
          {isWaiting ? (
            <Button
              variant="primary"
              size="sm"
              loading={isAssigning}
              onClick={handleAssignClick}
              icon={<UserCheck size={14} />}
            >
              Ambil Tiket
            </Button>
          ) : (
            <>
              {ticket.status !== 'PENDING' && !isClosed && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onOpenPendingModal}
                  icon={<Clock size={14} />}
                  title="Tunda tiket jika menunggu data"
                >
                  Pending
                </Button>
              )}

              {ticket.status !== 'RESOLVED' && !isClosed && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={onOpenResolveModal}
                  icon={<CheckCircle2 size={14} />}
                  title="Selesaikan tiket"
                >
                  Selesaikan
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Area Gelembung Percakapan (WhatsApp Chat Stream) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="cs-chat-messages"
      >
        {/* Banner Pembuat Tiket */}
        <div className="cs-bubble-system-banner">
          Tiket #{ticket.ticketNumber} dibuat pada {formatDate(ticket.createdAt)} pukul {formatTime(ticket.createdAt)}
        </div>

        {messages.map((msg) => {
          if (msg.senderType === 'SYSTEM') {
            return (
              <div key={msg.id} className="cs-bubble-system-banner">
                {msg.message}
              </div>
            );
          }

          const isUser = msg.senderType === 'USER';

          return (
            <div
              key={msg.id}
              className={cn(
                'cs-bubble-wrapper',
                isUser ? 'cs-bubble-wrapper-user' : 'cs-bubble-wrapper-admin'
              )}
            >
              {/* Nama Pengirim kecil */}
              <span
                className={cn(
                  'text-[10px] font-semibold mb-1 px-1',
                  isUser ? 'text-slate-500' : 'text-emerald-800 text-right'
                )}
              >
                {isUser ? ticket.customerName : msg.senderName || 'Petugas CS (BPS)'}
              </span>

              {/* Bubble Card */}
              <div className={isUser ? 'cs-bubble-user' : 'cs-bubble-admin'}>
                {/* Media Image Preview jika ada */}
                {msg.mediaUrl && (
                  <div
                    className="mb-2 cursor-pointer overflow-hidden rounded-lg border border-black/10"
                    onClick={() => onOpenImageModal(msg.mediaUrl!, msg.message)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={msg.mediaUrl}
                      alt="Gambar lampiran"
                      className="max-h-60 w-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                )}

                <p className="whitespace-pre-wrap">{msg.message}</p>

                {/* Metadata: Jam dan Centang Baca */}
                <div className="cs-bubble-meta">
                  <span>{formatTime(msg.createdAt)}</span>
                  {!isUser && (
                    <span title="Terkirim ke WhatsApp">
                      <CheckCheck size={14} className="text-emerald-600" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-28 right-8 z-20 p-2.5 rounded-full bg-white text-slate-700 shadow-lg border border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-all flex items-center gap-1.5 text-xs font-semibold"
          type="button"
        >
          <ArrowDown size={14} />
          <span>Pesan Baru</span>
        </button>
      )}

      {/* Chat Input Bar */}
      <div className="cs-chat-input-bar">
        {/* Quick Replies Template Badges */}
        <div className="cs-quick-replies">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 self-center pr-1 flex-shrink-0">
            <Sparkles size={12} className="text-amber-500" />
            Template:
          </span>
          {QUICK_REPLIES.map((qr, idx) => (
            <button
              key={idx}
              type="button"
              className="cs-quick-btn"
              onClick={() => handleApplyQuickReply(qr.text)}
              title={qr.text}
            >
              {qr.title}
            </button>
          ))}
        </div>

        {/* Input Textarea & Send Buttons */}
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              className="cs-input-textarea"
              rows={2}
              placeholder={
                isClosed
                  ? 'Tiket telah ditutup. Buka kembali atau buat sesi baru untuk mengirim pesan...'
                  : 'Ketik balasan WhatsApp ke pengguna (Enter untuk kirim, Shift + Enter baris baru)...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending || isClosed}
            />
          </div>

          <Button
            variant="primary"
            className="h-[46px] px-4 rounded-xl flex-shrink-0"
            disabled={!inputText.trim() || isSending || isClosed}
            loading={isSending}
            onClick={handleSend}
            icon={<Send size={16} />}
          >
            Kirim
          </Button>
        </div>
      </div>
    </div>
  );
}
