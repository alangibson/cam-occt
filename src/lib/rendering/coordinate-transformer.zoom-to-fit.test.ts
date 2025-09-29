import { describe, it, expect } from 'vitest';
import { CoordinateTransformer } from './coordinate-transformer';

describe('CoordinateTransformer.calculateZoomToFit', () => {
    it('should calculate zoom-to-fit for a simple rectangle', () => {
        const boundingBox = {
            min: { x: 0, y: 0 },
            max: { x: 100, y: 50 },
        };

        const result = CoordinateTransformer.calculateZoomToFit(
            boundingBox,
            800, // canvas width
            600, // canvas height
            1, // unit scale
            0.1 // 10% margin
        );

        expect(result.scale).toBeGreaterThan(0);
        expect(result.scale).toBeLessThanOrEqual(5.0); // Should respect max zoom cap
        expect(result.offset.x).toBeDefined();
        expect(result.offset.y).toBeDefined();
    });

    it('should handle zero-size drawings', () => {
        const boundingBox = {
            min: { x: 10, y: 10 },
            max: { x: 10, y: 10 },
        };

        const result = CoordinateTransformer.calculateZoomToFit(
            boundingBox,
            800,
            600,
            1,
            0.1
        );

        expect(result.scale).toBe(1);
        expect(result.offset.x).toBe(0);
        expect(result.offset.y).toBe(0);
    });

    it('should respect the margin percentage', () => {
        const boundingBox = {
            min: { x: 0, y: 0 },
            max: { x: 400, y: 300 }, // Larger drawing to avoid hitting zoom cap
        };

        // Calculate with 0% margin
        const result0 = CoordinateTransformer.calculateZoomToFit(
            boundingBox,
            1000,
            1000,
            1,
            0 // 0% margin
        );

        // Calculate with 20% margin
        const result20 = CoordinateTransformer.calculateZoomToFit(
            boundingBox,
            1000,
            1000,
            1,
            0.2 // 20% margin
        );

        // With margin, scale should be smaller (more zoomed out)
        expect(result20.scale).toBeLessThan(result0.scale);
        // Both should be reasonable values not hitting the cap
        expect(result0.scale).toBeLessThan(5.0);
        expect(result20.scale).toBeLessThan(5.0);
    });

    it('should handle different unit scales', () => {
        const boundingBox = {
            min: { x: 0, y: 0 },
            max: { x: 100, y: 100 },
        };

        const resultScale1 = CoordinateTransformer.calculateZoomToFit(
            boundingBox,
            800,
            600,
            1, // no unit scaling
            0.1
        );

        const resultScale2 = CoordinateTransformer.calculateZoomToFit(
            boundingBox,
            800,
            600,
            25.4, // mm to inch conversion
            0.1
        );

        // With higher unit scale, zoom should be different
        expect(resultScale2.scale).not.toBe(resultScale1.scale);
    });

    it('should cap maximum zoom at 500%', () => {
        const boundingBox = {
            min: { x: 0, y: 0 },
            max: { x: 0.1, y: 0.1 }, // Very small drawing
        };

        const result = CoordinateTransformer.calculateZoomToFit(
            boundingBox,
            1000,
            1000,
            1,
            0.1
        );

        expect(result.scale).toBeLessThanOrEqual(5.0);
    });
});
