import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Drawing } from '$lib/cam/drawing/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { CuttingParameters } from '$lib/cam/gcode-generator/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { Unit } from '$lib/config/units/units';

import { GeometryType } from '$lib/geometry/shape/enums';
import { getShapePoints } from '$lib/geometry/shape/functions';
import { generateToolPaths } from './cut-generator';

// Mock getShapePoints function
vi.mock('$lib/geometry/shape/functions', async () => {
    const actual = await vi.importActual('$lib/geometry/shape/functions');
    return {
        ...actual,
        getShapePoints: vi.fn(),
    };
});
const mockGetShapePoints = vi.mocked(getShapePoints);

describe('generateToolPaths', () => {
    const mockParameters: CuttingParameters = {
        feedRate: 1000,
        pierceHeight: 3.8,
        pierceDelay: 0.5,
        cutHeight: 1.5,
        kerf: 1.5,
        // Lead lengths removed from CuttingParameters
    };

    const createMockLine = (
        id: string,
        start: Point2D,
        end: Point2D
    ): Shape => ({
        id,
        type: GeometryType.LINE,
        layer: 'test',
        geometry: { start, end } as Line,
    });

    const createMockCircle = (
        id: string,
        center: Point2D,
        radius: number
    ): Shape => ({
        id,
        type: GeometryType.CIRCLE,
        layer: 'test',
        geometry: { center, radius } as Circle,
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate cuts for a simple drawing', () => {
        const drawing: Drawing = {
            shapes: [
                createMockLine('shape1', { x: 0, y: 0 }, { x: 100, y: 0 }),
                createMockCircle('shape2', { x: 50, y: 50 }, 25),
            ],
            bounds: {
                min: { x: 0, y: 0 },
                max: { x: 100, y: 75 },
            },
            units: Unit.MM,
        };

        mockGetShapePoints
            .mockReturnValueOnce([
                { x: 0, y: 0 },
                { x: 100, y: 0 },
            ])
            .mockReturnValueOnce([
                { x: 75, y: 50 },
                { x: 50, y: 75 },
                { x: 25, y: 50 },
                { x: 50, y: 25 },
            ]);

        const cuts = generateToolPaths(drawing, mockParameters);

        expect(cuts).toHaveLength(2);
        expect(cuts[0].shapeId).toBe('shape1');
        expect(cuts[1].shapeId).toBe('shape2');
    });

    it('should apply kerf compensation', () => {
        const drawing: Drawing = {
            shapes: [
                createMockLine('shape1', { x: 0, y: 0 }, { x: 100, y: 0 }),
            ],
            bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 0 } },
            units: Unit.MM,
        };

        // Use a 3-point cut to avoid edge cases in the kerf compensation algorithm
        mockGetShapePoints.mockReturnValueOnce([
            { x: 0, y: 0 },
            { x: 50, y: 0 },
            { x: 100, y: 0 },
        ]);

        const cuts = generateToolPaths(drawing, mockParameters);

        expect(cuts[0].points).toHaveLength(3);
        // Points should be offset by kerf compensation (perpendicular to horizontal line)
        // Middle point should definitely be offset since it has proper neighboring points
        expect(cuts[0].points[1].y).not.toBe(0);
    });

    it('should generate lead-in and lead-out for cuts', () => {
        const drawing: Drawing = {
            shapes: [
                createMockLine('shape1', { x: 0, y: 0 }, { x: 100, y: 0 }),
            ],
            bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 0 } },
            units: Unit.MM,
        };

        mockGetShapePoints.mockReturnValueOnce([
            { x: 0, y: 0 },
            { x: 100, y: 0 },
        ]);

        const cuts = generateToolPaths(drawing, mockParameters);

        expect(cuts[0].leadIn).toBeDefined();
        expect(cuts[0].leadOut).toBeDefined();

        // Lead points are already converted to point arrays
        const leadInPoints = cuts[0].leadIn!;
        const leadOutPoints = cuts[0].leadOut!;

        expect(leadInPoints).toHaveLength(2);
        expect(leadOutPoints).toHaveLength(2);

        // Lead-in should start before the cut
        expect(leadInPoints[0].x).toBeLessThan(cuts[0].points[0].x);
        // Lead-out should end after the cut
        expect(leadOutPoints[1].x).toBeGreaterThan(
            cuts[0].points[cuts[0].points.length - 1].x
        );
    });

    describe('toolpath optimization algorithms', () => {
        it('should return single cut unchanged', () => {
            const drawing: Drawing = {
                shapes: [
                    createMockLine('shape1', { x: 0, y: 0 }, { x: 100, y: 0 }),
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 0 } },
                units: Unit.MM,
            };

            mockGetShapePoints.mockReturnValueOnce([
                { x: 0, y: 0 },
                { x: 100, y: 0 },
            ]);

            const cuts = generateToolPaths(drawing, mockParameters);

            expect(cuts).toHaveLength(1);
            expect(cuts[0].shapeId).toBe('shape1');
        });

        it('should optimize cut sequence using nearest neighbor algorithm', () => {
            const drawing: Drawing = {
                shapes: [
                    createMockLine('shape1', { x: 0, y: 0 }, { x: 10, y: 0 }),
                    createMockLine(
                        'shape2',
                        { x: 100, y: 100 },
                        { x: 110, y: 100 }
                    ),
                    createMockLine('shape3', { x: 15, y: 0 }, { x: 25, y: 0 }),
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 110, y: 100 } },
                units: Unit.MM,
            };

            mockGetShapePoints
                .mockReturnValueOnce([
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                ])
                .mockReturnValueOnce([
                    { x: 100, y: 100 },
                    { x: 110, y: 100 },
                ])
                .mockReturnValueOnce([
                    { x: 15, y: 0 },
                    { x: 25, y: 0 },
                ]);

            const cuts = generateToolPaths(drawing, mockParameters);

            expect(cuts).toHaveLength(3);
            // Should keep shape1 first, then shape3 (closer), then shape2 (furthest)
            expect(cuts[0].shapeId).toBe('shape1');
            expect(cuts[1].shapeId).toBe('shape3');
            expect(cuts[2].shapeId).toBe('shape2');
        });

        it('should handle empty drawing', () => {
            const drawing: Drawing = {
                shapes: [],
                bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
                units: Unit.MM,
            };

            const cuts = generateToolPaths(drawing, mockParameters);

            expect(cuts).toHaveLength(0);
        });

        it('should skip shapes with insufficient points', () => {
            const drawing: Drawing = {
                shapes: [
                    createMockLine('shape1', { x: 0, y: 0 }, { x: 10, y: 0 }),
                    createMockLine('shape2', { x: 20, y: 0 }, { x: 30, y: 0 }),
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 30, y: 0 } },
                units: Unit.MM,
            };

            mockGetShapePoints
                .mockReturnValueOnce([{ x: 0, y: 0 }]) // Insufficient points
                .mockReturnValueOnce([
                    { x: 20, y: 0 },
                    { x: 30, y: 0 },
                ]);

            const cuts = generateToolPaths(drawing, mockParameters);

            expect(cuts).toHaveLength(1);
            expect(cuts[0].shapeId).toBe('shape2');
        });

        it('should calculate travel distances accurately', () => {
            const drawing: Drawing = {
                shapes: [
                    createMockLine('start', { x: 0, y: 0 }, { x: 10, y: 0 }),
                    createMockLine('far', { x: 50, y: 50 }, { x: 60, y: 50 }),
                    createMockLine('near', { x: 15, y: 5 }, { x: 25, y: 5 }),
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 60, y: 50 } },
                units: Unit.MM,
            };

            mockGetShapePoints
                .mockReturnValueOnce([
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                ])
                .mockReturnValueOnce([
                    { x: 50, y: 50 },
                    { x: 60, y: 50 },
                ])
                .mockReturnValueOnce([
                    { x: 15, y: 5 },
                    { x: 25, y: 5 },
                ]);

            const cuts = generateToolPaths(drawing, mockParameters);

            // Should select 'near' before 'far' due to shorter travel distance
            expect(cuts[0].shapeId).toBe('start');
            expect(cuts[1].shapeId).toBe('near');
            expect(cuts[2].shapeId).toBe('far');
        });

        it('should preserve shape parameters in cuts', () => {
            const drawing: Drawing = {
                shapes: [
                    createMockLine('shape1', { x: 0, y: 0 }, { x: 100, y: 0 }),
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 0 } },
                units: Unit.MM,
            };

            mockGetShapePoints.mockReturnValueOnce([
                { x: 0, y: 0 },
                { x: 100, y: 0 },
            ]);

            const cuts = generateToolPaths(drawing, mockParameters);

            expect(cuts[0].parameters).toEqual(mockParameters);
            expect(cuts[0].originalShape).toEqual(drawing.shapes[0]);
            expect(cuts[0].isRapid).toBe(false);
        });
    });

    describe('kerf compensation algorithm', () => {
        it('should skip compensation when kerf is zero', () => {
            const drawing: Drawing = {
                shapes: [
                    createMockLine('shape1', { x: 0, y: 0 }, { x: 100, y: 0 }),
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 0 } },
                units: Unit.MM,
            };

            mockGetShapePoints.mockReturnValueOnce([
                { x: 0, y: 0 },
                { x: 100, y: 0 },
            ]);

            const zeroKerfParams = { ...mockParameters, kerf: 0 };
            const cuts = generateToolPaths(drawing, zeroKerfParams);

            // Points should not be modified when kerf is 0
            expect(cuts[0].points[0]).toEqual({ x: 0, y: 0 });
            expect(cuts[0].points[1]).toEqual({ x: 100, y: 0 });
        });

        it('should handle closed cuts with kerf compensation', () => {
            const drawing: Drawing = {
                shapes: [createMockCircle('circle1', { x: 50, y: 50 }, 25)],
                bounds: { min: { x: 25, y: 25 }, max: { x: 75, y: 75 } },
                units: Unit.MM,
            };

            // Mock a closed square cut
            mockGetShapePoints.mockReturnValueOnce([
                { x: 40, y: 40 },
                { x: 60, y: 40 },
                { x: 60, y: 60 },
                { x: 40, y: 60 },
                { x: 40, y: 40 },
            ]);

            const cuts = generateToolPaths(drawing, mockParameters);

            expect(cuts[0].points).toHaveLength(5);
            // All points should be offset inward for an inside cut
            cuts[0].points.forEach((point, i) => {
                if (i < 4) {
                    // Skip the duplicate closing point
                    expect(point.x).not.toBe([40, 60, 60, 40][i]);
                    expect(point.y).not.toBe([40, 40, 60, 60][i]);
                }
            });
        });

        it('should handle single point gracefully', () => {
            const drawing: Drawing = {
                shapes: [
                    createMockLine('point', { x: 50, y: 50 }, { x: 50, y: 50 }),
                ],
                bounds: { min: { x: 50, y: 50 }, max: { x: 50, y: 50 } },
                units: Unit.MM,
            };

            mockGetShapePoints.mockReturnValueOnce([{ x: 50, y: 50 }]);

            const cuts = generateToolPaths(drawing, mockParameters);

            // Should skip shapes with insufficient points
            expect(cuts).toHaveLength(0);
        });
    });

    describe('lead generation algorithm', () => {
        it('should generate leads with correct lengths', () => {
            const drawing: Drawing = {
                shapes: [
                    createMockLine(
                        'shape1',
                        { x: 50, y: 50 },
                        { x: 100, y: 50 }
                    ),
                ],
                bounds: { min: { x: 50, y: 50 }, max: { x: 100, y: 50 } },
                units: Unit.MM,
            };

            mockGetShapePoints.mockReturnValueOnce([
                { x: 50, y: 50 },
                { x: 100, y: 50 },
            ]);

            const customParams = {
                ...mockParameters,
                // Lead lengths removed from CuttingParameters
            };
            const cuts = generateToolPaths(drawing, customParams, {
                leadInLength: 10,
                leadOutLength: 15,
            });

            // Lead points are already converted to point arrays
            const leadInPoints = cuts[0].leadIn!;
            const leadOutPoints = cuts[0].leadOut!;

            // Lead-in should be 10mm to the left
            expect(leadInPoints[0].x).toBeCloseTo(40, 3); // 50 - 10
            expect(leadInPoints[0].y).toBe(50);

            // Lead-out should be 15mm to the right
            expect(leadOutPoints[1].x).toBeCloseTo(115, 3); // 100 + 15
            expect(leadOutPoints[1].y).toBe(50);
        });

        it('should handle zero-length leads', () => {
            const drawing: Drawing = {
                shapes: [
                    createMockLine('shape1', { x: 0, y: 0 }, { x: 100, y: 0 }),
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 0 } },
                units: Unit.MM,
            };

            mockGetShapePoints.mockReturnValueOnce([
                { x: 0, y: 0 },
                { x: 100, y: 0 },
            ]);

            const zeroLeadParams = {
                ...mockParameters,
                // Lead lengths removed from CuttingParameters
            };
            const cuts = generateToolPaths(drawing, zeroLeadParams, {
                leadInLength: 0,
                leadOutLength: 0,
            });

            // Lead points are already converted to point arrays
            const leadInPoints = cuts[0].leadIn!;
            const leadOutPoints = cuts[0].leadOut!;

            // Should still generate lead arrays but with zero offset
            expect(leadInPoints).toHaveLength(2);
            expect(leadOutPoints).toHaveLength(2);
            expect(leadInPoints[0]).toEqual(leadInPoints[1]);
            expect(leadOutPoints[0]).toEqual(leadOutPoints[1]);
        });
    });
});
