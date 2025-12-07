import { beforeEach, describe, expect, it } from 'vitest';
import { rapidStore } from './store.svelte';
import { selectionStore } from '$lib/stores/selection/store.svelte';

// Helper to compare Set-like objects by their values
function expectSetEqual<T>(actual: Set<T> | Iterable<T>, expected: Set<T>) {
    const actualArray = [...actual].sort();
    const expectedArray = [...expected].sort();
    expect(actualArray).toEqual(expectedArray);
}

describe('rapidStore', () => {
    beforeEach(() => {
        rapidStore.reset();
        selectionStore.reset();
    });

    describe('initial state', () => {
        it('should start with default settings', () => {
            expect(rapidStore.showRapids).toBe(true);
            expect(rapidStore.showRapidDirections).toBe(false);
        });
    });

    describe('toggleShowRapids', () => {
        it('should toggle showRapids from true to false', () => {
            rapidStore.toggleShowRapids();

            expect(rapidStore.showRapids).toBe(false);
        });

        it('should toggle showRapids from false to true', () => {
            rapidStore.setShowRapids(false);
            rapidStore.toggleShowRapids();

            expect(rapidStore.showRapids).toBe(true);
        });

        it('should toggle multiple times correctly', () => {
            rapidStore.toggleShowRapids(); // true -> false
            rapidStore.toggleShowRapids(); // false -> true
            rapidStore.toggleShowRapids(); // true -> false

            expect(rapidStore.showRapids).toBe(false);
        });
    });

    describe('setShowRapids', () => {
        it('should set showRapids to true', () => {
            rapidStore.setShowRapids(false);
            rapidStore.setShowRapids(true);

            expect(rapidStore.showRapids).toBe(true);
        });

        it('should set showRapids to false', () => {
            rapidStore.setShowRapids(false);

            expect(rapidStore.showRapids).toBe(false);
        });

        it('should handle setting same value', () => {
            rapidStore.setShowRapids(true);
            rapidStore.setShowRapids(true);

            expect(rapidStore.showRapids).toBe(true);
        });
    });

    describe('setShowRapidDirections', () => {
        it('should set showRapidDirections to true', () => {
            rapidStore.setShowRapidDirections(true);

            expect(rapidStore.showRapidDirections).toBe(true);
        });

        it('should set showRapidDirections to false', () => {
            rapidStore.setShowRapidDirections(false);

            expect(rapidStore.showRapidDirections).toBe(false);
        });
    });

    describe('selectRapids', () => {
        it('should select rapids by ids', () => {
            selectionStore.selectRapids(new Set(['rapid-1']));

            const state = selectionStore.getState();
            expectSetEqual(state.rapids.selected, new Set(['rapid-1']));
        });

        it('should change selection to different rapids', () => {
            selectionStore.selectRapids(new Set(['rapid-1']));
            selectionStore.selectRapids(new Set(['rapid-2']));

            const state = selectionStore.getState();
            expectSetEqual(state.rapids.selected, new Set(['rapid-2']));
        });

        it('should clear selection when empty set passed', () => {
            selectionStore.selectRapids(new Set(['rapid-1']));
            selectionStore.selectRapids(new Set());

            const state = selectionStore.getState();
            expectSetEqual(state.rapids.selected, new Set());
        });

        it('should select multiple rapids', () => {
            selectionStore.selectRapids(new Set(['rapid-1', 'rapid-2']));

            const state = selectionStore.getState();
            expectSetEqual(
                state.rapids.selected,
                new Set(['rapid-1', 'rapid-2'])
            );
        });
    });

    describe('toggleRapidSelection', () => {
        it('should add rapid to selection if not selected', () => {
            selectionStore.toggleRapidSelection('rapid-1');

            const state = selectionStore.getState();
            expectSetEqual(state.rapids.selected, new Set(['rapid-1']));
        });

        it('should remove rapid from selection if already selected', () => {
            selectionStore.selectRapids(new Set(['rapid-1']));
            selectionStore.toggleRapidSelection('rapid-1');

            const state = selectionStore.getState();
            expectSetEqual(state.rapids.selected, new Set());
        });

        it('should handle multi-select correctly', () => {
            selectionStore.toggleRapidSelection('rapid-1');
            selectionStore.toggleRapidSelection('rapid-2');

            const state = selectionStore.getState();
            expectSetEqual(
                state.rapids.selected,
                new Set(['rapid-1', 'rapid-2'])
            );
        });

        it('should toggle individual rapids in multi-select', () => {
            selectionStore.selectRapids(
                new Set(['rapid-1', 'rapid-2', 'rapid-3'])
            );
            selectionStore.toggleRapidSelection('rapid-2');

            const state = selectionStore.getState();
            expectSetEqual(
                state.rapids.selected,
                new Set(['rapid-1', 'rapid-3'])
            );
        });
    });

    describe('clearRapidSelection', () => {
        it('should clear all selected rapids', () => {
            selectionStore.selectRapids(new Set(['rapid-1', 'rapid-2']));
            selectionStore.clearRapidSelection();

            const state = selectionStore.getState();
            expectSetEqual(state.rapids.selected, new Set());
        });

        it('should handle clearing when no selection exists', () => {
            selectionStore.clearRapidSelection();

            const state = selectionStore.getState();
            expectSetEqual(state.rapids.selected, new Set());
        });
    });

    describe('highlightRapid', () => {
        it('should highlight rapid by id', () => {
            selectionStore.highlightRapid('rapid-1');

            const state = selectionStore.getState();
            expect(state.rapids.highlighted).toBe('rapid-1');
        });

        it('should change highlight to different rapid', () => {
            selectionStore.highlightRapid('rapid-1');
            selectionStore.highlightRapid('rapid-2');

            const state = selectionStore.getState();
            expect(state.rapids.highlighted).toBe('rapid-2');
        });

        it('should clear highlight when null passed', () => {
            selectionStore.highlightRapid('rapid-1');
            selectionStore.highlightRapid(null);

            const state = selectionStore.getState();
            expect(state.rapids.highlighted).toBeNull();
        });
    });

    describe('clearRapidHighlight', () => {
        it('should clear highlighted rapid', () => {
            selectionStore.highlightRapid('rapid-1');
            selectionStore.clearRapidHighlight();

            const state = selectionStore.getState();
            expect(state.rapids.highlighted).toBeNull();
        });

        it('should handle clearing when no highlight exists', () => {
            selectionStore.clearRapidHighlight();

            const state = selectionStore.getState();
            expect(state.rapids.highlighted).toBeNull();
        });
    });

    describe('reset', () => {
        it('should reset to initial state', () => {
            rapidStore.setShowRapids(false);

            rapidStore.reset();

            expect(rapidStore.showRapids).toBe(true);
            expect(rapidStore.showRapidDirections).toBe(false);
        });

        it('should reset multiple times correctly', () => {
            rapidStore.setShowRapids(false);
            rapidStore.reset();
            rapidStore.reset();

            expect(rapidStore.showRapids).toBe(true);
        });
    });

    describe('complex state interactions', () => {
        it('should handle simultaneous selection and highlighting', () => {
            selectionStore.selectRapids(new Set(['rapid-1']));
            selectionStore.highlightRapid('rapid-2');

            const state = selectionStore.getState();
            expectSetEqual(state.rapids.selected, new Set(['rapid-1']));
            expect(state.rapids.highlighted).toBe('rapid-2');
        });

        it('should handle selection and highlighting of same rapid', () => {
            selectionStore.selectRapids(new Set(['rapid-1']));
            selectionStore.highlightRapid('rapid-1');

            const state = selectionStore.getState();
            expectSetEqual(state.rapids.selected, new Set(['rapid-1']));
            expect(state.rapids.highlighted).toBe('rapid-1');
        });

        it('should maintain state integrity after multiple operations', () => {
            rapidStore.setShowRapids(false);
            selectionStore.selectRapids(new Set(['rapid-1']));
            selectionStore.highlightRapid('rapid-2');

            const selectionState = selectionStore.getState();
            expect(rapidStore.showRapids).toBe(false);
            expectSetEqual(
                selectionState.rapids.selected,
                new Set(['rapid-1'])
            );
            expect(selectionState.rapids.highlighted).toBe('rapid-2');
        });
    });
});
