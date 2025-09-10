import { describe, it, expect, vi } from 'vitest';
import { getShapePoints } from './shape-utils';
import { GeometryType } from '../types/geometry';
import type {
    Shape,
    Line,
    Polyline,
    Ellipse,
    Spline,
    Geometry,
} from '../types/geometry';
import type { Circle } from '$lib/geometry/circle';
import type { Arc } from '$lib/geometry/arc';

// Mock the dependencies
vi.mock('./nurbs', () => ({
    sampleNURBS: vi.fn(),
}));

vi.mock('$lib/geometry/ellipse', () => ({
    tessellateEllipse: vi.fn(),
    ELLIPSE_TESSELLATION_POINTS: 64,
}));

vi.mock('./polyline', () => ({
    polylineToPoints: vi.fn(),
}));

vi.mock('$lib/geometry/arc', () => ({
    generateArcPoints: vi.fn(),
}));

vi.mock('$lib/geometry/circle', () => ({
    generateCirclePoints: vi.fn(),
}));

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

    it('should call generateCirclePoints for circle shape', async () => {
        const { generateCirclePoints } = await import('$lib/geometry/circle');
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

    it('should call generateArcPoints for arc shape', async () => {
        const { generateArcPoints } = await import('./arc');
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

    it('should call polylineToPoints for polyline shape', async () => {
        const { polylineToPoints } = await import('./polyline');
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

    it('should call tessellateEllipse for ellipse shape with correct parameters', async () => {
        const { tessellateEllipse } = await import('$lib/geometry/ellipse');
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

    it('should call sampleNURBS for spline shape', async () => {
        const { sampleNURBS } = await import('./nurbs');
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

    it('should fallback to fitPoints when NURBS evaluation fails', async () => {
        const { sampleNURBS } = await import('./nurbs');
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

    it('should fallback to controlPoints when NURBS fails and no fitPoints', async () => {
        const { sampleNURBS } = await import('./nurbs');
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

    it('should return empty array when NURBS fails and no fallback points', async () => {
        const { sampleNURBS } = await import('./nurbs');
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

    it('should return empty array for empty fitPoints array', async () => {
        const { sampleNURBS } = await import('./nurbs');
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
            geometry: {} as unknown as Geometry,
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

    it('should handle spline with only fitPoints', async () => {
        const { sampleNURBS } = await import('./nurbs');
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

    it('should handle spline with only controlPoints', async () => {
        const { sampleNURBS } = await import('./nurbs');
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
