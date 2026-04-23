#!/usr/bin/env node
/* eslint-disable no-console */

const required = ['AUTH_SECRET'];
const optional = ['MONGODB_URI', 'AUTH_URL', 'NEXTAUTH_URL'];

const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const unresolvedOptional = optional.filter((key) => !process.env[key] || process.env[key].trim() === '');
if (unresolvedOptional.length) {
  console.warn(`Optional env vars not set: ${unresolvedOptional.join(', ')}`);
}

console.log('Environment check passed.');
