'use client';

import * as React from 'react';

type NetworkQualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
type NetworkQualitySource = 'checking' | 'measured' | 'unavailable';

export type NetworkQualityState = {
  downlinkMbps: number | null;
  effectiveType: string | null;
  isMeasuring: boolean;
  isOnline: boolean;
  level: NetworkQualityLevel;
  measuredAt: Date | null;
  rttMs: number | null;
  source: NetworkQualitySource;
};

const LATENCY_PROBE_URL = '/api/health/live';
const DOWNLOAD_PROBE_URL = '/api/network/probe';
const PROBE_TIMEOUT_MS = 6000;

function resolveLevel(isOnline: boolean, downlinkMbps: number | null, rttMs: number | null): NetworkQualityLevel {
  if (!isOnline) {
    return 'offline';
  }

  let score = 70;
  if (typeof downlinkMbps === 'number') {
    if (downlinkMbps >= 25) score += 14;
    else if (downlinkMbps >= 10) score += 10;
    else if (downlinkMbps >= 5) score += 5;
    else if (downlinkMbps < 1.5) score -= 20;
  }

  if (typeof rttMs === 'number') {
    if (rttMs <= 50) score += 14;
    else if (rttMs <= 100) score += 8;
    else if (rttMs > 600) score -= 35;
    else if (rttMs > 300) score -= 22;
    else if (rttMs > 180) score -= 12;
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  return boundedScore >= 86 ? 'excellent' :
    boundedScore >= 70 ? 'good' :
      boundedScore >= 50 ? 'fair' :
        'poor';
}

function bytesFromResponse(response: Response, body: string) {
  const headerBytes = Number(response.headers.get('X-Network-Probe-Bytes'));
  if (Number.isFinite(headerBytes) && headerBytes > 0) {
    return headerBytes;
  }

  return new Blob([body]).size;
}

async function timedFetch(url: string, signal: AbortSignal) {
  const startedAt = performance.now();
  const response = await fetch(`${url}?t=${Date.now()}`, {
    cache: 'no-store',
    signal,
  });
  const body = await response.text();
  const durationMs = performance.now() - startedAt;

  if (!response.ok) {
    throw new Error(`Network probe failed with ${response.status}`);
  }

  return {
    body,
    durationMs,
    response,
  };
}

async function measureNetwork(signal: AbortSignal): Promise<NetworkQualityState> {
  if (!navigator.onLine) {
    return {
      downlinkMbps: null,
      effectiveType: null,
      isMeasuring: false,
      isOnline: false,
      level: 'offline',
      measuredAt: new Date(),
      rttMs: null,
      source: 'measured',
    };
  }

  const latencySample = await timedFetch(LATENCY_PROBE_URL, signal);
  const downloadSample = await timedFetch(DOWNLOAD_PROBE_URL, signal);
  const downloadedBytes = bytesFromResponse(downloadSample.response, downloadSample.body);
  const downlinkMbps = downloadSample.durationMs > 0
    ? (downloadedBytes * 8) / (downloadSample.durationMs / 1000) / 1_000_000
    : null;
  const rttMs = Math.max(0, latencySample.durationMs);

  return {
    downlinkMbps,
    effectiveType: 'measured',
    isMeasuring: false,
    isOnline: true,
    level: resolveLevel(true, downlinkMbps, rttMs),
    measuredAt: new Date(),
    rttMs,
    source: 'measured',
  };
}

export function useNetworkQuality(pollIntervalMs = 5000): NetworkQualityState {
  const [state, setState] = React.useState<NetworkQualityState>(() => ({
    downlinkMbps: null,
    effectiveType: null,
    isMeasuring: true,
    isOnline: true,
    level: 'good',
    measuredAt: null,
    rttMs: null,
    source: 'checking',
  }));

  React.useEffect(() => {
    let cancelled = false;
    let activeController: AbortController | null = null;

    const refresh = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      setState((current) => ({ ...current, isMeasuring: true, source: current.source === 'measured' ? current.source : 'checking' }));

      try {
        const nextState = await measureNetwork(controller.signal);
        if (!cancelled && activeController === controller) {
          setState(nextState);
        }
      } catch {
        if (!cancelled && activeController === controller) {
          const isOnline = navigator.onLine;
          setState({
            downlinkMbps: null,
            effectiveType: null,
            isMeasuring: false,
            isOnline,
            level: isOnline ? 'fair' : 'offline',
            measuredAt: new Date(),
            rttMs: null,
            source: 'unavailable',
          });
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (activeController === controller) {
          activeController = null;
        }
      }
    };

    const onlineListener = () => { void refresh(); };
    const offlineListener = () => { void refresh(); };

    void refresh();
    window.addEventListener('online', onlineListener);
    window.addEventListener('offline', offlineListener);

    const interval = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      activeController?.abort();
      window.removeEventListener('online', onlineListener);
      window.removeEventListener('offline', offlineListener);
      window.clearInterval(interval);
    };
  }, [pollIntervalMs]);

  return state;
}
