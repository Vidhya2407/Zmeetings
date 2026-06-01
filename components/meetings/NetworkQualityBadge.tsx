'use client';

import { useNetworkQuality } from '@/hooks/useNetworkQuality';
import { useAppTranslations } from '@/lib/utils/translations';

type NetworkQualityBadgeProps = {
  compact?: boolean;
  isLight: boolean;
  labelPrefix?: string;
  showDetails?: boolean;
};

function qualityLabel(level: ReturnType<typeof useNetworkQuality>['level'], isGerman: boolean) {
  if (level === 'excellent') return isGerman ? 'Ausgezeichnet' : 'Excellent';
  if (level === 'good') return isGerman ? 'Gut' : 'Good';
  if (level === 'fair') return isGerman ? 'Mittel' : 'Fair';
  if (level === 'poor') return isGerman ? 'Schwach' : 'Poor';
  return isGerman ? 'Offline' : 'Offline';
}

function qualityTone(level: ReturnType<typeof useNetworkQuality>['level']) {
  if (level === 'excellent') return '#10b981';
  if (level === 'good') return '#22c55e';
  if (level === 'fair') return '#f59e0b';
  if (level === 'poor') return '#ef4444';
  return '#dc2626';
}

function telemetryTypeLabel(type: string) {
  if (type === 'measured') return 'Measured';
  return type.toUpperCase();
}

export default function NetworkQualityBadge({ compact = false, isLight, labelPrefix, showDetails = true }: NetworkQualityBadgeProps) {
  const { isGerman } = useAppTranslations();
  const quality = useNetworkQuality();
  const resolvedPrefix = labelPrefix ?? (isGerman ? 'Netzwerk' : 'Network');
  const label = quality.isMeasuring && !quality.measuredAt
    ? (isGerman ? 'Pruefen' : 'Checking')
    : quality.source === 'unavailable'
      ? (isGerman ? 'Nicht verfuegbar' : 'Unavailable')
      : qualityLabel(quality.level, isGerman);
  const tone = qualityTone(quality.level);
  const telemetry: string[] = [];
  if (quality.effectiveType) telemetry.push(telemetryTypeLabel(quality.effectiveType));
  if (typeof quality.downlinkMbps === 'number') telemetry.push(`${quality.downlinkMbps.toFixed(1)} Mbps`);
  if (typeof quality.rttMs === 'number') telemetry.push(`${Math.round(quality.rttMs)} ms`);

  const titleParts = [
    `${resolvedPrefix}: ${label}`,
    quality.source === 'measured' ? (isGerman ? 'Wird etwa alle 5 Sekunden gemessen' : 'Measured about every 5 seconds') : null,
    telemetry.length ? telemetry.join(' | ') : null,
  ].filter(Boolean);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold"
      style={{
        borderColor: isLight ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.16)',
        background: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.72)',
        color: isLight ? '#0f172a' : '#f8fafc',
      }}
      title={titleParts.join(' | ')}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: tone }} />
      <span>{compact ? label : `${resolvedPrefix}: ${label}`}</span>
      {showDetails && telemetry.length ? (
        <span style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
          {telemetry.join(' | ')}
        </span>
      ) : null}
    </div>
  );
}
