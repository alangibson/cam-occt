import { describe, expect, it } from 'vitest';
import { EPSILON } from '$lib/geometry/math/constants';
import type { Point2D } from '$lib/geometry/point/interfaces';
import {
    calculatePolygonPerimeter,
    ensureClockwise,
    ensureCounterClockwise,
    getWindingDirection,
    isClockwise,
    isCounterClockwise,
    isSimplePolygon,
    reverseWinding,
} from '$lib/cam/chain/functions';
import {
    calculatePolygonArea,
    calculateSignedArea,
} from '$lib/geometry/polygon/functions';

describe('Chain Winding and Properties', () => {
    // Test shapes with known properties
    // Note: Using standard mathematical convention where positive area = CW
    const unitSquareCW: Point2D[] = [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 0 },
    ];

    const unitSquareCCW: Point2D[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
    ];

    const triangle: Point2D[] = [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 2 },
    ];

    const degenerate: Point2D[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 }, // All collinear
    ];

    const complex: Point2D[] = [
        { x: 0, y: 0 },
        { x: 0, y: 3 },
        { x: 2, y: 3 },
        { x: 2, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 0 },
    ];

    describe('calculateSignedArea', () => {
        it('should calculate correct signed area for clockwise square', () => {
            const area = calculateSignedArea({ points: unitSquareCW });
            expect(area).toBe(-1); // Negative for CW
        });

        it('should calculate correct signed area for counter-clockwise square', () => {
            const area = calculateSignedArea({ points: unitSquareCCW });
            expect(area).toBe(1); // Positive for CCW
        });

        it('should calculate correct area for triangle', () => {
            const area = calculateSignedArea({ points: triangle });
            expect(Math.abs(area)).toBeCloseTo(2); // Triangle area = 0.5 * base * height = 0.5 * 2 * 2 = 2
        });

        it('should return zero for degenerate polygon', () => {
            const area = calculateSignedArea({ points: degenerate });
            expect(Math.abs(area)).toBeLessThan(Number.EPSILON);
        });

        it('should handle empty array', () => {
            const area = calculateSignedArea({ points: [] });
            expect(area).toBe(0);
        });

        it('should handle single point', () => {
            const area = calculateSignedArea({ points: [{ x: 1, y: 1 }] });
            expect(area).toBe(0);
        });

        it('should handle two points', () => {
            const area = calculateSignedArea({
                points: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
            });
            expect(area).toBe(0);
        });

        it('should calculate area for complex polygon', () => {
            const area = calculateSignedArea({ points: complex });
            // Complex L-shaped polygon should have negative area (clockwise winding)
            expect(area).toBeLessThan(0);
        });
    });

    describe('getWindingDirection', () => {
        it('should detect clockwise winding', () => {
            expect(getWindingDirection({ points: unitSquareCW })).toBe('CW');
        });

        it('should detect counter-clockwise winding', () => {
            expect(getWindingDirection({ points: unitSquareCCW })).toBe('CCW');
        });

        it('should detect degenerate polygon', () => {
            expect(getWindingDirection({ points: degenerate })).toBe(
                'degenerate'
            );
        });

        it('should handle empty array', () => {
            expect(getWindingDirection({ points: [] })).toBe('degenerate');
        });
    });

    describe('isClockwise and isCounterClockwise', () => {
        it('should correctly identify clockwise polygons', () => {
            expect(isClockwise({ points: unitSquareCW })).toBe(true);
            expect(isClockwise({ points: unitSquareCCW })).toBe(false);
        });

        it('should correctly identify counter-clockwise polygons', () => {
            expect(isCounterClockwise({ points: unitSquareCCW })).toBe(true);
            expect(isCounterClockwise({ points: unitSquareCW })).toBe(false);
        });

        it('should return false for degenerate polygons', () => {
            expect(isClockwise({ points: degenerate })).toBe(false);
            expect(isCounterClockwise({ points: degenerate })).toBe(false);
        });
    });

    describe('reverseWinding', () => {
        it('should reverse the order of points', () => {
            const reversed = reverseWinding({ points: unitSquareCW });
            expect(reversed.points).toEqual([
                { x: 1, y: 0 },
                { x: 1, y: 1 },
                { x: 0, y: 1 },
                { x: 0, y: 0 },
            ]);
        });

        it('should not modify the original array', () => {
            const original = [...unitSquareCW];
            const reversed = reverseWinding({ points: unitSquareCW });
            expect(unitSquareCW).toEqual(original);
            expect(reversed.points).not.toBe(unitSquareCW);
        });

        it('should handle empty array', () => {
            expect(reverseWinding({ points: [] }).points).toEqual([]);
        });
    });

    describe('ensureClockwise', () => {
        it('should leave clockwise polygons unchanged', () => {
            const result = ensureClockwise({ points: unitSquareCW });
            expect(result.points).toBe(unitSquareCW); // Same reference
        });

        it('should reverse counter-clockwise polygons', () => {
            const result = ensureClockwise({ points: unitSquareCCW });
            expect(isClockwise(result)).toBe(true);
        });
    });

    describe('ensureCounterClockwise', () => {
        it('should leave counter-clockwise polygons unchanged', () => {
            const result = ensureCounterClockwise({ points: unitSquareCCW });
            expect(result.points).toBe(unitSquareCCW); // Same reference
        });

        it('should reverse clockwise polygons', () => {
            const result = ensureCounterClockwise({ points: unitSquareCW });
            expect(isCounterClockwise(result)).toBe(true);
        });
    });

    describe('isSimplePolygon', () => {
        it('should return true for simple polygons', () => {
            expect(isSimplePolygon({ points: unitSquareCW })).toBe(true);
            expect(isSimplePolygon({ points: triangle })).toBe(true);
        });

        it('should return false for polygons with too few points', () => {
            expect(isSimplePolygon({ points: [] })).toBe(false);
            expect(isSimplePolygon({ points: [{ x: 0, y: 0 }] })).toBe(false);
            expect(
                isSimplePolygon({
                    points: [
                        { x: 0, y: 0 },
                        { x: 1, y: 1 },
                    ],
                })
            ).toBe(false);
        });

        it('should return false for polygons with duplicate points', () => {
            const withDuplicates: Point2D[] = [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 0 }, // Duplicate
                { x: 1, y: 1 },
            ];
            expect(isSimplePolygon({ points: withDuplicates })).toBe(false);
        });
    });

    describe('calculatePolygonPerimeter', () => {
        it('should calculate perimeter of unit square', () => {
            const perimeter = calculatePolygonPerimeter({
                points: unitSquareCW,
            });
            expect(perimeter).toBeCloseTo(4); // 4 sides of length 1
        });

        it('should calculate perimeter of triangle', () => {
            const perimeter = calculatePolygonPerimeter({ points: triangle });
            // Side lengths: 2, sqrt(5), sqrt(5)
            const expected = 2 + 2 * Math.sqrt(5);
            expect(perimeter).toBeCloseTo(expected);
        });

        it('should handle empty array', () => {
            expect(calculatePolygonPerimeter({ points: [] })).toBe(0);
        });

        it('should handle single point', () => {
            expect(
                calculatePolygonPerimeter({ points: [{ x: 0, y: 0 }] })
            ).toBe(0);
        });
    });

    describe('Real-world usage scenarios', () => {
        it('should correctly determine winding for typical CAD shapes', () => {
            // Typical rectangle as would be imported from DXF (CW winding)
            const cadRectangle: Point2D[] = [
                { x: 10, y: 10 },
                { x: 10, y: 30 },
                { x: 50, y: 30 },
                { x: 50, y: 10 },
            ];

            expect(getWindingDirection({ points: cadRectangle })).toBe('CW');
            expect(calculatePolygonArea({ points: cadRectangle })).toBeCloseTo(
                800
            ); // 40 * 20
        });

        it('should handle precision issues in real coordinates', () => {
            // Points with typical floating point precision issues - make a proper rectangle
            const precisionTest: Point2D[] = [
                { x: 0, y: 0 },
                { x: 0, y: 0.1 },
                { x: 0.1, y: 0.1 },
                { x: 0.1, y: 0 },
            ];

            const area = calculatePolygonArea({ points: precisionTest });
            expect(area).toBeCloseTo(0.01, 6); // Small rectangle area
        });

        it('should work with complex manufacturing shapes', () => {
            // L-bracket shape common in manufacturing (CW winding)
            const lBracket: Point2D[] = [
                { x: 0, y: 0 },
                { x: 0, y: 80 },
                { x: 20, y: 80 },
                { x: 20, y: 20 },
                { x: 100, y: 20 },
                { x: 100, y: 0 },
            ];

            expect(getWindingDirection({ points: lBracket })).toBe('CW');
            expect(isSimplePolygon({ points: lBracket })).toBe(true);

            const area = calculatePolygonArea({ points: lBracket });
            const expectedArea = 100 * 20 + 20 * 60; // Two rectangles
            expect(area).toBeCloseTo(expectedArea);
        });
    });

    describe('Edge cases and error conditions', () => {
        it('should handle very small polygons', () => {
            const tiny: Point2D[] = [
                { x: 0, y: 0 },
                { x: EPSILON, y: 0 },
                { x: EPSILON, y: EPSILON },
            ];

            // Should not crash, even if area is near machine epsilon
            const area = calculateSignedArea({ points: tiny });
            expect(typeof area).toBe('number');
            expect(isFinite(area)).toBe(true);
        });

        it('should handle very large coordinates', () => {
            const large: Point2D[] = [
                { x: 1e6, y: 1e6 },
                { x: 1e6 + 1000, y: 1e6 },
                { x: 1e6 + 1000, y: 1e6 + 1000 },
                { x: 1e6, y: 1e6 + 1000 },
            ];

            const area = calculatePolygonArea({ points: large });
            expect(area).toBeCloseTo(1000000); // 1000 * 1000
        });

        it('should handle negative coordinates', () => {
            const negative: Point2D[] = [
                { x: -10, y: -10 },
                { x: -5, y: -10 },
                { x: -5, y: -5 },
                { x: -10, y: -5 },
            ];

            const area = calculatePolygonArea({ points: negative });
            expect(area).toBeCloseTo(25); // 5 * 5
        });
    });
});
