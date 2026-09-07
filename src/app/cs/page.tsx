'use client';

// ============================================================
// SAPA BPS 1901 IN — Customer Service Inbox & Ticketing Dashboard
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { Toast, ServerOfflineState } from '@/components/ui';
import {
  subscribeBackendStatus,
  getBackendStatus,
  syncWithBackend,
  BackendConnectionState,
} from '@/lib/repository';
import {
  Ticket,
  TicketStatus,
  TicketMessage,
  TicketEvent,
  TicketFilterTab,
  CsAdmin,
  CsSettings,
  RealtimeTicketEvent,
} from '@/lib/ticketTypes';
import {
  ticketApi,
  TicketConflictError,
  normalizeTicket,
  normalizeMessage,
} from '@/lib/ticketApi';
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
  const [admins, setAdmins] = useState<CsAdmin[]>([]);

  // Resolve admin CS yang valid di database (misal 'admin-bps-1')
  const effectiveAdmin = React.useMemo(() => {
    const byId = admins.find((a) => a.id === user?.id);
    if (byId) return { id: byId.id, name: byId.name };

    const byEmail = admins.find((a) => a.email && user?.email && a.email.toLowerCase() === user.email.toLowerCase());
    if (byEmail) return { id: byEmail.id, name: byEmail.name };

    const byName = admins.find((a) => a.name && user?.name && a.name.toLowerCase().includes(user.name.toLowerCase()));
    if (byName) return { id: byName.id, name: byName.name };

    if (admins.length > 0) return { id: admins[0].id, name: admins[0].name };

    return { id: 'admin-bps-1', name: user?.name || 'Admin Pelayanan BPS Bangka' };
  }, [admins, user]);

  const currentAdminId = effectiveAdmin.id;
  const currentAdminName = effectiveAdmin.name;

  const [backendState, setBackendState] = useState<BackendConnectionState>(() => getBackendStatus());
  const [isRetrying, setIsRetrying] = useState(false);

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
    setIsLoadingTickets(true);
    try {
      // Ambil seluruh tiket (pencarian di-forward jika ada) agar tab count badge akurat
      const res = await ticketApi.getTickets({
        search: searchQuery,
      });
      setTickets(res.data);
    } catch (err) {
      console.error('[CS] Gagal mengambil daftar tiket:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const unsub = subscribeBackendStatus((state) => {
      setBackendState(state);
      if (state.isConnected) {
        fetchTickets();
        ticketApi.getAdmins().then(setAdmins).catch(() => {});
        ticketApi.getSettings().then(setSettings).catch(() => {});
      }
    });

    // Panggil langsung saat inisialisasi komponen tanpa menunggu status dataset
    fetchTickets();
    ticketApi.getAdmins().then(setAdmins).catch(() => {});
    ticketApi.getSettings().then(setSettings).catch(() => {});

    if (!getBackendStatus().hasCheckedInitial) {
      syncWithBackend().catch(() => {});
    }

    return unsub;
  }, [fetchTickets]);

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

      const rawData = event.data || {};
      const ticketObj =
        event.ticket ||
        (rawData.ticket_number || rawData.ticketNumber ? normalizeTicket(rawData) : undefined);
      const messageObj =
        event.message ||
        (rawData.message !== undefined || rawData.content !== undefined
          ? normalizeMessage(rawData)
          : undefined);
      const ticketId = event.ticketId || rawData.ticketId || rawData.ticket_id || ticketObj?.id;
      const adminId = event.adminId || rawData.adminId || rawData.assigned_to;
      const adminName = event.adminName || rawData.adminName || rawData.admin_name;
      const status = event.status || rawData.status;

      // Event: New Ticket Created
      if (event.event === 'ticket.created') {
        const targetTicket = ticketObj || (rawData.id ? normalizeTicket(rawData) : null);
        if (targetTicket) {
          setTickets((prev) => [targetTicket, ...prev.filter((t) => t.id !== targetTicket.id)]);
          setToast({
            msg: `Tiket baru #${targetTicket.ticketNumber} masuk dari ${targetTicket.customerName}!`,
            type: 'warning',
          });
        } else {
          fetchTickets();
        }
      }

      // Event: Ticket Assigned
      else if (event.event === 'ticket.assigned' && ticketId) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticketId
              ? {
                  ...t,
                  status: 'ASSIGNED',
                  adminId: adminId || t.adminId,
                  adminName: adminName || t.adminName,
                }
              : t
          )
        );
        if (selectedTicketId === ticketId) {
          loadTicketDetail(ticketId);
        }
      }

      // Event: New Message Incoming
      else if (event.event === 'ticket.message' && (messageObj || ticketId)) {
        const msg = messageObj;

        // If currently open ticket
        if (msg && selectedTicketId === msg.ticketId) {
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
        } else if (msg) {
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
        } else {
          fetchTickets();
        }
      }

      // Event: Status Changed
      else if (event.event === 'ticket.status_changed' && ticketId) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticketId
              ? { ...t, status: (status || t.status) as TicketStatus }
              : t
          )
        );
        if (selectedTicketId === ticketId) {
          loadTicketDetail(ticketId);
        }
      }

      // Event: Closed or Released or Transferred
      else if (
        event.event === 'ticket.closed' ||
        event.event === 'ticket.released' ||
        event.event === 'ticket.transferred'
      ) {
        fetchTickets();
        if (selectedTicketId === ticketId) {
          loadTicketDetail(ticketId);
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
      if (res.success && res.ticket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedTicketId ? res.ticket! : t))
        );
        setSelectedTicketDetail((prev) =>
          prev ? { ...prev, ticket: res.ticket! } : { ticket: res.ticket!, messages: [], events: [] }
        );
        setActiveTab('ACTIVE');
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
    } catch (err: any) {
      setToast({ msg: err?.message || 'Gagal mengirim pesan ke pengguna.', type: 'error' });
    } finally {
      setIsSendingMessage(false);
    }
  };

  // 3. Pending Ticket
  const handlePendingConfirm = async (reason: string) => {
    if (!selectedTicketId) return;
    try {
      const res = await ticketApi.pendingTicket(selectedTicketId, currentAdminId, reason);
      if (res.success && res.ticket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedTicketId ? res.ticket! : t))
        );
        setSelectedTicketDetail((prev) =>
          prev ? { ...prev, ticket: res.ticket! } : null
        );
        setActiveTab('PENDING');
        setToast({ msg: 'Status tiket berhasil diubah menjadi PENDING.', type: 'warning' });
        fetchTickets();
        loadTicketDetail(selectedTicketId);
      }
    } catch (err: any) {
      setToast({ msg: err?.message || 'Gagal mengubah status pending.', type: 'error' });
    }
  };

  // 4. Resolve Ticket
  const handleResolveConfirm = async (notes: string) => {
    if (!selectedTicketId) return;
    try {
      const res = await ticketApi.resolveTicket(selectedTicketId, currentAdminId, notes);
      if (res.success && res.ticket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedTicketId ? res.ticket! : t))
        );
        setSelectedTicketDetail((prev) =>
          prev ? { ...prev, ticket: res.ticket! } : null
        );
        setActiveTab('RESOLVED');
        setToast({ msg: 'Tiket berhasil ditandai selesai (RESOLVED).', type: 'success' });
        fetchTickets();
        loadTicketDetail(selectedTicketId);
      }
    } catch (err: any) {
      setToast({ msg: err?.message || 'Gagal menyelesaikan tiket.', type: 'error' });
    }
  };

  // 5. Close Ticket
  const handleCloseConfirm = async (reason: string) => {
    if (!selectedTicketId) return;
    try {
      const res = await ticketApi.closeTicket(selectedTicketId, currentAdminId, reason);
      if (res.success && res.ticket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedTicketId ? res.ticket! : t))
        );
        setSelectedTicketDetail((prev) =>
          prev ? { ...prev, ticket: res.ticket! } : null
        );
        setToast({ msg: 'Tiket ditutup. Mode pengguna kembali ke BOT otomatis.', type: 'success' });
        fetchTickets();
        loadTicketDetail(selectedTicketId);
      }
    } catch (err: any) {
      setToast({ msg: err?.message || 'Gagal menutup tiket.', type: 'error' });
    }
  };

  // 6. Release Ticket
  const handleReleaseConfirm = async (reason: string) => {
    if (!selectedTicketId) return;
    try {
      const res = await ticketApi.releaseTicket(selectedTicketId, currentAdminId, reason);
      if (res.success && res.ticket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedTicketId ? res.ticket! : t))
        );
        setSelectedTicketDetail((prev) =>
          prev ? { ...prev, ticket: res.ticket! } : null
        );
        setActiveTab('WAITING');
        setToast({ msg: 'Tiket dikembalikan ke antrean WAITING.', type: 'success' });
        fetchTickets();
        loadTicketDetail(selectedTicketId);
      }
    } catch (err: any) {
      setToast({ msg: err?.message || 'Gagal melepaskan tiket.', type: 'error' });
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
      if (res.success && res.ticket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedTicketId ? res.ticket! : t))
        );
        setSelectedTicketDetail((prev) =>
          prev ? { ...prev, ticket: res.ticket! } : null
        );
        setToast({ msg: 'Tiket berhasil dialihkan ke petugas CS lain.', type: 'success' });
        fetchTickets();
        loadTicketDetail(selectedTicketId);
      }
    } catch (err: any) {
      setToast({ msg: err?.message || 'Gagal mengalihkan tiket.', type: 'error' });
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
  const isOffline = backendState.hasCheckedInitial && !backendState.isConnected && tickets.length === 0 && !isLoadingTickets;

  if (isOffline) {
    return (
      <AppLayout>
        <Header
          title="CS Inbox & Ticketing"
          subtitle="Pelayanan Statistik Terpadu (PST) BPS Kabupaten Bangka — Respon WhatsApp Realtime"
        />
        <div className="page-content" style={{ padding: '24px 16px' }}>
          <ServerOfflineState
            title="Layanan CS Sedang Offline"
            message="Fitur Customer Service dan Inbox Tiket tidak dapat ditampilkan karena server backend tidak aktif atau offline, dan database saat ini masih menggunakan penyimpanan lokal."
            hint="Silakan aktifkan server backend WhatsApp agar tiket chat dan pesan masuk dapat disinkronkan dan direspon secara realtime."
            isRetrying={isRetrying}
            onRetry={async () => {
              setIsRetrying(true);
              try {
                const [live] = await Promise.all([
                  syncWithBackend(),
                  fetchTickets(),
                ]);
                if (live || tickets.length > 0) {
                  setToast({ msg: 'Server backend CS berhasil terhubung!', type: 'success' });
                } else {
                  setToast({ msg: 'Server backend CS masih offline.', type: 'error' });
                }
              } finally {
                setIsRetrying(false);
              }
            }}
          />
        </div>
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
