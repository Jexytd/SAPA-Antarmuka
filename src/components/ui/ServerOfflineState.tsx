import React from 'react';
import Link from 'next/link';
import { ServerOff, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from './index';

interface ServerOfflineStateProps {
  title?: string;
  message?: string;
  hint?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  backHref?: string;
  backLabel?: string;
}

export function ServerOfflineState({
  title = 'Server Backend Sedang Offline',
  message = 'Data tidak dapat ditampilkan karena server backend tidak aktif atau offline, dan database saat ini masih menggunakan penyimpanan lokal.',
  hint = 'Silakan pastikan layanan server backend telah diaktifkan agar data dapat disinkronkan dan ditampilkan secara aman dan akurat.',
  onRetry,
  isRetrying = false,
  backHref,
  backLabel = 'Kembali ke Katalog',
}: ServerOfflineStateProps) {
  return (
    <div
      style={{
        maxWidth: 620,
        margin: '36px auto',
        padding: '40px 32px',
        borderRadius: 16,
        background: '#ffffff',
        border: '1px solid #fee2e2',
        boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.06)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <ServerOff size={32} />
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 9999,
          background: '#fee2e2',
          color: '#b91c1c',
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#ef4444',
          }}
        />
        Server Offline
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>
        {title}
      </h2>

      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 20 }}>
        {message}
      </p>

      {hint && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#b45309',
            fontSize: 13,
            lineHeight: 1.5,
            marginBottom: 24,
            textAlign: 'left',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2, color: '#d97706' }} />
          <div>
            <strong>Perhatian:</strong> {hint}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {onRetry && (
          <Button
            variant="primary"
            icon={<RefreshCw size={14} className={isRetrying ? 'animate-spin' : ''} />}
            loading={isRetrying}
            onClick={onRetry}
          >
            Coba Hubungkan Kembali
          </Button>
        )}
        {backHref && (
          <Link href={backHref}>
            <Button variant="secondary" icon={<ArrowLeft size={14} />}>
              {backLabel}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
