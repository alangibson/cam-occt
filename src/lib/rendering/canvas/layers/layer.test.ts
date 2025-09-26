/**
 * Tests for Layer class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Layer } from './layer';
import { LayerId } from './types';

// Mock HTMLCanvasElement and CanvasRenderingContext2D
class MockCanvasRenderingContext2D {
    canvas = {
        width: 800,
        height: 600,
        style: {},
        dataset: {},
    };

    clearRect = vi.fn();
    getImageData = vi.fn(() => ({}) as ImageData);
    putImageData = vi.fn();

    globalCompositeOperation: GlobalCompositeOperation = 'source-over';
}

class MockHTMLCanvasElement {
    width = 800;
    height = 600;
    style: Record<string, string> = {};
    dataset: Record<string, string> = {};

    getContext = vi.fn(() => new MockCanvasRenderingContext2D());
}

// Mock createElement
vi.stubGlobal('document', {
    createElement: vi.fn(() => new MockHTMLCanvasElement()),
});

describe('Layer', () => {
    let layer: Layer;

    beforeEach(() => {
        vi.clearAllMocks();

        layer = new Layer({
            id: LayerId.SHAPES,
            zIndex: 10,
            visible: true,
        });
    });

    it('should create layer with correct configuration', () => {
        expect(layer.id).toBe(LayerId.SHAPES);
        expect(layer.config.id).toBe(LayerId.SHAPES);
        expect(layer.config.zIndex).toBe(10);
        expect(layer.config.visible).toBe(true);
        // isDirty functionality removed
    });

    it('should create canvas element with correct properties', () => {
        expect(document.createElement).toHaveBeenCalledWith('canvas');
        expect(layer.canvas.style.position).toBe('absolute');
        expect(layer.canvas.style.left).toBe('0');
        expect(layer.canvas.style.top).toBe('0');
        expect(layer.canvas.style.zIndex).toBe('10');
        expect(layer.canvas.style.pointerEvents).toBe('none');
        expect(layer.canvas.dataset.layerId).toBe(LayerId.SHAPES);
        expect(layer.canvas.style.display).toBe('block');
    });

    it('should set pointer events to auto for interaction layer', () => {
        const interactionLayer = new Layer({
            id: LayerId.INTERACTION,
            zIndex: 100,
            visible: false,
        });

        expect(interactionLayer.canvas.style.pointerEvents).toBe('auto');
    });

    it('should set opacity if provided', () => {
        const layerWithOpacity = new Layer({
            id: LayerId.SHAPES,
            zIndex: 10,
            visible: true,
            opacity: 0.5,
        });

        expect(layerWithOpacity.canvas.style.opacity).toBe('0.5');
    });

    it('should set blend mode if provided', () => {
        const layerWithBlendMode = new Layer({
            id: LayerId.SHAPES,
            zIndex: 10,
            visible: true,
            blendMode: 'multiply',
        });

        expect(layerWithBlendMode.ctx.globalCompositeOperation).toBe(
            'multiply'
        );
    });

    describe('clear', () => {
        it('should call clearRect on context', () => {
            layer.clear();

            expect(layer.ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
        });
    });

    // markDirty and markClean functionality removed
    // describe('markDirty', () => { ... });
    // describe('markClean', () => { ... });

    describe('setVisible', () => {
        it('should update visibility and style', () => {
            layer.setVisible(false);

            expect(layer.config.visible).toBe(false);
            expect(layer.canvas.style.display).toBe('none');
        });

        it('should show canvas when visible is true', () => {
            layer.setVisible(false);
            layer.setVisible(true);

            expect(layer.config.visible).toBe(true);
            expect(layer.canvas.style.display).toBe('block');
        });
    });

    describe('setOpacity', () => {
        it('should update opacity and style', () => {
            layer.setOpacity(0.7);

            expect(layer.config.opacity).toBe(0.7);
            expect(layer.canvas.style.opacity).toBe('0.7');
        });

        it('should clamp opacity between 0 and 1', () => {
            layer.setOpacity(-0.5);
            expect(layer.config.opacity).toBe(0);

            layer.setOpacity(1.5);
            expect(layer.config.opacity).toBe(1);
        });
    });

    describe('resize', () => {
        it('should update canvas dimensions', () => {
            layer.resize(1024, 768);

            expect(layer.canvas.width).toBe(1024);
            expect(layer.canvas.height).toBe(768);
        });

        // Test removed - markDirty/isDirty functionality no longer exists
        // it('should mark as dirty if no content to preserve', () => { ... });
    });

    describe('setZIndex', () => {
        it('should update z-index and style', () => {
            layer.setZIndex(50);

            expect(layer.config.zIndex).toBe(50);
            expect(layer.canvas.style.zIndex).toBe('50');
        });
    });
});
