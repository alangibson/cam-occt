import { describe, it, expect, vi } from 'vitest';
import {
    getEllipseStartPoint,
    getEllipseEndPoint,
    reverseEllipse,
    getEllipsePointAt,
    getEllipseRadiusX,
    getEllipseRadiusY,
    getEllipseRotation,
} from './ellipse';
import type { Ellipse } from '../types/geometry';

// Mock the tessellateEllipse function to control the test environment
vi.mock('./ellipse-tessellation', () => ({
    tessellateEllipse: vi.fn(),
}));

describe('getEllipseStartPoint', () => {
    it('should return rightmost point for full ellipse', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const startPoint = getEllipseStartPoint(ellipse);
        expect(startPoint.x).toBe(10);
        expect(startPoint.y).toBe(0);
    });

    it('should handle ellipse with offset center', () => {
        const ellipse: Ellipse = {
            center: { x: 5, y: -3 },
            majorAxisEndpoint: { x: 8, y: 0 },
            minorToMajorRatio: 0.75,
        };

        const startPoint = getEllipseStartPoint(ellipse);
        expect(startPoint.x).toBe(13);
        expect(startPoint.y).toBe(-3);
    });

    it('should calculate start point from startParam for ellipse arc', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
            startParam: Math.PI / 2,
        };

        const startPoint = getEllipseStartPoint(ellipse);
        // At π/2, should be at top of ellipse
        expect(startPoint.x).toBeCloseTo(0);
        expect(startPoint.y).toBeCloseTo(5); // minorAxis = 10 * 0.5 = 5
    });

    it('should handle rotated ellipse with startParam', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 0, y: 10 }, // Rotated 90 degrees
            minorToMajorRatio: 0.5,
            startParam: 0,
        };

        const startPoint = getEllipseStartPoint(ellipse);
        expect(startPoint.x).toBeCloseTo(0);
        expect(startPoint.y).toBeCloseTo(10);
    });
});

describe('getEllipseEndPoint', () => {
    it('should return same as start point for full ellipse', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const endPoint = getEllipseEndPoint(ellipse);
        const startPoint = getEllipseStartPoint(ellipse);

        expect(endPoint.x).toBe(startPoint.x);
        expect(endPoint.y).toBe(startPoint.y);
    });

    it('should calculate end point from endParam for ellipse arc', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
            endParam: Math.PI,
        };

        const endPoint = getEllipseEndPoint(ellipse);
        // At π, should be at left side of ellipse
        expect(endPoint.x).toBeCloseTo(-10);
        expect(endPoint.y).toBeCloseTo(0);
    });

    it('should handle ellipse with both start and end params', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 6, y: 0 },
            minorToMajorRatio: 0.5,
            startParam: Math.PI / 4,
            endParam: (3 * Math.PI) / 4,
        };

        const endPoint = getEllipseEndPoint(ellipse);
        // Should calculate point at endParam
        expect(endPoint.x).toBeCloseTo(6 * Math.cos((3 * Math.PI) / 4));
        expect(endPoint.y).toBeCloseTo(3 * Math.sin((3 * Math.PI) / 4));
    });

    it('should handle ellipse with offset center and endParam', () => {
        const ellipse: Ellipse = {
            center: { x: 5, y: -2 },
            majorAxisEndpoint: { x: 4, y: 0 },
            minorToMajorRatio: 1, // Circle case
            endParam: Math.PI / 2,
        };

        const endPoint = getEllipseEndPoint(ellipse);
        expect(endPoint.x).toBeCloseTo(5);
        expect(endPoint.y).toBeCloseTo(2);
    });
});

describe('reverseEllipse', () => {
    it('should swap start and end parameters for ellipse arc', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
            startParam: Math.PI / 4,
            endParam: (3 * Math.PI) / 4,
        };

        const reversed = reverseEllipse(ellipse);
        expect(reversed.startParam).toBe((3 * Math.PI) / 4);
        expect(reversed.endParam).toBe(Math.PI / 4);
        expect(reversed.center).toEqual(ellipse.center);
        expect(reversed.majorAxisEndpoint).toEqual(ellipse.majorAxisEndpoint);
        expect(reversed.minorToMajorRatio).toBe(ellipse.minorToMajorRatio);
    });

    it('should use default values when params are undefined', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const reversed = reverseEllipse(ellipse);
        expect(reversed.startParam).toBe(2 * Math.PI);
        expect(reversed.endParam).toBe(0);
    });

    it('should handle partial parameter specification', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
            startParam: Math.PI / 6,
        };

        const reversed = reverseEllipse(ellipse);
        expect(reversed.startParam).toBe(2 * Math.PI);
        expect(reversed.endParam).toBe(Math.PI / 6);
    });
});

describe('getEllipsePointAt', () => {
    it('should return point from tessellation at t=0', async () => {
        const { tessellateEllipse } = await import('./ellipse-tessellation');
        const mockPoints = [
            { x: 10, y: 0 },
            { x: 7, y: 7 },
            { x: 0, y: 5 },
            { x: -7, y: 7 },
            { x: -10, y: 0 },
        ];

        vi.mocked(tessellateEllipse).mockReturnValue(mockPoints);

        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const point = getEllipsePointAt(ellipse, 0);
        expect(point).toEqual(mockPoints[0]);
    });

    it('should return point from tessellation at t=1', async () => {
        const { tessellateEllipse } = await import('./ellipse-tessellation');
        const mockPoints = [
            { x: 10, y: 0 },
            { x: 7, y: 7 },
            { x: 0, y: 5 },
            { x: -7, y: 7 },
            { x: -10, y: 0 },
        ];

        vi.mocked(tessellateEllipse).mockReturnValue(mockPoints);

        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const point = getEllipsePointAt(ellipse, 1);
        expect(point).toEqual(mockPoints[mockPoints.length - 1]);
    });

    it('should interpolate between points for intermediate t values', async () => {
        const { tessellateEllipse } = await import('./ellipse-tessellation');
        const mockPoints = [
            { x: 10, y: 0 },
            { x: 7, y: 7 },
            { x: 0, y: 5 },
            { x: -7, y: 7 },
            { x: -10, y: 0 },
        ];

        vi.mocked(tessellateEllipse).mockReturnValue(mockPoints);

        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const point = getEllipsePointAt(ellipse, 0.5);
        const expectedIndex = Math.floor(0.5 * (mockPoints.length - 1));
        expect(point).toEqual(mockPoints[expectedIndex]);
    });

    it('should return fallback point when tessellation fails', async () => {
        const { tessellateEllipse } = await import('./ellipse-tessellation');
        vi.mocked(tessellateEllipse).mockImplementation(() => {
            throw new Error('Tessellation failed');
        });

        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const point = getEllipsePointAt(ellipse, 0.5);
        expect(point).toEqual({ x: 0, y: 0 });
    });

    it('should return fallback point when tessellation returns empty array', async () => {
        const { tessellateEllipse } = await import('./ellipse-tessellation');
        vi.mocked(tessellateEllipse).mockReturnValue([]);

        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const point = getEllipsePointAt(ellipse, 0.5);
        expect(point).toEqual({ x: 0, y: 0 });
    });

    it('should clamp t values to valid range', async () => {
        const { tessellateEllipse } = await import('./ellipse-tessellation');
        const mockPoints = [
            { x: 10, y: 0 },
            { x: 0, y: 5 },
            { x: -10, y: 0 },
        ];

        vi.mocked(tessellateEllipse).mockReturnValue(mockPoints);

        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        // t > 1 should return last point
        const point1 = getEllipsePointAt(ellipse, 1.5);
        expect(point1).toEqual(mockPoints[mockPoints.length - 1]);
    });
});

describe('getEllipseRadiusX', () => {
    it('should return major axis length', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const radiusX = getEllipseRadiusX(ellipse);
        expect(radiusX).toBe(10);
    });

    it('should handle rotated ellipse', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 6, y: 8 }, // Length = 10
            minorToMajorRatio: 0.3,
        };

        const radiusX = getEllipseRadiusX(ellipse);
        expect(radiusX).toBeCloseTo(10);
    });

    it('should handle zero major axis', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 0, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const radiusX = getEllipseRadiusX(ellipse);
        expect(radiusX).toBe(0);
    });
});

describe('getEllipseRadiusY', () => {
    it('should return minor axis length', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const radiusY = getEllipseRadiusY(ellipse);
        expect(radiusY).toBe(5); // 10 * 0.5
    });

    it('should handle different minor axis ratio', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 8, y: 6 }, // Length = 10
            minorToMajorRatio: 0.3,
        };

        const radiusY = getEllipseRadiusY(ellipse);
        expect(radiusY).toBeCloseTo(3); // 10 * 0.3
    });

    it('should handle circle case', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 7, y: 0 },
            minorToMajorRatio: 1,
        };

        const radiusY = getEllipseRadiusY(ellipse);
        expect(radiusY).toBe(7);
    });
});

describe('getEllipseRotation', () => {
    it('should return 0 for horizontal ellipse', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const rotation = getEllipseRotation(ellipse);
        expect(rotation).toBeCloseTo(0);
    });

    it('should return π/2 for vertical ellipse', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 0, y: 10 },
            minorToMajorRatio: 0.5,
        };

        const rotation = getEllipseRotation(ellipse);
        expect(rotation).toBeCloseTo(Math.PI / 2);
    });

    it('should return correct angle for diagonal ellipse', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 10, y: 10 },
            minorToMajorRatio: 0.5,
        };

        const rotation = getEllipseRotation(ellipse);
        expect(rotation).toBeCloseTo(Math.PI / 4);
    });

    it('should handle negative coordinates', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: -10, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const rotation = getEllipseRotation(ellipse);
        expect(rotation).toBeCloseTo(Math.PI);
    });

    it('should handle zero major axis endpoint', () => {
        const ellipse: Ellipse = {
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 0, y: 0 },
            minorToMajorRatio: 0.5,
        };

        const rotation = getEllipseRotation(ellipse);
        expect(rotation).toBe(0);
    });
});
