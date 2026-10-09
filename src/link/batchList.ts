/** Batch list v1: JualanLab -> UntungLab. Spec: spec/LINK-FORMAT.md, section "Batch list". */
import { encodePayload, decodePayload } from './envelope';
import type { BatchExtraItem, BatchItem, BatchList, DecodeResult } from './types';
import * as v from './validate';

export const BATCH_LIST_FORMAT = 1;
export const MAX_QUANTITY = 100_000;

export function validateBatchList(json: unknown): DecodeResult<BatchList> {
  try {
    const o = v.object(json, '');
    v.header(o, 'jualanlab', 'batch-list', BATCH_LIST_FORMAT);
    const sentAt = v.dateTime(o.sentAt, 'sentAt');
    const batchDate = v.date(o.batchDate, 'batchDate');
    const rawItems = v.array(o.items, 'items', 0, v.MAX_ITEMS);
    const rawExtra = o.notInUntungLab === undefined ? [] : v.array(o.notInUntungLab, 'notInUntungLab', 0, v.MAX_ITEMS);
    if (rawItems.length + rawExtra.length === 0) v.fail('items', 'the batch is empty');

    const seen = new Set<string>();
    const items: BatchItem[] = rawItems.map((it, i) => {
      const p = `items[${i}]`;
      const r = v.object(it, p);
      const menuId = v.id(r.menuId, `${p}.menuId`);
      if (seen.has(menuId)) v.fail(`${p}.menuId`, 'appears twice');
      seen.add(menuId);
      return { menuId, name: v.text(r.name, `${p}.name`, v.MAX_NAME), quantity: v.int(r.quantity, `${p}.quantity`, 1, MAX_QUANTITY) };
    });
    const notInUntungLab: BatchExtraItem[] = rawExtra.map((it, i) => {
      const p = `notInUntungLab[${i}]`;
      const r = v.object(it, p);
      return { name: v.text(r.name, `${p}.name`, v.MAX_NAME), quantity: v.int(r.quantity, `${p}.quantity`, 1, MAX_QUANTITY) };
    });

    return { ok: true, value: { app: 'jualanlab', kind: 'batch-list', format: 1, sentAt, batchDate, items, notInUntungLab }, warnings: [] };
  } catch (e) {
    if (e instanceof v.Invalid) return { ok: false, error: e.error };
    throw e;
  }
}

export function encodeBatchList(list: BatchList): string {
  const checked = validateBatchList(list);
  if (!checked.ok) throw new Error(`refusing to send an invalid batch list: ${checked.error.path ?? ''} ${checked.error.detail ?? checked.error.code}`);
  return encodePayload(checked.value);
}

export function decodeBatchList(payload: string): DecodeResult<BatchList> {
  const d = decodePayload(payload);
  return d.ok ? validateBatchList(d.json) : d;
}
