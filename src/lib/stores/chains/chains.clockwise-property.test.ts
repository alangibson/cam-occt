import { describe, expect, it } from 'vitest';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import { Unit } from '$lib/config/units/units';
import type { Shape } from '$lib/geometry/shape/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';

describe('Layer - Clockwise Property Detection', () => {
    it('should automatically detect clockwise property for clockwise chain', () => {
        // Create a clockwise square chain (going: right → down → left → up)
        const clockwiseSquare: Shape[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 10 }, end: { x: 10, y: 10 } },
                layer: 'test-layer',
            }, // right
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: 10, y: 0 } },
                layer: 'test-layer',
            }, // down
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 0 }, end: { x: 0, y: 0 } },
                layer: 'test-layer',
            }, // left
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 0, y: 10 } },
                layer: 'test-layer',
            }, // up
        ];

        const drawingData: DrawingData = {
            shapes: clockwiseSquare,
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: Unit.MM,
        };

        const drawing = new Drawing(drawingData);
        const layer = drawing.layers['test-layer'];

        expect(layer).toBeDefined();
        expect(layer.chains).toHaveLength(1);
        expect(layer.chains[0].clockwise).toBe(true); // Should be detected as clockwise
    });

    it('should automatically detect clockwise property for counterclockwise chain', () => {
        // Create a counterclockwise square chain (going: right → up → left → down)
        const counterclockwiseSquare: Shape[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
                layer: 'test-layer',
            }, // right
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
                layer: 'test-layer',
            }, // up
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: 0, y: 10 } },
                layer: 'test-layer',
            }, // left
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 10 }, end: { x: 0, y: 0 } },
                layer: 'test-layer',
            }, // down
        ];

        const drawingData: DrawingData = {
            shapes: counterclockwiseSquare,
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: Unit.MM,
        };

        const drawing = new Drawing(drawingData);
        const layer = drawing.layers['test-layer'];

        expect(layer).toBeDefined();
        expect(layer.chains).toHaveLength(1);
        expect(layer.chains[0].clockwise).toBe(false); // Should be detected as counterclockwise
    });

    it('should set clockwise property to null for open chain', () => {
        // Create an open line chain
        const openLine: Shape[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
                layer: 'test-layer',
            },
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 0 }, end: { x: 20, y: 0 } },
                layer: 'test-layer',
            },
        ];

        const drawingData: DrawingData = {
            shapes: openLine,
            bounds: { min: { x: 0, y: 0 }, max: { x: 20, y: 0 } },
            units: Unit.MM,
        };

        const drawing = new Drawing(drawingData);
        const layer = drawing.layers['test-layer'];

        expect(layer).toBeDefined();
        expect(layer.chains).toHaveLength(1);
        expect(layer.chains[0].clockwise).toBe(null); // Should be null for open chains
    });

    it('should handle multiple chains with different clockwise properties', () => {
        // Create multiple chains with different orientations
        const shapes: Shape[] = [
            // Clockwise square
            {
                id: 'cw-line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 10 }, end: { x: 10, y: 10 } },
                layer: 'test-layer',
            },
            {
                id: 'cw-line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: 10, y: 0 } },
                layer: 'test-layer',
            },
            {
                id: 'cw-line3',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 0 }, end: { x: 0, y: 0 } },
                layer: 'test-layer',
            },
            {
                id: 'cw-line4',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 0, y: 10 } },
                layer: 'test-layer',
            },
            // Counterclockwise square
            {
                id: 'ccw-line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 20, y: 0 }, end: { x: 30, y: 0 } },
                layer: 'test-layer',
            },
            {
                id: 'ccw-line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 30, y: 0 }, end: { x: 30, y: 10 } },
                layer: 'test-layer',
            },
            {
                id: 'ccw-line3',
                type: GeometryType.LINE,
                geometry: { start: { x: 30, y: 10 }, end: { x: 20, y: 10 } },
                layer: 'test-layer',
            },
            {
                id: 'ccw-line4',
                type: GeometryType.LINE,
                geometry: { start: { x: 20, y: 10 }, end: { x: 20, y: 0 } },
                layer: 'test-layer',
            },
            // Open line
            {
                id: 'open-line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 40, y: 0 }, end: { x: 50, y: 0 } },
                layer: 'test-layer',
            },
            {
                id: 'open-line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 50, y: 0 }, end: { x: 60, y: 0 } },
                layer: 'test-layer',
            },
        ];

        const drawingData: DrawingData = {
            shapes,
            bounds: { min: { x: 0, y: 0 }, max: { x: 60, y: 10 } },
            units: Unit.MM,
        };

        const drawing = new Drawing(drawingData);
        const layer = drawing.layers['test-layer'];

        expect(layer).toBeDefined();
        expect(layer.chains).toHaveLength(3);

        // Find each chain (order may vary)
        const chains = layer.chains;
        const clockwiseChain = chains.find((c) => c.clockwise === true);
        const counterclockwiseChain = chains.find((c) => c.clockwise === false);
        const openChain = chains.find((c) => c.clockwise === null);

        expect(clockwiseChain).toBeDefined();
        expect(counterclockwiseChain).toBeDefined();
        expect(openChain).toBeDefined();
    });
});
