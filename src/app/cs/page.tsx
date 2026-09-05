'use client';

// ============================================================
// SAPA BPS 1901 IN — Customer Service Inbox & Ticketing Dashboard
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { Toast } from '@/components/ui';
import {
  Ticket,
  TicketMessage,
  TicketEvent,
  TicketFilterTab,
  CsAdmin,
  CsSettings,
  RealtimeTicketEvent,
} from '@/lib/ticketTypes';
import { ticketApi, TicketConflictError } from '@/lib/ticketApi';
import { useCsRealtime } from '@/lib/useCsRealtime';
import { CsTicketList } from '@/components/cs/CsTicketList';
import { CsChatRoom } from '@/components/cs/CsChatRoom';
import { CsTicketDetail } from '@/components/cs/CsTicketDetail';
import {
  ConflictModal,
  PendingModal,
  ResolveModal,
  CloseModal,
  ReleaseModal,
  TransferModal,
  CsSettingsModal,
  ImageLightboxModal,
} from '@/components/cs/CsModals';
import { MessageSquarePlus } from 'lucide-react';

export default function CustomerServiceInboxPage() {
  const { user } = useAuth();
  const currentAdminId = user?.id || 'admin-1';
  const currentAdminName = user?.name || 'Petugas CS (BPS Bangka)';

  // Core State
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<{
    ticket: Ticket;
    messages: TicketMessage[];
    events: TicketEvent[];
  } | null>(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<TicketFilterTab>('WAITING');
  const [searchQuery, setSearchQuery] = useState('');
  const [admins, setAdmins] = useState<CsAdmin[]>([]);
  const [settings, setSettings] = useState<CsSettings>({
    autoCloseMinutes: 15,
    soundEnabled: true,
    desktopNotification: true,
    greetingTemplate: 'Halo, saya petugas CS BPS Bangka. Ada yang dapat kami bantu?',
  });

  // UI / Action Loading & Toast States
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Modals state
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Image lightbox state
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption?: string } | null>(null);

  // ------------------------------------------------------------
  // Fetch Tickets List
  // ------------------------------------------------------------
  const fetchTickets = useCallback(async () => {
    try {
      const res = await ticketApi.getTickets({
        status: activeTab,
        adminId: currentAdminId,
        search: searchQuery,
      });
      setTickets(res.data);
    } catch (err) {
      console.error('[CS] Gagal mengambil daftar tiket:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  }, [activeTab, currentAdminId, searchQuery]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Initial load admins & settings
  useEffect(() => {
    ticketApi.getAdmins().then(setAdmins).catch(() => {});
    ticketApi.getSettings().then(setSettings).catch(() => {});
  }, []);

  // ------------------------------------------------------------
  // Load Active Ticket Detail
  // ------------------------------------------------------------
  const loadTicketDetail = useCallback(
    async (ticketId: string) => {
      try {
        const detail = await ticketApi.getTicketDetail(ticketId);
        setSelectedTicketDetail(detail);

        // Reset unread counter on selection
        ticketApi.markAsRead(ticketId).catch(() => {});
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, unreadCount: 0 } : t))
        );
      } catch (err) {
        console.error('[CS] Gagal memuat detail tiket:', err);
      }
    },
    []
  );

  // Auto select first waiting/active ticket on load if none selected
  useEffect(() => {
    if (!selectedTicketId && tickets.length > 0) {
      const first = tickets[0];
      setSelectedTicketId(first.id);
      loadTicketDetail(first.id);
    }
  }, [tickets, selectedTicketId, loadTicketDetail]);

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicketId(ticket.id);
    loadTicketDetail(ticket.id);
  };

  // ------------------------------------------------------------
  // Realtime Events Handler
  // ------------------------------------------------------------
  const handleRealtimeEvent = useCallback(
    (event: RealtimeTicketEvent) => {
      console.log('[CS Realtime Event]:', event);

      // Event: New Ticket Created
      if (event.event === 'ticket.created' && event.ticket) {
        setTickets((prev) => [event.ticket!, ...prev]);
        setToast({
          msg: `Tiket baru #${event.ticket.ticketNumber} masuk dari ${event.ticket.customerName}!`,
          type: 'warning',
        });
      }

      // Event: Ticket Assigned
      else if (event.event === 'ticket.assigned' && event.ticketId) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === event.ticketId
              ? {
                  ...t,
                  status: 'ACTIVE',
                  adminId: event.adminId || t.adminId,
                  adminName: event.adminName || t.adminName,
                }
              : t
          )
        );
        if (selectedTicketId === event.ticketId) {
          loadTicketDetail(event.ticketId);
        }
      }

      // Event: New Message Incoming
      else if (event.event === 'ticket.message' && event.message) {
        const msg = event.message;

        // If currently open ticket
        if (selectedTicketId === msg.ticketId) {
          setSelectedTicketDetail((prev) => {
            if (!prev) return null;
            // Check deduplication
            if (prev.messages.some((m) => m.id === msg.id)) return prev;
            return {
              ...prev,
              messages: [...prev.messages, msg],
            };
          });
          ticketApi.markAsRead(msg.ticketId).catch(() => {});
        } else {
          // Increment unread count in ticket card
          setTickets((prev) =>
            prev.map((t) =>
              t.id === msg.ticketId
                ? {
                    ...t,
                    unreadCount: (t.unreadCount || 0) + 1,
                    lastMessage: msg.message,
                    lastMessageAt: msg.createdAt,
                  }
                : t
            )
          );
        }
      }

      // Event: Status Changed
      else if (event.event === 'ticket.status_changed' && event.ticketId) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === event.ticketId
              ? { ...t, status: event.status || t.status }
              : t
          )
        );
        if (selectedTicketId === event.ticketId) {
          loadTicketDetail(event.ticketId);
        }
      }

      // Event: Closed or Released or Transferred
      else if (
        event.event === 'ticket.closed' ||
        event.event === 'ticket.released' ||
        event.event === 'ticket.transferred'
      ) {
        fetchTickets();
        if (selectedTicketId === event.ticketId) {
          loadTicketDetail(event.ticketId);
        }
      }
    },
    [selectedTicketId, loadTicketDetail, fetchTickets]
  );

  // Realtime hook
  const { status: realtimeStatus, soundEnabled, toggleSound } = useCsRealtime({
    onEvent: handleRealtimeEvent,
    enabled: true,
  });

  // ------------------------------------------------------------
  // Ticket Operations
  // ------------------------------------------------------------

  // 1. Assign Ticket
  const handleAssignTicket = async () => {
    if (!selectedTicketId) return;
    try {
      const res = await ticketApi.assignTicket(
        selectedTicketId,
        currentAdminId,
        currentAdminName
      );
      if (res.success) {
        setToast({ msg: 'Tiket berhasil diambil dan ditugaskan kepada Anda.', type: 'success' });
        fetchTickets();
        loadTicketDetail(selectedTicketId);
      }
    } catch (err: any) {
      if (err instanceof TicketConflictError) {
        setConflictMessage(err.message);
        setConflictModalOpen(true);
        fetchTickets();
      } else {
        setToast({ msg: err?.message || 'Gagal mengambil tiket.', type: 'error' });
      }
    }
  };

  // 2. Send Message
  const handleSendMessage = async (text: string, type: 'TEXT' | 'IMAGE' | 'DOCUMENT' = 'TEXT') => {
    if (!selectedTicketId) return;
    setIsSendingMessage(true);
    try {
      const res = await ticketApi.sendMessage(selectedTicketId, {
        adminId: currentAdminId,
        message: text,
        messageType: type,
      });
      if (res.success && res.message) {
        setSelectedTicketDetail((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            messages: [...prev.messages, res.message!],
          };
        });
        setTickets((prev) =>
          prev.map((t) =>
            t.id === selectedTicketId
              ? {
                  ...t,
                  lastMessage: text,
                  lastMessageAt: res.message!.createdAt,
                  status: t.status === 'ASSIGNED' ? 'ACTIVE' : t.status,
                }
              : t
          )
        );
      }
    } catch (err) {
      setToast({ msg: 'Gagal mengirim pesan ke pengguna.', type: 'error' });
    } finally {
      setIsSendingMessage(false);
    }
  };

  // 3. Pending Ticket
  const handlePendingConfirm = async (reason: string) => {
    if (!selectedTicketId) return;
    try {
      const res = await ticketApi.pendingTicket(selectedTicketId, currentAdminId, reason);
      if (res.success) {
        setToast({ msg: 'Status tiket berhasil diubah menjadi PENDING.', type: 'warning' });
        fetchTickets();
        loadTicketDetail(selectedTicketId);
      }
    } catch (err) {
      setToast({ msg: 'Gagal mengubah status pending.', type: 'error' });
    }
  };

  // 4. Resolve Ticket
  const handleResolveConfirm = async (notes: string) => {
    if (!selectedTicketId) return;
    try {
      const res = await ticketApi.resolveTicket(selectedTicketId, currentAdminId, notes);
      if (res.success) {
        setToast({ msg: 'Tiket berhasil ditandai selesai (RESOLVED).', type: 'success' });
        fetchTickets();
        loadTicketDetail(selectedTicketId);
      }
    } catch (err) {
      setToast({ msg: 'Gagal menyelesaikan tiket.', type: 'error' });
    }
  };

  // 5. Close Ticket
  const handleCloseConfirm = async (reason: string) => {
    if (!selectedTicketId) return;
    try {
      const res = await ticketApi.closeTicket(selectedTicketId, currentAdminId, reason);
      if (res.success) {
        setToast({ msg: 'Tiket ditutup. Mode pengguna kembali ke BOT otomatis.', type: 'success' });
        fetchTickets();
        loadTicketDetail(selectedTicketId);
      }
    } catch (err) {
      setToast({ msg: 'Gagal menutup tiket.', type: 'error' });
    }
  };

  // 6. Release Ticket
  const handleReleaseConfirm = async (reason: string) => {
    if (!selectedTicketId) return;
    try {
      const res = await ticketApi.releaseTicket(selectedTicketId, currentAdminId, reason);
      if (res.success) {
        setToast({ msg: 'Tiket dikembalikan ke antrean WAITING.', type: 'success' });
        fetchTickets();
        loadTicketDetail(selectedTicketId);
      }
    } catch (err) {
      setToast({ msg: 'Gagal melepaskan tiket.', type: 'error' });
    }
  };

  // 7. Transfer Ticket
  const handleTransferConfirm = async (toAdminId: string, reason: string) => {
    if (!selectedTicketId) return;
    try {
      const res = await ticketApi.transferTicket(
        selectedTicketId,
        currentAdminId,
        toAdminId,
        reason
      );
      if (res.success) {
        setToast({ msg: 'Tiket berhasil dialihkan ke petugas CS lain.', type: 'success' });
        fetchTickets();
        loadTicketDetail(selectedTicketId);
      }
    } catch (err) {
      setToast({ msg: 'Gagal mengalihkan tiket.', type: 'error' });
    }
  };

  // 8. Save Settings
  const handleSaveSettings = async (newSettings: Partial<CsSettings>) => {
    try {
      const updated = await ticketApi.updateSettings(newSettings);
      setSettings(updated);
      setToast({ msg: 'Pengaturan CS berhasil diperbarui.', type: 'success' });
    } catch (err) {
      setToast({ msg: 'Gagal menyimpan pengaturan.', type: 'error' });
    }
  };

  // 9. Interactive Simulation Helper for Demo
  const handleSimulateUserMessage = () => {
    if (!selectedTicketId) return;
    const sampleQuestions = [
      'Mohon izin bertanya, apakah ada publikasi Bangka Dalam Angka format excel?',
      'Terima kasih infonya Mas. Kalau untuk data pengangguran terbuka tingkat kecamatan apa ada?',
      'Baik, saya tunggu rincian tabelnya ya.',
      'Berapa persentase kemiskinan Kabupaten Bangka tahun lalu?',
    ];
    const randomText = sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)];
    const newMsg = ticketApi.simulateIncomingUserMessage(selectedTicketId, randomText);

    // Trigger realtime event handler
    handleRealtimeEvent({
      event: 'ticket.message',
      ticketId: selectedTicketId,
      message: newMsg,
    });
    setToast({ msg: 'Simulasi pesan pengguna WhatsApp berhasil diterima!', type: 'success' });
  };

  const activeTicket = selectedTicketDetail?.ticket || tickets.find((t) => t.id === selectedTicketId) || null;

  return (
    <AppLayout>
      <Header
        title="CS Inbox & Ticketing"
        subtitle="Pelayanan Statistik Terpadu (PST) BPS Kabupaten Bangka — Respon WhatsApp Realtime"
        actions={
          <div className="flex items-center gap-2">
            {/* Quick Demo Simulator button */}
            <button
              onClick={handleSimulateUserMessage}
              disabled={!selectedTicketId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm disabled:opacity-50"
              title="Kirim pesan simulasi dari pengguna WhatsApp ke tiket yang sedang aktif"
              type="button"
            >
              <MessageSquarePlus size={14} className="text-emerald-600" />
              <span>Simulasi Pesan User</span>
            </button>
          </div>
        }
      />

      {/* Main 3-Panel Layout Container */}
      <div className="cs-inbox-wrapper">
        {/* PANEL KIRI (30%): Daftar Tiket & Filter */}
        <CsTicketList
          tickets={tickets}
          selectedTicketId={selectedTicketId}
          onSelectTicket={handleSelectTicket}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          realtimeStatus={realtimeStatus}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          onOpenSettings={() => setSettingsModalOpen(true)}
          currentAdminId={currentAdminId}
          isLoading={isLoadingTickets}
        />

        {/* PANEL TENGAH (45%): Ruang Obrolan Percakapan WhatsApp */}
        <CsChatRoom
          ticket={activeTicket}
          messages={selectedTicketDetail?.messages || []}
          currentAdminId={currentAdminId}
          onSendMessage={handleSendMessage}
          onAssignTicket={handleAssignTicket}
          onOpenPendingModal={() => setPendingModalOpen(true)}
          onOpenResolveModal={() => setResolveModalOpen(true)}
          onOpenImageModal={(url, caption) => setLightboxImage({ url, caption })}
          isSending={isSendingMessage}
        />

        {/* PANEL KANAN (25%): Detail Tiket, Operasi Aksi & Audit Trail */}
        <CsTicketDetail
          ticket={activeTicket}
          events={selectedTicketDetail?.events || []}
          admins={admins}
          currentAdminId={currentAdminId}
          onAssign={handleAssignTicket}
          onOpenPending={() => setPendingModalOpen(true)}
          onOpenResolve={() => setResolveModalOpen(true)}
          onOpenClose={() => setCloseModalOpen(true)}
          onOpenRelease={() => setReleaseModalOpen(true)}
          onOpenTransfer={() => setTransferModalOpen(true)}
        />
      </div>

      {/* Modals & Dialogs */}
      <ConflictModal
        open={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        message={conflictMessage}
      />

      <PendingModal
        open={pendingModalOpen}
        onClose={() => setPendingModalOpen(false)}
        ticket={activeTicket}
        onConfirm={handlePendingConfirm}
      />

      <ResolveModal
        open={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        ticket={activeTicket}
        onConfirm={handleResolveConfirm}
      />

      <CloseModal
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        ticket={activeTicket}
        onConfirm={handleCloseConfirm}
      />

      <ReleaseModal
        open={releaseModalOpen}
        onClose={() => setReleaseModalOpen(false)}
        ticket={activeTicket}
        onConfirm={handleReleaseConfirm}
      />

      <TransferModal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        ticket={activeTicket}
        admins={admins}
        currentAdminId={currentAdminId}
        onConfirm={handleTransferConfirm}
      />

      <CsSettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <ImageLightboxModal
        open={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url || null}
        caption={lightboxImage?.caption}
      />

      {/* Toast Notification */}
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
