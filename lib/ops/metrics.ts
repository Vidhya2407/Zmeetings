import 'server-only';
import { getHealthSnapshot } from '@/lib/ops/health';

type MetricKind = 'counter' | 'gauge';

type MetricSample = {
  labels: Record<string, string>;
  value: number;
};

type MetricDefinition = {
  help: string;
  kind: MetricKind;
  samples: Map<string, MetricSample>;
};

type MetricsStore = {
  definitions: Map<string, MetricDefinition>;
};

declare global {
  // eslint-disable-next-line no-var
  var __zmeetingsMetricsStore: MetricsStore | undefined;
}

function getMetricsStore(): MetricsStore {
  if (!globalThis.__zmeetingsMetricsStore) {
    globalThis.__zmeetingsMetricsStore = {
      definitions: new Map(),
    };
  }

  return globalThis.__zmeetingsMetricsStore;
}

function normalizeMetricName(value: string) {
  return value.replace(/[^a-zA-Z0-9_:]/g, '_');
}

function normalizeLabels(labels: Record<string, string> = {}) {
  return Object.fromEntries(
    Object.entries(labels)
      .filter(([, value]) => value.trim().length > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function sampleKey(labels: Record<string, string>) {
  return Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join('|');
}

function escapeLabelValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function formatLabels(labels: Record<string, string>) {
  const entries = Object.entries(labels);
  if (!entries.length) {
    return '';
  }

  return `{${entries.map(([key, value]) => `${key}="${escapeLabelValue(value)}"`).join(',')}}`;
}

function ensureMetric(name: string, kind: MetricKind, help: string) {
  const normalizedName = normalizeMetricName(name);
  const store = getMetricsStore();
  const existing = store.definitions.get(normalizedName);
  if (existing) {
    if (existing.kind !== kind) {
      throw new Error(`Metric ${normalizedName} is already registered as ${existing.kind}.`);
    }
    return existing;
  }

  const definition: MetricDefinition = {
    help,
    kind,
    samples: new Map(),
  };
  store.definitions.set(normalizedName, definition);
  return definition;
}

export function incrementCounter(
  name: string,
  help: string,
  labels: Record<string, string> = {},
  value = 1,
) {
  const definition = ensureMetric(name, 'counter', help);
  const normalizedLabels = normalizeLabels(labels);
  const key = sampleKey(normalizedLabels);
  const existing = definition.samples.get(key);
  definition.samples.set(key, {
    labels: normalizedLabels,
    value: (existing?.value ?? 0) + value,
  });
}

export function setGauge(
  name: string,
  help: string,
  value: number,
  labels: Record<string, string> = {},
) {
  const definition = ensureMetric(name, 'gauge', help);
  const normalizedLabels = normalizeLabels(labels);
  definition.samples.set(sampleKey(normalizedLabels), {
    labels: normalizedLabels,
    value,
  });
}

function setBooleanGauge(
  name: string,
  help: string,
  value: boolean,
  labels: Record<string, string> = {},
) {
  setGauge(name, help, value ? 1 : 0, labels);
}

export function recordSfuJoinAttempt(labels: {
  provider: string;
  roomType: 'main' | 'breakout';
}) {
  incrementCounter(
    'zmeetings_sfu_join_attempts_total',
    'Total SFU join attempts initiated by clients.',
    labels,
  );
}

export function recordSfuJoinResult(labels: {
  provider: string;
  roomType: 'main' | 'breakout';
  success: boolean;
}) {
  incrementCounter(
    labels.success ? 'zmeetings_sfu_join_success_total' : 'zmeetings_sfu_join_failures_total',
    labels.success
      ? 'Total successful SFU room joins.'
      : 'Total failed SFU room joins.',
    {
      provider: labels.provider,
      room_type: labels.roomType,
    },
  );
}

export function recordPacketLossSample(labels: {
  provider: string;
  roomType: 'main' | 'breakout';
  packetLossRatio: number;
  sampleCount?: number;
  rttMs?: number | null;
}) {
  const baseLabels = {
    provider: labels.provider,
    room_type: labels.roomType,
  };
  setGauge(
    'zmeetings_sfu_packet_loss_ratio',
    'Latest observed SFU packet loss ratio reported by clients.',
    Math.max(0, Math.min(1, labels.packetLossRatio)),
    baseLabels,
  );
  if (typeof labels.sampleCount === 'number') {
    setGauge(
      'zmeetings_sfu_packet_loss_samples',
      'Number of RTP samples contributing to the latest packet loss report.',
      Math.max(0, labels.sampleCount),
      baseLabels,
    );
  }
  if (typeof labels.rttMs === 'number' && Number.isFinite(labels.rttMs)) {
    setGauge(
      'zmeetings_sfu_client_rtt_ms',
      'Latest observed SFU client round-trip time in milliseconds.',
      Math.max(0, labels.rttMs),
      baseLabels,
    );
  }
}

async function renderDynamicMetrics() {
  const health = await getHealthSnapshot();
  setGauge(
    'zmeetings_app_info',
    'Static app identity metric labeled by environment.',
    1,
    {
      environment: health.environment,
      service: health.service,
      status: health.status,
    },
  );
  setBooleanGauge(
    'zmeetings_app_ready',
    'Application readiness state.',
    health.ready,
  );
  setGauge(
    'zmeetings_process_uptime_seconds',
    'Process uptime in seconds.',
    health.uptimeSeconds,
  );
  setGauge(
    'zmeetings_process_resident_memory_bytes',
    'Resident set size used by the Node.js process.',
    process.memoryUsage().rss,
  );
  setGauge(
    'zmeetings_process_heap_used_bytes',
    'Heap memory currently used by the Node.js process.',
    process.memoryUsage().heapUsed,
  );
  setGauge(
    'zmeetings_process_heap_total_bytes',
    'Heap memory reserved by the Node.js process.',
    process.memoryUsage().heapTotal,
  );
  setBooleanGauge(
    'zmeetings_healthcheck_status',
    'Healthcheck component state encoded as 1 for pass and 0 for warn/fail.',
    health.checks.auth.status === 'pass',
    { check: 'auth' },
  );
  setBooleanGauge(
    'zmeetings_healthcheck_status',
    'Healthcheck component state encoded as 1 for pass and 0 for warn/fail.',
    health.checks.database.status === 'pass',
    { check: 'database' },
  );
  setBooleanGauge(
    'zmeetings_healthcheck_status',
    'Healthcheck component state encoded as 1 for pass and 0 for warn/fail.',
    health.checks.cache.status === 'pass',
    { check: 'cache' },
  );
  setBooleanGauge(
    'zmeetings_healthcheck_status',
    'Healthcheck component state encoded as 1 for pass and 0 for warn/fail.',
    health.checks.sfu.status === 'pass',
    { check: 'sfu' },
  );
}

export async function renderPrometheusMetrics() {
  await renderDynamicMetrics();
  const lines: string[] = [];
  for (const [name, definition] of getMetricsStore().definitions.entries()) {
    lines.push(`# HELP ${name} ${definition.help}`);
    lines.push(`# TYPE ${name} ${definition.kind}`);
    for (const sample of definition.samples.values()) {
      lines.push(`${name}${formatLabels(sample.labels)} ${sample.value}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
