import { describe, it, expect } from 'vitest';
import {
  calculateEllipsePoint,
  calculateEllipsePointWithRotation,
  generateEllipsePoints,
  tessellateEllipse,
  getEllipseStartEndPoints,
  getEllipseParameters
} from './ellipse-utils.js';
import type { Ellipse } from '../types/geometry';

describe('ellipse-utils', () => {
  // Create test ellipses
  const unitCircle: Ellipse = {
    id: 'circle',
    type: 'ellipse',
    center: { x: 0, y: 0 },
    majorAxisEndpoint: { x: 1, y: 0 }, // Major axis length = 1
    minorToMajorRatio: 1.0, // Circle
    closed: true
  };

  const horizontalEllipse: Ellipse = {
    id: 'h-ellipse',
    type: 'ellipse',
    center: { x: 5, y: 3 },
    majorAxisEndpoint: { x: 4, y: 0 }, // Major axis length = 4
    minorToMajorRatio: 0.5, // Minor axis length = 2
    closed: true
  };

  const rotatedEllipse: Ellipse = {
    id: 'rotated',
    type: 'ellipse',
    center: { x: 2, y: 1 },
    majorAxisEndpoint: { x: 2, y: 3 }, // 45° rotation
    minorToMajorRatio: 0.6,
    closed: true
  };

  const ellipseArc: Ellipse = {
    id: 'arc',
    type: 'ellipse',
    center: { x: 0, y: 0 },
    majorAxisEndpoint: { x: 3, y: 0 },
    minorToMajorRatio: 0.8,
    startParam: 0,
    endParam: Math.PI,
    closed: false
  };

  describe('calculateEllipsePoint', () => {
    it('should calculate point at parameter 0 (rightmost point of circle)', () => {
      const result = calculateEllipsePoint(unitCircle, 0, 1, 1, 0);
      
      expect(result.x).toBeCloseTo(1, 10);
      expect(result.y).toBeCloseTo(0, 10);
    });

    it('should calculate point at parameter π/2 (top point of circle)', () => {
      const result = calculateEllipsePoint(unitCircle, Math.PI / 2, 1, 1, 0);
      
      expect(result.x).toBeCloseTo(0, 10);
      expect(result.y).toBeCloseTo(1, 10);
    });

    it('should calculate point on horizontal ellipse', () => {
      const result = calculateEllipsePoint(horizontalEllipse, 0, 4, 2, 0);
      
      expect(result.x).toBeCloseTo(9, 10); // center.x (5) + major axis (4)
      expect(result.y).toBeCloseTo(3, 10); // center.y (3)
    });

    it('should handle rotated ellipse correctly', () => {
      const majorAxisLength = Math.sqrt(2 * 2 + 3 * 3); // sqrt(13)
      const minorAxisLength = majorAxisLength * 0.6;
      const majorAxisAngle = Math.atan2(3, 2);
      
      const result = calculateEllipsePoint(rotatedEllipse, 0, majorAxisLength, minorAxisLength, majorAxisAngle);
      
      expect(typeof result.x).toBe('number');
      expect(typeof result.y).toBe('number');
      expect(Number.isFinite(result.x)).toBe(true);
      expect(Number.isFinite(result.y)).toBe(true);
    });

    it('should handle different parameter values', () => {
      const params = [0, Math.PI / 4, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
      
      for (const param of params) {
        const result = calculateEllipsePoint(unitCircle, param, 1, 1, 0);
        
        // Point should be on unit circle
        const distance = Math.sqrt(result.x * result.x + result.y * result.y);
        expect(distance).toBeCloseTo(1, 8);
      }
    });

    it('should handle ellipse with different center', () => {
      const ellipse: Ellipse = { ...unitCircle, center: { x: 10, y: 20 } };
      const result = calculateEllipsePoint(ellipse, 0, 1, 1, 0);
      
      expect(result.x).toBeCloseTo(11, 10); // 10 + 1
      expect(result.y).toBeCloseTo(20, 10);
    });
  });

  describe('calculateEllipsePointWithRotation', () => {
    it('should calculate point on unrotated ellipse', () => {
      const center = { x: 0, y: 0 };
      const result = calculateEllipsePointWithRotation(center, 2, 1, 0, 0);
      
      expect(result.x).toBeCloseTo(2, 10);
      expect(result.y).toBeCloseTo(0, 10);
    });

    it('should calculate point on rotated ellipse', () => {
      const center = { x: 0, y: 0 };
      const angle = Math.PI / 2; // 90° rotation
      const result = calculateEllipsePointWithRotation(center, 2, 1, angle, 0);
      
      expect(result.x).toBeCloseTo(0, 10);
      expect(result.y).toBeCloseTo(2, 10); // Rotated 90°
    });

    it('should handle non-zero center', () => {
      const center = { x: 5, y: 3 };
      const result = calculateEllipsePointWithRotation(center, 1, 1, 0, Math.PI / 2);
      
      expect(result.x).toBeCloseTo(5, 10);
      expect(result.y).toBeCloseTo(4, 10); // 3 + 1
    });

    it('should handle different parameter values', () => {
      const center = { x: 0, y: 0 };
      const result1 = calculateEllipsePointWithRotation(center, 3, 2, 0, 0);
      const result2 = calculateEllipsePointWithRotation(center, 3, 2, 0, Math.PI);
      
      expect(result1.x).toBeCloseTo(3, 10);
      expect(result2.x).toBeCloseTo(-3, 10);
    });
  });

  describe('generateEllipsePoints', () => {
    it('should generate correct number of points', () => {
      const result = generateEllipsePoints(unitCircle, 0, Math.PI, 5);
      
      expect(result).toHaveLength(5);
    });

    it('should generate points for semicircle arc', () => {
      const result = generateEllipsePoints(unitCircle, 0, Math.PI, 3);
      
      expect(result).toHaveLength(3);
      expect(result[0].x).toBeCloseTo(1, 8); // Start at rightmost point
      expect(result[0].y).toBeCloseTo(0, 8);
      expect(result[2].x).toBeCloseTo(-1, 8); // End at leftmost point
      expect(result[2].y).toBeCloseTo(0, 8);
    });

    it('should generate points for full ellipse', () => {
      const result = generateEllipsePoints(horizontalEllipse, 0, 2 * Math.PI, 4);
      
      expect(result).toHaveLength(4);
      // All points should be valid
      result.forEach(point => {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      });
    });

    it('should handle rotated ellipse', () => {
      const result = generateEllipsePoints(rotatedEllipse, 0, 2 * Math.PI, 8);
      
      expect(result).toHaveLength(8);
      result.forEach(point => {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      });
    });

    it('should handle edge case with two points', () => {
      const result = generateEllipsePoints(unitCircle, 0, Math.PI / 2, 2);
      
      expect(result).toHaveLength(2);
      // First point at parameter 0
      expect(result[0].x).toBeCloseTo(1, 8);
      expect(result[0].y).toBeCloseTo(0, 8);
      // Second point at parameter π/2
      expect(result[1].x).toBeCloseTo(0, 8);
      expect(result[1].y).toBeCloseTo(1, 8);
    });

    it('should interpolate parameters correctly', () => {
      const result = generateEllipsePoints(unitCircle, 0, Math.PI / 2, 3);
      
      expect(result).toHaveLength(3);
      // First point at 0
      expect(result[0].x).toBeCloseTo(1, 8);
      expect(result[0].y).toBeCloseTo(0, 8);
      // Last point at π/2
      expect(result[2].x).toBeCloseTo(0, 8);
      expect(result[2].y).toBeCloseTo(1, 8);
    });
  });

  describe('tessellateEllipse', () => {
    it('should tessellate full ellipse', () => {
      const result = tessellateEllipse(unitCircle, 8);
      
      expect(result).toHaveLength(8);
      // Should be evenly spaced around circle
      result.forEach(point => {
        const distance = Math.sqrt(point.x * point.x + point.y * point.y);
        expect(distance).toBeCloseTo(1, 6);
      });
    });

    it('should tessellate ellipse arc', () => {
      const result = tessellateEllipse(ellipseArc, 4);
      
      expect(result).toHaveLength(5); // numPoints + 1 for arc
    });

    it('should handle full ellipse parameter calculation', () => {
      const result = tessellateEllipse(horizontalEllipse, 4);
      
      expect(result).toHaveLength(4);
      result.forEach(point => {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      });
    });

    it('should handle ellipse arc with parameter wrapping', () => {
      const wrappingArc: Ellipse = {
        ...ellipseArc,
        startParam: 3 * Math.PI / 2,
        endParam: Math.PI / 2 // Crosses 0
      };
      
      const result = tessellateEllipse(wrappingArc, 4);
      
      expect(result).toHaveLength(5);
      result.forEach(point => {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      });
    });

    it('should handle zero points gracefully', () => {
      const result = tessellateEllipse(unitCircle, 0);
      
      expect(result).toHaveLength(0);
    });

    it('should handle single point tessellation', () => {
      const result = tessellateEllipse(unitCircle, 1);
      
      expect(result).toHaveLength(1);
    });
  });

  describe('getEllipseStartEndPoints', () => {
    it('should return same point for full ellipse', () => {
      const result = getEllipseStartEndPoints(unitCircle);
      
      expect(result.start).toEqual(result.end);
      expect(result.start.x).toBeCloseTo(1, 10);
      expect(result.start.y).toBeCloseTo(0, 10);
    });

    it('should return same point for full horizontal ellipse', () => {
      const result = getEllipseStartEndPoints(horizontalEllipse);
      
      expect(result.start).toEqual(result.end);
      expect(result.start.x).toBeCloseTo(9, 10); // center.x + majorAxis
      expect(result.start.y).toBeCloseTo(3, 10); // center.y
    });

    it('should return different points for ellipse arc', () => {
      const result = getEllipseStartEndPoints(ellipseArc);
      
      expect(result.start).not.toEqual(result.end);
      // Start point at parameter 0
      expect(result.start.x).toBeCloseTo(3, 8); // Major axis length
      expect(result.start.y).toBeCloseTo(0, 8);
      // End point at parameter π
      expect(result.end.x).toBeCloseTo(-3, 8);
      expect(result.end.y).toBeCloseTo(0, 8);
    });

    it('should handle rotated ellipse arc', () => {
      const rotatedArc: Ellipse = {
        ...rotatedEllipse,
        startParam: 0,
        endParam: Math.PI / 2,
      };
      
      const result = getEllipseStartEndPoints(rotatedArc);
      
      expect(result.start).not.toEqual(result.end);
      expect(Number.isFinite(result.start.x)).toBe(true);
      expect(Number.isFinite(result.start.y)).toBe(true);
      expect(Number.isFinite(result.end.x)).toBe(true);
      expect(Number.isFinite(result.end.y)).toBe(true);
    });

    it('should handle ellipse without start/end parameters', () => {
      const ellipseNoParams: Ellipse = {
        ...horizontalEllipse,
        startParam: undefined,
        endParam: undefined
      };
      
      const result = getEllipseStartEndPoints(ellipseNoParams);
      
      expect(result.start).toEqual(result.end);
    });
  });

  describe('getEllipseParameters', () => {
    it('should calculate parameters for unit circle', () => {
      const result = getEllipseParameters(unitCircle);
      
      expect(result.majorAxisLength).toBeCloseTo(1, 10);
      expect(result.minorAxisLength).toBeCloseTo(1, 10);
      expect(result.majorAxisAngle).toBeCloseTo(0, 10);
    });

    it('should calculate parameters for horizontal ellipse', () => {
      const result = getEllipseParameters(horizontalEllipse);
      
      expect(result.majorAxisLength).toBeCloseTo(4, 10);
      expect(result.minorAxisLength).toBeCloseTo(2, 10);
      expect(result.majorAxisAngle).toBeCloseTo(0, 10);
    });

    it('should calculate parameters for rotated ellipse', () => {
      const result = getEllipseParameters(rotatedEllipse);
      
      const expectedMajorLength = Math.sqrt(2 * 2 + 3 * 3); // sqrt(13)
      const expectedMinorLength = expectedMajorLength * 0.6;
      const expectedAngle = Math.atan2(3, 2);
      
      expect(result.majorAxisLength).toBeCloseTo(expectedMajorLength, 8);
      expect(result.minorAxisLength).toBeCloseTo(expectedMinorLength, 8);
      expect(result.majorAxisAngle).toBeCloseTo(expectedAngle, 8);
    });

    it('should handle ellipse with vertical major axis', () => {
      const verticalEllipse: Ellipse = {
        ...unitCircle,
        majorAxisEndpoint: { x: 0, y: 5 }, // Vertical major axis
        minorToMajorRatio: 0.4
      };
      
      const result = getEllipseParameters(verticalEllipse);
      
      expect(result.majorAxisLength).toBeCloseTo(5, 10);
      expect(result.minorAxisLength).toBeCloseTo(2, 10);
      expect(result.majorAxisAngle).toBeCloseTo(Math.PI / 2, 10);
    });

    it('should handle very small ellipse', () => {
      const tinyEllipse: Ellipse = {
        ...unitCircle,
        majorAxisEndpoint: { x: 0.001, y: 0 },
        minorToMajorRatio: 0.5
      };
      
      const result = getEllipseParameters(tinyEllipse);
      
      expect(result.majorAxisLength).toBeCloseTo(0.001, 10);
      expect(result.minorAxisLength).toBeCloseTo(0.0005, 10);
    });

    it('should handle ellipse with negative coordinates', () => {
      const negativeEllipse: Ellipse = {
        ...unitCircle,
        majorAxisEndpoint: { x: -3, y: -4 },
        minorToMajorRatio: 0.8
      };
      
      const result = getEllipseParameters(negativeEllipse);
      
      expect(result.majorAxisLength).toBeCloseTo(5, 10); // sqrt(9 + 16)
      expect(result.minorAxisLength).toBeCloseTo(4, 10); // 5 * 0.8
      expect(result.majorAxisAngle).toBeCloseTo(Math.atan2(-4, -3), 8);
    });
  });
});