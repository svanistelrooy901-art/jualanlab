/**
 * Envelope: JSON -> UTF-8 -> raw DEFLATE -> base64url, prefixed with the scheme number.
 * `1.<base64url>` is scheme 1. A later scheme gets a new prefix; the JSON `format` is versioned separately.
 */
import { deflateSync, Inflate, strFromU8, strToU8 } from 'fflate';
import type { LinkError } from './types';

export const SCHEME_PREFIX = '1.';
/** Longest payload string accepted (characters after `d=`). */
export const MAX_PAYLOAD_CHARS = 200_000;
/** Largest decoded JSON accepted, in bytes. Guards against decompression bombs. */
export const MAX_JSON_BYTES = 1_000_000;

const B64URL = /^[A-Za-z0-9_-]*$/;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodePayload(value: unknown): string {
  const json = JSON.stringify(value);
  return SCHEME_PREFIX + toBase64Url(deflateSync(strToU8(json), { level: 9 }));
}

export function decodePayload(payload: string): { ok: true; json: unknown } | { ok: false; error: LinkError } {
  if (payload.length > MAX_PAYLOAD_CHARS) return { ok: false, error: { code: 'too_large' } };
  if (!payload.startsWith(SCHEME_PREFIX)) return { ok: false, error: { code: 'bad_encoding', detail: 'unknown scheme' } };
  const body = payload.slice(SCHEME_PREFIX.length);
  if (body.length === 0 || !B64URL.test(body) || body.length % 4 === 1) {
    return { ok: false, error: { code: 'bad_encoding', detail: 'not base64url' } };
  }
  let compressed: Uint8Array;
  try {
    compressed = fromBase64Url(body);
  } catch {
    return { ok: false, error: { code: 'bad_encoding', detail: 'not base64url' } };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  let tooLarge = false;
  try {
    const inflater = new Inflate((chunk) => {
      total += chunk.length;
      if (total > MAX_JSON_BYTES) {
        tooLarge = true;
        throw new Error('too large');
      }
      chunks.push(chunk);
    });
    inflater.push(compressed, true);
  } catch {
    return tooLarge
      ? { ok: false, error: { code: 'too_large' } }
      : { ok: false, error: { code: 'bad_encoding', detail: 'bad deflate data' } };
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.length;
  }

  let text: string;
  try {
    text = strFromU8(bytes);
  } catch {
    return { ok: false, error: { code: 'bad_encoding', detail: 'not UTF-8' } };
  }
  try {
    return { ok: true, json: JSON.parse(text) };
  } catch {
    return { ok: false, error: { code: 'bad_json' } };
  }
}
