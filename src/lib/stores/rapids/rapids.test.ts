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

describe('rapidStore', () => {
    beforeEach(() => {
        rapidStore.reset();
    });

    describe('initial state', () => {
        it('should start with default settings', () => {
            const state = get(rapidStore);

            expect(state.showRapids).toBe(true);
            expect(state.showRapidDirections).toBe(false);
            expect(state.selectedRapidIds).toEqual(new Set());
            expect(state.highlightedRapidId).toBeNull();
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

    describe('setShowRapidDirections', () => {
        it('should set showRapidDirections to true', () => {
            rapidStore.setShowRapidDirections(true);

            const state = get(rapidStore);
            expect(state.showRapidDirections).toBe(true);
        });

        it('should set showRapidDirections to false', () => {
            rapidStore.setShowRapidDirections(false);

            const state = get(rapidStore);
            expect(state.showRapidDirections).toBe(false);
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
            rapidStore.setShowRapids(false);
            rapidStore.selectRapids(new Set(['rapid-1']));
            rapidStore.highlightRapid('rapid-1');

            rapidStore.reset();

            const state = get(rapidStore);
            expect(state).toEqual({
                showRapids: true,
                showRapidDirections: false,
                selectedRapidIds: new Set(),
                highlightedRapidId: null,
            });
        });

        it('should reset multiple times correctly', () => {
            rapidStore.setShowRapids(false);
            rapidStore.reset();
            rapidStore.reset();

            const state = get(rapidStore);
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
            rapidStore.setShowRapids(false);
            rapidStore.selectRapids(new Set(['rapid-1']));
            rapidStore.highlightRapid('rapid-2');

            const state = get(rapidStore);
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
            selectRapids(new Set(['rapid-1']));
            highlightRapid('rapid-1');
            rapidStore.setShowRapids(false);

            const state = get(rapidStore);
            expect(state.selectedRapidIds).toEqual(new Set(['rapid-1']));
            expect(state.highlightedRapidId).toBe('rapid-1');
            expect(state.showRapids).toBe(false);
        });
    });
});
