import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import type { NetworkRiskResult, NetworkRiskSignals } from '@/types/domain/networkRisk';

export const dynamic = 'force-dynamic';

type EnforcementMode = NetworkRiskResult['enforcement'];

const EMPTY_SIGNALS: NetworkRiskSignals = {
  hosting: false,
  proxy: false,
  relay: false,
  tor: false,
  vpn: false,
};

function getEnforcementMode(): EnforcementMode {
  const value = process.env.NETWORK_RISK_ENFORCEMENT?.trim().toLowerCase();
  if (value === 'warn' || value === 'off') return value;
  return 'block';
}

function firstHeaderIp(value: string | null) {
  return value?.split(',')[0]?.trim() || null;
}

function getClientIp(request: NextRequest) {
  return (
    firstHeaderIp(request.headers.get('cf-connecting-ip'))
    ?? firstHeaderIp(request.headers.get('x-real-ip'))
    ?? firstHeaderIp(request.headers.get('x-client-ip'))
    ?? firstHeaderIp(request.headers.get('x-forwarded-for'))
    ?? null
  );
}

function isPrivateOrLocalIp(ipAddress: string) {
  const normalized = ipAddress.trim().toLowerCase();
  return (
    normalized === '::1'
    || normalized === '127.0.0.1'
    || normalized.startsWith('10.')
    || normalized.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
  );
}

function maskIp(ipAddress: string | null) {
  if (!ipAddress) return null;
  if (ipAddress.includes(':')) {
    const parts = ipAddress.split(':').filter(Boolean);
    return `${parts.slice(0, 3).join(':') || 'ipv6'}::`;
  }
  const parts = ipAddress.split('.');
  if (parts.length !== 4) return ipAddress;
  return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
}

function boolFromRecord(record: Record<string, unknown>, key: string) {
  return record[key] === true;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

async function fetchWithTimeout(url: string, timeoutMs = 2500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkWithIpinfo(ipAddress: string, token: string) {
  const response = await fetchWithTimeout(`https://ipinfo.io/${encodeURIComponent(ipAddress)}/privacy?token=${encodeURIComponent(token)}`);
  if (!response.ok) {
    throw new Error('IPinfo risk check failed.');
  }
  const body = toRecord(await response.json());
  const signals: NetworkRiskSignals = {
    hosting: boolFromRecord(body, 'hosting'),
    proxy: boolFromRecord(body, 'proxy'),
    relay: boolFromRecord(body, 'relay'),
    tor: boolFromRecord(body, 'tor'),
    vpn: boolFromRecord(body, 'vpn'),
  };
  return signals;
}

async function checkWithIpQualityScore(ipAddress: string, apiKey: string) {
  const params = new URLSearchParams({
    allow_public_access_points: 'true',
    fast: 'true',
    strictness: '1',
  });
  const response = await fetchWithTimeout(`https://ipqualityscore.com/api/json/ip/${encodeURIComponent(apiKey)}/${encodeURIComponent(ipAddress)}?${params.toString()}`);
  if (!response.ok) {
    throw new Error('IPQualityScore risk check failed.');
  }
  const body = toRecord(await response.json());
  const signals: NetworkRiskSignals = {
    hosting: boolFromRecord(body, 'hosting') || boolFromRecord(body, 'is_crawler'),
    proxy: boolFromRecord(body, 'proxy'),
    relay: false,
    tor: boolFromRecord(body, 'tor') || boolFromRecord(body, 'active_tor'),
    vpn: boolFromRecord(body, 'vpn') || boolFromRecord(body, 'active_vpn'),
  };
  return signals;
}

function buildResult(input: {
  enforcement: EnforcementMode;
  ipAddress: string | null;
  provider: NetworkRiskResult['provider'];
  reason: string;
  signals?: NetworkRiskSignals;
  status: NetworkRiskResult['status'];
}): NetworkRiskResult {
  const signals = input.signals ?? EMPTY_SIGNALS;
  const risky = signals.vpn || signals.proxy || signals.tor || signals.relay || signals.hosting;
  return {
    blocked: input.enforcement === 'block' && risky,
    checkedAt: new Date().toISOString(),
    enforcement: input.enforcement,
    ipAddress: maskIp(input.ipAddress),
    provider: input.provider,
    reason: input.reason,
    signals,
    status: risky && input.enforcement === 'block' ? 'blocked' : input.status,
  };
}

export async function GET(request: NextRequest) {
  const enforcement = getEnforcementMode();
  const ipAddress = getClientIp(request);

  if (enforcement === 'off') {
    return apiSuccess(buildResult({
      enforcement,
      ipAddress,
      provider: 'none',
      reason: 'Network risk gate is disabled.',
      status: 'clear',
    }));
  }

  if (!ipAddress) {
    return apiSuccess(buildResult({
      enforcement,
      ipAddress,
      provider: 'none',
      reason: 'Unable to read the public client IP from request headers.',
      status: 'unverified',
    }));
  }

  if (isPrivateOrLocalIp(ipAddress)) {
    return apiSuccess(buildResult({
      enforcement,
      ipAddress,
      provider: 'none',
      reason: 'Local or private network address. VPN detection requires a public IP in production.',
      status: 'unverified',
    }));
  }

  const ipinfoToken = process.env.IPINFO_TOKEN?.trim();
  const ipQualityScoreKey = process.env.IPQUALITYSCORE_API_KEY?.trim();

  try {
    if (ipinfoToken) {
      const signals = await checkWithIpinfo(ipAddress, ipinfoToken);
      const risky = signals.vpn || signals.proxy || signals.tor || signals.relay || signals.hosting;
      return apiSuccess(buildResult({
        enforcement,
        ipAddress,
        provider: 'ipinfo',
        reason: risky ? 'VPN, proxy, relay, TOR, or hosting network detected.' : 'No VPN or proxy signals detected.',
        signals,
        status: risky ? 'blocked' : 'clear',
      }));
    }

    if (ipQualityScoreKey) {
      const signals = await checkWithIpQualityScore(ipAddress, ipQualityScoreKey);
      const risky = signals.vpn || signals.proxy || signals.tor || signals.relay || signals.hosting;
      return apiSuccess(buildResult({
        enforcement,
        ipAddress,
        provider: 'ipqualityscore',
        reason: risky ? 'VPN, proxy, TOR, or hosting network detected.' : 'No VPN or proxy signals detected.',
        signals,
        status: risky ? 'blocked' : 'clear',
      }));
    }
  } catch (error) {
    return apiSuccess(buildResult({
      enforcement,
      ipAddress,
      provider: ipinfoToken ? 'ipinfo' : 'ipqualityscore',
      reason: error instanceof Error ? error.message : 'Network risk provider failed.',
      status: 'unverified',
    }));
  }

  return apiSuccess(buildResult({
    enforcement,
    ipAddress,
    provider: 'none',
    reason: 'No VPN/proxy detection provider is configured.',
    status: 'unverified',
  }));
}
