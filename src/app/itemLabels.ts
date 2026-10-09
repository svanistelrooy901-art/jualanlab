import type { Item } from '../domain/items';
import { fill, type Dict } from '../i18n/lang';

/** Second line under an item name: "Variation of Brownies" or "JualanLab-only item". */
export function itemSubtitle(item: Item, all: Item[], t: Dict): string | null {
  if (item.source === 'own') return t.counter.ownItem;
  if (item.baseUlMenuId) {
    const base = all.find((i) => i.ulMenuId === item.baseUlMenuId);
    if (base) return fill(t.counter.variationOf, { name: base.name });
  }
  return null;
}

/** Case- and accent-insensitive match on name and category. */
export function matchesSearch(item: Item, q: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const needle = norm(q.trim());
  if (!needle) return true;
  return norm(`${item.name} ${item.category ?? ''}`).includes(needle);
}

/** Badge colours follow UntungLab's status band, so a losing menu never looks healthy at the counter. */
export function marginTone(item: Item): string {
  switch (item.status) {
    case 'loss':
      return 'bg-bad-soft text-bad';
    case 'low':
    case 'watch':
      return 'bg-warn-soft text-warn';
    default:
      return 'bg-good-soft text-good';
  }
}
