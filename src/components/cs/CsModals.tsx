// ============================================================
// SAPA BPS 1901 IN — Customer Service Modals & Dialogs
// ============================================================

import React, { useState } from 'react';
import { Modal, Button, TextareaField, Select } from '@/components/ui';
import { Ticket, CsAdmin, CsSettings } from '@/lib/ticketTypes';
import {
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  XCircle,
  Bot,
  RotateCcw,
  ShieldAlert,
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
  const [form, setForm] = useState<CsSettings>(settings);
  const [loading, setLoading] = useState(false);

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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pengaturan Customer Service"
      maxWidth="540px"
      actions={
        <div className="flex justify-end gap-2.5 w-full">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Tutup
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            Simpan Pengaturan
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-1">
        <div>
          <label className="input-label mb-1">Durasi Auto-Close Tiket Inaktif</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="5"
              max="120"
              className="text-input w-28"
              value={form.autoCloseMinutes}
              onChange={(e) =>
                setForm({ ...form, autoCloseMinutes: Number(e.target.value) || 15 })
              }
            />
            <span className="text-xs text-slate-600">
              menit setelah pesan terakhir
            </span>
          </div>
          <p className="input-hint mt-1">
            Tiket yang tidak memiliki aktivitas baru akan ditutup otomatis oleh sistem pekerja latar belakang (autoCloseWorker).
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.soundEnabled}
              onChange={(e) => setForm({ ...form, soundEnabled: e.target.checked })}
              className="rounded border-slate-300 text-blue-600"
            />
            <span className="text-xs font-medium text-slate-800">
              Aktifkan Notifikasi Suara (Chime Dering Pesan & Tiket Baru)
            </span>
          </label>
        </div>

        <TextareaField
          label="Template Salam Pembuka CS Otomatis"
          rows={3}
          value={form.greetingTemplate}
          onChange={(e) => setForm({ ...form, greetingTemplate: e.target.value })}
          hint="Gunakan tag {adminName} untuk menyematkan nama Anda."
        />
      </form>
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
