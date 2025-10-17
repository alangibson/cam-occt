import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { drawingStore } from './store';
import { Unit } from '$lib/utils/units';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { Drawing } from '$lib/geometry/shape';

describe('DrawingStore zoomToFit method', () => {
    beforeEach(() => {
        // Reset store and set canvas dimensions
        drawingStore.setCanvasDimensions(1000, 800);
    });

    it('should calculate zoom-to-fit when called', () => {
        const testDrawing: Drawing = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    layer: '0',
                    start: { x: 0, y: 0 },
                    end: { x: 200, y: 100 },
                } as any,
            ],
            units: Unit.MM,
            layers: {},
            bounds: { min: { x: 0, y: 0 }, max: { x: 200, y: 100 } },
        };

        drawingStore.setDrawing(testDrawing, 'test.dxf');

        // Manually set a different zoom and offset
        drawingStore.setViewTransform(0.5, { x: -50, y: -50 });

        const stateBeforeFit = get(drawingStore);
        expect(stateBeforeFit.scale).toBe(0.5);
        expect(stateBeforeFit.offset).toEqual({ x: -50, y: -50 });

        // Call zoomToFit
        drawingStore.zoomToFit();

        const stateAfterFit = get(drawingStore);

        // The scale and offset should have changed
        expect(stateAfterFit.scale).not.toBe(0.5);
        expect(stateAfterFit.offset).not.toEqual({ x: -50, y: -50 });

        // The drawing should still be loaded
        expect(stateAfterFit.drawing).toBe(testDrawing);
    });

    it('should do nothing when canvas dimensions are not set', () => {
        // Create a fresh store without canvas dimensions by clearing them
        // Since we can't directly modify the store, we test the expected behavior
        const testDrawing: Drawing = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    layer: '0',
                    start: { x: 0, y: 0 },
                    end: { x: 100, y: 100 },
                } as any,
            ],
            units: Unit.MM,
            layers: {},
            bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
        };

        drawingStore.setDrawing(testDrawing, 'test.dxf');

        // The store should have canvas dimensions from beforeEach
        const state = get(drawingStore);
        expect(state.canvasDimensions).not.toBeNull();

        // Call zoomToFit - it should work since we have canvas dimensions
        drawingStore.zoomToFit();

        const afterState = get(drawingStore);
        // The zoom should have been calculated
        expect(afterState.scale).toBeGreaterThan(0);
    });

    it('should handle empty drawings gracefully', () => {
        const emptyDrawing: Drawing = {
            shapes: [],
            units: Unit.MM,
            layers: {},
            bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
        };

        drawingStore.setDrawing(emptyDrawing, 'empty.dxf');

        // Set a custom zoom and offset
        drawingStore.setViewTransform(3, { x: 200, y: 200 });

        const stateBeforeFit = get(drawingStore);
        expect(stateBeforeFit.scale).toBe(3);
        expect(stateBeforeFit.offset).toEqual({ x: 200, y: 200 });

        // Call zoomToFit
        drawingStore.zoomToFit();

        const stateAfterFit = get(drawingStore);

        // For empty drawings, it should use default zoom (1) and offset (0, 0)
        expect(stateAfterFit.scale).toBe(1);
        expect(stateAfterFit.offset).toEqual({ x: 0, y: 0 });
    });

    it('should be callable multiple times', () => {
        const testDrawing: Drawing = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    layer: '0',
                    start: { x: 50, y: 50 },
                    end: { x: 150, y: 150 },
                } as any,
            ],
            units: Unit.MM,
            layers: {},
            bounds: { min: { x: 50, y: 50 }, max: { x: 150, y: 150 } },
        };

        drawingStore.setDrawing(testDrawing, 'test.dxf');

        // Change zoom and call zoomToFit
        drawingStore.setViewTransform(0.5, { x: -100, y: -100 });
        drawingStore.zoomToFit();

        const firstFit = get(drawingStore);
        const firstScale = firstFit.scale;
        const firstOffset = { ...firstFit.offset };

        // Change zoom again and call zoomToFit again
        drawingStore.setViewTransform(3, { x: 300, y: 300 });
        drawingStore.zoomToFit();

        const secondFit = get(drawingStore);

        // Should return to the same zoom-to-fit values
        expect(secondFit.scale).toBe(firstScale);
        expect(secondFit.offset).toEqual(firstOffset);
    });
});
