import { describe, expect, it } from 'vitest';
import { InventoryProcessor } from '../inventory.js';
import type { ApiItem } from '../types/index.js';
describe('buildEntry', () => {
  it('builds entry according to entered data', () => {
    const meta1: ApiItem = { id: 1, name: 'testEntry', tier: 1, rarity: 2 };
    const meta2: ApiItem = { id: 2, name: 'testEntry2', tier: 2, rarity: 3, tag: 'tag' };

    let result: {
      name: string;
      tier: number;
      qty: number;
      rarity: number | undefined;
    } = InventoryProcessor.buildEntry(meta1);
    expect(result.name).toBe('testEntry');
    expect(result.tier).toBe(1);
    expect(result.qty).toBe(5);
    expect(result.rarity).toBe(2);

    result = InventoryProcessor.buildEntry(meta2);
    expect(result.name).toBe('testEntry2');
    expect(result.tier).toBe(2);
    expect(result.qty).toBe(1);
    expect(result.rarity).toBe(3);
  });
});
