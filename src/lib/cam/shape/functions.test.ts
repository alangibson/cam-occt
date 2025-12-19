import { describe, expect, it, vi } from 'vitest';
import {
    getShapeEndPoint,
    getShapeLength,
    getShapeMidpoint,
    getShapeNormal,
    getShapePointAt,
    getShapePoints,
    getShapeStartPoint,
    isShapeClosed,
    moveShape,
    reverseShape,
    rotateShape,
    sampleShapes,
    scaleShape,
    splitShapeAtMidpoint,
    tessellateShape,
} from './functions';
import type { ShapeData } from './interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { DxfPolyline } from '$lib/geometry/dxf-polyline/interfaces';
import { generateCirclePoints } from '$lib/geometry/circle/functions';
import { tessellateArc } from '$lib/geometry/arc/functions';
import {
    polylineToPoints,
    polylineToVertices,
} from '$lib/geometry/dxf-polyline/functions';
import {
    sampleEllipse,
    tessellateEllipse,
    getEllipsePointAt,
} from '$lib/geometry/ellipse/functions';
import {
    tessellateSpline,
    getSplineStartPoint,
    getSplineEndPoint,
} from '$lib/geometry/spline/functions';
import type { Geometry } from '$lib/geometry/types';
import { GeometryType } from '$lib/geometry/enums';
import { Shape } from './classes';

// Mock the dependencies
vi.mock('$lib/geometry/spline/functions', async (importOriginal) => {
    const original = (await importOriginal()) as Record<string, unknown>;
    return {
        ...original,
        tessellateSpline: vi.fn(),
        getSplineStartPoint: vi.fn(),
        getSplineEndPoint: vi.fn(),
    };
});

vi.mock('$lib/geometry/ellipse/functions', async (importOriginal) => {
    const original = (await importOriginal()) as Record<string, unknown>;
    return {
        ...original,
        sampleEllipse: vi.fn(),
        tessellateEllipse: vi.fn(),
        getEllipsePointAt: vi.fn(),
    };
});

vi.mock('$lib/geometry/dxf-polyline/functions', async (importOriginal) => {
    const original = (await importOriginal()) as Record<string, unknown>;
    return {
        ...original,
        polylineToPoints: vi.fn(),
        polylineToVertices: vi.fn(),
    };
});

vi.mock('$lib/geometry/arc/functions', async (importOriginal) => {
    const original = (await importOriginal()) as Record<string, unknown>;
    return {
        ...original,
        tessellateArc: vi.fn(),
    };
});

vi.mock('$lib/geometry/circle/functions', async (importOriginal) => {
    const original = (await importOriginal()) as Record<string, unknown>;
    return {
        ...original,
        generateCirclePoints: vi.fn(),
    };
});

// Helper function to create test circle
function createCircle(x: number, y: number, radius: number): ShapeData {
    return {
        id: '1',
        type: GeometryType.CIRCLE,
        geometry: {
            center: { x, y },
            radius,
        } as Circle,
    };
}

describe('getShapePoints', () => {
    it('should return start and end points for line shape', () => {
        const lineGeometry: Line = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 },
        };

        const shape: ShapeData = {
            id: 'line1',
            type: GeometryType.LINE,
            geometry: lineGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(points.points).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 10 },
        ]);
    });

    it('should call generateCirclePoints for circle shape', () => {
        const mockPoints = [
            { x: 5, y: 0 },
            { x: 0, y: 5 },
            { x: -5, y: 0 },
            { x: 0, y: -5 },
        ];
        vi.mocked(generateCirclePoints).mockReturnValue(mockPoints);

        const circleGeometry: Circle = {
            center: { x: 0, y: 0 },
            radius: 5,
        };

        const shape: ShapeData = {
            id: 'circle1',
            type: GeometryType.CIRCLE,
            geometry: circleGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(generateCirclePoints).toHaveBeenCalledWith({ x: 0, y: 0 }, 5);
        expect(points.points).toEqual(mockPoints);
    });

    it('should call tessellateArc for arc shape', () => {
        const mockPoints = [
            { x: 5, y: 0 },
            { x: 0, y: 5 },
            { x: -5, y: 0 },
        ];
        vi.mocked(tessellateArc).mockReturnValue(mockPoints);

        const arcGeometry: Arc = {
            center: { x: 0, y: 0 },
            radius: 5,
            startAngle: 0,
            endAngle: Math.PI,
            clockwise: false,
        };

        const shape: ShapeData = {
            id: 'arc1',
            type: GeometryType.ARC,
            geometry: arcGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(tessellateArc).toHaveBeenCalledWith(
            arcGeometry,
            expect.any(Number)
        );
        expect(points.points).toEqual(mockPoints);
    });

    it('should call polylineToPoints for polyline shape', () => {
        const mockPoints = [
            { x: 0, y: 0 },
            { x: 5, y: 5 },
            { x: 10, y: 0 },
        ];
        vi.mocked(polylineToPoints).mockReturnValue(mockPoints);

        const polylineGeometry: DxfPolyline = {
            closed: false,
            shapes: [],
        };

        const shape: ShapeData = {
            id: 'polyline1',
            type: GeometryType.POLYLINE,
            geometry: polylineGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(polylineToPoints).toHaveBeenCalledWith(polylineGeometry);
        expect(points.points).toStrictEqual(mockPoints);
    });

    it('should call tessellateEllipse for ellipse shape with correct parameters', () => {
        const mockPoints = [
            { x: 10, y: 0 },
            { x: 0, y: 5 },
            { x: -10, y: 0 },
            { x: 0, y: -5 },
        ];
        (sampleEllipse as ReturnType<typeof vi.fn>).mockReturnValue({
            points: mockPoints,
        });

        const ellipseGeometry: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const shape: ShapeData = {
            id: 'ellipse1',
            type: GeometryType.ELLIPSE,
            geometry: ellipseGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(sampleEllipse).toHaveBeenCalledWith(ellipseGeometry, 64);
        expect(points.points).toEqual(mockPoints);
    });

    it('should call tessellateSpline for spline shape', () => {
        const mockPoints = [
            { x: 0, y: 0 },
            { x: 3, y: 4 },
            { x: 6, y: 2 },
            { x: 10, y: 0 },
        ];
        vi.mocked(tessellateSpline).mockReturnValue({
            points: mockPoints,
            success: true,
            errors: [],
            warnings: [],
            methodUsed: 'test',
        });

        const splineGeometry: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 3, y: 5 },
                { x: 7, y: 3 },
                { x: 10, y: 0 },
            ],
            knots: [0, 0, 0, 0.5, 1, 1, 1],
            weights: [1, 1, 1, 1],
            degree: 3,
            fitPoints: [],
            closed: false,
        };

        const shape: ShapeData = {
            id: 'spline1',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(tessellateSpline).toHaveBeenCalledWith(splineGeometry, {
            numSamples: 64,
        });
        expect(points.points).toEqual(mockPoints);
    });

    it('should fallback to fitPoints when NURBS evaluation fails', () => {
        vi.mocked(tessellateSpline).mockImplementation(() => {
            throw new Error('NURBS evaluation failed');
        });

        const fitPoints = [
            { x: 0, y: 0 },
            { x: 5, y: 3 },
            { x: 10, y: 0 },
        ];

        const splineGeometry: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ],
            knots: [0, 1],
            weights: [1, 1],
            degree: 1,
            fitPoints,
            closed: false,
        };

        const shape: ShapeData = {
            id: 'spline2',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(points.points).toStrictEqual(fitPoints);
    });

    it('should fallback to controlPoints when NURBS fails and no fitPoints', () => {
        vi.mocked(tessellateSpline).mockImplementation(() => {
            throw new Error('NURBS evaluation failed');
        });

        const controlPoints = [
            { x: 0, y: 0 },
            { x: 5, y: 5 },
            { x: 10, y: 0 },
        ];

        const splineGeometry: Spline = {
            controlPoints,
            knots: [0, 0.5, 1],
            weights: [1, 1, 1],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const shape: ShapeData = {
            id: 'spline3',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(points.points).toStrictEqual(controlPoints);
    });

    it('should return empty array when NURBS fails and no fallback points', () => {
        vi.mocked(tessellateSpline).mockImplementation(() => {
            throw new Error('NURBS evaluation failed');
        });

        const splineGeometry: Spline = {
            controlPoints: [],
            knots: [],
            weights: [],
            degree: 3,
            fitPoints: [],
            closed: false,
        };

        const shape: ShapeData = {
            id: 'spline4',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(points.points).toEqual([]);
    });

    it('should return empty array for empty fitPoints array', () => {
        vi.mocked(tessellateSpline).mockImplementation(() => {
            throw new Error('NURBS evaluation failed');
        });

        const splineGeometry: Spline = {
            controlPoints: [],
            knots: [],
            weights: [],
            degree: 3,
            fitPoints: [], // Empty but defined
            closed: false,
        };

        const shape: ShapeData = {
            id: 'spline5',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(points.points).toEqual([]);
    });

    it('should return empty array for unknown shape type', () => {
        const shape: ShapeData = {
            id: 'unknown1',
            type: 'unknown' as unknown as GeometryType,
            geometry: {} as unknown as Line,
        };

        const points = getShapePoints(new Shape(shape));
        expect(points.points).toEqual([]);
    });

    it('should handle multiple line segments correctly', () => {
        const lineGeometry: Line = {
            start: { x: -5, y: -10 },
            end: { x: 15, y: 25 },
        };

        const shape: ShapeData = {
            id: 'line2',
            type: GeometryType.LINE,
            geometry: lineGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(points.points).toEqual([
            { x: -5, y: -10 },
            { x: 15, y: 25 },
        ]);
    });

    it('should handle zero-length line', () => {
        const lineGeometry: Line = {
            start: { x: 5, y: 5 },
            end: { x: 5, y: 5 },
        };

        const shape: ShapeData = {
            id: 'line3',
            type: GeometryType.LINE,
            geometry: lineGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(points.points).toEqual([
            { x: 5, y: 5 },
            { x: 5, y: 5 },
        ]);
    });

    it('should handle spline with only fitPoints', () => {
        vi.mocked(tessellateSpline).mockImplementation(() => {
            throw new Error('NURBS evaluation failed');
        });

        const fitPoints = [
            { x: 0, y: 0 },
            { x: 2, y: 4 },
            { x: 4, y: 2 },
            { x: 6, y: 0 },
        ];

        const splineGeometry: Spline = {
            controlPoints: [],
            knots: [],
            weights: [],
            degree: 3,
            fitPoints,
            closed: false,
        };

        const shape: ShapeData = {
            id: 'spline6',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(points.points).toStrictEqual(fitPoints);
    });

    it('should handle spline with only controlPoints', () => {
        vi.mocked(tessellateSpline).mockImplementation(() => {
            throw new Error('NURBS evaluation failed');
        });

        const controlPoints = [
            { x: 0, y: 0 },
            { x: 2, y: 8 },
            { x: 8, y: 2 },
            { x: 10, y: 0 },
        ];

        const splineGeometry: Spline = {
            controlPoints,
            knots: [0, 0, 0, 0.5, 1, 1, 1],
            weights: [1, 1, 1, 1],
            degree: 3,
            fitPoints: [],
            closed: false,
        };

        const shape: ShapeData = {
            id: 'spline7',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(new Shape(shape));
        expect(points.points).toStrictEqual(controlPoints);
    });
});

describe('samplePathAtDistanceIntervals', () => {
    describe('Cut Direction Handling', () => {
        it('should produce correct direction vectors in natural shape direction', () => {
            // Create a simple horizontal line from (0,0) to (10,0)
            const line: ShapeData = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const shapes = [line];
            const samples = sampleShapes(
                shapes.map((s) => new Shape(s)),
                5
            );

            // Function now always returns natural direction (from start to end)
            expect(samples.length).toBeGreaterThan(0);

            // First sample should be pointing in positive X direction (right)
            const firstSample = samples[0];
            expect(firstSample.direction.x).toBeGreaterThan(0);
            expect(Math.abs(firstSample.direction.y)).toBeLessThan(0.1); // Should be essentially 0

            // Direction should be normalized
            const magnitude = Math.sqrt(
                firstSample.direction.x ** 2 + firstSample.direction.y ** 2
            );
            expect(magnitude).toBeCloseTo(1.0, 2);
        });

        it('should produce correct direction vectors for clockwise cuts on simple line', () => {
            // Create a simple horizontal line from (0,0) to (10,0)
            const line: ShapeData = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const shapes = [line];
            const samples = sampleShapes(
                shapes.map((s) => new Shape(s)),
                5
            );

            // For clockwise cuts, direction should be natural (pointing right)
            expect(samples.length).toBeGreaterThan(0);

            // First sample should be pointing in positive X direction (right)
            const firstSample = samples[0];
            expect(firstSample.direction.x).toBeGreaterThan(0);
            expect(Math.abs(firstSample.direction.y)).toBeLessThan(0.1); // Should be essentially 0

            // Direction should be normalized
            const magnitude = Math.sqrt(
                firstSample.direction.x ** 2 + firstSample.direction.y ** 2
            );
            expect(magnitude).toBeCloseTo(1.0, 2);
        });

        it('should produce opposite directions when shapes are in opposite order', () => {
            // Create a vertical line and its reverse
            const originalLine: ShapeData = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 0, y: 10 },
                } as Line,
            };

            // For counterclockwise behavior, reverse the line's start/end
            const reversedLine: ShapeData = {
                id: 'line1-reversed',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 10 },
                    end: { x: 0, y: 0 },
                } as Line,
            };

            const originalSamples = sampleShapes([new Shape(originalLine)], 5);
            const reversedSamples = sampleShapes([new Shape(reversedLine)], 5);

            expect(originalSamples.length).toBeGreaterThan(0);
            expect(reversedSamples.length).toBeGreaterThan(0);

            // Directions should be opposite
            const origDir = originalSamples[0].direction;
            const revDir = reversedSamples[0].direction;

            expect(origDir.x).toBeCloseTo(-revDir.x, 2);
            expect(origDir.y).toBeCloseTo(-revDir.y, 2);
        });

        it('should handle multi-shape paths correctly', () => {
            // Create an L-shaped path: horizontal line then vertical line
            const horizontalLine: ShapeData = {
                id: 'horizontalLine',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const verticalLine: ShapeData = {
                id: 'verticalLine',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 },
                } as Line,
            };

            const shapes = [horizontalLine, verticalLine];

            const originalSamples = sampleShapes(
                shapes.map((s) => new Shape(s)),
                5
            );
            const reversedSamples = sampleShapes(
                [new Shape(verticalLine), new Shape(horizontalLine)],
                5
            );

            // Should have samples from both shapes
            expect(originalSamples.length).toBeGreaterThanOrEqual(2);
            expect(reversedSamples.length).toBeGreaterThanOrEqual(2);

            // For original order, first samples should point right (positive X)
            const originalFirstSample = originalSamples[0];
            expect(originalFirstSample.direction.x).toBeGreaterThan(0);

            // For reversed order, first samples should point up (positive Y) from vertical line
            const reversedFirstSample = reversedSamples[0];
            expect(reversedFirstSample.direction.y).toBeGreaterThan(0);
        });
    });

    describe('Regular Distance Sampling', () => {
        it('should sample at regular intervals', () => {
            // Create a 20-unit long line
            const line: ShapeData = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 20, y: 0 },
                } as Line,
            };

            const shapes = [line];
            const samples = sampleShapes(
                shapes.map((s) => new Shape(s)),
                5
            ); // Sample every 5 units

            // Should have samples at positions ~5, ~10, ~15 (and possibly one more at end)
            expect(samples.length).toBeGreaterThanOrEqual(3);
            expect(samples.length).toBeLessThanOrEqual(4);

            // Check positions are approximately correct for the first few samples
            expect(samples[0].point.x).toBeCloseTo(5, 1);
            expect(samples[1].point.x).toBeCloseTo(10, 1);
            if (samples.length >= 3) {
                expect(samples[2].point.x).toBeCloseTo(15, 1);
            }

            // All samples should be on the Y=0 line
            samples.forEach((sample) => {
                expect(Math.abs(sample.point.y)).toBeLessThan(0.1);
            });
        });

        it('should handle edge cases gracefully', () => {
            // Empty shapes array
            expect(sampleShapes([], 5)).toEqual([]);

            // Zero interval distance
            const line: ShapeData = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };
            expect(sampleShapes([new Shape(line)], 0)).toEqual([]);

            // Negative interval distance
            expect(sampleShapes([new Shape(line)], -5)).toEqual([]);
        });
    });
});

describe('Cut Direction Regression Tests', () => {
    it('should now return natural directions since cut direction is handled at Cut level', () => {
        // With the new architecture, samplePathAtDistanceIntervals always returns natural directions
        // The cut direction handling is moved to the Cut level via execution chains

        const line: ShapeData = {
            id: 'line1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 }, // Horizontal line pointing right
            } as Line,
        };

        // Function now always returns natural direction
        const samples = sampleShapes([new Shape(line)], 5);

        expect(samples.length).toBeGreaterThan(0);

        // Direction should always be natural (pointing right) for this line
        const direction = samples[0].direction;
        expect(direction.x).toBeGreaterThan(0); // Should point right in natural direction
        expect(Math.abs(direction.y)).toBeLessThan(0.1); // Should be horizontal

        // The old behavior would have reversed this based on cut direction parameter
    });
});

describe('getShapeStartPoint', () => {
    it('should get start point for line', () => {
        const line: ShapeData = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 1, y: 2 },
                end: { x: 3, y: 4 },
            } as Line,
        };

        const result = getShapeStartPoint(new Shape(line));
        expect(result).toEqual({ x: 1, y: 2 });
    });

    it('should throw error for unknown shape type', () => {
        const unknownShape: ShapeData = {
            id: '1',
            type: 'unknown' as any,
            geometry: {} as unknown as Geometry,
        };

        expect(() => getShapeStartPoint(new Shape(unknownShape))).toThrow(
            'Unknown shape type: unknown'
        );
    });
});

describe('getShapeEndPoint', () => {
    it('should get end point for line', () => {
        const line: ShapeData = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 1, y: 2 },
                end: { x: 3, y: 4 },
            } as Line,
        };

        const result = getShapeEndPoint(new Shape(line));
        expect(result).toEqual({ x: 3, y: 4 });
    });

    it('should throw error for unknown shape type', () => {
        const unknownShape: ShapeData = {
            id: '1',
            type: 'unknown' as any,
            geometry: {} as unknown as Geometry,
        };

        expect(() => getShapeEndPoint(new Shape(unknownShape))).toThrow(
            'Unknown shape type: unknown'
        );
    });
});

describe('getShapePointAt', () => {
    it('should get point at parameter for line', () => {
        const line: ShapeData = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            } as Line,
        };

        const result = getShapePointAt(new Shape(line), 0.5);
        expect(result).toEqual({ x: 5, y: 0 });
    });

    it('should throw error for unknown shape type', () => {
        const unknownShape: ShapeData = {
            id: '1',
            type: 'unknown' as any,
            geometry: {} as unknown as Geometry,
        };

        expect(() => getShapePointAt(new Shape(unknownShape), 0.5)).toThrow(
            'Unknown shape type: unknown'
        );
    });
});

describe('getShapeLength', () => {
    it('should calculate length for line', () => {
        const line: ShapeData = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 3, y: 4 },
            } as Line,
        };

        const result = getShapeLength(new Shape(line));
        expect(result).toBe(5); // 3-4-5 triangle
    });

    it('should calculate length for circle', () => {
        const circle: ShapeData = {
            id: '1',
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 5,
            },
        };

        const result = getShapeLength(new Shape(circle));
        expect(result).toBeCloseTo(2 * Math.PI * 5);
    });

    it('should calculate length for arc with large angular span', () => {
        const arc: ShapeData = {
            id: '1',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: 0,
                endAngle: 1.5 * Math.PI, // Large span > PI
            },
        };

        const result = getShapeLength(new Shape(arc));
        expect(result).toBeCloseTo(5 * (2 * Math.PI - 1.5 * Math.PI)); // Uses 2π - span
    });

    it('should calculate length for polyline with nested shapes', () => {
        const nestedShape: ShapeData = {
            id: 'nested',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 5, y: 0 },
            },
        };

        const polyline: ShapeData = {
            id: '1',
            type: GeometryType.POLYLINE,
            geometry: {
                closed: false,
                shapes: [nestedShape],
            },
        };

        const result = getShapeLength(new Shape(polyline));
        expect(result).toBe(5);
    });

    it('should return 0 for polyline with no shapes', () => {
        const polyline: ShapeData = {
            id: '1',
            type: GeometryType.POLYLINE,
            geometry: {
                closed: false,
                shapes: [],
            },
        };

        const result = getShapeLength(new Shape(polyline));
        expect(result).toBe(0);
    });

    it('should calculate length for spline using NURBS sampling', () => {
        const spline: ShapeData = {
            id: '1',
            type: GeometryType.SPLINE,
            geometry: {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 5, y: 5 },
                    { x: 10, y: 0 },
                ],
                degree: 2,
                knots: [],
                weights: [],
                fitPoints: [],
                closed: false,
            },
        };

        // Mock tessellateSpline to return known points
        vi.mocked(tessellateSpline).mockReturnValue({
            points: [
                { x: 0, y: 0 },
                { x: 5, y: 2.5 },
                { x: 10, y: 0 },
            ],
            success: true,
            errors: [],
            warnings: [],
            methodUsed: 'test',
        });

        const result = getShapeLength(new Shape(spline));
        expect(result).toBeGreaterThan(0);
    });

    it('should return 0 for spline when NURBS sampling fails', () => {
        const spline: ShapeData = {
            id: '1',
            type: GeometryType.SPLINE,
            geometry: {
                controlPoints: [{ x: 0, y: 0 }],
                degree: 2,
                knots: [],
                weights: [],
                fitPoints: [],
                closed: false,
            } as Spline,
        };

        vi.mocked(tessellateSpline).mockImplementation(() => {
            throw new Error('NURBS sampling failed');
        });

        const result = getShapeLength(new Shape(spline));
        expect(result).toBe(0);
    });

    it('should calculate length for ellipse arc', () => {
        // Mock getEllipsePointAt to return points for calculation
        vi.mocked(getEllipsePointAt).mockImplementation((ellipse, t) => {
            const angle = (t * Math.PI) / 2; // Since endParam is Math.PI / 2
            return {
                x: 5 * Math.cos(angle),
                y: 3 * Math.sin(angle), // 5 * 0.6 = 3
            };
        });

        const ellipse: ShapeData = {
            id: '1',
            type: GeometryType.ELLIPSE,
            geometry: {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 5, y: 0 },
                minorToMajorRatio: 0.6,
                startParam: 0,
                endParam: Math.PI / 2,
            },
        };

        const result = getShapeLength(new Shape(ellipse));
        expect(result).toBeGreaterThan(0);
    });

    it('should calculate length for full ellipse using Ramanujan approximation', () => {
        const ellipse: ShapeData = {
            id: '1',
            type: GeometryType.ELLIPSE,
            geometry: {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 5, y: 0 },
                minorToMajorRatio: 0.6,
            },
        };

        const result = getShapeLength(new Shape(ellipse));
        expect(result).toBeGreaterThan(0);
    });

    it('should return 0 for unknown shape type', () => {
        const unknownShape: ShapeData = {
            id: '1',
            type: 'unknown' as any,
            geometry: {} as unknown as Geometry,
        };

        const result = getShapeLength(new Shape(unknownShape));
        expect(result).toBe(0);
    });
});

describe('getShapeNormal', () => {
    it('should calculate normal vector at midpoint', () => {
        const line: ShapeData = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            } as Line,
        };

        const result = getShapeNormal(new Shape(line), 0.5);
        expect(result.x).toBeCloseTo(0);
        expect(result.y).toBeCloseTo(1); // Should be pointing up (90° rotation of rightward direction)
    });
});

describe('getShapeMidpoint', () => {
    it('should get midpoint with default parameter', () => {
        const line: ShapeData = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            } as Line,
        };

        const result = getShapeMidpoint(new Shape(line));
        expect(result).toEqual({ x: 5, y: 0 });
    });

    it('should get midpoint with custom parameter', () => {
        const line: ShapeData = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            } as Line,
        };

        const result = getShapeMidpoint(new Shape(line), 0.25);
        expect(result).toEqual({ x: 2.5, y: 0 });
    });
});

describe('reverseShape', () => {
    it('should reverse line shape', () => {
        const line: ShapeData = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            } as Line,
        };

        const shape = new Shape(line);
        reverseShape(shape);
        expect(shape.geometry).toEqual({
            start: { x: 10, y: 0 },
            end: { x: 0, y: 0 },
        });
    });

    it('should handle unknown shape type by not changing it', () => {
        const unknownShape: ShapeData = {
            id: '1',
            type: 'unknown' as any,
            geometry: { test: 'value' } as unknown as Geometry,
        };

        const shape = new Shape(unknownShape);
        reverseShape(shape);
        expect(shape.geometry).toEqual({ test: 'value' });
    });
});

describe('scaleShape', () => {
    it('should scale line shape', () => {
        const line: ShapeData = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            },
        };

        const result = scaleShape(new Shape(line), 2, { x: 0, y: 0 });
        expect(result.geometry).toEqual({
            start: { x: 0, y: 0 },
            end: { x: 20, y: 0 },
        });
    });

    it('should scale circle/arc shape', () => {
        const circle: ShapeData = {
            id: '1',
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: 5, y: 5 },
                radius: 3,
            },
        };

        const result = scaleShape(new Shape(circle), 2, { x: 0, y: 0 });
        expect(result.geometry).toEqual({
            center: { x: 10, y: 10 },
            radius: 6,
        });
    });

    it('should scale polyline with line segments', () => {
        const polyline: ShapeData = {
            id: '1',
            type: GeometryType.POLYLINE,
            geometry: {
                closed: false,
                shapes: [
                    {
                        id: 'seg1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 5, y: 0 },
                        },
                    },
                ],
            },
        };

        const result = scaleShape(new Shape(polyline), 2, { x: 0, y: 0 });
        expect((result.geometry as DxfPolyline).shapes[0].geometry).toEqual({
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
        });
    });

    it('should scale polyline with arc segments', () => {
        const polyline: ShapeData = {
            id: '1',
            type: GeometryType.POLYLINE,
            geometry: {
                closed: false,
                shapes: [
                    {
                        id: 'seg1',
                        type: GeometryType.ARC,
                        geometry: {
                            center: { x: 5, y: 5 },
                            radius: 3,
                            startAngle: 0,
                            endAngle: Math.PI,
                        },
                    },
                ],
            },
        };

        const result = scaleShape(new Shape(polyline), 2, { x: 0, y: 0 });
        expect((result.geometry as DxfPolyline).shapes[0].geometry).toEqual({
            center: { x: 10, y: 10 },
            radius: 6,
            startAngle: 0,
            endAngle: Math.PI,
        });
    });

    it('should scale ellipse shape', () => {
        const ellipse: ShapeData = {
            id: '1',
            type: GeometryType.ELLIPSE,
            geometry: {
                center: { x: 5, y: 5 },
                majorAxisEndpoint: { x: 3, y: 0 },
                minorToMajorRatio: 0.5,
            },
        };

        const result = scaleShape(new Shape(ellipse), 2, { x: 0, y: 0 });
        expect(result.geometry).toEqual({
            center: { x: 10, y: 10 },
            majorAxisEndpoint: { x: 6, y: 0 },
            minorToMajorRatio: 0.5,
        });
    });

    it('should scale spline shape', () => {
        const spline: ShapeData = {
            id: '1',
            type: GeometryType.SPLINE,
            geometry: {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 5, y: 5 },
                ],
                fitPoints: [
                    { x: 0, y: 0 },
                    { x: 5, y: 5 },
                ],
                degree: 2,
                knots: [0, 0, 0, 1, 1, 1],
                weights: [1, 1],
                closed: false,
            },
        };

        const result = scaleShape(new Shape(spline), 2, { x: 0, y: 0 });
        expect((result.geometry as Spline).controlPoints).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 10 },
        ]);
        expect((result.geometry as Spline).fitPoints).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 10 },
        ]);
    });
});

describe('rotateShape', () => {
    it('should rotate line shape', () => {
        const line: ShapeData = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 1, y: 0 },
            },
        };

        const result = rotateShape(new Shape(line), Math.PI / 2, {
            x: 0,
            y: 0,
        });
        expect((result.geometry as Line).start.x).toBeCloseTo(0);
        expect((result.geometry as Line).start.y).toBeCloseTo(0);
        expect((result.geometry as Line).end.x).toBeCloseTo(0, 5);
        expect((result.geometry as Line).end.y).toBeCloseTo(1);
    });

    it('should rotate arc shape', () => {
        const arc: ShapeData = {
            id: '1',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: 0,
                endAngle: Math.PI / 2,
            },
        };

        const result = rotateShape(new Shape(arc), Math.PI / 4, { x: 0, y: 0 });
        expect((result.geometry as Arc).startAngle).toBeCloseTo(Math.PI / 4);
        expect((result.geometry as Arc).endAngle).toBeCloseTo(
            (3 * Math.PI) / 4
        );
    });

    it('should rotate polyline with arc segments', () => {
        const polyline: ShapeData = {
            id: '1',
            type: GeometryType.POLYLINE,
            geometry: {
                closed: false,
                shapes: [
                    {
                        id: 'seg1',
                        type: GeometryType.ARC,
                        geometry: {
                            center: { x: 0, y: 0 },
                            radius: 5,
                            startAngle: 0,
                            endAngle: Math.PI / 2,
                        },
                    },
                ],
            },
        };

        const result = rotateShape(new Shape(polyline), Math.PI / 4, {
            x: 0,
            y: 0,
        });
        expect(
            ((result.geometry as DxfPolyline).shapes[0].geometry as Arc)
                .startAngle
        ).toBeCloseTo(Math.PI / 4);
        expect(
            ((result.geometry as DxfPolyline).shapes[0].geometry as Arc)
                .endAngle
        ).toBeCloseTo((3 * Math.PI) / 4);
    });

    it('should rotate polyline with circle segments', () => {
        const polyline: ShapeData = {
            id: '1',
            type: GeometryType.POLYLINE,
            geometry: {
                closed: false,
                shapes: [
                    {
                        id: 'seg1',
                        type: GeometryType.CIRCLE,
                        geometry: {
                            center: { x: 1, y: 0 },
                            radius: 5,
                        },
                    },
                ],
            },
        };

        const result = rotateShape(new Shape(polyline), Math.PI / 2, {
            x: 0,
            y: 0,
        });
        expect(
            ((result.geometry as DxfPolyline).shapes[0].geometry as Circle)
                .center.x
        ).toBeCloseTo(0, 5);
        expect(
            ((result.geometry as DxfPolyline).shapes[0].geometry as Circle)
                .center.y
        ).toBeCloseTo(1);
    });
});

describe('moveShape', () => {
    it('should move line shape', () => {
        const line: ShapeData = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            },
        };

        const result = moveShape(new Shape(line), { x: 5, y: 3 });
        expect(result.geometry).toEqual({
            start: { x: 5, y: 3 },
            end: { x: 15, y: 3 },
        });
    });

    it('should move circle/arc shape', () => {
        const circle: ShapeData = {
            id: '1',
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 5,
            },
        };

        const result = moveShape(new Shape(circle), { x: 5, y: 3 });
        expect(result.geometry).toEqual({
            center: { x: 5, y: 3 },
            radius: 5,
        });
    });

    it('should move ellipse shape', () => {
        const ellipse: ShapeData = {
            id: '1',
            type: GeometryType.ELLIPSE,
            geometry: {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 5, y: 0 },
                minorToMajorRatio: 0.5,
            },
        };

        const result = moveShape(new Shape(ellipse), { x: 3, y: 2 });
        expect(result.geometry).toEqual({
            center: { x: 3, y: 2 },
            majorAxisEndpoint: { x: 5, y: 0 },
            minorToMajorRatio: 0.5,
        });
    });
});

describe('isShapeClosed', () => {
    it('should return true for circle', () => {
        const circle = createCircle(0, 0, 5);
        expect(isShapeClosed(new Shape(circle), 0.1)).toBe(true);
    });

    it('should return false for arc', () => {
        const arc: ShapeData = {
            id: '1',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: 0,
                endAngle: Math.PI,
            } as Arc,
        };
        expect(isShapeClosed(new Shape(arc), 0.1)).toBe(false);
    });

    it('should return false for line', () => {
        const line: ShapeData = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            } as Line,
        };
        expect(isShapeClosed(new Shape(line), 0.1)).toBe(false);
    });

    it('should return true for polyline with closed flag', () => {
        const polyline: ShapeData = {
            id: '1',
            type: GeometryType.POLYLINE,
            geometry: {
                closed: true,
                shapes: [
                    {
                        id: 'seg1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 5, y: 0 },
                        },
                    },
                ],
            } as DxfPolyline,
        };

        vi.mocked(polylineToPoints).mockReturnValue([
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 5 },
            { x: 0, y: 5 },
        ]);

        expect(isShapeClosed(new Shape(polyline), 0.1)).toBe(true);
    });

    it('should return false for polyline with insufficient points', () => {
        const polyline: ShapeData = {
            id: '1',
            type: GeometryType.POLYLINE,
            geometry: {
                shapes: [],
                closed: false,
            } as DxfPolyline,
        };

        vi.mocked(polylineToPoints).mockReturnValue([{ x: 0, y: 0 }]);

        expect(isShapeClosed(new Shape(polyline), 0.1)).toBe(false);
    });

    it('should handle spline with NURBS evaluation failure', () => {
        const spline: ShapeData = {
            id: '1',
            type: GeometryType.SPLINE,
            geometry: {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 5, y: 5 },
                    { x: 10, y: 0 },
                ],
                knots: [0, 0, 0.5, 1, 1],
                weights: [1, 1, 1],
                fitPoints: [
                    { x: 0, y: 0 },
                    { x: 0.05, y: 0.05 }, // Close to forming a closed loop
                ],
                degree: 2,
                closed: false,
            } as Spline,
        };

        // Mock NURBS evaluation to fail
        vi.mocked(getSplineStartPoint).mockImplementation(() => {
            throw new Error('NURBS evaluation failed');
        });
        vi.mocked(getSplineEndPoint).mockImplementation(() => {
            throw new Error('NURBS evaluation failed');
        });

        expect(isShapeClosed(new Shape(spline), 0.1)).toBe(true); // Should use fitPoints fallback
    });

    it('should throw error for unknown shape type', () => {
        const unknownShape: ShapeData = {
            id: '1',
            type: 'unknown' as any,
            geometry: {} as unknown as Geometry,
        };

        expect(() => isShapeClosed(new Shape(unknownShape), 0.1)).toThrow(
            'Unknown type unknown'
        );
    });
});

describe('splitShapeAtMidpoint', () => {
    it('should split line at midpoint', () => {
        const line: ShapeData = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            },
        };

        const result = splitShapeAtMidpoint(new Shape(line));
        expect(result).not.toBeNull();
        expect(result).toHaveLength(2);
    });

    it('should split arc at midpoint', () => {
        const arc: ShapeData = {
            id: '1',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: 0,
                endAngle: Math.PI,
            },
        };

        const result = splitShapeAtMidpoint(new Shape(arc));
        expect(result).not.toBeNull();
        expect(result).toHaveLength(2);
    });

    it('should return null for unsupported shape types', () => {
        const circle = createCircle(0, 0, 5);

        const result = splitShapeAtMidpoint(new Shape(circle));
        expect(result).toBeNull();
    });
});

describe('tessellateShape', () => {
    const mockParams = {
        enableTessellation: true,
        circleTessellationPoints: 32,
        tessellationTolerance: 0.1,
        decimalPrecision: 6,
    };

    it('should tessellate arc with clockwise direction', () => {
        const clockwiseArc: ShapeData = {
            id: '1',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: 0,
                endAngle: Math.PI,
                clockwise: true,
            } as Arc,
        };

        const result = tessellateShape(new Shape(clockwiseArc), mockParams);
        expect(result.points.length).toBeGreaterThan(2);
    });

    it('should tessellate arc with counterclockwise direction (negative deltaAngle)', () => {
        const ccwArc: ShapeData = {
            id: '1',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: Math.PI,
                endAngle: 0, // This creates negative deltaAngle
                clockwise: false,
            } as Arc,
        };

        const result = tessellateShape(new Shape(ccwArc), mockParams);
        expect(result.points.length).toBeGreaterThan(2);
    });

    it('should tessellate ellipse arc', async () => {
        // Import the real tessellateEllipse and use it directly since the code is correct
        const actual: any = await vi.importActual(
            '$lib/geometry/ellipse/functions'
        );
        (tessellateEllipse as ReturnType<typeof vi.fn>).mockImplementation(
            actual.tessellateEllipse
        );

        const ellipseArc: ShapeData = {
            id: '1',
            type: GeometryType.ELLIPSE,
            geometry: {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 5, y: 0 },
                minorToMajorRatio: 0.6,
                startParam: 0,
                endParam: Math.PI / 2,
            } as Ellipse,
        };

        const result = tessellateShape(new Shape(ellipseArc), mockParams);
        expect(result.points.length).toBeGreaterThan(2);
    });

    it('should tessellate full ellipse', async () => {
        // Import the real tessellateEllipse and use it directly since the code is correct
        const actual: any = await vi.importActual(
            '$lib/geometry/ellipse/functions'
        );
        (tessellateEllipse as ReturnType<typeof vi.fn>).mockImplementation(
            actual.tessellateEllipse
        );

        const ellipse: ShapeData = {
            id: '1',
            type: GeometryType.ELLIPSE,
            geometry: {
                center: { x: 0, y: 0 },
                majorAxisEndpoint: { x: 5, y: 0 },
                minorToMajorRatio: 0.6,
            } as Ellipse,
        };

        const result = tessellateShape(new Shape(ellipse), mockParams);
        expect(result.points.length).toBe(32); // numEllipsePoints
    });

    it('should tessellate polyline using vertices when available', () => {
        const polyline: ShapeData = {
            id: '1',
            type: GeometryType.POLYLINE,
            geometry: {
                shapes: [],
                closed: false,
            } as DxfPolyline,
        };

        // Mock polylineToVertices to return vertices
        vi.mocked(polylineToVertices).mockReturnValue([
            { x: 0, y: 0 },
            { x: 5, y: 5 },
            { x: 10, y: 0 },
        ]);

        const result = tessellateShape(new Shape(polyline), mockParams);
        expect(result.points.length).toBe(3);
    });

    it('should tessellate polyline using points when vertices are null', () => {
        const polyline: ShapeData = {
            id: '1',
            type: GeometryType.POLYLINE,
            geometry: {
                shapes: [],
                closed: false,
            } as DxfPolyline,
        };

        // Mock polylineToVertices to return empty array to trigger fallback
        vi.mocked(polylineToVertices).mockReturnValue([]);
        vi.mocked(polylineToPoints).mockReturnValue([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
        ]);

        const result = tessellateShape(new Shape(polyline), mockParams);
        expect(result.points.length).toBe(2);
    });
});

describe('getShapePoints for native shapes', () => {
    it('should return single point for circle when forNativeShapes is true', () => {
        const circle: ShapeData = {
            id: '1',
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: 5, y: 3 },
                radius: 2,
            } as Circle,
        };

        const result = getShapePoints(new Shape(circle), true);
        expect(result.points).toEqual([{ x: 7, y: 3 }]); // center.x + radius, center.y
    });

    it('should return start and end points for arc when forNativeShapes is true', () => {
        const arc: ShapeData = {
            id: '1',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: 0,
                endAngle: Math.PI / 2,
            } as Arc,
        };

        const result = getShapePoints(new Shape(arc), true);
        expect(result.points).toHaveLength(2);
        expect(result.points[0]).toEqual({ x: 5, y: 0 }); // Start point
        expect(result.points[1].x).toBeCloseTo(0, 5);
        expect(result.points[1].y).toBeCloseTo(5, 5); // End point
    });

    it('should handle spline NURBS sampling failure with fitPoints fallback', () => {
        const spline: ShapeData = {
            id: '1',
            type: GeometryType.SPLINE,
            geometry: {
                controlPoints: [{ x: 0, y: 0 }],
                knots: [0, 1],
                weights: [1],
                fitPoints: [
                    { x: 1, y: 1 },
                    { x: 2, y: 2 },
                ],
                degree: 2,
                closed: false,
            } as Spline,
        };

        vi.mocked(tessellateSpline).mockImplementation(() => {
            throw new Error('NURBS failed');
        });

        const result = getShapePoints(new Shape(spline));
        expect(result.points).toEqual([
            { x: 1, y: 1 },
            { x: 2, y: 2 },
        ]);
    });

    it('should handle spline NURBS sampling failure with controlPoints fallback', () => {
        const spline: ShapeData = {
            id: '1',
            type: GeometryType.SPLINE,
            geometry: {
                controlPoints: [
                    { x: 3, y: 3 },
                    { x: 4, y: 4 },
                ],
                knots: [0, 0, 1, 1],
                weights: [1, 1],
                fitPoints: [],
                degree: 2,
                closed: false,
            } as Spline,
        };

        vi.mocked(tessellateSpline).mockImplementation(() => {
            throw new Error('NURBS failed');
        });

        const result = getShapePoints(new Shape(spline));
        expect(result.points).toEqual([
            { x: 3, y: 3 },
            { x: 4, y: 4 },
        ]);
    });

    it('should return empty array for spline when all sampling fails', () => {
        const spline: ShapeData = {
            id: '1',
            type: GeometryType.SPLINE,
            geometry: {
                controlPoints: [],
                knots: [],
                weights: [],
                fitPoints: [],
                degree: 2,
                closed: false,
            } as Spline,
        };

        vi.mocked(tessellateSpline).mockImplementation(() => {
            throw new Error('NURBS failed');
        });

        const result = getShapePoints(new Shape(spline));
        expect(result.points).toEqual([]);
    });
});

describe('getShapePoints - direction analysis mode', () => {
    it('should handle arc with clockwise property correctly', () => {
        const clockwiseArc: ShapeData = {
            id: '1',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: 0,
                endAngle: Math.PI / 2,
                clockwise: true,
            } as Arc,
        };

        const result = getShapePoints(new Shape(clockwiseArc), {
            mode: 'DIRECTION_ANALYSIS',
        });
        expect(result.points.length).toBeGreaterThan(2);
    });

    it('should handle arc with counterclockwise property correctly', () => {
        const ccwArc: ShapeData = {
            id: '1',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 5,
                startAngle: 0,
                endAngle: Math.PI / 2,
                clockwise: false,
            } as Arc,
        };

        const result = getShapePoints(new Shape(ccwArc), {
            mode: 'DIRECTION_ANALYSIS',
        });
        expect(result.points.length).toBeGreaterThan(2);
    });
});
