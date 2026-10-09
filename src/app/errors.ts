import type { Dict } from '../i18n/lang';
import { ApiError } from './api';

/** Plain words for a failed request. Pages handle their own specific codes first. */
export function errorText(e: unknown, t: Dict): string {
  if (e instanceof ApiError) {
    if (e.offline) return t.errors.offline;
    if (e.status === 401) return t.errors.signedOut;
    if (e.status === 429) return t.errors.tooMany;
    if (e.status >= 500) return t.errors.server;
  }
  return t.errors.generic;
}
