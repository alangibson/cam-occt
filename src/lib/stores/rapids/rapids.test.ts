import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { rapidStore } from './store';
import {
    clearRapidHighlight,
    highlightRapid,
    selectRapids,
    toggleRapidSelection,
    clearRapidSelection,
} from './functions';
import type { Rapid } from '$lib/cam/rapid/interfaces';

describe('rapidStore', () => {
    beforeEach(() => {
        rapidStore.reset();
    });

    const createTestRapid = (id: string): Rapid => ({
        id,
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        type: 'rapid',
    });

    describe('initial state', () => {
        it('should start with empty rapids and default settings', () => {
            const state = get(rapidStore);

            expect(state.rapids).toHaveLength(0);
            expect(state.showRapids).toBe(true);
            expect(state.selectedRapidIds).toEqual(new Set());
            expect(state.highlightedRapidId).toBeNull();
        });
    });

    describe('setRapids', () => {
        it('should set rapids array', () => {
            const rapids = [
                createTestRapid('rapid-1'),
                createTestRapid('rapid-2'),
            ];

            rapidStore.setRapids(rapids);

            const state = get(rapidStore);
            expect(state.rapids).toEqual(rapids);
            expect(state.rapids).toHaveLength(2);
        });

        it('should replace existing rapids', () => {
            const initialRapids = [createTestRapid('rapid-1')];
            const newRapids = [
                createTestRapid('rapid-2'),
                createTestRapid('rapid-3'),
            ];

            rapidStore.setRapids(initialRapids);
            rapidStore.setRapids(newRapids);

            const state = get(rapidStore);
            expect(state.rapids).toEqual(newRapids);
            expect(state.rapids).toHaveLength(2);
            expect(state.rapids[0].id).toBe('rapid-2');
        });

        it('should handle empty rapids array', () => {
            const rapids = [createTestRapid('rapid-1')];

            rapidStore.setRapids(rapids);
            rapidStore.setRapids([]);

            const state = get(rapidStore);
            expect(state.rapids).toHaveLength(0);
        });
    });

    describe('clearRapids', () => {
        it('should clear rapids array', () => {
            const rapids = [
                createTestRapid('rapid-1'),
                createTestRapid('rapid-2'),
            ];

            rapidStore.setRapids(rapids);
            rapidStore.clearRapids();

            const state = get(rapidStore);
            expect(state.rapids).toHaveLength(0);
        });

        it('should preserve other state when clearing rapids', () => {
            const rapids = [createTestRapid('rapid-1')];

            rapidStore.setRapids(rapids);
            rapidStore.setShowRapids(false);
            rapidStore.selectRapids(new Set(['rapid-1']));
            rapidStore.highlightRapid('rapid-1');

            rapidStore.clearRapids();

            const state = get(rapidStore);
            expect(state.rapids).toHaveLength(0);
            expect(state.showRapids).toBe(false);
            expect(state.selectedRapidIds).toEqual(new Set(['rapid-1']));
            expect(state.highlightedRapidId).toBe('rapid-1');
        });
    });

    describe('toggleShowRapids', () => {
        it('should toggle showRapids from true to false', () => {
            rapidStore.toggleShowRapids();

            const state = get(rapidStore);
            expect(state.showRapids).toBe(false);
        });

        it('should toggle showRapids from false to true', () => {
            rapidStore.setShowRapids(false);
            rapidStore.toggleShowRapids();

            const state = get(rapidStore);
            expect(state.showRapids).toBe(true);
        });

        it('should toggle multiple times correctly', () => {
            rapidStore.toggleShowRapids(); // true -> false
            rapidStore.toggleShowRapids(); // false -> true
            rapidStore.toggleShowRapids(); // true -> false

            const state = get(rapidStore);
            expect(state.showRapids).toBe(false);
        });
    });

    describe('setShowRapids', () => {
        it('should set showRapids to true', () => {
            rapidStore.setShowRapids(false);
            rapidStore.setShowRapids(true);

            const state = get(rapidStore);
            expect(state.showRapids).toBe(true);
        });

        it('should set showRapids to false', () => {
            rapidStore.setShowRapids(false);

            const state = get(rapidStore);
            expect(state.showRapids).toBe(false);
        });

        it('should handle setting same value', () => {
            rapidStore.setShowRapids(true);
            rapidStore.setShowRapids(true);

            const state = get(rapidStore);
            expect(state.showRapids).toBe(true);
        });
    });

    describe('selectRapids', () => {
        it('should select rapids by ids', () => {
            rapidStore.selectRapids(new Set(['rapid-1']));

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set(['rapid-1']));
        });

        it('should change selection to different rapids', () => {
            rapidStore.selectRapids(new Set(['rapid-1']));
            rapidStore.selectRapids(new Set(['rapid-2']));

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set(['rapid-2']));
        });

        it('should clear selection when empty set passed', () => {
            rapidStore.selectRapids(new Set(['rapid-1']));
            rapidStore.selectRapids(new Set());

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set());
        });

        it('should select multiple rapids', () => {
            rapidStore.selectRapids(new Set(['rapid-1', 'rapid-2']));

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(
                new Set(['rapid-1', 'rapid-2'])
            );
        });
    });

    describe('toggleRapidSelection', () => {
        it('should add rapid to selection if not selected', () => {
            rapidStore.toggleRapidSelection('rapid-1');

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set(['rapid-1']));
        });

        it('should remove rapid from selection if already selected', () => {
            rapidStore.selectRapids(new Set(['rapid-1']));
            rapidStore.toggleRapidSelection('rapid-1');

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set());
        });

        it('should handle multi-select correctly', () => {
            rapidStore.toggleRapidSelection('rapid-1');
            rapidStore.toggleRapidSelection('rapid-2');

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(
                new Set(['rapid-1', 'rapid-2'])
            );
        });

        it('should toggle individual rapids in multi-select', () => {
            rapidStore.selectRapids(new Set(['rapid-1', 'rapid-2', 'rapid-3']));
            rapidStore.toggleRapidSelection('rapid-2');

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(
                new Set(['rapid-1', 'rapid-3'])
            );
        });
    });

    describe('clearSelection', () => {
        it('should clear all selected rapids', () => {
            rapidStore.selectRapids(new Set(['rapid-1', 'rapid-2']));
            rapidStore.clearSelection();

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set());
        });

        it('should handle clearing when no selection exists', () => {
            rapidStore.clearSelection();

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set());
        });
    });

    describe('highlightRapid', () => {
        it('should highlight rapid by id', () => {
            rapidStore.highlightRapid('rapid-1');

            const state = get(rapidStore);
            expect(state.highlightedRapidId).toBe('rapid-1');
        });

        it('should change highlight to different rapid', () => {
            rapidStore.highlightRapid('rapid-1');
            rapidStore.highlightRapid('rapid-2');

            const state = get(rapidStore);
            expect(state.highlightedRapidId).toBe('rapid-2');
        });

        it('should clear highlight when null passed', () => {
            rapidStore.highlightRapid('rapid-1');
            rapidStore.highlightRapid(null);

            const state = get(rapidStore);
            expect(state.highlightedRapidId).toBeNull();
        });
    });

    describe('clearHighlight', () => {
        it('should clear highlighted rapid', () => {
            rapidStore.highlightRapid('rapid-1');
            rapidStore.clearHighlight();

            const state = get(rapidStore);
            expect(state.highlightedRapidId).toBeNull();
        });

        it('should handle clearing when no highlight exists', () => {
            rapidStore.clearHighlight();

            const state = get(rapidStore);
            expect(state.highlightedRapidId).toBeNull();
        });
    });

    describe('reset', () => {
        it('should reset to initial state', () => {
            const rapids = [createTestRapid('rapid-1')];

            rapidStore.setRapids(rapids);
            rapidStore.setShowRapids(false);
            rapidStore.selectRapids(new Set(['rapid-1']));
            rapidStore.highlightRapid('rapid-1');

            rapidStore.reset();

            const state = get(rapidStore);
            expect(state).toEqual({
                rapids: [],
                showRapids: true,
                showRapidDirections: false,
                selectedRapidIds: new Set(),
                highlightedRapidId: null,
            });
        });

        it('should reset multiple times correctly', () => {
            const rapids = [createTestRapid('rapid-1')];

            rapidStore.setRapids(rapids);
            rapidStore.reset();
            rapidStore.reset();

            const state = get(rapidStore);
            expect(state.rapids).toHaveLength(0);
            expect(state.showRapids).toBe(true);
        });
    });

    describe('complex state interactions', () => {
        it('should handle simultaneous selection and highlighting', () => {
            rapidStore.selectRapids(new Set(['rapid-1']));
            rapidStore.highlightRapid('rapid-2');

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set(['rapid-1']));
            expect(state.highlightedRapidId).toBe('rapid-2');
        });

        it('should handle selection and highlighting of same rapid', () => {
            rapidStore.selectRapids(new Set(['rapid-1']));
            rapidStore.highlightRapid('rapid-1');

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set(['rapid-1']));
            expect(state.highlightedRapidId).toBe('rapid-1');
        });

        it('should maintain state integrity after multiple operations', () => {
            const rapids = [
                createTestRapid('rapid-1'),
                createTestRapid('rapid-2'),
            ];

            rapidStore.setRapids(rapids);
            rapidStore.setShowRapids(false);
            rapidStore.selectRapids(new Set(['rapid-1']));
            rapidStore.highlightRapid('rapid-2');
            rapidStore.clearRapids();

            const state = get(rapidStore);
            expect(state.rapids).toHaveLength(0);
            expect(state.showRapids).toBe(false);
            expect(state.selectedRapidIds).toEqual(new Set(['rapid-1']));
            expect(state.highlightedRapidId).toBe('rapid-2');
        });
    });
});

describe('helper functions', () => {
    beforeEach(() => {
        rapidStore.reset();
    });

    describe('selectRapids helper', () => {
        it('should select rapids using helper function', () => {
            selectRapids(new Set(['helper-rapid-1']));

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set(['helper-rapid-1']));
        });

        it('should clear selection using helper function', () => {
            selectRapids(new Set(['helper-rapid-1']));
            clearRapidSelection();

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set());
        });
    });

    describe('toggleRapidSelection helper', () => {
        it('should toggle rapid using helper function', () => {
            toggleRapidSelection('helper-rapid-1');

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set(['helper-rapid-1']));
        });

        it('should toggle off using helper function', () => {
            toggleRapidSelection('helper-rapid-1');
            toggleRapidSelection('helper-rapid-1');

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set());
        });
    });

    describe('highlightRapid helper', () => {
        it('should highlight rapid using helper function', () => {
            highlightRapid('helper-rapid-2');

            const state = get(rapidStore);
            expect(state.highlightedRapidId).toBe('helper-rapid-2');
        });

        it('should clear highlight using helper function', () => {
            highlightRapid('helper-rapid-2');
            highlightRapid(null);

            const state = get(rapidStore);
            expect(state.highlightedRapidId).toBeNull();
        });
    });

    describe('clearRapidHighlight helper', () => {
        it('should clear highlight using helper function', () => {
            highlightRapid('helper-rapid-3');
            clearRapidHighlight();

            const state = get(rapidStore);
            expect(state.highlightedRapidId).toBeNull();
        });

        it('should handle clearing when no highlight exists using helper', () => {
            clearRapidHighlight();

            const state = get(rapidStore);
            expect(state.highlightedRapidId).toBeNull();
        });
    });

    describe('helper function integration', () => {
        it('should work together with store methods', () => {
            const rapids: Rapid[] = [
                {
                    id: 'rapid-1',
                    start: { x: 0, y: 0 },
                    end: { x: 5, y: 5 },
                    type: 'rapid',
                },
            ];

            rapidStore.setRapids(rapids);
            selectRapids(new Set(['rapid-1']));
            highlightRapid('rapid-1');
            rapidStore.setShowRapids(false);

            const state = get(rapidStore);
            expect(state.rapids).toHaveLength(1);
            expect(state.selectedRapidIds).toEqual(new Set(['rapid-1']));
            expect(state.highlightedRapidId).toBe('rapid-1');
            expect(state.showRapids).toBe(false);
        });
    });
});
