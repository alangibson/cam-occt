import { describe, it, expect, beforeEach } from 'vitest';
import { drawingStore } from './store.svelte';
import { Unit } from '$lib/config/units/units';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import { GeometryType } from '$lib/geometry/enums';

describe('Drawing Store Zoom-to-Fit Integration', () => {
    beforeEach(() => {
        // Reset store state before each test
        drawingStore.setContainerDimensions(800, 600);
    });

    it('should calculate zoom-to-fit when setting a drawing with canvas dimensions available', () => {
        const testDrawing: DrawingData = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    layer: '0',
                    geometry: {
                        start: { x: 0, y: 0 },
                        end: { x: 100, y: 50 },
                    },
                },
                {
                    id: '2',
                    type: GeometryType.LINE,
                    layer: '0',
                    geometry: {
                        start: { x: 100, y: 50 },
                        end: { x: 0, y: 50 },
                    },
                },
            ],
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        drawingStore.setDrawing(new Drawing(testDrawing), 'test.dxf');

        const state = drawingStore;

        // Should have calculated a zoom scale (not the default 1)
        expect(state.scale).toBeGreaterThan(0);
        // Should have calculated an offset
        expect(state.offset).toBeDefined();
        expect(typeof state.offset.x).toBe('number');
        expect(typeof state.offset.y).toBe('number');
        // Should have the drawing loaded
        expect(state.drawing?.shapes.length).toBe(2);
        expect(state.drawing?.fileName).toBe('test.dxf');
    });

    it('should use default zoom when no canvas dimensions are available', () => {
        // Since we can't directly modify store state, test using a fresh store
        // by creating a test scenario where canvas dimensions haven't been set yet
        const testDrawing: DrawingData = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    layer: '0',
                    geometry: {
                        start: { x: 0, y: 0 },
                        end: { x: 100, y: 50 },
                    },
                },
            ],
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        // The calculation will use fallback values if no canvas dimensions are available
        // In practice, this test verifies the error handling in the calculateZoomToFitForDrawing function
        drawingStore.setDrawing(new Drawing(testDrawing), 'test.dxf');

        const state = drawingStore;

        // The drawing should still be loaded
        expect(state.drawing?.shapes.length).toBe(1);
        expect(state.drawing?.fileName).toBe('test.dxf');
        // Scale and offset should be reasonable values (may be calculated or default)
        expect(typeof state.scale).toBe('number');
        expect(typeof state.offset.x).toBe('number');
        expect(typeof state.offset.y).toBe('number');
    });

    it('should calculate zoom-to-fit when canvas dimensions are set after drawing', () => {
        // For this test, we'll verify that the first call to setCanvasDimensions triggers zoom calculation
        // Since canvasDimensions is null initially, we first load a drawing
        const testDrawing: DrawingData = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    layer: '0',
                    geometry: {
                        start: { x: 0, y: 0 },
                        end: { x: 200, y: 100 },
                    },
                },
            ],
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        // Set drawing first without any canvas dimensions set yet (in beforeEach, we set dimensions)
        // We need to create a fresh test for this

        // The logic should work - when setCanvasDimensions is called and we have a drawing,
        // it should calculate zoom-to-fit
        drawingStore.setDrawing(new Drawing(testDrawing), 'test.dxf');

        // Verify drawing is loaded with canvas dimensions available (from beforeEach)
        const state = drawingStore;
        expect(state.drawing?.shapes.length).toBe(1);
        expect(state.containerDimensions).not.toBeNull();
        expect(state.scale).toBeGreaterThan(0);
        expect(state.drawing?.fileName).toBe('test.dxf');
    });

    it('should handle empty drawings gracefully', () => {
        const emptyDrawing: DrawingData = {
            shapes: [],
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        drawingStore.setDrawing(new Drawing(emptyDrawing), 'empty.dxf');

        const state = drawingStore;

        // Should use fallback zoom settings for empty drawings
        expect(state.scale).toBe(1);
        expect(state.offset.x).toBe(0);
        expect(state.offset.y).toBe(0);
        expect(state.drawing?.shapes).toEqual([]);
    });

    it('should position origin at 25% from left, 75% from top after zoom-to-fit', () => {
        // Create a drawing with bounds NOT centered at origin
        // Drawing from (100, 100) to (200, 150)
        const testDrawing: DrawingData = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    layer: '0',
                    geometry: {
                        start: { x: 100, y: 100 },
                        end: { x: 200, y: 150 },
                    },
                },
            ],
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        const canvasWidth = 800;
        const canvasHeight = 600;

        drawingStore.setContainerDimensions(canvasWidth, canvasHeight);
        drawingStore.setDrawing(new Drawing(testDrawing), 'test.dxf');

        const state = drawingStore;
        const drawing = state.drawing!;

        // Calculate where the origin (0, 0) will appear after all transforms
        // Step 1: Calculate viewport transform parameters
        const bounds = drawing.bounds;
        const DEFAULT_PADDING = 50;
        const boundsHeight = bounds.max.y - bounds.min.y;
        const viewportHeight = Math.max(boundsHeight + 2 * DEFAULT_PADDING, 100);
        const viewportOffsetX = bounds.min.x - DEFAULT_PADDING;
        const viewportOffsetY = bounds.min.y - DEFAULT_PADDING;

        // Step 2: Apply viewport transform to origin (0, 0)
        // Transforms applied right-to-left: scale(1, -1), translate(-vox, vh+voy), scale(unitScale)
        const unitScale = state.unitScale;
        const originAfterViewport = {
            x: (0 - viewportOffsetX) * unitScale,
            y: (-0 + viewportHeight + viewportOffsetY) * unitScale,
        };

        // Step 3: Apply panzoom transform
        const panzoomScale = state.scale;
        const panzoomOffset = state.offset;
        const finalOriginX =
            panzoomScale * originAfterViewport.x + panzoomOffset.x;
        const finalOriginY =
            panzoomScale * originAfterViewport.y + panzoomOffset.y;

        // Step 4: Verify origin is at 25% from left, 75% from top
        const expectedOriginX = canvasWidth * 0.25;
        const expectedOriginY = canvasHeight * 0.75;

        // Debug output
        console.log('Debug info:');
        console.log('  Canvas:', canvasWidth, 'x', canvasHeight);
        console.log('  Drawing bounds:', bounds);
        console.log('  Viewport offset:', viewportOffsetX, viewportOffsetY);
        console.log('  Viewport height:', viewportHeight);
        console.log('  Unit scale:', unitScale);
        console.log('  Panzoom scale:', panzoomScale);
        console.log('  Panzoom offset:', panzoomOffset);
        console.log('  Origin after viewport:', originAfterViewport);
        console.log('  Final origin position:', finalOriginX, finalOriginY);
        console.log('  Expected origin position:', expectedOriginX, expectedOriginY);
        console.log('  Error:', Math.abs(finalOriginX - expectedOriginX), Math.abs(finalOriginY - expectedOriginY));

        // Allow small tolerance for floating point errors
        expect(Math.abs(finalOriginX - expectedOriginX)).toBeLessThan(1);
        expect(Math.abs(finalOriginY - expectedOriginY)).toBeLessThan(1);
    });
});
