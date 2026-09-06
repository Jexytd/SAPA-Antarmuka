'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { Button, Modal, Toast, ServerOfflineState } from '@/components/ui';
import { BackendApi, getEffectiveBackendUrl, BotStatusData } from '@/lib/apiClient';
import { getBackendStatus, subscribeBackendStatus, syncWithBackend, BackendConnectionState } from '@/lib/repository';
import { formatDate, cn } from '@/lib/utils';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Radio,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Sparkles,
  PhoneCall,
  KeyRound,
  Info,
  Layers,
  Activity,
  Server,
  Zap,
  Database,
  Wifi,
  CheckCircle,
} from 'lucide-react';

interface SystemHealthData {
  status: string;
  service: string;
  port: string;
  timestamp: string;
  uptime: number;
  botState: string;
  phoneNumber: string | null;
}

const QR_EXPIRE_SECONDS = 300; // 5 menit auto-reset QR Code

export default function WhatsAppHostPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  const [backendState, setBackendState] = useState<BackendConnectionState>(() => getBackendStatus());
  const [isRetrying, setIsRetrying] = useState(false);

  // Bot Status State
  const [botStatus, setBotStatus] = useState<BotStatusData>({
    state: 'connecting',
    qr: null,
  });
  const [isFetchingStatus, setIsFetchingStatus] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Auto-refresh countdown (60s)
  const [countdown, setCountdown] = useState<number>(QR_EXPIRE_SECONDS);
  const [isRefreshingQR, setIsRefreshingQR] = useState(false);

  // Tabs: 'qr' | 'pairing'
  const [loginMethod, setLoginMethod] = useState<'qr' | 'pairing'>('qr');

  // Phone Pairing Code State
  const [phoneInput, setPhoneInput] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Logout Modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Diagnostics & Detailed Status Check
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [lastPing, setLastPing] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [isCheckingDiagnostics, setIsCheckingDiagnostics] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [datasetCount, setDatasetCount] = useState<number | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Helper formatting countdown (M:SS)
  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return '0 detik';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) {
      return `${m}m ${s < 10 ? '0' : ''}${s}s`;
    }
    return `${s}s`;
  };

  // Helper formatting uptime
  const formatUptime = (seconds?: number) => {
    if (!seconds && seconds !== 0) return '-';
    const s = Math.floor(seconds);
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (days > 0) return `${days} hari ${hours} jam ${minutes} menit`;
    if (hours > 0) return `${hours} jam ${minutes} menit`;
    if (minutes > 0) return `${minutes} menit ${secs} detik`;
    return `${secs} detik`;
  };

  // Helper formatting phone
  const formatPhone = (phone?: string | null) => {
    if (!phone) return '-';
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('62')) {
      return `+62 ${clean.slice(2, 5)}-${clean.slice(5, 9)}-${clean.slice(9)}`;
    }
    return phone;
  };

  // Diagnostics Runner
  const handleRunDiagnostics = useCallback(async (openModal = true) => {
    setIsCheckingDiagnostics(true);
    setIsFetchingStatus(true);
    setCheckError(null);
    const startTime = performance.now();

    try {
      const [healthRes, botRes, summaryRes] = await Promise.all([
        BackendApi.getHealth().catch(() => null),
        BackendApi.getBotStatus().catch(() => null),
        BackendApi.getDashboardSummary().catch(() => null),
      ]);

      const ping = Math.round(performance.now() - startTime);
      setLastPing(ping);
      setLastCheckedAt(new Date());

      if (summaryRes && typeof summaryRes.total_datasets === 'number') {
        setDatasetCount(summaryRes.total_datasets);
      }

      if (botRes) {
        setBotStatus(botRes);

        // Sinkronisasi sisa waktu dari server jika tersedia
        if (botRes.qrExpiresAt) {
          const remainingSec = Math.max(0, Math.round((botRes.qrExpiresAt - Date.now()) / 1000));
          setCountdown(remainingSec);
        }

        // Tampilkan QR code saat qr_ready, scanning, atau connecting
        if (botRes.qr && (botRes.state === 'qr_ready' || botRes.state === 'scanning' || botRes.state === 'connecting')) {
          try {
            const url = await QRCode.toDataURL(botRes.qr, {
              width: 320,
              margin: 2,
              color: { dark: '#0f172a', light: '#ffffff' },
            });
            setQrDataUrl(url);
          } catch (qrErr) {
            console.error('Failed generating QR Data URL:', qrErr);
          }
        } else if (!botRes.qr) {
          setQrDataUrl(null);
        }
      }

      const isBackendLive = Boolean(healthRes && (healthRes.status === 'ok' || healthRes.service)) || Boolean(botRes);

      if (isBackendLive) {
        if (healthRes) {
          setHealthData(healthRes);
        }
        const botConnected = botRes?.state === 'connected' || healthRes?.botState === 'connected';
        const phone = botRes?.phoneNumber || healthRes?.phoneNumber;

        if (botConnected) {
          setToast({
            msg: `✅ [${ping}ms] Sistem Normal: Server Aktif & WhatsApp Bot Terhubung (${formatPhone(phone)})`,
            type: 'success',
          });
        } else if (botRes?.state === 'qr_ready') {
          setToast({
            msg: `🟡 [${ping}ms] Server Backend Aktif. Bot WhatsApp siap scan QR code.`,
            type: 'success',
          });
        } else {
          setToast({
            msg: `🔵 [${ping}ms] Server Backend Aktif. Bot WhatsApp status: ${botRes?.state || healthRes?.botState || 'connecting'}`,
            type: 'success',
          });
        }
      } else {
        setCheckError('Server backend tidak merespons. Pastikan file START_SAPA_BPS.bat dan tunnel Ngrok aktif.');
        setToast({
          msg: '❌ Server backend tidak merespons. Periksa tunnel Ngrok dan START_SAPA_BPS.bat.',
          type: 'error',
        });
      }

      if (openModal) {
        setShowDiagnosticModal(true);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Gagal menghubungi server.';
      setCheckError(errMsg);
      setToast({
        msg: '❌ Terjadi kesalahan saat memeriksa status server.',
        type: 'error',
      });
      if (openModal) {
        setShowDiagnosticModal(true);
      }
    } finally {
      setIsCheckingDiagnostics(false);
      setIsFetchingStatus(false);
    }
  }, []);

  const handleCopyReport = () => {
    const timeStr = lastCheckedAt
      ? lastCheckedAt.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' })
      : new Date().toLocaleString('id-ID');
    const isBotOnline = botStatus.state === 'connected' || healthData?.botState === 'connected';
    const phone = botStatus.phoneNumber || healthData?.phoneNumber;
    const uptimeStr = formatUptime(healthData?.uptime);

    const report = [
      '====================================================',
      '        LAPORAN STATUS & DIAGNOSTIK SAPA BPS        ',
      '====================================================',
      `Waktu Pengecekan : ${timeStr} WIB`,
      `Status Backend   : ${healthData ? `ONLINE / SEHAT (${healthData.port ? `Port ${healthData.port}` : 'Service Backend'})` : 'TIDAK MERESPONS'}`,
      `Latency (Ping)   : ${lastPing !== null ? `${lastPing} ms` : '-'}`,
      `Uptime Server    : ${uptimeStr}`,
      `Bot WhatsApp     : ${isBotOnline ? 'ONLINE & TERHUBUNG' : botStatus.state === 'qr_ready' ? 'MENUNGGU SCAN QR' : botStatus.state}`,
      `Nomor Host       : ${formatPhone(phone)}`,
      `Enkripsi Sesi    : Signal Protocol End-to-End`,
      `Dataset Aktif    : ${datasetCount !== null ? `${datasetCount} Dataset` : 'Tersinkron'}`,
      `Public Endpoint  : ${getEffectiveBackendUrl() || 'Direct Proxy'}`,
      `Health Endpoint  : ${getEffectiveBackendUrl() ? `${getEffectiveBackendUrl()}/health` : '/health'}`,
      '====================================================',
      isBotOnline
        ? 'KESIMPULAN: Layanan Chatbot WhatsApp & REST API beroperasi normal.'
        : 'KESIMPULAN: Server aktif, silakan scan QR code atau sambungkan nomor host.',
    ].join('\n');

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setToast({ msg: 'Laporan diagnostik lengkap berhasil disalin ke clipboard!', type: 'success' });
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // 1. Fetch Bot Status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await BackendApi.getBotStatus();
      if (res) {
        setBotStatus(res);

        // Sinkronisasi countdown dari waktu kedaluwarsa server jika ada
        if (res.qrExpiresAt) {
          const remainingSec = Math.max(0, Math.round((res.qrExpiresAt - Date.now()) / 1000));
          setCountdown(remainingSec);
        }

        // Tampilkan QR code saat status qr_ready, scanning, maupun connecting
        if (res.qr && (res.state === 'qr_ready' || res.state === 'scanning' || res.state === 'connecting')) {
          try {
            const url = await QRCode.toDataURL(res.qr, {
              width: 320,
              margin: 2,
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
            setQrDataUrl(url);
          } catch (qrErr) {
            console.error('Failed generating QR Data URL:', qrErr);
          }
        } else if (!res.qr) {
          setQrDataUrl(null);
        }
      }
    } catch (err) {
      console.error('Error fetching bot status:', err);
    }
  }, []);

  // 2. Refresh QR Code (manual = pemicu refresh ke server, auto = hanya sinkronisasi status terbaru)
  const handleRefreshQR = useCallback(async (manual = true) => {
    setIsRefreshingQR(true);
    try {
      if (manual) {
        await BackendApi.refreshBotQR('Penyegaran QR Code manual oleh pengguna');
      }
      setCountdown(QR_EXPIRE_SECONDS);
      setPairingCode(null);
      await fetchStatus();
      if (manual) {
        setToast({ msg: 'Sesi diperbarui. Menyiapkan QR Code baru (masa aktif 5 menit)...', type: 'success' });
      }
    } catch (err) {
      if (manual) {
        setToast({ msg: 'Gagal memperbarui QR Code. Pastikan server backend aktif.', type: 'error' });
      }
    } finally {
      setIsRefreshingQR(false);
    }
  }, [fetchStatus]);

  // 3. Logout / Putuskan Sambungan
  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      const res = await BackendApi.logoutBot();
      if (res && res.success) {
        setToast({ msg: 'Sambungan host WhatsApp berhasil diputuskan. QR Code baru siap.', type: 'success' });
        setShowLogoutModal(false);
        setBotStatus({ state: 'connecting', qr: null });
        setCountdown(QR_EXPIRE_SECONDS);
        await handleRefreshQR(false);
      } else {
        setToast({ msg: res?.message || 'Gagal logout dari host WhatsApp.', type: 'error' });
      }
    } catch (err) {
      setToast({ msg: 'Terjadi kesalahan saat memutuskan sambungan.', type: 'error' });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // 4. Request Pairing Code (Nomor Telepon)
  const handleRequestPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) {
      setToast({ msg: 'Silakan masukkan nomor WhatsApp Anda.', type: 'error' });
      return;
    }

    setIsRequestingCode(true);
    setPairingCode(null);
    try {
      const res = await BackendApi.requestPairingCode(phoneInput.trim());
      if (res && res.success && res.code) {
        setPairingCode(res.code);
        setToast({ msg: 'Kode pairing berhasil didapatkan!', type: 'success' });
      } else {
        setToast({
          msg: res?.message || 'Gagal mendapatkan kode pairing. Pastikan nomor benar dan bot belum terhubung.',
          type: 'error',
        });
      }
    } catch (err) {
      setToast({ msg: 'Terjadi kesalahan saat meminta kode pairing.', type: 'error' });
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Initial fetch and polling loop
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const initialTimer = setTimeout(() => {
      fetchStatus();
    }, 0);
    const interval = setInterval(fetchStatus, 3000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isAuthenticated, isLoading, router, fetchStatus]);

  // Auto-refresh polling saat BELUM connected & TIDAK sedang di-scan
  useEffect(() => {
    if (
      botStatus.state === 'connected' ||
      healthData?.botState === 'connected' ||
      botStatus.isScanning ||
      botStatus.state === 'scanning'
    ) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Hanya sinkronisasi status/QR terbaru tanpa mereset sesi aktif di server
          handleRefreshQR(false);
          return QR_EXPIRE_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [botStatus.state, healthData?.botState, handleRefreshQR]);

  // Subscribe to backend connection status for offline UI
  useEffect(() => {
    const unsub = subscribeBackendStatus((state) => {
      setBackendState(state);
    });
    return unsub;
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await syncWithBackend();
    } finally {
      setIsRetrying(false);
    }
  };

  if (isLoading || !isAuthenticated) return null;

  const isOffline = backendState.hasCheckedInitial && !backendState.isConnected;

  if (isOffline) {
    return (
      <AppLayout>
        <Header
          title="Host WhatsApp Chatbot"
          subtitle="Kelola perangkat host penanggung jawab chatbot resmi SAPA BPS Kab. Bangka"
        />
        <div className="page-content" style={{ padding: '24px 16px' }}>
          <ServerOfflineState
            title="Server Backend Sedang Offline"
            message="Halaman WhatsApp tidak dapat diakses karena server backend tidak aktif atau offline. QR Code dan fitur pairing membutuhkan koneksi ke server backend yang aktif."
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        </div>
      </AppLayout>
    );
  }

  const isConnected = botStatus.state === 'connected' || healthData?.botState === 'connected';
  const effectivePhoneNumber = botStatus.phoneNumber || healthData?.phoneNumber;

  return (
    <AppLayout>
      <Header
        title="Host WhatsApp Chatbot"
        subtitle="Kelola perangkat host penanggung jawab chatbot resmi SAPA BPS Kab. Bangka"
        actions={
          <div className="flex items-center gap-3">
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Terhubung
              </span>
            ) : (botStatus.isScanning || botStatus.state === 'scanning') ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                Sedang memproses...
              </span>
            ) : botStatus.state === 'connecting' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Menyambungkan...
              </span>
            ) : botStatus.state === 'qr_ready' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Menunggu scan QR</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500 font-mono text-[11px]">{formatCountdown(countdown)}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Menyiapkan socket...
              </span>
            )}

            <Button
              variant="secondary"
              size="sm"
              icon={
                <RefreshCw
                  size={13}
                  className={isCheckingDiagnostics || isFetchingStatus ? 'spin' : ''}
                />
              }
              onClick={() => handleRunDiagnostics(true)}
              title="Periksa koneksi, latency ping, dan diagnosa status lengkap"
              className="text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
            >
              <span>{isCheckingDiagnostics ? 'Memeriksa...' : 'Cek Status'}</span>
              {lastPing !== null && !isCheckingDiagnostics && (
                <span className="text-[11px] font-mono text-slate-400 ml-1">
                  {lastPing}ms
                </span>
              )}
            </Button>
          </div>
        }
      />

      <div className="page-content max-w-[1240px] mx-auto px-6 sm:px-8 py-8">
        {/* ============================================================ */}
        {/* KONDISI 1: BOT SUDAH TERHUBUNG (CONNECTED)                   */}
        {/* ============================================================ */}
        {isConnected ? (
          <div className="space-y-6">
            {/* Panel Perangkat Terhubung */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-100">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Perangkat Host Aktif
                  </div>
                  <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
                    {formatPhone(effectivePhoneNumber)}
                  </h2>
                  <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
                    Nomor WhatsApp ini bertindak sebagai penanggung jawab resmi layanan chatbot <strong>SAPA BPS Kab. Bangka</strong>. Seluruh pesan masyarakat akan dijawab secara otomatis melalui nomor ini.
                  </p>
                </div>

                <div>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<LogOut size={14} />}
                    onClick={() => setShowLogoutModal(true)}
                    className="text-xs font-medium"
                  >
                    Putuskan Sambungan
                  </Button>
                </div>
              </div>

              {/* Status Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-xs text-slate-600">
                <div className="flex items-center gap-2.5">
                  <Clock size={15} className="text-slate-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[11px]">Terhubung Sejak</span>
                    <span className="font-medium text-slate-700">
                      {botStatus.connectedAt ? formatDate(botStatus.connectedAt) : 'Sesi Aktif'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={15} className="text-slate-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[11px]">Protokol Enkripsi</span>
                    <span className="font-medium text-slate-700">Signal Protocol (End-to-End)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Radio size={15} className="text-slate-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[11px]">Basis Pengetahuan</span>
                    <span className="font-medium text-slate-700">Katalog Dataset Resmi BPS</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Aksi Cepat / Shortcut */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">Simulator Chatbot</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Uji coba respons bot terhadap berbagai kata kunci tanpa mengirim pesan WhatsApp sungguhan.
                  </p>
                </div>
                <Link href="/keywords" className="shrink-0 pt-0.5">
                  <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}>
                    Buka
                  </Button>
                </Link>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">Input Data Statistik</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Perbarui atau tambahkan indikator statistik terbaru agar dapat diakses oleh publik.
                  </p>
                </div>
                <Link href="/input" className="shrink-0 pt-0.5">
                  <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}>
                    Input Data
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* KONDISI 2: BOT BELUM TERHUBUNG (LOGIN QR / PAIRING)          */
          /* ============================================================ */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Kolom Kiri: Main Connection Area */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
              {/* Header Connection */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
                  Hubungkan WhatsApp
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Buka WhatsApp di smartphone Anda → Perangkat Tertaut → arahkan kamera ke QR Code.
                </p>
              </div>

              {/* Tabs Switcher Sederhana & Bersih */}
              <div className="flex border-b border-slate-200 mb-6">
                <button
                  type="button"
                  onClick={() => setLoginMethod('qr')}
                  className={cn(
                    'pb-3 px-1 mr-6 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 cursor-pointer',
                    loginMethod === 'qr'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  )}
                >
                  <QrCode size={15} />
                  Scan QR Code
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMethod('pairing')}
                  className={cn(
                    'pb-3 px-1 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 cursor-pointer',
                    loginMethod === 'pairing'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  )}
                >
                  <PhoneCall size={15} />
                  Nomor HP (Pairing)
                </button>
              </div>

              {/* Tab 1: QR Code Method */}
              {loginMethod === 'qr' && (
                <div className="flex flex-col items-center text-center">
                  {/* Inline Error Alert jika ada kendala */}
                  {botStatus.lastError && !isConnected && (
                    <div className="w-full text-left bg-red-50/70 border border-red-200 rounded-lg p-3.5 mb-6">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold text-red-900">
                            {botStatus.lastError.title || 'QR Code telah kedaluwarsa'}
                          </p>
                          <p className="text-red-700 leading-relaxed">
                            {botStatus.lastError.message || 'QR Code sebelumnya sudah tidak dapat digunakan. Buat QR Code baru untuk melanjutkan.'}
                          </p>
                          {botStatus.lastError.suggestedAction && (
                            <p className="text-red-600 text-[11px]">
                              Saran: {botStatus.lastError.suggestedAction}
                            </p>
                          )}
                          <div className="pt-2">
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<RefreshCw size={12} className={isRefreshingQR ? 'spin' : ''} />}
                              onClick={() => handleRefreshQR(true)}
                              disabled={isRefreshingQR}
                              className="text-xs font-medium"
                            >
                              {isRefreshingQR ? 'Menyiapkan...' : 'Buat QR Baru'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scanning State Indicator */}
                  {(botStatus.isScanning || botStatus.state === 'scanning') && (
                    <div className="w-full text-left bg-sky-50 border border-sky-200 rounded-lg p-3 mb-6 flex items-center gap-3">
                      <RefreshCw size={15} className="text-sky-600 spin shrink-0" />
                      <div className="text-xs">
                        <span className="font-semibold text-sky-900 block">QR Code sedang di-scan oleh WhatsApp</span>
                        <span className="text-sky-700">
                          {botStatus.scanMessage || 'Sedang memproses otorisasi perangkat di smartphone Anda...'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* QR Code Container Bersih */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 inline-flex flex-col items-center justify-center mb-4">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="QR Code WhatsApp Bot"
                        className="w-[280px] h-[280px] rounded block"
                      />
                    ) : (
                      <div className="w-[280px] h-[280px] flex flex-col items-center justify-center text-slate-400 gap-3">
                        <RefreshCw size={28} className="spin text-slate-400" />
                        <span className="text-xs font-medium text-slate-500">Menyiapkan QR Code...</span>
                      </div>
                    )}
                  </div>

                  {/* Countdown Text */}
                  <div className="text-xs text-slate-500 mb-4">
                    QR Code berlaku selama{' '}
                    <span className="font-mono font-medium text-slate-700">
                      {formatCountdown(countdown)}
                    </span>
                  </div>

                  {/* Action Button Primer */}
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<RefreshCw size={13} className={isRefreshingQR ? 'spin' : ''} />}
                      onClick={() => handleRefreshQR(true)}
                      disabled={isRefreshingQR}
                      className="text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
                    >
                      {isRefreshingQR ? 'Sedang Memperbarui...' : 'Buat QR Baru'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Tab 2: Pairing Code Method */}
              {loginMethod === 'pairing' && (
                <div className="max-w-md mx-auto py-2">
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Tautkan dengan Nomor HP
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Masukkan nomor WhatsApp Anda untuk menerima kode pairing 8-digit.
                    </p>
                  </div>

                  <form onSubmit={handleRequestPairing} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5" htmlFor="phone-input">
                        Nomor WhatsApp Host
                      </label>
                      <input
                        id="phone-input"
                        type="text"
                        placeholder="Contoh: 081234567890"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Gunakan awalan 08 atau 62 (contoh: 081234567890)
                      </span>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      icon={<KeyRound size={14} />}
                      disabled={isRequestingCode}
                      className="w-full text-xs font-medium"
                    >
                      {isRequestingCode ? 'Meminta Kode...' : 'Dapatkan Kode Pairing'}
                    </Button>
                  </form>

                  {/* Kode Pairing Output */}
                  {pairingCode && (
                    <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-3">
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                        Masukkan kode ini di WhatsApp Anda:
                      </span>
                      <div className="font-mono text-2xl font-bold text-slate-900 tracking-widest bg-white py-2.5 px-4 rounded border border-slate-200">
                        {pairingCode}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={copiedCode ? <Check size={13} /> : <Copy size={13} />}
                        onClick={handleCopyCode}
                        className="w-full text-xs font-medium"
                      >
                        {copiedCode ? 'Tersalin ke Clipboard' : 'Salin Kode'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Kolom Kanan: Panduan Langkah & Privasi */}
            <div className="lg:col-span-5 space-y-8 pt-2">
              {/* Cara Menghubungkan */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-4">
                  Cara Menghubungkan
                </h3>

                <div className="space-y-4">
                  <div className="flex items-start gap-3.5">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      01
                    </span>
                    <p className="text-sm text-slate-600 leading-normal">
                      Buka aplikasi <strong>WhatsApp</strong> di smartphone Anda.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      02
                    </span>
                    <p className="text-sm text-slate-600 leading-normal">
                      Buka menu <strong>Perangkat Tertaut</strong>.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      03
                    </span>
                    <p className="text-sm text-slate-600 leading-normal">
                      Pilih <strong>Tautkan Perangkat</strong>.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      04
                    </span>
                    <p className="text-sm text-slate-600 leading-normal">
                      Scan <strong>QR Code</strong> yang ditampilkan pada halaman ini.
                    </p>
                  </div>
                </div>
              </div>

              {/* Garis pemisah halus */}
              <div className="border-t border-slate-200" />

              {/* Privasi & Keamanan */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck size={16} className="text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Privasi & Keamanan
                  </h3>
                </div>

                <div className="space-y-2.5 text-xs text-slate-500 leading-relaxed">
                  <p>
                    Bot hanya membalas chat pribadi seputar pertanyaan data statistik resmi BPS.
                  </p>
                  <p>
                    Bot tidak membaca atau membalas grup tempat nomor Anda berada.
                  </p>
                  <p>
                    Jika ingin mengganti nomor host, logout terlebih dahulu lalu lakukan pairing dengan nomor baru.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Logout Host */}
      <Modal
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Putuskan Sambungan WhatsApp Host?"
        variant="danger"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowLogoutModal(false)} disabled={isLoggingOut}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleConfirmLogout} disabled={isLoggingOut}>
              {isLoggingOut ? 'Memutuskan Sambungan...' : 'Ya, Putuskan & Buat QR Baru'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertCircle size={20} />
          </div>
          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: 13.5, color: '#334155', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin memutuskan sambungan nomor WhatsApp <strong>{formatPhone(effectivePhoneNumber)}</strong> dari bot SAPA BPS?
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: '#64748b', lineHeight: 1.4 }}>
              Setelah diputuskan, bot tidak akan lagi membalas pesan WhatsApp dari nomor ini sampai ada perangkat baru yang memindai QR code berikutnya.
            </p>
          </div>
        </div>
      </Modal>

      {/* Modal Diagnostik Status & Kesehatan Sistem */}
      <Modal
        open={showDiagnosticModal}
        onClose={() => setShowDiagnosticModal(false)}
        title="Diagnostik Status & Kesehatan Sistem"
        description="Pemeriksaan konektivitas real-time antara Frontend, Server Backend (Port 80), Socket WhatsApp, dan Tunnel Publik."
        maxWidth={620}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={copiedReport ? <Check size={14} /> : <Copy size={14} />}
              onClick={handleCopyReport}
            >
              {copiedReport ? 'Tersalin!' : 'Salin Laporan'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={isCheckingDiagnostics ? 'spin' : ''} />}
              onClick={() => handleRunDiagnostics(false)}
              disabled={isCheckingDiagnostics}
            >
              {isCheckingDiagnostics ? 'Menguji...' : 'Uji Ping Ulang'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowDiagnosticModal(false)}
            >
              Tutup
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card Hero Ringkasan Status */}
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: checkError
                ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                : botStatus.state === 'connected'
                ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: `1px solid ${
                checkError
                  ? '#fca5a5'
                  : botStatus.state === 'connected'
                  ? '#86efac'
                  : '#fde68a'
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: checkError
                    ? '#dc2626'
                    : botStatus.state === 'connected'
                    ? '#16a34a'
                    : '#d97706',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  flexShrink: 0,
                }}
              >
                {checkError ? (
                  <AlertCircle size={24} />
                ) : botStatus.state === 'connected' ? (
                  <CheckCircle2 size={24} />
                ) : (
                  <Zap size={24} />
                )}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: checkError
                      ? '#b91c1c'
                      : botStatus.state === 'connected'
                      ? '#15803d'
                      : '#b45309',
                  }}
                >
                  {checkError
                    ? 'GANGGUAN KONEKSI'
                    : botStatus.state === 'connected'
                    ? 'SEMUA SISTEM NORMAL'
                    : 'MENUNGGU KONEKSI'}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#0f172a',
                    marginTop: 2,
                  }}
                >
                  {checkError
                    ? 'Backend Tidak Menjawab'
                    : botStatus.state === 'connected'
                    ? 'Bot WhatsApp & Server Siap'
                    : botStatus.state === 'qr_ready'
                    ? 'Perlu Pindai QR WhatsApp'
                    : 'Menyiapkan Socket WhatsApp...'}
                </div>
              </div>
            </div>

            {/* Latency Meter Pill */}
            {lastPing !== null && !checkError && (
              <div
                style={{
                  background: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: 20,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Activity
                  size={16}
                  style={{
                    color: lastPing < 60 ? '#16a34a' : lastPing < 200 ? '#d97706' : '#dc2626',
                  }}
                />
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>LATENCY</div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: lastPing < 60 ? '#16a34a' : lastPing < 200 ? '#d97706' : '#dc2626',
                    }}
                  >
                    {lastPing} ms{' '}
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#64748b' }}>
                      ({lastPing < 60 ? 'Optimal' : lastPing < 200 ? 'Sedang' : 'Lambat'})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Grid Komponen Sistem */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 10,
            }}
          >
            {/* 1. Server Express Backend */}
            <div
              style={{
                border: '1px solid var(--slate-200)',
                borderRadius: 10,
                padding: 12,
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                  <Server size={15} style={{ color: '#2563eb' }} />
                  Server Backend Express
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: (healthData || botStatus.state) ? '#dcfce7' : '#fee2e2',
                    color: (healthData || botStatus.state) ? '#15803d' : '#b91c1c',
                  }}
                >
                  {(healthData || botStatus.state) ? 'PORT 80 AKTIF' : 'OFFLINE'}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div>Target: <strong style={{ wordBreak: 'break-all' }}>{getEffectiveBackendUrl()}</strong></div>
                <div>Uptime: <strong>{formatUptime(healthData?.uptime)}</strong></div>
              </div>
            </div>

            {/* 2. Socket Baileys WhatsApp */}
            <div
              style={{
                border: '1px solid var(--slate-200)',
                borderRadius: 10,
                padding: 12,
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                  <Smartphone size={15} style={{ color: '#10b981' }} />
                  Socket Bot WhatsApp
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background:
                      botStatus.state === 'connected'
                        ? '#dcfce7'
                        : botStatus.state === 'qr_ready'
                        ? '#fef3c7'
                        : '#f1f5f9',
                    color:
                      botStatus.state === 'connected'
                        ? '#15803d'
                        : botStatus.state === 'qr_ready'
                        ? '#b45309'
                        : '#475569',
                  }}
                >
                  {botStatus.state === 'connected'
                    ? 'TERHUBUNG'
                    : botStatus.state === 'qr_ready'
                    ? 'SIAP QR'
                    : 'CONNECTING'}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div>Nomor: <strong>{formatPhone(botStatus.phoneNumber || healthData?.phoneNumber)}</strong></div>
                <div>Sesi: <strong>Signal Protocol (E2E Encrypted)</strong></div>
              </div>
            </div>

            {/* 3. Ngrok Public Tunnel */}
            <div
              style={{
                border: '1px solid var(--slate-200)',
                borderRadius: 10,
                padding: 12,
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                  <Radio size={15} style={{ color: '#0284c7' }} />
                  REST API Endpoint
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: '#e0f2fe',
                    color: '#0369a1',
                  }}
                >
                  {getEffectiveBackendUrl().startsWith('https') ? 'HTTPS LIVE' : 'BACKEND TARGET'}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  URL: <strong>{getEffectiveBackendUrl() || 'Menggunakan Relative Proxy'}</strong>
                </div>
                <div>Target Service: <strong>{healthData?.service || 'SAPA BPS WhatsApp Backend'}</strong> {healthData?.port ? `(Port ${healthData.port})` : ''}</div>
              </div>
            </div>

            {/* 4. AI & NLP Store */}
            <div
              style={{
                border: '1px solid var(--slate-200)',
                borderRadius: 10,
                padding: 12,
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                  <Sparkles size={15} style={{ color: '#8b5cf6' }} />
                  Mesin NLP & Dataset BPS
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: '#f3e8ff',
                    color: '#7e22ce',
                  }}
                >
                  SIAP MELAYANI
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div>Dataset Aktif: <strong>{datasetCount !== null ? `${datasetCount} Dataset` : 'Tersinkronisasi'}</strong></div>
                <div>Model AI: <strong>Rule Matcher + NLP Mesin Data</strong></div>
              </div>
            </div>
          </div>

          {/* Footer Info / Petunjuk jika error */}
          {checkError ? (
            <div
              style={{
                padding: 12,
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: 8,
                fontSize: 12,
                color: '#9f1239',
                lineHeight: 1.4,
              }}
            >
              <strong>Langkah Perbaikan:</strong>
              <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                <li>Pastikan Service Backend SAPA BPS telah dijalankan (<code>node dist/serverOnly.js</code>).</li>
                <li>Pastikan variabel <code>NEXT_PUBLIC_API_URL</code> pada file <code>.env</code> atau konfigurasi Vercel mengarah ke URL backend publik Anda.</li>
                <li>Setelah backend aktif, klik tombol <strong>Uji Ping Ulang</strong> di bawah.</li>
              </ol>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11.5,
                color: '#64748b',
                paddingTop: 4,
              }}
            >
              <div>
                Terakhir dicek:{' '}
                <strong>
                  {lastCheckedAt
                    ? lastCheckedAt.toLocaleTimeString('id-ID')
                    : 'Baru saja'}{' '}
                  WIB
                </strong>
              </div>
              {getEffectiveBackendUrl() ? (
                <a
                  href={`${getEffectiveBackendUrl()}/health`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: 'var(--primary-color)',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  Buka /health <ExternalLink size={11} />
                </a>
              ) : null}
            </div>
          )}
        </div>
      </Modal>

      {/* Toast Notifikasi */}
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
