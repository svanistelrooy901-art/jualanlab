/**
 * Shared types for the UntungLab <-> JualanLab hand-off formats.
 * Spec: spec/LINK-FORMAT.md. Both apps copy this folder; keep it free of app code.
 */

/** UntungLab's four status bands (src/domain/status.ts in UntungLab). */
export type MenuStatus = 'loss' | 'low' | 'watch' | 'healthy';

export const MENU_STATUSES: readonly MenuStatus[] = ['loss', 'low', 'watch', 'healthy'];

/** One active UntungLab menu (a variation is its own entry). */
export interface PriceListMenu {
  /** UntungLab menu id. The matching key on both sides. */
  id: string;
  /** Recipe name in UntungLab. */
  name: string;
  /** Optional menu category; null when the menu has none. */
  category: string | null;
  /** Selling price per unit in sen (RM1.00 = 100). */
  priceSen: number;
  /** Margin in %, 2 decimals. null when UntungLab reports the menu incomplete. Never guessed. */
  marginPct: number | null;
  /** UntungLab status band. null exactly when marginPct is null. */
  status: MenuStatus | null;
  /** Set on a variation: the base menu's id. null otherwise. */
  baseMenuId: string | null;
}

/** UntungLab -> JualanLab. */
export interface PriceList {
  app: 'untunglab';
  kind: 'price-list';
  format: 1;
  /** When UntungLab built the list, ISO 8601 with offset. */
  sentAt: string;
  currency: 'MYR';
  menus: PriceListMenu[];
}

export interface BatchItem {
  /** UntungLab menu id, as received in a price list. */
  menuId: string;
  /** Name as JualanLab shows it, used only to label items UntungLab cannot find. */
  name: string;
  /** Pieces ordered for the batch. */
  quantity: number;
}

export interface BatchExtraItem {
  /** An item that exists only in JualanLab (for example bottled water). */
  name: string;
  quantity: number;
}

/** JualanLab -> UntungLab. */
export interface BatchList {
  app: 'jualanlab';
  kind: 'batch-list';
  format: 1;
  sentAt: string;
  /** Pickup or delivery date of the batch, YYYY-MM-DD. */
  batchDate: string;
  items: BatchItem[];
  /** Items with no UntungLab id. UntungLab lists them by name and does not calculate them. */
  notInUntungLab: BatchExtraItem[];
}

export type LinkErrorCode =
  | 'not_a_link'      // no `d=` payload found
  | 'bad_encoding'    // unknown scheme, bad base64url or bad deflate data
  | 'too_large'       // over the size limits
  | 'bad_json'        // not valid JSON after decoding
  | 'wrong_app'       // payload from the wrong app
  | 'wrong_kind'      // right app, wrong payload kind
  | 'newer_format'    // a format this app does not know yet: ask the user to update
  | 'invalid';        // fails a field rule; `path` names the field

export interface LinkError {
  code: LinkErrorCode;
  /** JSON path of the failing field, for example `menus[2].priceSen`. */
  path?: string;
  detail?: string;
}

export type WarningCode =
  | 'base_missing'; // a variation's base menu is not in the list: show it as a standalone menu

export interface LinkWarning {
  code: WarningCode;
  path: string;
}

export type DecodeResult<T> =
  | { ok: true; value: T; warnings: LinkWarning[] }
  | { ok: false; error: LinkError };
