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
// Web Audio Chime Synthesizer (No external mp3 needed, zero latency)
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

/**
 * Play pleasant chime for new ticket arrival
 */
export function playNewTicketSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Note 1: E5 (659.25 Hz)
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

    // Note 2: B5 (987.77 Hz)
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

/**
 * Play subtle pop chime for new message
 */
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
// URL Resolver for WebSocket & SSE
// ============================================================
function getWebSocketUrl(): string {
  try {
    const url = new URL(RAW_API_URL);
    const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${url.host}/ws/cs`;
  } catch {
    return 'ws://localhost:8000/ws/cs';
  }
}

function getSseUrl(): string {
  const sep = RAW_API_URL.includes('?') ? '&' : '?';
  return `${RAW_API_URL}/api/cs/events${sep}ngrok-skip-browser-warning=true`;
}

// ============================================================
// Main React Hook
// ============================================================
export function useCsRealtime(options: UseCsRealtimeOptions = {}) {
  const { onEvent, enabled = true } = options;

  const [status, setStatus] = useState<RealtimeStatus>('CONNECTING');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isComponentMounted = useRef<boolean>(true);

  // Initialize sound preference from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sapa_cs_sound_enabled');
      if (stored !== null) {
        setSoundEnabled(stored === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sapa_cs_sound_enabled', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleIncomingPayload = useCallback(
    (payload: RealtimeTicketEvent) => {
      setLastEventTime(new Date());

      // Audio notification trigger
      if (soundEnabled) {
        if (payload.event === 'ticket.created') {
          playNewTicketSound();
        } else if (payload.event === 'ticket.message') {
          playNewMessageSound();
        }
      }

      if (onEvent) {
        onEvent(payload);
      }
    },
    [onEvent, soundEnabled]
  );

  // Setup SSE Fallback
  const startSseFallback = useCallback(() => {
    if (!isComponentMounted.current) return;
    if (sseRef.current) sseRef.current.close();

    const sseUrl = getSseUrl();
    try {
      console.log('[Realtime SSE] Connecting to:', sseUrl);
      const source = new EventSource(sseUrl);
      sseRef.current = source;
      setStatus('FALLBACK_SSE');

      source.onopen = () => {
        if (isComponentMounted.current) {
          console.log('[Realtime SSE] Connected to SSE stream.');
          setStatus('FALLBACK_SSE');
        }
      };

      source.onmessage = (e) => {
        try {
          const parsed: RealtimeTicketEvent = JSON.parse(e.data);
          handleIncomingPayload(parsed);
        } catch {
          // parse error
        }
      };

      source.onerror = (err) => {
        console.warn('[Realtime SSE] Connection interrupted:', err);
        source.close();
        if (isComponentMounted.current) {
          setStatus('OFFLINE');
          // Try reconnecting after 5s
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 5000);
        }
      };
    } catch (err) {
      console.error('[Realtime SSE] Init error:', err);
      setStatus('OFFLINE');
    }
  }, [handleIncomingPayload]);

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    if (!enabled || !isComponentMounted.current) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const wsUrl = getWebSocketUrl();
    setStatus('CONNECTING');

    try {
      console.log('[Realtime WS] Attempting connection to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isComponentMounted.current) return;
        console.log('[Realtime WS] Connected successfully.');
        setStatus('CONNECTED');
        reconnectAttemptsRef.current = 0;
        // Send initial auth / handshake if needed
        ws.send(JSON.stringify({ action: 'cs_subscribe', timestamp: Date.now() }));
      };

      ws.onmessage = (event) => {
        if (!isComponentMounted.current) return;
        try {
          const data: RealtimeTicketEvent = JSON.parse(event.data);
          handleIncomingPayload(data);
        } catch {
          // Non-json or ping
        }
      };

      ws.onclose = (event) => {
        if (!isComponentMounted.current) return;
        console.warn(`[Realtime WS] Closed (code: ${event.code}).`);

        const attempts = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = attempts;

        if (attempts <= 1) {
          setStatus('RECONNECTING');
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 1500);
        } else {
          console.info('[Realtime] Switching to SSE stream fallback...');
          startSseFallback();
        }
      };

      ws.onerror = (err) => {
        console.warn('[Realtime WS] Error occurred:', err);
      };
    } catch {
      startSseFallback();
    }
  }, [enabled, handleIncomingPayload, startSseFallback]);

  useEffect(() => {
    isComponentMounted.current = true;
    connectWebSocket();

    return () => {
      isComponentMounted.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
      if (sseRef.current) sseRef.current.close();
    };
  }, [connectWebSocket]);

  return {
    status,
    soundEnabled,
    toggleSound,
    lastEventTime,
    reconnect: connectWebSocket,
  };
}
