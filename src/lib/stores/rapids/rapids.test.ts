import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { rapidStore } from './store';
import { selectionStore } from '$lib/stores/selection/store';

describe('rapidStore', () => {
    beforeEach(() => {
        rapidStore.reset();
        selectionStore.reset();
    });

    describe('initial state', () => {
        it('should start with default settings', () => {
            const state = get(rapidStore);

            expect(state.showRapids).toBe(true);
            expect(state.showRapidDirections).toBe(false);
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
            selectionStore.selectRapids(new Set(['rapid-1']));

            const state = get(selectionStore);
            expect(state.rapids.selected).toEqual(new Set(['rapid-1']));
        });

        it('should change selection to different rapids', () => {
            selectionStore.selectRapids(new Set(['rapid-1']));
            selectionStore.selectRapids(new Set(['rapid-2']));

            const state = get(selectionStore);
            expect(state.rapids.selected).toEqual(new Set(['rapid-2']));
        });

        it('should clear selection when empty set passed', () => {
            selectionStore.selectRapids(new Set(['rapid-1']));
            selectionStore.selectRapids(new Set());

            const state = get(selectionStore);
            expect(state.rapids.selected).toEqual(new Set());
        });

        it('should select multiple rapids', () => {
            selectionStore.selectRapids(new Set(['rapid-1', 'rapid-2']));

            const state = get(selectionStore);
            expect(state.rapids.selected).toEqual(
                new Set(['rapid-1', 'rapid-2'])
            );
        });
    });

    describe('toggleRapidSelection', () => {
        it('should add rapid to selection if not selected', () => {
            selectionStore.toggleRapidSelection('rapid-1');

            const state = get(selectionStore);
            expect(state.rapids.selected).toEqual(new Set(['rapid-1']));
        });

        it('should remove rapid from selection if already selected', () => {
            selectionStore.selectRapids(new Set(['rapid-1']));
            selectionStore.toggleRapidSelection('rapid-1');

            const state = get(selectionStore);
            expect(state.rapids.selected).toEqual(new Set());
        });

        it('should handle multi-select correctly', () => {
            selectionStore.toggleRapidSelection('rapid-1');
            selectionStore.toggleRapidSelection('rapid-2');

            const state = get(selectionStore);
            expect(state.rapids.selected).toEqual(
                new Set(['rapid-1', 'rapid-2'])
            );
        });

        it('should toggle individual rapids in multi-select', () => {
            selectionStore.selectRapids(
                new Set(['rapid-1', 'rapid-2', 'rapid-3'])
            );
            selectionStore.toggleRapidSelection('rapid-2');

            const state = get(selectionStore);
            expect(state.rapids.selected).toEqual(
                new Set(['rapid-1', 'rapid-3'])
            );
        });
    });

    describe('clearRapidSelection', () => {
        it('should clear all selected rapids', () => {
            selectionStore.selectRapids(new Set(['rapid-1', 'rapid-2']));
            selectionStore.clearRapidSelection();

            const state = get(selectionStore);
            expect(state.rapids.selected).toEqual(new Set());
        });

        it('should handle clearing when no selection exists', () => {
            selectionStore.clearRapidSelection();

            const state = get(selectionStore);
            expect(state.rapids.selected).toEqual(new Set());
        });
    });

    describe('highlightRapid', () => {
        it('should highlight rapid by id', () => {
            selectionStore.highlightRapid('rapid-1');

            const state = get(selectionStore);
            expect(state.rapids.highlighted).toBe('rapid-1');
        });

        it('should change highlight to different rapid', () => {
            selectionStore.highlightRapid('rapid-1');
            selectionStore.highlightRapid('rapid-2');

            const state = get(selectionStore);
            expect(state.rapids.highlighted).toBe('rapid-2');
        });

        it('should clear highlight when null passed', () => {
            selectionStore.highlightRapid('rapid-1');
            selectionStore.highlightRapid(null);

            const state = get(selectionStore);
            expect(state.rapids.highlighted).toBeNull();
        });
    });

    describe('clearRapidHighlight', () => {
        it('should clear highlighted rapid', () => {
            selectionStore.highlightRapid('rapid-1');
            selectionStore.clearRapidHighlight();

            const state = get(selectionStore);
            expect(state.rapids.highlighted).toBeNull();
        });

        it('should handle clearing when no highlight exists', () => {
            selectionStore.clearRapidHighlight();

            const state = get(selectionStore);
            expect(state.rapids.highlighted).toBeNull();
        });
    });

    describe('reset', () => {
        it('should reset to initial state', () => {
            rapidStore.setShowRapids(false);

            rapidStore.reset();

            const state = get(rapidStore);
            expect(state).toEqual({
                showRapids: true,
                showRapidDirections: false,
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
            selectionStore.selectRapids(new Set(['rapid-1']));
            selectionStore.highlightRapid('rapid-2');

            const state = get(selectionStore);
            expect(state.rapids.selected).toEqual(new Set(['rapid-1']));
            expect(state.rapids.highlighted).toBe('rapid-2');
        });

        it('should handle selection and highlighting of same rapid', () => {
            selectionStore.selectRapids(new Set(['rapid-1']));
            selectionStore.highlightRapid('rapid-1');

            const state = get(selectionStore);
            expect(state.rapids.selected).toEqual(new Set(['rapid-1']));
            expect(state.rapids.highlighted).toBe('rapid-1');
        });

        it('should maintain state integrity after multiple operations', () => {
            rapidStore.setShowRapids(false);
            selectionStore.selectRapids(new Set(['rapid-1']));
            selectionStore.highlightRapid('rapid-2');

            const rapidState = get(rapidStore);
            const selectionState = get(selectionStore);
            expect(rapidState.showRapids).toBe(false);
            expect(selectionState.rapids.selected).toEqual(
                new Set(['rapid-1'])
            );
            expect(selectionState.rapids.highlighted).toBe('rapid-2');
        });
    });
});
