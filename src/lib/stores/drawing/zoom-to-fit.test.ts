import { describe, it, expect } from 'vitest';
import { calculateZoomToFit } from '$lib/stores/drawing/functions';

describe('calculateZoomToFit', () => {
    it('should calculate zoom-to-fit for a simple rectangle', () => {
        const boundingBox = {
            min: { x: 0, y: 0 },
            max: { x: 100, y: 50 },
        };

        const canvasWidth = 800;
        const canvasHeight = 600;

        const result = calculateZoomToFit(
            boundingBox,
            canvasWidth,
            canvasHeight,
            1, // unit scale
            0.1 // 10% margin
        );

        expect(result.scale).toBeGreaterThan(0);
        expect(result.scale).toBeLessThanOrEqual(5.0); // Should respect max zoom cap

        // Origin should be positioned at 10% from left, 90% from top
        expect(result.offset.x).toBe(canvasWidth * 0.1);
        expect(result.offset.y).toBe(canvasHeight * 0.9);
    });

    it('should handle zero-size drawings', () => {
        const boundingBox = {
            min: { x: 10, y: 10 },
            max: { x: 10, y: 10 },
        };

        const canvasWidth = 800;
        const canvasHeight = 600;

        const result = calculateZoomToFit(
            boundingBox,
            canvasWidth,
            canvasHeight,
            1,
            0.1
        );

        expect(result.scale).toBe(1);
        // Even for zero-size drawings, origin should be positioned correctly
        expect(result.offset.x).toBe(canvasWidth * 0.1);
        expect(result.offset.y).toBe(canvasHeight * 0.9);
    });

    it('should respect the margin percentage', () => {
        const boundingBox = {
            min: { x: 0, y: 0 },
            max: { x: 400, y: 300 }, // Larger drawing to avoid hitting zoom cap
        };

        const canvasWidth = 1000;
        const canvasHeight = 1000;

        // Calculate with 0% margin
        const result0 = calculateZoomToFit(
            boundingBox,
            canvasWidth,
            canvasHeight,
            1,
            0 // 0% margin
        );

        // Calculate with 20% margin
        const result20 = calculateZoomToFit(
            boundingBox,
            canvasWidth,
            canvasHeight,
            1,
            0.2 // 20% margin
        );

        // With margin, scale should be smaller (more zoomed out)
        expect(result20.scale).toBeLessThan(result0.scale);
        // Both should be reasonable values not hitting the cap
        expect(result0.scale).toBeLessThan(5.0);
        expect(result20.scale).toBeLessThan(5.0);

        // Origin position should be the same regardless of margin
        expect(result0.offset.x).toBe(canvasWidth * 0.1);
        expect(result0.offset.y).toBe(canvasHeight * 0.9);
        expect(result20.offset.x).toBe(canvasWidth * 0.1);
        expect(result20.offset.y).toBe(canvasHeight * 0.9);
    });

    it('should handle different unit scales', () => {
        const boundingBox = {
            min: { x: 0, y: 0 },
            max: { x: 100, y: 100 },
        };

        const canvasWidth = 800;
        const canvasHeight = 600;

        const resultScale1 = calculateZoomToFit(
            boundingBox,
            canvasWidth,
            canvasHeight,
            1, // no unit scaling
            0.1
        );

        const resultScale2 = calculateZoomToFit(
            boundingBox,
            canvasWidth,
            canvasHeight,
            25.4, // mm to inch conversion
            0.1
        );

        // With higher unit scale, zoom should be different
        expect(resultScale2.scale).not.toBe(resultScale1.scale);

        // Origin position should be the same regardless of unit scale
        expect(resultScale1.offset.x).toBe(canvasWidth * 0.1);
        expect(resultScale1.offset.y).toBe(canvasHeight * 0.9);
        expect(resultScale2.offset.x).toBe(canvasWidth * 0.1);
        expect(resultScale2.offset.y).toBe(canvasHeight * 0.9);
    });

    it('should cap maximum zoom at 500%', () => {
        const boundingBox = {
            min: { x: 0, y: 0 },
            max: { x: 0.1, y: 0.1 }, // Very small drawing
        };

        const canvasWidth = 1000;
        const canvasHeight = 1000;

        const result = calculateZoomToFit(
            boundingBox,
            canvasWidth,
            canvasHeight,
            1,
            0.1
        );

        expect(result.scale).toBeLessThanOrEqual(5.0);

        // Origin position should still be correct even when zoom is capped
        expect(result.offset.x).toBe(canvasWidth * 0.1);
        expect(result.offset.y).toBe(canvasHeight * 0.9);
    });

    it('should position origin consistently across different canvas sizes', () => {
        const boundingBox = {
            min: { x: 0, y: 0 },
            max: { x: 100, y: 100 },
        };

        // Test with different canvas sizes
        const sizes = [
            { width: 800, height: 600 },
            { width: 1920, height: 1080 },
            { width: 400, height: 400 },
        ];

        sizes.forEach(({ width, height }) => {
            const result = calculateZoomToFit(
                boundingBox,
                width,
                height,
                1,
                0.1
            );

            // Verify origin is always at 10% from left, 90% from top
            expect(result.offset.x).toBe(width * 0.1);
            expect(result.offset.y).toBe(height * 0.9);
        });
    });
});
