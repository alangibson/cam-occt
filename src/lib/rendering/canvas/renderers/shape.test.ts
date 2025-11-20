/**
 * Tests for ShapeRenderer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ShapeRenderer } from './shape';
import { createEmptyRenderState } from '$lib/rendering/canvas/state/render-state';
import { LayerId } from '$lib/rendering/canvas/layers/types';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import { Unit } from '$lib/config/units/units';
import { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';

// Mock HTMLCanvasElement for testing
class MockCanvasElement {
    width = 800;
    height = 600;

    getContext(type: string) {
        if (type === '2d') {
            return new MockCanvasRenderingContext2D();
        }
        return null;
    }
}

// Mock CanvasRenderingContext2D for testing
class MockCanvasRenderingContext2D {
    canvas = new MockCanvasElement();
    strokeStyle = '#000000';
    fillStyle = '#000000';
    lineWidth = 1;
    lineCap = 'butt';
    lineJoin = 'miter';
    shadowColor = 'transparent';
    shadowBlur = 0;
    shadowOffsetX = 0;
    shadowOffsetY = 0;

    save() {}
    restore() {}
    beginPath() {}
    moveTo(_x: number, _y: number) {}
    lineTo(_x: number, _y: number) {}
    arc(
        _x: number,
        _y: number,
        _radius: number,
        _startAngle: number,
        _endAngle: number,
        _counterclockwise?: boolean
    ) {}
    stroke() {}
    fill() {}
    closePath() {}
    translate(_x: number, _y: number) {}
    scale(_x: number, _y: number) {}
    setLineDash(_segments: number[]) {}
    clearRect(_x: number, _y: number, _w: number, _h: number) {}
}

describe('ShapeRenderer', () => {
    let renderer: ShapeRenderer;
    let mockCtx: MockCanvasRenderingContext2D;
    let mockCoordinator: CoordinateTransformer;

    beforeEach(() => {
        // Create a mock canvas for the coordinator
        const mockCanvas = document.createElement('canvas');
        mockCanvas.width = 800;
        mockCanvas.height = 600;
        mockCoordinator = new CoordinateTransformer(
            mockCanvas,
            1,
            { x: 0, y: 0 },
            1
        );

        renderer = new ShapeRenderer(
            'shape-renderer',
            mockCoordinator,
            (state) => state.drawing?.shapes || []
        );

        // Create mock context
        mockCtx = new MockCanvasRenderingContext2D();
    });

    it('should be created with correct id and layer', () => {
        expect(renderer.id).toBe('shape-renderer');
        expect(renderer.layer).toBe(LayerId.SHAPES);
    });

    it('should render shapes when drawing is present', () => {
        const state = createEmptyRenderState();

        // Create a simple line shape
        const lineShape: Shape = {
            id: 'line1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 100 },
            } as Line,
            layer: '0',
        };

        const drawing: DrawingData = {
            shapes: [lineShape],
            bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
            units: Unit.MM,
        };

        state.drawing = drawing;
        state.respectLayerVisibility = false; // Don't filter by layer visibility for test

        // Should not throw when rendering
        expect(() =>
            renderer.render(mockCtx as CanvasRenderingContext2D, state)
        ).not.toThrow();
    });

    it('should not render when drawing is null', () => {
        const state = createEmptyRenderState();
        state.drawing = null;

        // Should not throw when drawing is null
        expect(() =>
            renderer.render(mockCtx as CanvasRenderingContext2D, state)
        ).not.toThrow();
    });

    it('should perform hit testing on shapes', () => {
        const state = createEmptyRenderState();

        // Create a circle shape at origin
        const circleShape: Shape = {
            id: 'circle1',
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 50,
            } as Circle,
            layer: '0',
        };

        const drawing: DrawingData = {
            shapes: [circleShape],
            bounds: { min: { x: -50, y: -50 }, max: { x: 50, y: 50 } },
            units: Unit.MM,
        };

        state.drawing = drawing;
        state.respectLayerVisibility = false;
        // Set up proper transform scale
        state.transform.zoomScale = 1;
        state.transform.unitScale = 1;

        // Test hit on circle perimeter (should hit)
        // Tolerance = 5 / (1 * 1) = 5 world units
        // Circle has radius 50, so point at 52 should be within tolerance
        const hitResult = renderer.hitWorld({ x: 52, y: 0 }, state);
        expect(hitResult).not.toBeNull();
        expect(hitResult?.id).toBe('circle1');

        // Test hit far from circle (should miss)
        const missResult = renderer.hitWorld({ x: 1000, y: 1000 }, state);
        expect(missResult).toBeNull();
    });

    it('should handle layer visibility filtering', () => {
        const state = createEmptyRenderState();

        // Create shape on layer 'hidden'
        const shape: Shape = {
            id: 'shape1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 100 },
            } as Line,
            layer: 'hidden',
        };

        const drawing: DrawingData = {
            shapes: [shape],
            bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
            units: Unit.MM,
        };

        state.drawing = drawing;
        state.respectLayerVisibility = true;
        state.visibility.layerVisibility = { hidden: false }; // Hide the layer

        // Hit test should miss because layer is hidden
        const hitResult = renderer.hitWorld({ x: 50, y: 50 }, state);
        expect(hitResult).toBeNull();

        // Make layer visible
        state.visibility.layerVisibility = { hidden: true };

        // Now hit test should work
        const hitResult2 = renderer.hitWorld({ x: 50, y: 50 }, state);
        expect(hitResult2).not.toBeNull();
    });
});
