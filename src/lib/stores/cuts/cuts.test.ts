import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { cutStore } from './store';

describe('cutStore - UI state only', () => {
    beforeEach(() => {
        // Reset the store
        cutStore.reset();
    });

    describe('selectCut', () => {
        it('should set selected cut id', () => {
            cutStore.selectCut('cut-123');

            const state = get(cutStore);
            expect(state.selectedCutIds.has('cut-123')).toBe(true);
        });

        it('should clear selection when null passed', () => {
            cutStore.selectCut('cut-123');
            cutStore.selectCut(null);

            const state = get(cutStore);
            expect(state.selectedCutIds.size).toBe(0);
        });

        it('should support multi-select', () => {
            cutStore.selectCut('cut-1', true);
            cutStore.selectCut('cut-2', true);

            const state = get(cutStore);
            expect(state.selectedCutIds.has('cut-1')).toBe(true);
            expect(state.selectedCutIds.has('cut-2')).toBe(true);
        });
    });

    describe('deselectCut', () => {
        it('should remove cut from selection', () => {
            cutStore.selectCut('cut-1', true);
            cutStore.selectCut('cut-2', true);
            cutStore.deselectCut('cut-1');

            const state = get(cutStore);
            expect(state.selectedCutIds.has('cut-1')).toBe(false);
            expect(state.selectedCutIds.has('cut-2')).toBe(true);
        });
    });

    describe('toggleCutSelection', () => {
        it('should add cut to selection if not selected', () => {
            cutStore.toggleCutSelection('cut-1');

            const state = get(cutStore);
            expect(state.selectedCutIds.has('cut-1')).toBe(true);
        });

        it('should remove cut from selection if already selected', () => {
            cutStore.selectCut('cut-1');
            cutStore.toggleCutSelection('cut-1');

            const state = get(cutStore);
            expect(state.selectedCutIds.has('cut-1')).toBe(false);
        });
    });

    describe('highlightCut', () => {
        it('should set highlighted cut id', () => {
            cutStore.highlightCut('cut-123');

            const state = get(cutStore);
            expect(state.highlightedCutId).toBe('cut-123');
        });

        it('should clear highlight when null passed', () => {
            cutStore.highlightCut('cut-123');
            cutStore.highlightCut(null);

            const state = get(cutStore);
            expect(state.highlightedCutId).toBeNull();
        });
    });

    describe('clearHighlight', () => {
        it('should clear highlighted cut', () => {
            cutStore.highlightCut('cut-123');
            cutStore.clearHighlight();

            const state = get(cutStore);
            expect(state.highlightedCutId).toBeNull();
        });
    });

    describe('visibility flags', () => {
        it('should toggle showCutNormals', () => {
            cutStore.setShowCutNormals(true);
            expect(get(cutStore).showCutNormals).toBe(true);

            cutStore.setShowCutNormals(false);
            expect(get(cutStore).showCutNormals).toBe(false);
        });

        it('should toggle showCutDirections', () => {
            cutStore.setShowCutDirections(true);
            expect(get(cutStore).showCutDirections).toBe(true);
        });

        it('should toggle showCutPaths', () => {
            cutStore.setShowCutPaths(false);
            expect(get(cutStore).showCutPaths).toBe(false);
        });

        it('should toggle showCutStartPoints', () => {
            cutStore.setShowCutStartPoints(true);
            expect(get(cutStore).showCutStartPoints).toBe(true);
        });

        it('should toggle showCutEndPoints', () => {
            cutStore.setShowCutEndPoints(true);
            expect(get(cutStore).showCutEndPoints).toBe(true);
        });

        it('should toggle showCutTangentLines', () => {
            cutStore.setShowCutTangentLines(true);
            expect(get(cutStore).showCutTangentLines).toBe(true);
        });
    });

    describe('reset', () => {
        it('should clear all UI state', () => {
            cutStore.selectCut('cut-123');
            cutStore.highlightCut('cut-456');
            cutStore.setShowCutNormals(true);

            cutStore.reset();

            const state = get(cutStore);
            expect(state.selectedCutIds.size).toBe(0);
            expect(state.highlightedCutId).toBeNull();
            expect(state.showCutNormals).toBe(false);
        });
    });

    describe('restore', () => {
        it('should restore UI state', () => {
            const savedState = {
                selectedCutIds: new Set(['cut-1', 'cut-2']),
                highlightedCutId: 'cut-3',
                showCutNormals: true,
                showCutDirections: true,
                showCutPaths: false,
                showCutStartPoints: true,
                showCutEndPoints: true,
                showCutTangentLines: true,
            };

            cutStore.restore(savedState);

            const state = get(cutStore);
            expect(state).toEqual(savedState);
        });
    });
});
