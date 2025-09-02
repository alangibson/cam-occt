import { describe, it, expect } from 'vitest';
import type { Point2D, Line } from '../../../types/geometry';
import {
  calculateLineParameter,
  pointDistance,
  calculatePointToLineDistance,
  snapParameterToEndpoints,
  validateTrimExtendParameters,
  type TrimExtendParams,
  type TrimExtendValidationResult
} from './trim-extend-utils';

describe('trim-extend-utils', () => {
  describe('pointDistance', () => {
    it('should calculate distance between two points', () => {
      const p1: Point2D = { x: 0, y: 0 };
      const p2: Point2D = { x: 3, y: 4 };
      expect(pointDistance(p1, p2)).toBe(5);
    });

    it('should calculate distance for identical points', () => {
      const p: Point2D = { x: 10, y: 20 };
      expect(pointDistance(p, p)).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const p1: Point2D = { x: -3, y: -4 };
      const p2: Point2D = { x: 0, y: 0 };
      expect(pointDistance(p1, p2)).toBe(5);
    });

    it('should calculate horizontal distance', () => {
      const p1: Point2D = { x: 0, y: 5 };
      const p2: Point2D = { x: 10, y: 5 };
      expect(pointDistance(p1, p2)).toBe(10);
    });

    it('should calculate vertical distance', () => {
      const p1: Point2D = { x: 7, y: 0 };
      const p2: Point2D = { x: 7, y: 24 };
      expect(pointDistance(p1, p2)).toBe(24);
    });

    it('should handle decimal coordinates', () => {
      const p1: Point2D = { x: 0.5, y: 1.5 };
      const p2: Point2D = { x: 3.5, y: 5.5 };
      expect(pointDistance(p1, p2)).toBe(5);
    });
  });

  describe('calculatePointToLineDistance', () => {
    it('should calculate perpendicular distance from point to horizontal line', () => {
      const point: Point2D = { x: 5, y: 10 };
      const line: Line = { start: { x: 0, y: 5 }, end: { x: 10, y: 5 } };
      expect(calculatePointToLineDistance(point, line)).toBe(5);
    });

    it('should calculate perpendicular distance from point to vertical line', () => {
      const point: Point2D = { x: 10, y: 5 };
      const line: Line = { start: { x: 3, y: 0 }, end: { x: 3, y: 10 } };
      expect(calculatePointToLineDistance(point, line)).toBe(7);
    });

    it('should calculate distance from point to diagonal line', () => {
      const point: Point2D = { x: 0, y: 0 };
      const line: Line = { start: { x: 1, y: 1 }, end: { x: 3, y: 3 } };
      // Distance from origin to line y=x through (1,1) and (3,3)
      // Formula: |ax + by + c| / sqrt(a² + b²)
      // Line equation: x - y = 0, so distance = |0 - 0| / sqrt(2) = 0
      expect(calculatePointToLineDistance(point, line)).toBeCloseTo(0, 10);
    });

    it('should calculate distance to 45-degree line', () => {
      const point: Point2D = { x: 2, y: 0 };
      const line: Line = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
      // Distance from (2,0) to line y=x
      // Line equation: x - y = 0, distance = |2 - 0| / sqrt(1² + 1²) = 2/√2 = √2
      expect(calculatePointToLineDistance(point, line)).toBeCloseTo(Math.sqrt(2), 10);
    });

    it('should handle degenerate line (point)', () => {
      const point: Point2D = { x: 5, y: 7 };
      const line: Line = { start: { x: 1, y: 2 }, end: { x: 1, y: 2 } };
      // Distance to a point is just point distance
      expect(calculatePointToLineDistance(point, line)).toBe(pointDistance(point, line.start));
    });

    it('should handle very short line within epsilon', () => {
      const point: Point2D = { x: 5, y: 7 };
      const line: Line = { 
        start: { x: 1, y: 2 }, 
        end: { x: 1 + 1e-11, y: 2 + 1e-11 } 
      };
      // Should treat as degenerate and return distance to start point
      const result = calculatePointToLineDistance(point, line);
      const expectedDistance = pointDistance(point, line.start);
      expect(result).toBeCloseTo(expectedDistance, 5);
    });

    it('should handle point on line', () => {
      const point: Point2D = { x: 2, y: 5 };
      const line: Line = { start: { x: 0, y: 5 }, end: { x: 10, y: 5 } };
      expect(calculatePointToLineDistance(point, line)).toBeCloseTo(0, 10);
    });

    it('should handle negative coordinates', () => {
      const point: Point2D = { x: -2, y: -3 };
      const line: Line = { start: { x: -5, y: 0 }, end: { x: 5, y: 0 } };
      expect(calculatePointToLineDistance(point, line)).toBe(3);
    });
  });

  describe('calculateLineParameter', () => {
    it('should be exported as alias for calculateLineParameterForPoint', () => {
      expect(typeof calculateLineParameter).toBe('function');
    });

    it('should calculate parameter for point on line', () => {
      const line: Line = { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
      const point: Point2D = { x: 3, y: 0 };
      
      expect(calculateLineParameter(point, line)).toBeCloseTo(0.3);
    });

    it('should return 0 for start point', () => {
      const line: Line = { start: { x: 5, y: 3 }, end: { x: 15, y: 8 } };
      
      expect(calculateLineParameter(line.start, line)).toBeCloseTo(0);
    });

    it('should return 1 for end point', () => {
      const line: Line = { start: { x: 5, y: 3 }, end: { x: 15, y: 8 } };
      
      expect(calculateLineParameter(line.end, line)).toBeCloseTo(1);
    });
  });

  describe('snapParameterToEndpoints', () => {
    it('should snap parameter near 0 to exactly 0', () => {
      expect(snapParameterToEndpoints(1e-11)).toBe(0);
      expect(snapParameterToEndpoints(-1e-11)).toBe(0);
    });

    it('should snap parameter near 1 to exactly 1', () => {
      expect(snapParameterToEndpoints(1 - 1e-11)).toBe(1);
      expect(snapParameterToEndpoints(1 + 1e-11)).toBe(1);
    });

    it('should not snap parameters far from endpoints', () => {
      expect(snapParameterToEndpoints(0.1)).toBe(0.1);
      expect(snapParameterToEndpoints(0.5)).toBe(0.5);
      expect(snapParameterToEndpoints(0.9)).toBe(0.9);
    });

    it('should use custom tolerance', () => {
      expect(snapParameterToEndpoints(0.05, 0.1)).toBe(0);
      expect(snapParameterToEndpoints(0.95, 0.1)).toBe(1);
      expect(snapParameterToEndpoints(0.05, 0.01)).toBe(0.05);
    });

    it('should handle parameters outside [0,1] range', () => {
      expect(snapParameterToEndpoints(-0.5)).toBe(-0.5);
      expect(snapParameterToEndpoints(1.5)).toBe(1.5);
    });

    it('should use default EPSILON tolerance', () => {
      // Test that the default tolerance works for very small values
      expect(snapParameterToEndpoints(1e-12)).toBe(0);
      expect(snapParameterToEndpoints(1 - 1e-12)).toBe(1);
    });
  });

  describe('validateTrimExtendParameters', () => {
    describe('valid parameters', () => {
      it('should validate correct parameters', () => {
        const params: TrimExtendParams = {
          point: { x: 1, y: 2 },
          tolerance: 0.01
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
      });

      it('should validate parameters with maxExtension', () => {
        const params: TrimExtendParams = {
          point: { x: 5, y: 10 },
          tolerance: 0.1,
          maxExtension: 50
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
      });

      it('should provide warning for large tolerance', () => {
        const params: TrimExtendParams = {
          point: { x: 1, y: 2 },
          tolerance: 2.0
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toContain('Large tolerance value may lead to unexpected results');
      });

      it('should provide warning for large maxExtension', () => {
        const params: TrimExtendParams = {
          point: { x: 1, y: 2 },
          tolerance: 0.01,
          maxExtension: 2000
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toContain('Large maxExtension value may lead to unexpected results');
      });
    });

    describe('invalid point', () => {
      it('should reject missing point', () => {
        const params = {
          tolerance: 0.01
        } as TrimExtendParams;
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid point: must have numeric x and y coordinates');
      });

      it('should reject point with non-numeric coordinates', () => {
        const params: TrimExtendParams = {
          point: { x: 'invalid' as any, y: 2 },
          tolerance: 0.01
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid point: must have numeric x and y coordinates');
      });

      it('should reject point with NaN coordinates', () => {
        const params: TrimExtendParams = {
          point: { x: NaN, y: 2 },
          tolerance: 0.01
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid point: coordinates cannot be NaN');
      });

      it('should reject point with both coordinates NaN', () => {
        const params: TrimExtendParams = {
          point: { x: NaN, y: NaN },
          tolerance: 0.01
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid point: coordinates cannot be NaN');
      });
    });

    describe('invalid tolerance', () => {
      it('should reject non-numeric tolerance', () => {
        const params: TrimExtendParams = {
          point: { x: 1, y: 2 },
          tolerance: 'invalid' as any
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid tolerance: must be a positive number');
      });

      it('should reject zero tolerance', () => {
        const params: TrimExtendParams = {
          point: { x: 1, y: 2 },
          tolerance: 0
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid tolerance: must be a positive number');
      });

      it('should reject negative tolerance', () => {
        const params: TrimExtendParams = {
          point: { x: 1, y: 2 },
          tolerance: -0.1
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid tolerance: must be a positive number');
      });
    });

    describe('invalid maxExtension', () => {
      it('should reject non-numeric maxExtension', () => {
        const params: TrimExtendParams = {
          point: { x: 1, y: 2 },
          tolerance: 0.01,
          maxExtension: 'invalid' as any
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid maxExtension: must be a positive number');
      });

      it('should reject zero maxExtension', () => {
        const params: TrimExtendParams = {
          point: { x: 1, y: 2 },
          tolerance: 0.01,
          maxExtension: 0
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid maxExtension: must be a positive number');
      });

      it('should reject negative maxExtension', () => {
        const params: TrimExtendParams = {
          point: { x: 1, y: 2 },
          tolerance: 0.01,
          maxExtension: -10
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid maxExtension: must be a positive number');
      });
    });

    describe('multiple validation errors', () => {
      it('should collect multiple errors', () => {
        const params: TrimExtendParams = {
          point: { x: 'invalid' as any, y: 2 },
          tolerance: -1,
          maxExtension: 0
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
        expect(result.errors).toContain('Invalid point: must have numeric x and y coordinates');
        expect(result.errors).toContain('Invalid tolerance: must be a positive number');
        expect(result.errors).toContain('Invalid maxExtension: must be a positive number');
      });

      it('should collect multiple warnings', () => {
        const params: TrimExtendParams = {
          point: { x: 1, y: 2 },
          tolerance: 5.0,
          maxExtension: 5000
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(true);
        expect(result.warnings.length).toBe(2);
        expect(result.warnings).toContain('Large tolerance value may lead to unexpected results');
        expect(result.warnings).toContain('Large maxExtension value may lead to unexpected results');
      });
    });

    describe('boundary conditions', () => {
      it('should accept tolerance exactly at warning threshold', () => {
        const params: TrimExtendParams = {
          point: { x: 1, y: 2 },
          tolerance: 1.0
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(true);
        expect(result.warnings).toEqual([]);
      });

      it('should accept maxExtension exactly at warning threshold', () => {
        const params: TrimExtendParams = {
          point: { x: 1, y: 2 },
          tolerance: 0.01,
          maxExtension: 1000
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(true);
        expect(result.warnings).toEqual([]);
      });

      it('should handle very small valid tolerance', () => {
        const params: TrimExtendParams = {
          point: { x: 1, y: 2 },
          tolerance: 1e-10
        };
        
        const result = validateTrimExtendParameters(params);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
      });
    });
  });

  describe('Edge Cases and Precision', () => {
    describe('pointDistance precision', () => {
      it('should handle very small distances', () => {
        const p1: Point2D = { x: 0, y: 0 };
        const p2: Point2D = { x: 1e-10, y: 1e-10 };
        const distance = pointDistance(p1, p2);
        expect(distance).toBeCloseTo(Math.sqrt(2e-20), 15);
      });

      it('should handle very large coordinates', () => {
        const p1: Point2D = { x: 1e6, y: 1e6 };
        const p2: Point2D = { x: 1e6 + 3, y: 1e6 + 4 };
        expect(pointDistance(p1, p2)).toBeCloseTo(5, 10);
      });
    });

    describe('calculatePointToLineDistance edge cases', () => {
      it('should handle line with zero length in one dimension', () => {
        const point: Point2D = { x: 5, y: 3 };
        const line: Line = { start: { x: 0, y: 0 }, end: { x: 0, y: 10 } };
        expect(calculatePointToLineDistance(point, line)).toBe(5);
      });

      it('should handle very long line', () => {
        const point: Point2D = { x: 0, y: 1 };
        const line: Line = { start: { x: -1e6, y: 0 }, end: { x: 1e6, y: 0 } };
        expect(calculatePointToLineDistance(point, line)).toBeCloseTo(1, 10);
      });

      it('should maintain precision with floating point coordinates', () => {
        const point: Point2D = { x: 1.234567, y: 2.345678 };
        const line: Line = { start: { x: 0.123456, y: 3.456789 }, end: { x: 5.678901, y: 3.456789 } };
        // Distance to horizontal line
        const expectedDistance = Math.abs(2.345678 - 3.456789);
        expect(calculatePointToLineDistance(point, line)).toBeCloseTo(expectedDistance, 10);
      });
    });

    describe('snapParameterToEndpoints precision', () => {
      it('should not snap values exactly at tolerance boundary', () => {
        const tolerance = 1e-6;
        expect(snapParameterToEndpoints(tolerance, tolerance)).toBe(tolerance);
        expect(snapParameterToEndpoints(1 - tolerance, tolerance)).toBe(1 - tolerance);
      });

      it('should snap values just inside tolerance', () => {
        const tolerance = 1e-6;
        expect(snapParameterToEndpoints(tolerance * 0.5, tolerance)).toBe(0);
        expect(snapParameterToEndpoints(1 - tolerance * 0.5, tolerance)).toBe(1);
      });
    });
  });

  describe('Mathematical Properties', () => {
    it('should satisfy distance symmetry', () => {
      const p1: Point2D = { x: 3, y: 7 };
      const p2: Point2D = { x: 11, y: 15 };
      expect(pointDistance(p1, p2)).toBe(pointDistance(p2, p1));
    });

    it('should satisfy triangle inequality', () => {
      const p1: Point2D = { x: 0, y: 0 };
      const p2: Point2D = { x: 3, y: 4 };
      const p3: Point2D = { x: 6, y: 8 };
      
      const d12 = pointDistance(p1, p2);
      const d23 = pointDistance(p2, p3);
      const d13 = pointDistance(p1, p3);
      
      expect(d13).toBeLessThanOrEqual(d12 + d23 + 1e-10); // Small epsilon for floating point
    });

    it('should calculate zero distance for identical points', () => {
      const coords = [
        { x: 0, y: 0 },
        { x: 123.456, y: -789.012 },
        { x: -1e6, y: 1e6 }
      ];

      for (const point of coords) {
        expect(pointDistance(point, point)).toBe(0);
      }
    });
  });
});