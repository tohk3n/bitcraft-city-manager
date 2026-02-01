import {describe, expect, it} from 'vitest';
import {DashboardUI} from './dashboard.js';
import {FILTER_TYPE} from "./types";

const DASHBOARD_CONFIG = {
    FRIDGE: {
        Apple: true,
        Bread: true
    }
};

describe('filterFridge', () => {
    it('filters food items based on fridge list', () => {
        const food = {
            1: { name: 'Fine Deluxe Ocean Fish Sticks', tier: 1, qty: 5, rarity: 1 },
            2: { name: 'Succulent Ocean Fish Sticks', tier: 2, qty: 2, rarity: 2 },
            3: { name: 'Apple', tier: 1, qty: 10, rarity: 3 }
        };

        const fridge = [
            'Fine Deluxe Ocean Fish Sticks',
            'Succulent Ocean Fish Sticks'
        ];

        const result = DashboardUI.filterFridge(food, fridge,FILTER_TYPE.FRIDGE);

        expect(Object.keys(result)).toHaveLength(2);
        expect(result[1].name).toBe('Fine Deluxe Ocean Fish Sticks');
        expect(result[2].name).toBe('Succulent Ocean Fish Sticks');
        expect(result[3]).toBeUndefined();


    });
    it('filters food items based on rarity > 1', () => {
        const food = {
            1: { name: 'Fine Deluxe Ocean Fish Sticks', tier: 1, qty: 5, rarity: 1 },
            2: { name: 'Succulent Ocean Fish Sticks', tier: 2, qty: 2, rarity: 2 },
            3: { name: 'Apple', tier: 1, qty: 10, rarity: 3 }
        };
        const fridge = [''];

        const result = DashboardUI.filterFridge(food,fridge ,FILTER_TYPE.RARITY_RARE);

        expect(Object.keys(result)).toHaveLength(2);
        expect(result[1]).toBeUndefined;
        expect(result[2]?.name).toBe('Succulent Ocean Fish Sticks');
        expect(result[3]?.name).toBe('Apple');
    })
});
