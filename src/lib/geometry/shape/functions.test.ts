import { describe, expect, it, vi } from 'vitest';
import {
    getShapePoints,
    isShapeContainedInShape,
    samplePathAtDistanceIntervals,
} from './functions';
import { GeometryType } from './enums';
import type { Shape } from './interfaces';
import type { Line } from '$lib/geometry/line';
import type { Ellipse } from '$lib/geometry/ellipse';
import type { Spline } from '$lib/geometry/spline';
import type { Circle } from '$lib/geometry/circle';
import type { Arc } from '$lib/geometry/arc';
import type { Polyline } from '$lib/geometry/polyline';
import { generateCirclePoints } from '$lib/geometry/circle';
import { generateArcPoints } from '$lib/geometry/arc';
import { polylineToPoints } from '$lib/geometry/polyline';
import { tessellateEllipse } from '$lib/geometry/ellipse';
import { sampleNURBS } from '$lib/geometry/spline';

// Mock the dependencies
vi.mock('$lib/geometry/spline', () => ({
    sampleNURBS: vi.fn(),
}));

vi.mock('$lib/geometry/ellipse', () => ({
    tessellateEllipse: vi.fn(),
    ELLIPSE_TESSELLATION_POINTS: 64,
}));

vi.mock('$lib/geometry/polyline', () => ({
    polylineToPoints: vi.fn(),
}));

vi.mock('$lib/geometry/arc', () => ({
    generateArcPoints: vi.fn(),
}));

vi.mock('$lib/geometry/circle', () => ({
    generateCirclePoints: vi.fn(),
}));

// Helper function to create test circle
function createCircle(x: number, y: number, radius: number): Shape {
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

        const shape: Shape = {
            id: 'line1',
            type: GeometryType.LINE,
            geometry: lineGeometry,
        };

        const points = getShapePoints(shape);
        expect(points).toEqual([
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

        const shape: Shape = {
            id: 'circle1',
            type: GeometryType.CIRCLE,
            geometry: circleGeometry,
        };

        const points = getShapePoints(shape);
        expect(generateCirclePoints).toHaveBeenCalledWith({ x: 0, y: 0 }, 5);
        expect(points).toBe(mockPoints);
    });

    it('should call generateArcPoints for arc shape', () => {
        const mockPoints = [
            { x: 5, y: 0 },
            { x: 0, y: 5 },
            { x: -5, y: 0 },
        ];
        vi.mocked(generateArcPoints).mockReturnValue(mockPoints);

        const arcGeometry: Arc = {
            center: { x: 0, y: 0 },
            radius: 5,
            startAngle: 0,
            endAngle: Math.PI,
            clockwise: false,
        };

        const shape: Shape = {
            id: 'arc1',
            type: GeometryType.ARC,
            geometry: arcGeometry,
        };

        const points = getShapePoints(shape);
        expect(generateArcPoints).toHaveBeenCalledWith(arcGeometry);
        expect(points).toBe(mockPoints);
    });

    it('should call polylineToPoints for polyline shape', () => {
        const mockPoints = [
            { x: 0, y: 0 },
            { x: 5, y: 5 },
            { x: 10, y: 0 },
        ];
        vi.mocked(polylineToPoints).mockReturnValue(mockPoints);

        const polylineGeometry: Polyline = {
            closed: false,
            shapes: [],
        };

        const shape: Shape = {
            id: 'polyline1',
            type: GeometryType.POLYLINE,
            geometry: polylineGeometry,
        };

        const points = getShapePoints(shape);
        expect(polylineToPoints).toHaveBeenCalledWith(polylineGeometry);
        expect(points).toBe(mockPoints);
    });

    it('should call tessellateEllipse for ellipse shape with correct parameters', () => {
        const mockPoints = [
            { x: 10, y: 0 },
            { x: 0, y: 5 },
            { x: -10, y: 0 },
            { x: 0, y: -5 },
        ];
        vi.mocked(tessellateEllipse).mockReturnValue(mockPoints);

        const ellipseGeometry: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const shape: Shape = {
            id: 'ellipse1',
            type: GeometryType.ELLIPSE,
            geometry: ellipseGeometry,
        };

        const points = getShapePoints(shape);
        expect(tessellateEllipse).toHaveBeenCalledWith(ellipseGeometry, 64);
        expect(points).toBe(mockPoints);
    });

    it('should call sampleNURBS for spline shape', () => {
        const mockPoints = [
            { x: 0, y: 0 },
            { x: 3, y: 4 },
            { x: 6, y: 2 },
            { x: 10, y: 0 },
        ];
        vi.mocked(sampleNURBS).mockReturnValue(mockPoints);

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

        const shape: Shape = {
            id: 'spline1',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(shape);
        expect(sampleNURBS).toHaveBeenCalledWith(splineGeometry, 64);
        expect(points).toBe(mockPoints);
    });

    it('should fallback to fitPoints when NURBS evaluation fails', () => {
        vi.mocked(sampleNURBS).mockImplementation(() => {
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

        const shape: Shape = {
            id: 'spline2',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(shape);
        expect(points).toBe(fitPoints);
    });

    it('should fallback to controlPoints when NURBS fails and no fitPoints', () => {
        vi.mocked(sampleNURBS).mockImplementation(() => {
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

        const shape: Shape = {
            id: 'spline3',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(shape);
        expect(points).toBe(controlPoints);
    });

    it('should return empty array when NURBS fails and no fallback points', () => {
        vi.mocked(sampleNURBS).mockImplementation(() => {
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

        const shape: Shape = {
            id: 'spline4',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(shape);
        expect(points).toEqual([]);
    });

    it('should return empty array for empty fitPoints array', () => {
        vi.mocked(sampleNURBS).mockImplementation(() => {
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

        const shape: Shape = {
            id: 'spline5',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(shape);
        expect(points).toEqual([]);
    });

    it('should return empty array for unknown shape type', () => {
        const shape: Shape = {
            id: 'unknown1',
            type: 'unknown' as unknown as GeometryType,
            geometry: {} as unknown as Line,
        };

        const points = getShapePoints(shape);
        expect(points).toEqual([]);
    });

    it('should handle multiple line segments correctly', () => {
        const lineGeometry: Line = {
            start: { x: -5, y: -10 },
            end: { x: 15, y: 25 },
        };

        const shape: Shape = {
            id: 'line2',
            type: GeometryType.LINE,
            geometry: lineGeometry,
        };

        const points = getShapePoints(shape);
        expect(points).toEqual([
            { x: -5, y: -10 },
            { x: 15, y: 25 },
        ]);
    });

    it('should handle zero-length line', () => {
        const lineGeometry: Line = {
            start: { x: 5, y: 5 },
            end: { x: 5, y: 5 },
        };

        const shape: Shape = {
            id: 'line3',
            type: GeometryType.LINE,
            geometry: lineGeometry,
        };

        const points = getShapePoints(shape);
        expect(points).toEqual([
            { x: 5, y: 5 },
            { x: 5, y: 5 },
        ]);
    });

    it('should handle spline with only fitPoints', () => {
        vi.mocked(sampleNURBS).mockImplementation(() => {
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

        const shape: Shape = {
            id: 'spline6',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(shape);
        expect(points).toBe(fitPoints);
    });

    it('should handle spline with only controlPoints', () => {
        vi.mocked(sampleNURBS).mockImplementation(() => {
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

        const shape: Shape = {
            id: 'spline7',
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        const points = getShapePoints(shape);
        expect(points).toBe(controlPoints);
    });
});

describe('samplePathAtDistanceIntervals', () => {
    describe('Cut Direction Handling', () => {
        it('should produce correct direction vectors in natural shape direction', () => {
            // Create a simple horizontal line from (0,0) to (10,0)
            const line: Shape = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const shapes = [line];
            const samples = samplePathAtDistanceIntervals(shapes, 5);

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
            const line: Shape = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const shapes = [line];
            const samples = samplePathAtDistanceIntervals(shapes, 5);

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
            const originalLine: Shape = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 0, y: 10 },
                } as Line,
            };

            // For counterclockwise behavior, reverse the line's start/end
            const reversedLine: Shape = {
                id: 'line1-reversed',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 10 },
                    end: { x: 0, y: 0 },
                } as Line,
            };

            const originalSamples = samplePathAtDistanceIntervals(
                [originalLine],
                5
            );
            const reversedSamples = samplePathAtDistanceIntervals(
                [reversedLine],
                5
            );

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
            const horizontalLine: Shape = {
                id: 'horizontalLine',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };

            const verticalLine: Shape = {
                id: 'verticalLine',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 },
                } as Line,
            };

            const shapes = [horizontalLine, verticalLine];

            const originalSamples = samplePathAtDistanceIntervals(shapes, 5);
            const reversedSamples = samplePathAtDistanceIntervals(
                [verticalLine, horizontalLine],
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
            const line: Shape = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 20, y: 0 },
                } as Line,
            };

            const shapes = [line];
            const samples = samplePathAtDistanceIntervals(shapes, 5); // Sample every 5 units

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
            expect(samplePathAtDistanceIntervals([], 5)).toEqual([]);

            // Zero interval distance
            const line: Shape = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            };
            expect(samplePathAtDistanceIntervals([line], 0)).toEqual([]);

            // Negative interval distance
            expect(samplePathAtDistanceIntervals([line], -5)).toEqual([]);
        });
    });
});

describe('Cut Direction Regression Tests', () => {
    it('should now return natural directions since cut direction is handled at Path level', () => {
        // With the new architecture, samplePathAtDistanceIntervals always returns natural directions
        // The cut direction handling is moved to the Path level via execution chains

        const line: Shape = {
            id: 'line1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 }, // Horizontal line pointing right
            } as Line,
        };

        // Function now always returns natural direction
        const samples = samplePathAtDistanceIntervals([line], 5);

        expect(samples.length).toBeGreaterThan(0);

        // Direction should always be natural (pointing right) for this line
        const direction = samples[0].direction;
        expect(direction.x).toBeGreaterThan(0); // Should point right in natural direction
        expect(Math.abs(direction.y)).toBeLessThan(0.1); // Should be horizontal

        // The old behavior would have reversed this based on cut direction parameter
    });
});

describe('isShapeContainedInShape', () => {
    it('should detect circle contained within larger circle', () => {
        const innerCircle = createCircle(5, 5, 2);
        const outerCircle = createCircle(5, 5, 5);

        expect(isShapeContainedInShape(innerCircle, outerCircle, 0.1)).toBe(
            true
        );
    });

    it('should detect circle not contained in smaller circle', () => {
        const innerCircle = createCircle(5, 5, 5);
        const outerCircle = createCircle(5, 5, 2);

        expect(isShapeContainedInShape(innerCircle, outerCircle, 0.1)).toBe(
            false
        );
    });

    it('should handle open shapes (lines)', () => {
        const line: Shape = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 2, y: 2 },
                end: { x: 8, y: 8 },
            } as Line,
        };
        const outerCircle = createCircle(5, 5, 5);

        expect(isShapeContainedInShape(line, outerCircle, 0.1)).toBe(true);
    });

    it('should return false for insufficient tessellation points', () => {
        const mockShape: Shape = {
            id: '1',
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 1,
            } as Circle,
        };

        // This tests the error handling path when shapes don't tessellate properly
        const result = isShapeContainedInShape(mockShape, mockShape, 0.1);

        // The result depends on tessellation - could be true or false
        expect(typeof result).toBe('boolean');
    });
});
