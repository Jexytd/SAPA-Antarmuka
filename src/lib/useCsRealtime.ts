// ============================================================
// SAPA BPS 1901 IN — Customer Service Realtime WebSocket & SSE Hook
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeTicketEvent } from './ticketTypes';
import { RAW_API_URL } from './ticketApi';

export type RealtimeStatus = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'FALLBACK_SSE' | 'OFFLINE';

interface UseCsRealtimeOptions {
  onEvent?: (event: RealtimeTicketEvent) => void;
  enabled?: boolean;
}

// ============================================================
// Web Audio Chime Synthesizer (Zero external latency)
// ============================================================
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playNewTicketSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.15);
    gain2.gain.setValueAtTime(0.25, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.debug('[Audio] Unable to play chime:', err);
  }
}

export function playNewMessageSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  } catch (err) {
    console.debug('[Audio] Unable to play message sound:', err);
  }
}

// ============================================================
// URL Resolvers
// ============================================================
function getWebSocketUrl(): string {
  try {
    const raw = (
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:8000'
    ).replace(/\/$/, '');
    const url = new URL(raw);
    const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${url.host}/ws/cs`;
  } catch {
    return 'ws://localhost:8000/ws/cs';
  }
}

function getSseUrl(): string {
  const raw = (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'http://localhost:8000'
  ).replace(/\/$/, '');
  const sep = raw.includes('?') ? '&' : '?';
  return `${raw}/api/cs/events${sep}ngrok-skip-browser-warning=true`;
}

// ============================================================
// Persistent Singleton Connection Manager
// ============================================================
class CsRealtimeManager {
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private eventSubscribers = new Set<(event: RealtimeTicketEvent) => void>();
  private statusSubscribers = new Set<(status: RealtimeStatus) => void>();
  private status: RealtimeStatus = 'CONNECTING';

  private pingTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private disconnectDebounceTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;

  public getStatus(): RealtimeStatus {
    return this.status;
  }

  private setStatus(newStatus: RealtimeStatus) {
    this.status = newStatus;
    this.statusSubscribers.forEach((cb) => {
      try { cb(newStatus); } catch {}
    });
  }

  public subscribe(
    onEvent?: (event: RealtimeTicketEvent) => void,
    onStatus?: (status: RealtimeStatus) => void
  ): () => void {
    // Batalkan rencana disconnect jika ada re-render / tab switch cepat
    if (this.disconnectDebounceTimer) {
      clearTimeout(this.disconnectDebounceTimer);
      this.disconnectDebounceTimer = null;
    }

    if (onEvent) this.eventSubscribers.add(onEvent);
    if (onStatus) {
      this.statusSubscribers.add(onStatus);
      onStatus(this.status);
    }

    this.connect();

    return () => {
      if (onEvent) this.eventSubscribers.delete(onEvent);
      if (onStatus) this.statusSubscribers.delete(onStatus);

      // Debounce 5 detik sebelum benar-benar menutup koneksi socket
      if (this.eventSubscribers.size === 0 && this.statusSubscribers.size === 0) {
        if (this.disconnectDebounceTimer) clearTimeout(this.disconnectDebounceTimer);
        this.disconnectDebounceTimer = setTimeout(() => {
          if (this.eventSubscribers.size === 0 && this.statusSubscribers.size === 0) {
            this.disconnect();
          }
        }, 5000);
      }
    };
  }

  public connect() {
    if (typeof window === 'undefined') return;

    // JIKA SUDAH CONNECTED ATAU SEDANG CONNECTING, JANGAN DISENTUH ATAU DITUTUP!
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.setStatus('CONNECTED');
        return;
      }
      if (this.ws.readyState === WebSocket.CONNECTING) {
        this.setStatus('CONNECTING');
        return;
      }
    }

    // Bersihkan socket lama yang sudah close/closing
    this.cleanupSocket('New connection request');

    const wsUrl = getWebSocketUrl();
    this.setStatus('CONNECTING');
    console.log('[Realtime WS] Menghubungkan ke:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        console.log('[Realtime WS] Terhubung sukses (OPEN).');
        this.setStatus('CONNECTED');
        this.reconnectAttempts = 0;

        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // Matikan SSE fallback jika sebelumnya aktif
        this.closeSSE();

        // Kirim initial handshake
        try {
          ws.send(JSON.stringify({ action: 'cs_subscribe', timestamp: Date.now() }));
        } catch {}

        // Heartbeat ping setiap 25 detik
        this.startHeartbeat(ws);
      };

      ws.onmessage = (event) => {
        if (this.ws !== ws) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong' || data.event === 'pong' || data.event === 'connected' || data.event === 'subscribed') {
            return;
          }
          this.broadcastEvent(data as RealtimeTicketEvent);
        } catch {}
      };

      ws.onclose = (event) => {
        if (this.ws !== ws) return;
        this.ws = null;
        this.stopHeartbeat();

        console.warn(`[Realtime WS] Terputus. Kode: ${event.code}, Alasan: ${event.reason || 'none'}`);

        // Jika tidak ada komponen aktif yang butuh realtime, jangan reconnect
        if (this.eventSubscribers.size === 0 && this.statusSubscribers.size === 0) {
          return;
        }

        // JIKA PENUTUPAN NORMAL (KODE 1000), JANGAN PERNAH RECONNECT OTOMATIS!
        if (event.code === 1000) {
          return;
        }

        this.reconnectAttempts++;
        const backoff = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts - 1), 15000);
        this.setStatus('RECONNECTING');

        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, backoff);

        // Jika WS terputus abnormal berulang kali, aktifkan SSE sebagai cadangan
        if (this.reconnectAttempts >= 3 && !this.sse) {
          console.info('[Realtime] Mengaktifkan SSE Stream sebagai cadangan...');
          this.startSSE();
        }
      };

      ws.onerror = (err) => {
        if (this.ws !== ws) return;
        console.warn('[Realtime WS] Galat koneksi:', err);
      };
    } catch (err) {
      console.error('[Realtime WS] Gagal inisialisasi socket:', err);
      this.startSSE();
    }
  }

  private startHeartbeat(ws: WebSocket) {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch {}
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private cleanupSocket(reason = 'Normal closure') {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const oldWs = this.ws;
      this.ws = null;
      oldWs.onopen = null;
      oldWs.onmessage = null;
      oldWs.onerror = null;
      oldWs.onclose = null; // Lepas listener agar tidak ada onclose re-entrant
      try {
        if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
          oldWs.close(1000, reason);
        }
      } catch {}
    }
  }

  public disconnect() {
    this.cleanupSocket('Intentional disconnect');
    this.closeSSE();
    this.setStatus('OFFLINE');
  }

  private broadcastEvent(payload: RealtimeTicketEvent) {
    this.eventSubscribers.forEach((cb) => {
      try { cb(payload); } catch (err) {
        console.warn('[Realtime Event Handler Error]', err);
      }
    });
  }

  private startSSE() {
    this.closeSSE();
    try {
      const sseUrl = getSseUrl();
      const source = new EventSource(sseUrl);
      this.sse = source;

      source.onopen = () => {
        console.log('[Realtime SSE] Stream terhubung.');
        if (this.status !== 'CONNECTED') {
          this.setStatus('FALLBACK_SSE');
        }
      };

      source.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          this.broadcastEvent(parsed as RealtimeTicketEvent);
        } catch {}
      };

      source.onerror = () => {
        source.close();
        this.sse = null;
        if (this.status === 'FALLBACK_SSE') {
          this.setStatus('OFFLINE');
        }
      };
    } catch (err) {
      console.error('[Realtime SSE Error]', err);
    }
  }

  private closeSSE() {
    if (this.sse) {
      try { this.sse.close(); } catch {}
      this.sse = null;
    }
  }
}

const realtimeManager = new CsRealtimeManager();

// ============================================================
// React Hook
// ============================================================
export function useCsRealtime(options: UseCsRealtimeOptions = {}) {
  const { onEvent, enabled = true } = options;

  const [status, setStatus] = useState<RealtimeStatus>(() => realtimeManager.getStatus());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sapa_cs_sound_enabled');
      if (stored !== null) setSoundEnabled(stored === 'true');
    } catch {}
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem('sapa_cs_sound_enabled', String(next)); } catch {}
      return next;
    });
  }, []);

  const handleIncomingPayload = useCallback((payload: RealtimeTicketEvent) => {
    setLastEventTime(new Date());

    if (soundEnabledRef.current) {
      if (payload.event === 'ticket.created') {
        playNewTicketSound();
      } else if (payload.event === 'ticket.message') {
        playNewMessageSound();
      }
    }

    if (onEventRef.current) {
      onEventRef.current(payload);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = realtimeManager.subscribe(
      handleIncomingPayload,
      (newStatus) => setStatus(newStatus)
    );

    return unsubscribe;
  }, [enabled, handleIncomingPayload]);

  return {
    status,
    soundEnabled,
    toggleSound,
    lastEventTime,
    reconnect: () => realtimeManager.connect(),
  };
}
