import { describe, expect, it } from 'vitest';
import { offsetLine } from './line';
import type { Line } from '$lib/types/geometry';
import { EPSILON } from '$lib/geometry/math/constants';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';

describe('offsetLine', () => {
    const testLine: Line = {
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
    };

    it('should return no shapes when direction is none', () => {
        const result = offsetLine(testLine, 5, OffsetDirection.NONE);
        expect(result.success).toBe(true);
        expect(result.shapes).toHaveLength(0);
    });

    it('should return no shapes when distance is zero', () => {
        const result = offsetLine(testLine, 0, OffsetDirection.OUTSET);
        expect(result.success).toBe(true);
        expect(result.shapes).toHaveLength(0);
    });

    it('should offset line outward correctly', () => {
        const result = offsetLine(testLine, 5, OffsetDirection.OUTSET);
        expect(result.success).toBe(true);
        expect(result.shapes).toHaveLength(1);

        const offsetGeometry = result.shapes[0].geometry as Line;
        expect(offsetGeometry.start.x).toBe(0);
        expect(offsetGeometry.start.y).toBe(-5); // Moved up (clockwise perpendicular for right-hand rule consistency)
        expect(offsetGeometry.end.x).toBe(10);
        expect(offsetGeometry.end.y).toBe(-5);
    });

    it('should offset line inward correctly', () => {
        const result = offsetLine(testLine, 5, OffsetDirection.INSET);
        expect(result.success).toBe(true);
        expect(result.shapes).toHaveLength(1);

        const offsetGeometry = result.shapes[0].geometry as Line;
        expect(offsetGeometry.start.x).toBe(0);
        expect(offsetGeometry.start.y).toBe(5); // Moved down (opposite direction from outset)
        expect(offsetGeometry.end.x).toBe(10);
        expect(offsetGeometry.end.y).toBe(5);
    });

    it('should handle vertical lines correctly', () => {
        const verticalLine: Line = {
            start: { x: 0, y: 0 },
            end: { x: 0, y: 10 },
        };

        const result = offsetLine(verticalLine, 3, OffsetDirection.OUTSET);
        expect(result.success).toBe(true);

        const offsetGeometry = result.shapes[0].geometry as Line;
        expect(offsetGeometry.start.x).toBe(3); // Moved right (clockwise perpendicular to vertical line)
        expect(offsetGeometry.start.y).toBe(0);
        expect(offsetGeometry.end.x).toBe(3);
        expect(offsetGeometry.end.y).toBe(10);
    });

    it('should fail for zero-length lines', () => {
        const zeroLine: Line = {
            start: { x: 5, y: 5 },
            end: { x: 5, y: 5 },
        };

        const result = offsetLine(zeroLine, 2, OffsetDirection.OUTSET);
        expect(result.success).toBe(false);
        expect(result.errors).toContain('Cannot offset zero-length line');
    });

    it('should create perfectly parallel lines with exact distance', () => {
        const horizontalLine: Line = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
        };

        const result = offsetLine(horizontalLine, 3, OffsetDirection.OUTSET);
        expect(result.success).toBe(true);

        const offsetGeometry = result.shapes[0].geometry as Line;

        // Check that offset line is exactly 3 units away
        expect(offsetGeometry.start.x).toBeCloseTo(0, 10);
        expect(offsetGeometry.start.y).toBeCloseTo(-3, 10);
        expect(offsetGeometry.end.x).toBeCloseTo(10, 10);
        expect(offsetGeometry.end.y).toBeCloseTo(-3, 10);

        // Verify line length is preserved
        const originalLength = Math.sqrt(
            Math.pow(horizontalLine.end.x - horizontalLine.start.x, 2) +
                Math.pow(horizontalLine.end.y - horizontalLine.start.y, 2)
        );
        const offsetLength = Math.sqrt(
            Math.pow(offsetGeometry.end.x - offsetGeometry.start.x, 2) +
                Math.pow(offsetGeometry.end.y - offsetGeometry.start.y, 2)
        );

        expect(offsetLength).toBeCloseTo(originalLength, 10);
    });

    it('should maintain perpendicular distance for diagonal lines', () => {
        const diagonalLine: Line = {
            start: { x: 0, y: 0 },
            end: { x: 3, y: 4 }, // 3-4-5 triangle, length = 5
        };

        const offsetDistance = 2;
        const result = offsetLine(
            diagonalLine,
            offsetDistance,
            OffsetDirection.OUTSET
        );
        expect(result.success).toBe(true);

        const offsetGeometry = result.shapes[0].geometry as Line;

        // Calculate perpendicular distance from original line to offset line
        // Using point-to-line distance formula
        const distanceToStart = pointToLineDistance(
            offsetGeometry.start,
            diagonalLine.start,
            diagonalLine.end
        );
        const distanceToEnd = pointToLineDistance(
            offsetGeometry.end,
            diagonalLine.start,
            diagonalLine.end
        );

        expect(distanceToStart).toBeCloseTo(offsetDistance, 10);
        expect(distanceToEnd).toBeCloseTo(offsetDistance, 10);
    });

    it('should handle zero-length line segment', () => {
        const zeroLine: Line = {
            start: { x: 5, y: 5 },
            end: { x: 5, y: 5 },
        };

        const result = offsetLine(zeroLine, 2, OffsetDirection.OUTSET);
        expect(result.success).toBe(false);
        expect(result.errors).toContain('Cannot offset zero-length line');
    });

    it('should maintain accuracy for micro-scale offsets', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 1, y: 0 },
        };

        const microOffset = 0.00001;
        const result = offsetLine(line, microOffset, OffsetDirection.OUTSET);
        expect(result.success).toBe(true);

        const offsetGeometry = result.shapes[0].geometry as Line;
        expect(offsetGeometry.start.y).toBeCloseTo(-microOffset, 10);
        expect(offsetGeometry.end.y).toBeCloseTo(-microOffset, 10);
    });

    it('should maintain accuracy for macro-scale offsets', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 1000, y: 0 },
        };

        const macroOffset = 50;
        const result = offsetLine(line, macroOffset, OffsetDirection.OUTSET);
        expect(result.success).toBe(true);

        const offsetGeometry = result.shapes[0].geometry as Line;
        expect(offsetGeometry.start.y).toBeCloseTo(-macroOffset, 8);
        expect(offsetGeometry.end.y).toBeCloseTo(-macroOffset, 8);
    });

    it('should handle near-zero offset distance', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
        };

        const result = offsetLine(line, 0.00001, OffsetDirection.OUTSET);
        expect(result.success).toBe(true);
        expect(result.shapes.length).toBe(1);

        const offsetGeometry = result.shapes[0].geometry as Line;
        expect(Math.abs(offsetGeometry.start.y - -0.00001)).toBeLessThan(
            EPSILON
        );
    });
});

// Helper function for accuracy validation
function pointToLineDistance(
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number }
): number {
    const A = lineEnd.y - lineStart.y;
    const B = lineStart.x - lineEnd.x;
    const C = lineEnd.x * lineStart.y - lineStart.x * lineEnd.y;

    return Math.abs(A * point.x + B * point.y + C) / Math.sqrt(A * A + B * B);
}
