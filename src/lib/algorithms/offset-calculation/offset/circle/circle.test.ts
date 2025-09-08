import { describe, it, expect } from 'vitest';
import { offsetCircle } from './circle';
import type { Circle } from '../../../../types/geometry';
import { OffsetDirection } from '../types';

describe('offsetCircle', () => {
    const testCircle: Circle = {
        center: { x: 5, y: 5 },
        radius: 8,
    };

    it('should return no shapes when direction is none', () => {
        const result = offsetCircle(testCircle, 2, OffsetDirection.NONE);
        expect(result.success).toBe(true);
        expect(result.shapes).toHaveLength(0);
    });

    it('should offset circle outward by increasing radius', () => {
        const result = offsetCircle(testCircle, 4, OffsetDirection.OUTSET);
        expect(result.success).toBe(true);
        expect(result.shapes).toHaveLength(1);

        const offsetGeometry = result.shapes[0].geometry as Circle;
        expect(offsetGeometry.center.x).toBe(5);
        expect(offsetGeometry.center.y).toBe(5);
        expect(offsetGeometry.radius).toBe(12); // Original radius + offset
    });

    it('should offset circle inward by decreasing radius', () => {
        const result = offsetCircle(testCircle, 3, OffsetDirection.INSET);
        expect(result.success).toBe(true);

        const offsetGeometry = result.shapes[0].geometry as Circle;
        expect(offsetGeometry.radius).toBe(5); // Original radius - offset
    });

    it('should fail when inset would create negative radius', () => {
        const result = offsetCircle(testCircle, 10, OffsetDirection.INSET); // 10 > 8 (original radius)
        expect(result.success).toBe(false);
        expect(result.errors[0]).toContain('negative radius');
    });

    it('should create concentric circles with exact radius difference', () => {
        const originalCircle: Circle = {
            center: { x: 5, y: 3 },
            radius: 10,
        };

        const offsetDistance = 2.5;
        const outsetResult = offsetCircle(
            originalCircle,
            offsetDistance,
            OffsetDirection.OUTSET
        );
        const insetResult = offsetCircle(
            originalCircle,
            offsetDistance,
            OffsetDirection.INSET
        );

        expect(outsetResult.success).toBe(true);
        expect(insetResult.success).toBe(true);

        const outsetGeometry = outsetResult.shapes[0].geometry as Circle;
        const insetGeometry = insetResult.shapes[0].geometry as Circle;

        // Check radius accuracy
        expect(outsetGeometry.radius).toBeCloseTo(12.5, 10);
        expect(insetGeometry.radius).toBeCloseTo(7.5, 10);

        // Check center preservation
        expect(outsetGeometry.center.x).toBeCloseTo(
            originalCircle.center.x,
            10
        );
        expect(outsetGeometry.center.y).toBeCloseTo(
            originalCircle.center.y,
            10
        );
        expect(insetGeometry.center.x).toBeCloseTo(originalCircle.center.x, 10);
        expect(insetGeometry.center.y).toBeCloseTo(originalCircle.center.y, 10);
    });

    it('should handle circle with near-zero radius', () => {
        const tinyCircle: Circle = {
            center: { x: 0, y: 0 },
            radius: 0.001,
        };

        const outsetResult = offsetCircle(
            tinyCircle,
            2,
            OffsetDirection.OUTSET
        );
        expect(outsetResult.success).toBe(true);

        const insetResult = offsetCircle(tinyCircle, 2, OffsetDirection.INSET);
        expect(insetResult.success).toBe(false); // Should fail - negative radius
        expect(insetResult.errors[0]).toContain('negative radius');
    });

    it('should handle inset larger than feature size', () => {
        const smallCircle: Circle = {
            center: { x: 0, y: 0 },
            radius: 2,
        };

        const result = offsetCircle(smallCircle, 5, OffsetDirection.INSET); // Larger than radius
        expect(result.success).toBe(false);
        expect(result.errors[0]).toContain('negative radius');
    });
});
