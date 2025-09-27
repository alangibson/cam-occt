/**
 * Tests for base renderer interface and abstract class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseRenderer } from './base';
import { LayerId } from '$lib/rendering/canvas/layers/types';
import { createEmptyRenderState } from '$lib/rendering/canvas/state/render-state';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';

// Concrete implementation for testing
class TestRenderer extends BaseRenderer {
    renderCalled = false;
    renderCount = 0;

    render(_ctx: CanvasRenderingContext2D, _state: RenderState): void {
        this.renderCalled = true;
        this.renderCount++;
    }

    // Override isDirty for testing
    isDirty(state: RenderState, prevState: RenderState | null): boolean {
        return state !== prevState;
    }
}

describe('BaseRenderer', () => {
    let renderer: TestRenderer;
    let renderState: RenderState;
    let mockCtx: CanvasRenderingContext2D;
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

        renderer = new TestRenderer(
            'test-renderer',
            LayerId.SHAPES,
            mockCoordinator
        );
        renderState = createEmptyRenderState();

        mockCtx = {
            canvas: { width: 800, height: 600 },
        } as CanvasRenderingContext2D;
    });

    it('should create renderer with correct id and layer', () => {
        expect(renderer.id).toBe('test-renderer');
        expect(renderer.layer).toBe(LayerId.SHAPES);
    });

    describe('render', () => {
        it('should call subclass render implementation', () => {
            renderer.render(mockCtx, renderState);

            expect(renderer.renderCalled).toBe(true);
            expect(renderer.renderCount).toBe(1);
        });
    });

    describe('hitTest', () => {
        it('should return null by default', () => {
            const result = renderer.hitWorld({ x: 10, y: 20 }, renderState);

            expect(result).toBeNull();
        });
    });

    describe('isDirty', () => {
        it('should use subclass implementation', () => {
            const isDirty1 = renderer.isDirty(renderState, null);
            const isDirty2 = renderer.isDirty(renderState, renderState);

            expect(isDirty1).toBe(true); // Different from null
            expect(isDirty2).toBe(false); // Same state
        });
    });

    describe('initialize', () => {
        it('should not throw when called', () => {
            expect(() => renderer.initialize()).not.toThrow();
        });
    });

    describe('destroy', () => {
        it('should not throw when called', () => {
            expect(() => renderer.destroy()).not.toThrow();
        });
    });
});
