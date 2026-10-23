import { describe, expect, it } from 'vitest';
import { effectivePlan, hasFull, onTrial, trialDaysLeft, trialEnd } from '../access';
import { effectiveMargin, unitCost, type Item } from '../items';
import { lineProfit, lineFor } from '../cart';

describe('free month', () => {
  const end = trialEnd('2026-11-01T00:00:00.000Z');
  it('runs 30 days from the shop being created', () => {
    expect(end).toBe('2026-12-01T00:00:00.000Z');
    const shop = { plan: 'free' as const, trialEndsAt: end };
    expect(onTrial(shop, '2026-11-15T00:00:00.000Z')).toBe(true);
    expect(trialDaysLeft(shop, '2026-11-15T00:00:00.000Z')).toBe(16);
    expect(trialDaysLeft(shop, '2026-11-30T23:00:00.000Z')).toBe(1);
    expect(effectivePlan(shop, '2026-11-30T23:59:59.000Z')).toBe('pos');
    expect(effectivePlan(shop, '2026-12-01T00:00:00.000Z')).toBe('free');
    expect(trialDaysLeft(shop, '2026-12-02T00:00:00.000Z')).toBe(0);
  });
  it('a bought plan is never "on trial"; no trial date = none', () => {
    expect(onTrial({ plan: 'pos', trialEndsAt: end }, '2026-11-15T00:00:00.000Z')).toBe(false);
    expect(hasFull({ plan: 'pos', trialEndsAt: null }, '2030-01-01T00:00:00.000Z')).toBe(true);
    expect(hasFull({ plan: 'free', trialEndsAt: null }, '2026-11-15T00:00:00.000Z')).toBe(false);
  });
});

describe('own items with a margin % (FT-03)', () => {
  const own: Item = { id: 'a', source: 'own', ulMenuId: null, name: 'Air sirap', category: null, priceSen: 300, ulPriceSen: null, marginPct: 40, status: null, baseUlMenuId: null, active: true, updatedAt: '' };
  it('cost follows the counter price and the typed margin', () => {
    expect(effectiveMargin(own)).toBe(40);
    expect(unitCost(own)).toBe(180);
    expect(lineProfit(lineFor(own))).toBe(120);
  });
  it('no margin typed: unknown profit, as before', () => {
    const plain = { ...own, marginPct: null };
    expect(effectiveMargin(plain)).toBeNull();
    expect(unitCost(plain)).toBeNull();
    expect(lineProfit(lineFor(plain))).toBeNull();
  });
});
