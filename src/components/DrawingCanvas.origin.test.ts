import { describe, it, expect } from 'vitest';
import { CoordinateTransformer } from '../lib/rendering/coordinate-transformer';

describe('Drawing Canvas Origin Positioning', () => {
    it('should calculate fixed origin position correctly', () => {
        // Test the fixed origin calculation using CoordinateTransformer
        const canvas = { width: 800, height: 600 };
        const offset = { x: 0, y: 0 };
        const transformer = new CoordinateTransformer(canvas, 1, offset);

        const screenOrigin = transformer.getScreenOrigin();

        expect(screenOrigin.x).toBe(200); // 25% of 800
        expect(screenOrigin.y).toBe(450); // 75% of 600
    });

    it('should maintain origin position when canvas size changes', () => {
        // Test that origin percentage stays the same when canvas resizes using CoordinateTransformer
        const offset = { x: 0, y: 0 };

        // Original canvas size
        const originalCanvas = { width: 800, height: 600 };
        const originalTransformer = new CoordinateTransformer(
            originalCanvas,
            1,
            offset
        );
        const originalOrigin = originalTransformer.getScreenOrigin();

        // New canvas size (after column resize)
        const resizedCanvas = { width: 1000, height: 600 };
        const resizedTransformer = new CoordinateTransformer(
            resizedCanvas,
            1,
            offset
        );
        const resizedOrigin = resizedTransformer.getScreenOrigin();

        // Origin percentage should be the same
        expect(originalOrigin.x / originalCanvas.width).toBe(
            resizedOrigin.x / resizedCanvas.width
        );
        expect(originalOrigin.y / originalCanvas.height).toBe(
            resizedOrigin.y / resizedCanvas.height
        );

        // But absolute position should be different
        expect(resizedOrigin.x).not.toBe(originalOrigin.x);
        expect(resizedOrigin.y).toBe(originalOrigin.y); // Height didn't change
    });

    it('should apply panning offset correctly', () => {
        const canvas = { width: 800, height: 600 };
        const panOffset = { x: 50, y: -30 };
        const transformer = new CoordinateTransformer(canvas, 1, panOffset);

        const screenOrigin = transformer.getScreenOrigin();

        expect(screenOrigin.x).toBe(250); // 200 + 50
        expect(screenOrigin.y).toBe(420); // 450 - 30
    });

    it('should convert screen coordinates to world coordinates correctly', () => {
        const canvas = { width: 800, height: 600 };
        const offset = { x: 0, y: 0 };
        const transformer = new CoordinateTransformer(canvas, 1, offset);

        const screenOrigin = transformer.getScreenOrigin();

        // Screen point at origin should convert to world (0, 0)
        const worldPos = transformer.screenToWorld(screenOrigin);

        expect(worldPos.x).toBe(0);
        expect(worldPos.y).toBeCloseTo(0);
    });

    it('should handle zoom correctly with fixed origin', () => {
        const canvas = { width: 800, height: 600 };
        const offset = { x: 0, y: 0 };
        const scale = 2; // 200% zoom
        const transformer = new CoordinateTransformer(canvas, scale, offset);

        const screenOrigin = transformer.getScreenOrigin();

        // Point 100 pixels right of origin
        const screenPos = { x: screenOrigin.x + 100, y: screenOrigin.y };
        const worldPos = transformer.screenToWorld(screenPos);

        // At 200% zoom, 100 screen pixels = 50 world units
        expect(worldPos.x).toBe(50);
        expect(worldPos.y).toBeCloseTo(0);
    });
});
