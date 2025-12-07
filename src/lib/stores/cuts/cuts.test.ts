import { beforeEach, describe, expect, it } from 'vitest';
import { cutStore } from './store.svelte';
import { selectionStore } from '$lib/stores/selection/store.svelte';

describe('cutStore - UI state only', () => {
    beforeEach(() => {
        // Reset the stores
        cutStore.reset();
        selectionStore.reset();
    });

    describe('selectCut', () => {
        it('should set selected cut id', () => {
            selectionStore.selectCut('cut-123');

            const state = selectionStore.getState();
            expect(state.cuts.selected.has('cut-123')).toBe(true);
        });

        it('should clear selection when null passed', () => {
            selectionStore.selectCut('cut-123');
            selectionStore.selectCut(null);

            const state = selectionStore.getState();
            expect(state.cuts.selected.size).toBe(0);
        });

        it('should support multi-select', () => {
            selectionStore.selectCut('cut-1', true);
            selectionStore.selectCut('cut-2', true);

            const state = selectionStore.getState();
            expect(state.cuts.selected.has('cut-1')).toBe(true);
            expect(state.cuts.selected.has('cut-2')).toBe(true);
        });
    });

    describe('deselectCut', () => {
        it('should remove cut from selection', () => {
            selectionStore.selectCut('cut-1', true);
            selectionStore.selectCut('cut-2', true);
            selectionStore.deselectCut('cut-1');

            const state = selectionStore.getState();
            expect(state.cuts.selected.has('cut-1')).toBe(false);
            expect(state.cuts.selected.has('cut-2')).toBe(true);
        });
    });

    describe('toggleCutSelection', () => {
        it('should add cut to selection if not selected', () => {
            selectionStore.toggleCutSelection('cut-1');

            const state = selectionStore.getState();
            expect(state.cuts.selected.has('cut-1')).toBe(true);
        });

        it('should remove cut from selection if already selected', () => {
            selectionStore.selectCut('cut-1');
            selectionStore.toggleCutSelection('cut-1');

            const state = selectionStore.getState();
            expect(state.cuts.selected.has('cut-1')).toBe(false);
        });
    });

    describe('highlightCut', () => {
        it('should set highlighted cut id', () => {
            selectionStore.highlightCut('cut-123');

            const state = selectionStore.getState();
            expect(state.cuts.highlighted).toBe('cut-123');
        });

        it('should clear highlight when null passed', () => {
            selectionStore.highlightCut('cut-123');
            selectionStore.highlightCut(null);

            const state = selectionStore.getState();
            expect(state.cuts.highlighted).toBeNull();
        });
    });

    describe('clearCutHighlight', () => {
        it('should clear highlighted cut', () => {
            selectionStore.highlightCut('cut-123');
            selectionStore.clearCutHighlight();

            const state = selectionStore.getState();
            expect(state.cuts.highlighted).toBeNull();
        });
    });

    describe('visibility flags', () => {
        it('should toggle showCutNormals', () => {
            cutStore.setShowCutNormals(true);
            expect(cutStore.showCutNormals).toBe(true);

            cutStore.setShowCutNormals(false);
            expect(cutStore.showCutNormals).toBe(false);
        });

        it('should toggle showCutDirections', () => {
            cutStore.setShowCutDirections(true);
            expect(cutStore.showCutDirections).toBe(true);
        });

        it('should toggle showCutPaths', () => {
            cutStore.setShowCutPaths(false);
            expect(cutStore.showCutPaths).toBe(false);
        });

        it('should toggle showCutStartPoints', () => {
            cutStore.setShowCutStartPoints(true);
            expect(cutStore.showCutStartPoints).toBe(true);
        });

        it('should toggle showCutEndPoints', () => {
            cutStore.setShowCutEndPoints(true);
            expect(cutStore.showCutEndPoints).toBe(true);
        });

        it('should toggle showCutTangentLines', () => {
            cutStore.setShowCutTangentLines(true);
            expect(cutStore.showCutTangentLines).toBe(true);
        });
    });

    describe('reset', () => {
        it('should clear all UI state', () => {
            cutStore.setShowCutNormals(true);

            cutStore.reset();

            expect(cutStore.showCutNormals).toBe(false);
        });
    });

    describe('restore', () => {
        it('should restore UI state', () => {
            const savedState = {
                showCutNormals: true,
                showCutDirections: true,
                showCutPaths: false,
                showCutStartPoints: true,
                showCutEndPoints: true,
                showCutTangentLines: true,
            };

            cutStore.restore(savedState);

            expect(cutStore.showCutNormals).toBe(savedState.showCutNormals);
            expect(cutStore.showCutDirections).toBe(
                savedState.showCutDirections
            );
            expect(cutStore.showCutPaths).toBe(savedState.showCutPaths);
            expect(cutStore.showCutStartPoints).toBe(
                savedState.showCutStartPoints
            );
            expect(cutStore.showCutEndPoints).toBe(savedState.showCutEndPoints);
            expect(cutStore.showCutTangentLines).toBe(
                savedState.showCutTangentLines
            );
        });
    });
});
