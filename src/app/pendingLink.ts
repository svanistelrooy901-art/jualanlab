/**
 * An UntungLab price-list link opened before signing in. The payload is kept for this browser tab only
 * (sessionStorage) and handed to the Receive page once the shop is ready.
 */
const KEY = 'jl-pending-link';

export function stashPendingLink(hash: string): void {
  try {
    sessionStorage.setItem(KEY, hash);
  } catch {
    /* the person pastes the link again */
  }
}

export function hasPendingLink(): boolean {
  try {
    return !!sessionStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function takePendingLink(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
