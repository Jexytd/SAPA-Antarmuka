// ============================================================
// SAPA BPS 1901 IN — Customer Service Modals & Dialogs
// ============================================================

import React, { useState, useEffect } from 'react';
import { Modal, Button, TextareaField, Select } from '@/components/ui';
import { Ticket, CsAdmin, CsSettings } from '@/lib/ticketTypes';
import { DEFAULT_CS_TEMPLATES } from '@/lib/ticketApi';
import {
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  XCircle,
  Bot,
  RotateCcw,
  ShieldAlert,
  Settings,
  MessageSquare,
  Sparkles,
  Info,
} from 'lucide-react';

// ------------------------------------------------------------
// 1. Conflict 409 Modal (Ticket Taken by Another Admin)
// ------------------------------------------------------------
interface ConflictModalProps {
  open: boolean;
  onClose: () => void;
  message?: string;
}

export function ConflictModal({ open, onClose, message }: ConflictModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tiket Sudah Diambil"
      variant="warning"
      maxWidth="460px"
      actions={
        <Button variant="primary" onClick={onClose}>
          Mengerti, Perbarui Daftar
        </Button>
      }
    >
      <div className="flex items-start gap-3 py-2">
        <div className="p-2.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
          <ShieldAlert size={24} />
        </div>
        <div>
          <p className="text-sm text-slate-700 leading-relaxed font-medium">
            {message ||
              'Maaf, tiket ini baru saja diambil oleh petugas admin lain beberapa saat yang lalu.'}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Daftar tiket telah disinkronkan secara otomatis dengan status terkini.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------
// 2. Pending Reason Modal
// ------------------------------------------------------------
interface PendingModalProps {
  open: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  onConfirm: (reason: string) => Promise<void>;
}

export function PendingModal({
  open,
  onClose,
  ticket,
  onConfirm,
}: PendingModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Harap masukkan alasan penundaan tiket.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onConfirm(reason);
      setReason('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ubah Status Menjadi PENDING"
      maxWidth="500px"
      actions={
        <div className="flex justify-end gap-2.5 w-full">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            icon={<Clock size={16} />}
          >
            Tandai Pending
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 py-1">
        <p className="text-xs text-slate-600">
          Status <strong className="text-amber-700 font-semibold">PENDING</strong>{' '}
          digunakan saat Anda menunggu data dari seksi teknis (seperti Seksi
          Neraca, Sosial, atau Distribusi) atau konfirmasi lanjutan dari pengguna.
        </p>

        <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <span>Tiket: </span>
          <strong className="font-semibold text-slate-900">
            #{ticket?.ticketNumber} — {ticket?.customerName}
          </strong>
        </div>

        <TextareaField
          label="Alasan Pending (Wajib)"
          required
          rows={3}
          placeholder="Contoh: Menunggu validasi angka agregat kemiskinan dari Seksi Statistik Sosial..."
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError('');
          }}
          error={error}
        />
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------
// 3. Resolve Notes Modal
// ------------------------------------------------------------
interface ResolveModalProps {
  open: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  onConfirm: (notes: string) => Promise<void>;
}

export function ResolveModal({
  open,
  onClose,
  ticket,
  onConfirm,
}: ResolveModalProps) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(notes);
      setNotes('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Selesaikan Tiket (RESOLVED)"
      maxWidth="500px"
      actions={
        <div className="flex justify-end gap-2.5 w-full">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            variant="success"
            onClick={handleSubmit}
            loading={loading}
            icon={<CheckCircle2 size={16} />}
          >
            Selesaikan Tiket
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 py-1">
        <p className="text-xs text-slate-600">
          Tandai tiket ini jika seluruh kebutuhan data atau pertanyaan pengguna{' '}
          <strong className="text-slate-900">{ticket?.customerName}</strong> telah
          terpenuhi.
        </p>

        <TextareaField
          label="Catatan Penyelesaian (Opsional)"
          rows={3}
          placeholder="Contoh: Permintaan tabel data PDRB 2024 telah dikirimkan via chat. Pengguna puas dengan penjelasan."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------
// 4. Close Ticket Confirmation Modal (Returns to Bot)
// ------------------------------------------------------------
interface CloseModalProps {
  open: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  onConfirm: (reason: string) => Promise<void>;
}

export function CloseModal({
  open,
  onClose,
  ticket,
  onConfirm,
}: CloseModalProps) {
  const [reason, setReason] = useState('Konsultasi selesai');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(reason);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tutup Percakapan & Kembalikan ke Bot"
      variant="warning"
      maxWidth="520px"
      actions={
        <div className="flex justify-end gap-2.5 w-full">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            variant="danger-solid"
            onClick={handleSubmit}
            loading={loading}
            icon={<XCircle size={16} />}
          >
            Tutup Percakapan
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 py-1">
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
          <div className="p-1.5 rounded-full bg-amber-200/80 text-amber-800 flex-shrink-0 mt-0.5">
            <Bot size={18} />
          </div>
          <div className="text-xs text-amber-900 leading-relaxed">
            <p className="font-semibold mb-1">Perhatian Mode Otomatis:</p>
            Menutup tiket akan mengakhiri sesi Customer Service dan{' '}
            <strong>secara otomatis mengembalikan nomor WhatsApp pengguna ke mode BOT AI SAPA</strong>. Pesan berikutnya dari pengguna akan dijawab otomatis oleh bot.
          </div>
        </div>

        <TextareaField
          label="Alasan Penutupan"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Alasan penutupan tiket..."
        />
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------
// 5. Release Ticket Confirmation Modal
// ------------------------------------------------------------
interface ReleaseModalProps {
  open: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  onConfirm: (reason: string) => Promise<void>;
}

export function ReleaseModal({
  open,
  onClose,
  ticket,
  onConfirm,
}: ReleaseModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(reason);
      setReason('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lepaskan Tiket ke Antrean Waiting"
      maxWidth="500px"
      actions={
        <div className="flex justify-end gap-2.5 w-full">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            icon={<RotateCcw size={16} />}
          >
            Lepaskan Tiket
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 py-1">
        <p className="text-xs text-slate-600">
          Tiket #{ticket?.ticketNumber} akan dikembalikan ke status{' '}
          <strong className="text-amber-700 font-semibold">WAITING</strong> sehingga petugas CS lain yang sedang bertugas dapat mengambil dan menindaklanjutinya.
        </p>

        <TextareaField
          label="Alasan Pelepasan (Opsional)"
          rows={2}
          placeholder="Contoh: Mengalihkan shift kerja atau sedang menghadiri rapat dinas..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------
// 6. Transfer Ticket Modal (Assign to another CS)
// ------------------------------------------------------------
interface TransferModalProps {
  open: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  admins: CsAdmin[];
  currentAdminId: string;
  onConfirm: (toAdminId: string, reason: string) => Promise<void>;
}

export function TransferModal({
  open,
  onClose,
  ticket,
  admins,
  currentAdminId,
  onConfirm,
}: TransferModalProps) {
  const [targetAdminId, setTargetAdminId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const otherAdmins = admins.filter((a) => a.id !== currentAdminId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAdminId) {
      setError('Silakan pilih petugas CS tujuan.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onConfirm(targetAdminId, reason);
      setTargetAdminId('');
      setReason('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Alihkan Tiket ke Petugas CS Lain"
      maxWidth="500px"
      actions={
        <div className="flex justify-end gap-2.5 w-full">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            icon={<ArrowRightLeft size={16} />}
          >
            Alihkan Tiket
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 py-1">
        <p className="text-xs text-slate-600">
          Pilih petugas CS lain untuk melanjutkan penanganan tiket #{ticket?.ticketNumber}.
        </p>

        <Select
          label="Petugas CS Penerima (Wajib)"
          required
          value={targetAdminId}
          onChange={(e) => {
            setTargetAdminId(e.target.value);
            if (error) setError('');
          }}
          placeholder="-- Pilih Petugas CS Aktif --"
          options={otherAdmins.map((adm) => ({
            value: adm.id,
            label: `${adm.name} (${adm.role || 'CS'})${adm.isOnline ? ' • Online' : ''}`,
          }))}
          error={error}
        />

        <TextareaField
          label="Catatan Pengalihan / Alasan"
          rows={2}
          placeholder="Contoh: Pertanyaan seputar metodologi Survei Angkatan Kerja Nasional (Sakernas)..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------
// 7. Settings Modal
// ------------------------------------------------------------
interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: CsSettings;
  onSave: (newSettings: Partial<CsSettings>) => Promise<void>;
}

export function CsSettingsModal({
  open,
  onClose,
  settings,
  onSave,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'templates'>('general');
  const [form, setForm] = useState<CsSettings>(settings);
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(settings);
      setResetSuccess(false);
    }
  }, [settings, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleResetTemplates = () => {
    setForm((prev) => ({
      ...prev,
      ...DEFAULT_CS_TEMPLATES,
    }));
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 3000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pengaturan Customer Service"
      maxWidth="680px"
      actions={
        <div className="flex items-center justify-between w-full">
          <div>
            {activeTab === 'templates' && (
              <button
                type="button"
                onClick={handleResetTemplates}
                className="text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 transition-colors"
                title="Pulihkan seluruh template ke standar BPS"
              >
                <RotateCcw size={13} />
                <span>Reset ke Standar BPS</span>
              </button>
            )}
            {resetSuccess && (
              <span className="text-[11px] text-emerald-600 font-medium ml-2">
                ✓ Template dikembalikan ke default
              </span>
            )}
          </div>
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Tutup
            </Button>
            <Button variant="primary" onClick={handleSubmit} loading={loading}>
              Simpan Pengaturan
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Settings size={14} />
            Pengaturan Umum
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare size={14} />
            Template Pesan WhatsApp
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
              6
            </span>
          </button>
        </div>

        {/* Tab Content: General */}
        {activeTab === 'general' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label mb-1">Durasi Auto-Close Inaktif</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="120"
                    className="text-input w-24"
                    value={form.autoCloseMinutes}
                    onChange={(e) =>
                      setForm({ ...form, autoCloseMinutes: Number(e.target.value) || 15 })
                    }
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    menit
                  </span>
                </div>
                <p className="input-hint mt-1 text-[11px]">
                  Tiket inaktif otomatis ditutup setelah menit ini terlewati.
                </p>
              </div>

              <div>
                <label className="input-label mb-1">Maks. Tiket per Petugas</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    className="text-input w-24"
                    value={form.max_assigned_tickets_per_admin || 10}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        max_assigned_tickets_per_admin: Number(e.target.value) || 10,
                      })
                    }
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    tiket aktif
                  </span>
                </div>
                <p className="input-hint mt-1 text-[11px]">
                  Batas penugasan serentak untuk setiap petugas CS.
                </p>
              </div>
            </div>

            <div>
              <label className="input-label mb-1">Grace Period Status Resolved</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="1440"
                  className="text-input w-24"
                  value={form.resolved_grace_period_minutes || 60}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      resolved_grace_period_minutes: Number(e.target.value) || 60,
                    })
                  }
                />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  menit
                </span>
              </div>
              <p className="input-hint mt-1 text-[11px]">
                Waktu tunggu sebelum tiket dengan status RESOLVED otomatis berstatus CLOSED permanen.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.soundEnabled}
                  onChange={(e) => setForm({ ...form, soundEnabled: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Aktifkan Notifikasi Suara (Chime Dering Pesan & Tiket Baru)
                </span>
              </label>
            </div>

            <TextareaField
              label="Template Salam Pembuka CS Otomatis"
              rows={3}
              value={form.greetingTemplate}
              onChange={(e) => setForm({ ...form, greetingTemplate: e.target.value })}
              hint="Gunakan tag {adminName} untuk menyematkan nama petugas secara dinamis."
            />
          </form>
        )}

        {/* Tab Content: WhatsApp Templates */}
        {activeTab === 'templates' && (
          <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="p-3 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/50 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
              <Info size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Pengaturan Notifikasi Otomatis WhatsApp</p>
                Pesan di bawah ini dikirim otomatis ke nomor WhatsApp pengguna saat status tiket berubah. Tag dalam kurung kurawal seperti <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded font-mono text-[11px]">{'{ticket_number}'}</code> akan digantikan otomatis oleh data aktual tiket.
              </div>
            </div>

            {/* 1. template_waiting */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  1. Tiket Dibuat (Status WAITING)
                </label>
                <div className="flex gap-1">
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono px-1.5 py-0.5 rounded">
                    {'{ticket_number}'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Dikirim saat pengguna membuat tiket CS melalui bot WhatsApp.
              </p>
              <textarea
                rows={4}
                className="text-input font-mono text-xs leading-relaxed"
                value={form.template_waiting ?? DEFAULT_CS_TEMPLATES.template_waiting}
                onChange={(e) => setForm({ ...form, template_waiting: e.target.value })}
                placeholder="Template saat tiket dibuat..."
              />
            </div>

            {/* 2. template_assigned */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  2. Tiket Diambil Petugas (Status ASSIGNED)
                </label>
                <div className="flex gap-1">
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono px-1.5 py-0.5 rounded">
                    {'{admin_name}'}
                  </span>
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono px-1.5 py-0.5 rounded">
                    {'{ticket_number}'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Dikirim saat petugas CS mengklik tombol &quot;Ambil Tiket&quot;.
              </p>
              <textarea
                rows={4}
                className="text-input font-mono text-xs leading-relaxed"
                value={form.template_assigned ?? DEFAULT_CS_TEMPLATES.template_assigned}
                onChange={(e) => setForm({ ...form, template_assigned: e.target.value })}
                placeholder="Template saat petugas mengambil tiket..."
              />
            </div>

            {/* 3. template_pending */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  3. Tiket Ditunda (Status PENDING)
                </label>
                <div className="flex gap-1">
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono px-1.5 py-0.5 rounded">
                    {'{ticket_number}'}
                  </span>
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono px-1.5 py-0.5 rounded">
                    {'{reason}'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Dikirim saat petugas mengubah tiket menjadi Tertunda (Pending).
              </p>
              <textarea
                rows={4}
                className="text-input font-mono text-xs leading-relaxed"
                value={form.template_pending ?? DEFAULT_CS_TEMPLATES.template_pending}
                onChange={(e) => setForm({ ...form, template_pending: e.target.value })}
                placeholder="Template saat tiket dipending..."
              />
            </div>

            {/* 4. template_resolved */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                  4. Konsultasi Selesai (Status RESOLVED)
                </label>
                <div className="flex gap-1">
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono px-1.5 py-0.5 rounded">
                    {'{ticket_number}'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Dikirim saat petugas menyelesaikan tiket sebelum grace period berakhir.
              </p>
              <textarea
                rows={4}
                className="text-input font-mono text-xs leading-relaxed"
                value={form.template_resolved ?? DEFAULT_CS_TEMPLATES.template_resolved}
                onChange={(e) => setForm({ ...form, template_resolved: e.target.value })}
                placeholder="Template saat tiket diselesaikan..."
              />
            </div>

            {/* 5. template_closed */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                  5. Tiket Ditutup (Status CLOSED / Kembali ke Bot)
                </label>
                <div className="flex gap-1">
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono px-1.5 py-0.5 rounded">
                    {'{ticket_number}'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Dikirim saat tiket ditutup permanen dan nomor pengguna dikembalikan ke Bot AI SAPA.
              </p>
              <textarea
                rows={4}
                className="text-input font-mono text-xs leading-relaxed"
                value={form.template_closed ?? DEFAULT_CS_TEMPLATES.template_closed}
                onChange={(e) => setForm({ ...form, template_closed: e.target.value })}
                placeholder="Template saat tiket ditutup..."
              />
            </div>

            {/* 6. template_admin_message */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  6. Format Pembungkus Pesan CS (Admin Message)
                </label>
                <div className="flex gap-1">
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono px-1.5 py-0.5 rounded">
                    {'{message}'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Format pembungkus teks yang diketikkan petugas saat membalas pesan di chat room.
              </p>
              <textarea
                rows={2}
                className="text-input font-mono text-xs leading-relaxed"
                value={form.template_admin_message ?? DEFAULT_CS_TEMPLATES.template_admin_message}
                onChange={(e) => setForm({ ...form, template_admin_message: e.target.value })}
                placeholder="{message}"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------
// 8. Image Viewer Lightbox Modal
// ------------------------------------------------------------
interface ImageLightboxProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string | null;
  caption?: string;
}

export function ImageLightboxModal({
  open,
  onClose,
  imageUrl,
  caption,
}: ImageLightboxProps) {
  if (!open || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[85vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-slate-300 transition-colors p-1"
          title="Tutup Pratinjau"
        >
          <XCircle size={24} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={caption || 'Preview Media'}
          className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-2xl border border-white/10"
        />
        {caption && (
          <p className="text-sm text-slate-200 text-center mt-3 bg-black/40 px-4 py-1.5 rounded-full">
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}
