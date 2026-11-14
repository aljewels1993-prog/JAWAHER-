import { describe, expect, it } from 'vitest';
import { isBrowserSafeKey } from '../src/api/keys';

const jwt = (payload: object) => `x.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.y`;

describe('browser key guard', () => {
  it('accepts the publishable key and the legacy anon key', () => {
    expect(isBrowserSafeKey('sb_publishable_abc123')).toBe(true);
    expect(isBrowserSafeKey(jwt({ role: 'anon', ref: 'svqojttxvfqmimhdlais' }))).toBe(true);
  });
  it('refuses secret and service_role keys', () => {
    expect(isBrowserSafeKey('sb_secret_abc123')).toBe(false);
    expect(isBrowserSafeKey(jwt({ role: 'service_role' }))).toBe(false);
  });
  it('refuses anything else', () => {
    expect(isBrowserSafeKey('sb_publishable_your-key-here'.replace('sb_publishable_', ''))).toBe(false);
    expect(isBrowserSafeKey('not-a-key')).toBe(false);
  });
});
