import { describe, it, expect, vi } from 'vitest';
import type { Point2D, Spline, Line, Circle } from '../../../types/geometry';
import {
  calculateSplineStartTangent,
  calculateSplineEndTangent,
  calculateSplineExtensionLength,
  createExtendedSplineVerb,
  analyzeParameterLocation,
  extendSplineToPoint,
  determineSplineExtensionDirection,
  calculateSplineExtension,
  getSplinePoint,
  type SplineExtensionOptions,
  type SplineExtensionResult
} from './spline';

// Mock verb-nurbs
vi.mock('verb-nurbs', () => ({
  default: {
    eval: {
      Eval: {
        rationalCurveDerivatives: vi.fn(),
        rationalCurvePoint: vi.fn()
      }
    },
    geom: {
      NurbsCurve: {
        byKnotsControlPointsWeights: vi.fn(() => ({
          asNurbs: vi.fn(() => ({}))
        }))
      }
    }
  }
}));

// Mock verb integration utils
vi.mock('../../../utils/verb-integration-utils', () => ({
  createVerbCurveFromSpline: vi.fn(() => ({
    asNurbs: vi.fn(() => ({}))
  }))
}));

// Mock common utils
vi.mock('./common', () => ({
  generateUniformKnots: vi.fn((numPoints, degree) => {
    const numKnots = numPoints + degree + 1;
    const knots: number[] = [];
    for (let i = 0; i < numKnots; i++) {
      knots.push(i / (numKnots - 1));
    }
    return knots;
  })
}));

describe('Spline Extension Functions', () => {
  const createTestSpline = (points: Point2D[]): Spline => ({
    type: 'spline',
    controlPoints: points,
    degree: 3,
    weights: points.map(() => 1),
    knots: [0, 0, 0, 0, 1, 1, 1, 1]
  });

  const createTestLine = (start: Point2D, end: Point2D): Line => ({
    type: 'line',
    start,
    end
  });

  const createTestCircle = (center: Point2D, radius: number): Circle => ({
    type: 'circle',
    center,
    radius
  });

  describe('calculateSplineStartTangent', () => {
    it('should calculate tangent at start of spline using verb', async () => {
      const { default: verb } = await import('verb-nurbs');
      const mockDerivatives = [[10, 20], [3, 4]]; // position, tangent
      vi.mocked(verb.eval.Eval.rationalCurveDerivatives).mockReturnValue(mockDerivatives);

      const spline = createTestSpline([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 }
      ]);

      const tangent = calculateSplineStartTangent(spline);
      
      // Tangent should be normalized: [3, 4] -> [0.6, 0.8]
      expect(tangent.x).toBeCloseTo(0.6);
      expect(tangent.y).toBeCloseTo(0.8);
    });

    it('should fallback to linear approximation when verb fails', async () => {
      const { default: verb } = await import('verb-nurbs');
      vi.mocked(verb.eval.Eval.rationalCurveDerivatives).mockImplementation(() => {
        throw new Error('Verb failed');
      });

      const spline = createTestSpline([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 }
      ]);

      const tangent = calculateSplineStartTangent(spline);
      
      // Should use difference between first two control points
      expect(tangent.x).toBe(10);
      expect(tangent.y).toBe(10);
    });

    it('should fallback to linear approximation when derivatives are degenerate', async () => {
      const { default: verb } = await import('verb-nurbs');
      const mockDerivatives = [[10, 20], [1e-12, 1e-12]]; // near-zero tangent
      vi.mocked(verb.eval.Eval.rationalCurveDerivatives).mockReturnValue(mockDerivatives);

      const spline = createTestSpline([
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 0 }
      ]);

      const tangent = calculateSplineStartTangent(spline);
      
      // Should use difference between first two control points
      expect(tangent.x).toBe(5);
      expect(tangent.y).toBe(5);
    });
  });

  describe('calculateSplineEndTangent', () => {
    it('should calculate tangent at end of spline using verb', async () => {
      const { default: verb } = await import('verb-nurbs');
      const mockDerivatives = [[20, 0], [-4, 3]]; // position, tangent
      vi.mocked(verb.eval.Eval.rationalCurveDerivatives).mockReturnValue(mockDerivatives);

      const spline = createTestSpline([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 }
      ]);

      const tangent = calculateSplineEndTangent(spline);
      
      // Tangent should be normalized: [-4, 3] -> [-0.8, 0.6]
      expect(tangent.x).toBeCloseTo(-0.8);
      expect(tangent.y).toBeCloseTo(0.6);
    });

    it('should fallback to linear approximation when verb fails', async () => {
      const { default: verb } = await import('verb-nurbs');
      vi.mocked(verb.eval.Eval.rationalCurveDerivatives).mockImplementation(() => {
        throw new Error('Verb failed');
      });

      const spline = createTestSpline([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 5 }
      ]);

      const tangent = calculateSplineEndTangent(spline);
      
      // Should use difference between last two control points
      expect(tangent.x).toBe(10);
      expect(tangent.y).toBe(-5);
    });
  });

  describe('calculateSplineExtensionLength', () => {
    it('should calculate extension length based on combined bounding box diagonal', () => {
      const spline = createTestSpline([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 }
      ]);
      
      const line = createTestLine({ x: 25, y: 5 }, { x: 30, y: 10 });
      
      const extensionLength = calculateSplineExtensionLength(spline, line);
      
      // Combined bounds: x: 0-30, y: 0-10
      // Diagonal = sqrt(30^2 + 10^2) = sqrt(1000) ≈ 31.6
      // Extension = diagonal * 0.75 ≈ 23.7
      // But minimum is 50, so should return 50
      expect(extensionLength).toBe(50);
    });

    it('should use minimum extension length when diagonal is small', () => {
      const spline = createTestSpline([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 }
      ]);
      
      const circle = createTestCircle({ x: 1, y: 1 }, 1);
      
      const extensionLength = calculateSplineExtensionLength(spline, circle);
      
      // Should use minimum of 50 units
      expect(extensionLength).toBe(50);
    });

    it('should handle circle shape bounds correctly', () => {
      const spline = createTestSpline([
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ]);
      
      const circle = createTestCircle({ x: 20, y: 20 }, 5);
      
      const extensionLength = calculateSplineExtensionLength(spline, circle);
      
      // Circle bounds: x: 15-25, y: 15-25
      // Combined bounds: x: 0-25, y: 0-25
      // Diagonal = sqrt(25^2 + 25^2) = 35.36
      // Extension = 35.36 * 0.75 ≈ 26.5
      // But minimum is 50, so should return 50
      expect(extensionLength).toBe(50);
    });
  });

  describe('createExtendedSplineVerb', () => {
    it('should create extended spline with start extension only', () => {
      const spline = createTestSpline([
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 10 }
      ]);

      const result = createExtendedSplineVerb(spline, true, false, 15);
      
      expect(result).toBeDefined();
    });

    it('should create extended spline with end extension only', () => {
      const spline = createTestSpline([
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 10 }
      ]);

      const result = createExtendedSplineVerb(spline, false, true, 15);
      
      expect(result).toBeDefined();
    });

    it('should create extended spline with both extensions', () => {
      const spline = createTestSpline([
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 10 }
      ]);

      const result = createExtendedSplineVerb(spline, true, true, 15);
      
      expect(result).toBeDefined();
    });

    it('should return original spline equivalent when no extensions requested', () => {
      const spline = createTestSpline([
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 10 }
      ]);

      const result = createExtendedSplineVerb(spline, false, false, 15);
      
      expect(result).toBeDefined();
    });

    it('should fallback to control points when verb evaluation fails', async () => {
      const { default: verb } = await import('verb-nurbs');
      vi.mocked(verb.eval.Eval.rationalCurvePoint).mockImplementation(() => {
        throw new Error('Verb failed');
      });

      const spline = createTestSpline([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 }
      ]);

      const result = createExtendedSplineVerb(spline, true, true, 10);
      
      expect(result).toBeDefined();
    });
  });

  describe('analyzeParameterLocation', () => {
    const testSpline = createTestSpline([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 }
    ]);

    it('should identify parameter on original spline with no extensions', () => {
      const result = analyzeParameterLocation(0.5, testSpline, false, false, 10);
      
      expect(result.onOriginal).toBe(true);
      expect(result.onStartExtension).toBe(false);
      expect(result.onEndExtension).toBe(false);
    });

    it('should identify parameter outside bounds with no extensions', () => {
      const result = analyzeParameterLocation(1.5, testSpline, false, false, 10);
      
      expect(result.onOriginal).toBe(false);
      expect(result.onStartExtension).toBe(false);
      expect(result.onEndExtension).toBe(false);
    });

    it('should identify parameter on start extension', () => {
      const result = analyzeParameterLocation(0.1, testSpline, true, false, 10);
      
      expect(result.onStartExtension).toBe(true);
      expect(result.onOriginal).toBe(false);
      expect(result.onEndExtension).toBe(false);
    });

    it('should identify parameter on end extension', () => {
      const result = analyzeParameterLocation(0.9, testSpline, false, true, 10);
      
      expect(result.onEndExtension).toBe(true);
      expect(result.onOriginal).toBe(false);
      expect(result.onStartExtension).toBe(false);
    });

    it('should identify parameter on original with both extensions', () => {
      const result = analyzeParameterLocation(0.5, testSpline, true, true, 10);
      
      expect(result.onOriginal).toBe(true);
      expect(result.onStartExtension).toBe(false);
      expect(result.onEndExtension).toBe(false);
    });
  });

  describe('extendSplineToPoint', () => {
    const testSpline = createTestSpline([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 }
    ]);

    it('should extend spline to intersection point successfully', () => {
      const intersectionPoint: Point2D = { x: 25, y: -5 };
      const options: SplineExtensionOptions = {
        maxExtension: 100,
        tolerance: 1e-6,
        direction: 'end',
        method: 'linear'
      };

      const result = extendSplineToPoint(testSpline, intersectionPoint, options);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.controlPoints.length).toBeGreaterThan(testSpline.controlPoints.length);
        // Last control point should be the intersection point
        const lastPoint = result.controlPoints[result.controlPoints.length - 1];
        expect(lastPoint.x).toBe(intersectionPoint.x);
        expect(lastPoint.y).toBe(intersectionPoint.y);
      }
    });

    it('should return null when extension distance exceeds maximum', () => {
      const intersectionPoint: Point2D = { x: 1000, y: 1000 };
      const options: SplineExtensionOptions = {
        maxExtension: 10,
        tolerance: 1e-6,
        direction: 'end',
        method: 'linear'
      };

      const result = extendSplineToPoint(testSpline, intersectionPoint, options);
      
      expect(result).toBeNull();
    });

    it('should return null for invalid spline', () => {
      const invalidSpline = createTestSpline([]);
      const intersectionPoint: Point2D = { x: 10, y: 10 };

      const result = extendSplineToPoint(invalidSpline, intersectionPoint);
      
      expect(result).toBeNull();
    });

    it('should use auto direction selection', () => {
      const intersectionPoint: Point2D = { x: -5, y: -5 }; // Closer to start
      const options: SplineExtensionOptions = {
        direction: 'auto'
      };

      const result = extendSplineToPoint(testSpline, intersectionPoint, options);
      
      expect(result).not.toBeNull();
      if (result) {
        // Should extend at start, so first point should be intersection point
        const firstPoint = result.controlPoints[0];
        expect(firstPoint.x).toBe(intersectionPoint.x);
        expect(firstPoint.y).toBe(intersectionPoint.y);
      }
    });
  });

  describe('determineSplineExtensionDirection', () => {
    const testSpline = createTestSpline([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 }
    ]);

    it('should return specified direction when not auto', () => {
      const intersectionPoint: Point2D = { x: 100, y: 100 };
      const options: SplineExtensionOptions = { direction: 'start' };

      const result = determineSplineExtensionDirection(testSpline, intersectionPoint, options);
      
      expect(result).toBe('start');
    });

    it('should choose closest end in auto mode', () => {
      const intersectionPoint: Point2D = { x: -5, y: -5 }; // Closer to start (0,0)
      const options: SplineExtensionOptions = { direction: 'auto' };

      const result = determineSplineExtensionDirection(testSpline, intersectionPoint, options);
      
      expect(result).toBe('start');
    });

    it('should choose end when intersection is closer to end', () => {
      const intersectionPoint: Point2D = { x: 25, y: -5 }; // Closer to end (20,0)
      const options: SplineExtensionOptions = { direction: 'auto' };

      const result = determineSplineExtensionDirection(testSpline, intersectionPoint, options);
      
      expect(result).toBe('end');
    });
  });

  describe('calculateSplineExtension', () => {
    const testSpline = createTestSpline([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 }
    ]);

    it('should calculate extension from start', () => {
      const intersectionPoint: Point2D = { x: -10, y: -10 };
      const options: SplineExtensionOptions = { method: 'linear' };

      const result = calculateSplineExtension(testSpline, intersectionPoint, 'start', options);
      
      expect(result.success).toBe(true);
      expect(result.direction).toBe('start');
      expect(result.method).toBe('linear');
      expect(result.extensionDistance).toBeGreaterThan(0);
    });

    it('should calculate extension from end', () => {
      const intersectionPoint: Point2D = { x: 30, y: -10 };
      const options: SplineExtensionOptions = { method: 'linear' };

      const result = calculateSplineExtension(testSpline, intersectionPoint, 'end', options);
      
      expect(result.success).toBe(true);
      expect(result.direction).toBe('end');
      expect(result.method).toBe('linear');
      expect(result.extensionDistance).toBeGreaterThan(0);
    });

    it('should use default method when not specified', () => {
      const intersectionPoint: Point2D = { x: 25, y: 5 };
      const options: SplineExtensionOptions = {};

      const result = calculateSplineExtension(testSpline, intersectionPoint, 'end', options);
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('linear'); // Should default to linear
    });
  });

  describe('getSplinePoint', () => {
    const testSpline = createTestSpline([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 }
    ]);

    it('should return start point at parameter 0', () => {
      const point = getSplinePoint(testSpline, 0);
      
      expect(point.x).toBe(0);
      expect(point.y).toBe(0);
    });

    it('should return end point at parameter 1', () => {
      const point = getSplinePoint(testSpline, 1);
      
      expect(point.x).toBe(20);
      expect(point.y).toBe(0);
    });

    it('should interpolate at parameter 0.5', () => {
      const point = getSplinePoint(testSpline, 0.5);
      
      // Should interpolate between control points
      expect(point.x).toBe(10);
      expect(point.y).toBe(10);
    });

    it('should handle parameter < 0', () => {
      const point = getSplinePoint(testSpline, -0.5);
      
      expect(point.x).toBe(0);
      expect(point.y).toBe(0);
    });

    it('should handle parameter > 1', () => {
      const point = getSplinePoint(testSpline, 1.5);
      
      expect(point.x).toBe(20);
      expect(point.y).toBe(0);
    });

    it('should return origin for empty spline', () => {
      const emptySpline = createTestSpline([]);
      const point = getSplinePoint(emptySpline, 0.5);
      
      expect(point.x).toBe(0);
      expect(point.y).toBe(0);
    });

    it('should handle single point spline', () => {
      const singlePointSpline = createTestSpline([{ x: 5, y: 3 }]);
      const point = getSplinePoint(singlePointSpline, 0.5);
      
      expect(point.x).toBe(5);
      expect(point.y).toBe(3);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle spline with insufficient control points', () => {
      const invalidSpline = createTestSpline([{ x: 0, y: 0 }]);
      const intersectionPoint: Point2D = { x: 10, y: 10 };

      const result = extendSplineToPoint(invalidSpline, intersectionPoint);
      
      expect(result).toBeNull();
    });

    it('should handle coincident intersection point', () => {
      const testSpline = createTestSpline([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 }
      ]);
      const coincidentPoint: Point2D = { x: 20, y: 0 }; // Same as end point

      const result = extendSplineToPoint(testSpline, coincidentPoint);
      
      // Should still create valid extension even with zero distance
      expect(result).not.toBeNull();
    });

    it('should handle spline with collinear control points', () => {
      const linearSpline = createTestSpline([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 }
      ]);

      const startTangent = calculateSplineStartTangent(linearSpline);
      const endTangent = calculateSplineEndTangent(linearSpline);

      // Tangents should be well-defined even for linear splines
      expect(Math.abs(startTangent.x)).toBeGreaterThan(0);
      expect(Math.abs(endTangent.x)).toBeGreaterThan(0);
    });
  });
});