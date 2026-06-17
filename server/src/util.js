import { randomUUID } from 'node:crypto';

// App-generated id. Prefix keeps ids readable in logs/exports.
export function uid(prefix = '') {
  return prefix + randomUUID();
}

export function now() {
  return Date.now();
}
