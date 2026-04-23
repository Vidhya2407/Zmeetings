const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const generatedDir = path.join(repoRoot, 'ops', 'generated');
const templatesDir = path.join(repoRoot, 'ops', 'templates');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const out = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }

  return out;
}

function loadEnv() {
  const files = [
    '.env.production',
    '.env.go-live',
    '.env.docker',
    '.env',
  ];

  const merged = {};
  for (const file of files) {
    Object.assign(merged, parseEnvFile(path.join(repoRoot, file)));
  }

  return { ...merged, ...process.env };
}

function requireValue(env, key) {
  const value = env[key];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment value: ${key}`);
  }
  return String(value).trim();
}

function renderTemplate(name, replacements) {
  const template = fs.readFileSync(path.join(templatesDir, name), 'utf8');
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, token) => replacements[token] ?? '');
}

function indent(text, spaces) {
  const prefix = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

function main() {
  const env = loadEnv();
  const replacements = {
    ALERTMANAGER_PRIMARY_CONFIG: '',
    APP_DOMAIN: requireValue(env, 'APP_DOMAIN'),
    LETSENCRYPT_EMAIL: requireValue(env, 'LETSENCRYPT_EMAIL'),
    LIVEKIT_API_KEY: requireValue(env, 'LIVEKIT_API_KEY'),
    LIVEKIT_API_SECRET: requireValue(env, 'LIVEKIT_API_SECRET'),
    LIVEKIT_NODE_IP_LINE: '',
    LIVEKIT_ROOM_MAX_PARTICIPANTS: String(env.LIVEKIT_ROOM_MAX_PARTICIPANTS || '150').trim(),
    LIVEKIT_USE_EXTERNAL_IP: String(env.LIVEKIT_USE_EXTERNAL_IP || 'true').trim(),
    METRICS_ACCESS_TOKEN: requireValue(env, 'METRICS_ACCESS_TOKEN'),
    RTC_DOMAIN: requireValue(env, 'RTC_DOMAIN'),
  };

  const livekitNodeIp = String(env.LIVEKIT_NODE_IP || '').trim();
  if (livekitNodeIp) {
    replacements.LIVEKIT_NODE_IP_LINE = `  node_ip: ${livekitNodeIp}`;
  }

  const alertWebhookUrl = String(env.ALERT_WEBHOOK_URL || '').trim();
  if (alertWebhookUrl) {
    replacements.ALERTMANAGER_PRIMARY_CONFIG = indent(
      [
        'webhook_configs:',
        `  - url: "${alertWebhookUrl}"`,
        '    send_resolved: true',
      ].join('\n'),
      4,
    );
  } else {
    replacements.ALERTMANAGER_PRIMARY_CONFIG = indent('webhook_configs: []', 4);
  }

  fs.mkdirSync(generatedDir, { recursive: true });

  const filesToWrite = [
    ['Caddyfile', renderTemplate('Caddyfile.tpl', replacements)],
    ['livekit.yaml', renderTemplate('livekit.yaml.tpl', replacements)],
    ['prometheus.production.yml', renderTemplate('prometheus.production.yml.tpl', replacements)],
    ['alertmanager.production.yml', renderTemplate('alertmanager.production.yml.tpl', replacements)],
  ];

  for (const [name, contents] of filesToWrite) {
    fs.writeFileSync(path.join(generatedDir, name), contents.endsWith('\n') ? contents : `${contents}\n`);
  }

  console.log('Rendered go-live config into ops/generated');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
