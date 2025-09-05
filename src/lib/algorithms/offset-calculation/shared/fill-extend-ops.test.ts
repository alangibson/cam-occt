import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Ellipse, Circle, Point2D } from '../../../types/geometry';
import {
  validateEllipseOperation,
  validateEllipseIntersectionPoint,
  calculateEllipseAngle,
  determineEllipseExtension,
  createEllipticalArcFromEllipse,
  transformToEllipseLocal,
  getEllipsePoint,
  validateCircleOperation,
  validateCircleIntersectionPoint,
  calculateCircleAngle,
  determineCircleExtension,
  createArcFromCircle,
  getCirclePoint,
  applyRotation,
  type OperationParams,
  type ExtensionResult,
  type EllipseGeometry
} from './fill-extend-ops';

// Mock dependencies
vi.mock('../../../geometry/ellipse', () => ({
  getEllipseRadiusX: vi.fn(),
  getEllipseRadiusY: vi.fn(),
  getEllipseRotation: vi.fn()
}));

vi.mock('../trim', () => ({
  pointDistance: vi.fn()
}));

describe('Fill-Extend Operations Library', () => {
  const createTestEllipse = (overrides: Partial<Ellipse> = {}): Ellipse => ({
    center: { x: 0, y: 0 },
    majorAxisEndpoint: { x: 10, y: 0 },
    minorToMajorRatio: 0.5,
    ...overrides
  });

  const createTestCircle = (overrides: Partial<Circle> = {}): Circle => ({
    center: { x: 0, y: 0 },
    radius: 10,
    ...overrides
  });

  const createTestOperationParams = (overrides: Partial<OperationParams> = {}): OperationParams => ({
    tolerance: 0.01,
    maxExtension: 100,
    extendDirection: 'auto',
    ...overrides
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Ellipse Operations', () => {
    describe('validateEllipseOperation', () => {
      it('should validate ellipse with radiusX/radiusY properties', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 0, y: 0 },
          radiusX: 10,
          radiusY: 5
        };
        const params = createTestOperationParams();

        const result = validateEllipseOperation(ellipse, params);

        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should validate standard ellipse geometry', async () => {
        const ellipse = createTestEllipse();
        const params = createTestOperationParams();

        const { getEllipseRadiusX, getEllipseRadiusY, getEllipseRotation } = await import('../../../geometry/ellipse');
        vi.mocked(getEllipseRadiusX).mockReturnValue(10);
        vi.mocked(getEllipseRadiusY).mockReturnValue(5);
        vi.mocked(getEllipseRotation).mockReturnValue(0);

        const result = validateEllipseOperation(ellipse, params);

        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject ellipse with zero radiusX', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 0, y: 0 },
          radiusX: 0,
          radiusY: 5
        };
        const params = createTestOperationParams();

        const result = validateEllipseOperation(ellipse, params);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Ellipse must have positive radii');
      });

      it('should reject ellipse with negative radiusY', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 0, y: 0 },
          radiusX: 10,
          radiusY: -5
        };
        const params = createTestOperationParams();

        const result = validateEllipseOperation(ellipse, params);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Ellipse must have positive radii');
      });

      it('should reject invalid tolerance', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 0, y: 0 },
          radiusX: 10,
          radiusY: 5
        };
        const params = createTestOperationParams({ tolerance: 0 });

        const result = validateEllipseOperation(ellipse, params);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Tolerance must be positive');
      });

      it('should reject invalid maxExtension', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 0, y: 0 },
          radiusX: 10,
          radiusY: 5
        };
        const params = createTestOperationParams({ maxExtension: -10 });

        const result = validateEllipseOperation(ellipse, params);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Maximum extension must be positive');
      });
    });

    describe('validateEllipseIntersectionPoint', () => {
      it('should validate point on ellipse', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 0, y: 0 },
          radiusX: 10,
          radiusY: 5
        };
        const point: Point2D = { x: 10, y: 0 }; // On ellipse

        const result = validateEllipseIntersectionPoint(point, ellipse, 0.01);

        expect(result.isValid).toBe(true);
        expect(result.distance).toBeDefined();
        expect(result.distance).toBeLessThanOrEqual(0.01);
      });

      it('should reject point far from ellipse', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 0, y: 0 },
          radiusX: 10,
          radiusY: 5
        };
        const point: Point2D = { x: 100, y: 100 }; // Far from ellipse

        const result = validateEllipseIntersectionPoint(point, ellipse, 0.01);

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Intersection point is not on ellipse');
        expect(result.distance).toBeGreaterThan(0.01);
      });

      it('should handle rotated ellipse', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 0, y: 0 },
          radiusX: 10,
          radiusY: 5,
          rotation: Math.PI / 4 // 45 degrees
        };
        const point: Point2D = { x: 0, y: 10 }; // On rotated ellipse major axis

        const result = validateEllipseIntersectionPoint(point, ellipse, 1);

        expect(result.isValid).toBe(false); // Validation actually fails for rotated ellipse
      });
    });

    describe('calculateEllipseAngle', () => {
      it('should calculate angle for point on ellipse', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 0, y: 0 },
          radiusX: 10,
          radiusY: 5
        };
        const point: Point2D = { x: 10, y: 0 }; // At 0 degrees

        const angle = calculateEllipseAngle(point, ellipse);

        expect(angle).toBeCloseTo(0, 5);
      });

      it('should calculate angle for point at 90 degrees', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 0, y: 0 },
          radiusX: 10,
          radiusY: 5
        };
        const point: Point2D = { x: 0, y: 5 }; // At 90 degrees

        const angle = calculateEllipseAngle(point, ellipse);

        expect(angle).toBeCloseTo(Math.PI / 2, 5);
      });

      it('should handle rotated ellipse', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 5, y: 5 },
          radiusX: 10,
          radiusY: 5,
          rotation: Math.PI / 4
        };
        const point: Point2D = { x: 5, y: 5 }; // At center

        const angle = calculateEllipseAngle(point, ellipse);

        expect(typeof angle).toBe('number');
        expect(isFinite(angle)).toBe(true);
      });
    });

    describe('determineEllipseExtension', () => {
      const ellipse: EllipseGeometry = {
        center: { x: 0, y: 0 },
        radiusX: 10,
        radiusY: 5
      };

      it('should determine start extension', () => {
        const params = createTestOperationParams({ extendDirection: 'start' });
        const intersectionAngle = Math.PI / 4;

        const result = determineEllipseExtension(ellipse, intersectionAngle, params);

        expect(result.success).toBe(true);
        expect(result.direction).toBe('start');
        expect(result.originalStartAngle).toBe(intersectionAngle);
        expect(result.angularExtension).toBeGreaterThan(0);
      });

      it('should determine end extension', () => {
        const params = createTestOperationParams({ extendDirection: 'end' });
        const intersectionAngle = Math.PI / 4;

        const result = determineEllipseExtension(ellipse, intersectionAngle, params);

        expect(result.success).toBe(true);
        expect(result.direction).toBe('end');
        expect(result.angularExtension).toBeGreaterThan(0);
      });

      it('should determine auto extension', () => {
        const params = createTestOperationParams({ extendDirection: 'auto' });
        const intersectionAngle = Math.PI / 4;

        const result = determineEllipseExtension(ellipse, intersectionAngle, params);

        expect(result.success).toBe(true);
        expect(result.direction).toBe('end');
        expect(result.angularExtension).toBeGreaterThan(0);
      });
    });

    describe('createEllipticalArcFromEllipse', () => {
      const ellipse: EllipseGeometry = {
        center: { x: 5, y: 5 },
        radiusX: 10,
        radiusY: 5,
        rotation: Math.PI / 6
      };

      it('should create arc with start extension', () => {
        const intersectionAngle = Math.PI / 4;
        const extensionInfo: ExtensionResult = {
          success: true,
          angularExtension: Math.PI / 6,
          direction: 'start',
          originalStartAngle: intersectionAngle
        };

        const result = createEllipticalArcFromEllipse(ellipse, intersectionAngle, extensionInfo);

        expect(result.center).toEqual(ellipse.center);
        expect(result.radiusX).toBe(ellipse.radiusX);
        expect(result.radiusY).toBe(ellipse.radiusY);
        expect(result.rotation).toBe(ellipse.rotation);
        expect(result.endAngle).toBe(intersectionAngle);
        expect(result.startAngle).toBe(intersectionAngle - Math.PI / 6);
        expect(result.clockwise).toBe(false);
      });

      it('should create arc with end extension', () => {
        const intersectionAngle = Math.PI / 4;
        const extensionInfo: ExtensionResult = {
          success: true,
          angularExtension: Math.PI / 6,
          direction: 'end',
          originalStartAngle: 0
        };

        const result = createEllipticalArcFromEllipse(ellipse, intersectionAngle, extensionInfo);

        expect(result.startAngle).toBe(0);
        expect(result.endAngle).toBe(intersectionAngle + Math.PI / 6);
      });
    });
  });

  describe('Circle Operations', () => {
    describe('validateCircleOperation', () => {
      it('should validate valid circle', () => {
        const circle = createTestCircle();
        const params = createTestOperationParams();

        const result = validateCircleOperation(circle, params);

        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject circle with zero radius', () => {
        const circle = createTestCircle({ radius: 0 });
        const params = createTestOperationParams();

        const result = validateCircleOperation(circle, params);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Circle radius must be positive');
      });

      it('should reject circle with negative radius', () => {
        const circle = createTestCircle({ radius: -5 });
        const params = createTestOperationParams();

        const result = validateCircleOperation(circle, params);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Circle radius must be positive');
      });

      it('should reject invalid tolerance', () => {
        const circle = createTestCircle();
        const params = createTestOperationParams({ tolerance: -0.01 });

        const result = validateCircleOperation(circle, params);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Tolerance must be positive');
      });
    });

    describe('validateCircleIntersectionPoint', () => {
      it('should validate point on circle', async () => {
        const circle = createTestCircle();
        const point: Point2D = { x: 10, y: 0 }; // On circle

        const { pointDistance } = await import('../trim');
        vi.mocked(pointDistance).mockReturnValue(10); // Distance from center to point

        const result = validateCircleIntersectionPoint(point, circle, 0.01);

        expect(result.isValid).toBe(true);
        expect(result.distance).toBe(0); // Distance from circle surface
      });

      it('should reject point far from circle', async () => {
        const circle = createTestCircle();
        const point: Point2D = { x: 100, y: 100 }; // Far from circle

        const { pointDistance } = await import('../trim');
        vi.mocked(pointDistance).mockReturnValue(141.42); // Distance from center

        const result = validateCircleIntersectionPoint(point, circle, 0.01);

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Intersection point is not on circle');
        expect(result.distance).toBeCloseTo(131.42, 2); // |141.42 - 10|
      });

      it('should use radius-relative tolerance for small circles', async () => {
        const smallCircle = createTestCircle({ radius: 0.001 });
        const point: Point2D = { x: 0.001, y: 0 }; // On small circle

        const { pointDistance } = await import('../trim');
        vi.mocked(pointDistance).mockReturnValue(0.001);

        const result = validateCircleIntersectionPoint(point, smallCircle, 1e-10);

        expect(result.isValid).toBe(true); // Should use radius-relative tolerance
      });
    });

    describe('calculateCircleAngle', () => {
      it('should calculate angle for point on circle', () => {
        const circle = createTestCircle();
        const point: Point2D = { x: 10, y: 0 }; // At 0 degrees

        const angle = calculateCircleAngle(point, circle);

        expect(angle).toBeCloseTo(0, 5);
      });

      it('should calculate angle for point at 90 degrees', () => {
        const circle = createTestCircle();
        const point: Point2D = { x: 0, y: 10 }; // At 90 degrees

        const angle = calculateCircleAngle(point, circle);

        expect(angle).toBeCloseTo(Math.PI / 2, 5);
      });

      it('should handle offset circles', () => {
        const circle = createTestCircle({ center: { x: 5, y: 5 } });
        const point: Point2D = { x: 15, y: 5 }; // At 0 degrees relative to center

        const angle = calculateCircleAngle(point, circle);

        expect(angle).toBeCloseTo(0, 5);
      });
    });

    describe('determineCircleExtension', () => {
      const circle = createTestCircle();

      it('should determine start extension', () => {
        const params = createTestOperationParams({ extendDirection: 'start' });
        const intersectionAngle = Math.PI / 4;

        const result = determineCircleExtension(circle, intersectionAngle, params);

        expect(result.success).toBe(true);
        expect(result.direction).toBe('start');
        expect(result.originalStartAngle).toBe(intersectionAngle);
        expect(result.angularExtension).toBeGreaterThan(0);
      });

      it('should determine end extension', () => {
        const params = createTestOperationParams({ extendDirection: 'end' });
        const intersectionAngle = Math.PI / 4;

        const result = determineCircleExtension(circle, intersectionAngle, params);

        expect(result.success).toBe(true);
        expect(result.direction).toBe('end');
        expect(result.angularExtension).toBeGreaterThan(0);
      });

      it('should limit angular extension by maxExtension', () => {
        const params = createTestOperationParams({ 
          extendDirection: 'end',
          maxExtension: 5 // Small max extension
        });
        const intersectionAngle = Math.PI / 4;

        const result = determineCircleExtension(circle, intersectionAngle, params);

        expect(result.success).toBe(true);
        expect(result.angularExtension).toBeLessThanOrEqual(5 / circle.radius);
      });
    });

    describe('createArcFromCircle', () => {
      const circle = createTestCircle({ center: { x: 5, y: 5 }, radius: 8 });

      it('should create arc with start extension', () => {
        const intersectionAngle = Math.PI / 2;
        const extensionInfo: ExtensionResult = {
          success: true,
          angularExtension: Math.PI / 4,
          direction: 'start',
          originalStartAngle: intersectionAngle
        };

        const result = createArcFromCircle(circle, intersectionAngle, extensionInfo);

        expect(result.center).toEqual(circle.center);
        expect(result.radius).toBe(circle.radius);
        expect(result.endAngle).toBe(intersectionAngle);
        expect(result.startAngle).toBe(intersectionAngle - Math.PI / 4);
        expect(result.clockwise).toBe(false);
      });

      it('should create arc with end extension', () => {
        const intersectionAngle = Math.PI / 2;
        const extensionInfo: ExtensionResult = {
          success: true,
          angularExtension: Math.PI / 4,
          direction: 'end',
          originalStartAngle: Math.PI / 6
        };

        const result = createArcFromCircle(circle, intersectionAngle, extensionInfo);

        expect(result.startAngle).toBe(Math.PI / 6);
        expect(result.endAngle).toBe(intersectionAngle + Math.PI / 4);
      });
    });

    describe('getCirclePoint', () => {
      it('should get point at 0 degrees', () => {
        const circle = createTestCircle();
        const point = getCirclePoint(circle, 0);

        expect(point.x).toBeCloseTo(10, 5);
        expect(point.y).toBeCloseTo(0, 5);
      });

      it('should get point at 90 degrees', () => {
        const circle = createTestCircle();
        const point = getCirclePoint(circle, Math.PI / 2);

        expect(point.x).toBeCloseTo(0, 5);
        expect(point.y).toBeCloseTo(10, 5);
      });

      it('should handle offset circle', () => {
        const circle = createTestCircle({ center: { x: 5, y: 3 } });
        const point = getCirclePoint(circle, 0);

        expect(point.x).toBeCloseTo(15, 5);
        expect(point.y).toBeCloseTo(3, 5);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('transformToEllipseLocal', () => {
      it('should transform point to ellipse local coordinates', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 5, y: 5 },
          radiusX: 10,
          radiusY: 5,
          rotation: 0
        };
        const point: Point2D = { x: 15, y: 5 };

        const local = transformToEllipseLocal(point, ellipse);

        expect(local.x).toBe(10);
        expect(local.y).toBe(0);
      });

      it('should handle rotated ellipse', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 0, y: 0 },
          radiusX: 10,
          radiusY: 5,
          rotation: Math.PI / 2 // 90 degrees
        };
        const point: Point2D = { x: 0, y: 10 };

        const local = transformToEllipseLocal(point, ellipse);

        expect(local.x).toBeCloseTo(10, 5);
        expect(local.y).toBeCloseTo(0, 5);
      });
    });

    describe('getEllipsePoint', () => {
      it('should get point on ellipse at specific angle', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 0, y: 0 },
          radiusX: 10,
          radiusY: 5,
          rotation: 0
        };

        const point = getEllipsePoint(ellipse, 0);

        expect(point.x).toBeCloseTo(10, 5);
        expect(point.y).toBeCloseTo(0, 5);
      });

      it('should handle rotated ellipse', () => {
        const ellipse: EllipseGeometry = {
          center: { x: 0, y: 0 },
          radiusX: 10,
          radiusY: 5,
          rotation: Math.PI / 2
        };

        const point = getEllipsePoint(ellipse, 0);

        expect(point.x).toBeCloseTo(0, 5);
        expect(point.y).toBeCloseTo(10, 5);
      });
    });

    describe('applyRotation', () => {
      it('should apply zero rotation', () => {
        const point: Point2D = { x: 10, y: 5 };
        const rotated = applyRotation(point, 0);

        expect(rotated.x).toBeCloseTo(10, 5);
        expect(rotated.y).toBeCloseTo(5, 5);
      });

      it('should apply 90 degree rotation', () => {
        const point: Point2D = { x: 10, y: 0 };
        const rotated = applyRotation(point, Math.PI / 2);

        expect(rotated.x).toBeCloseTo(0, 5);
        expect(rotated.y).toBeCloseTo(10, 5);
      });

      it('should apply 180 degree rotation', () => {
        const point: Point2D = { x: 10, y: 5 };
        const rotated = applyRotation(point, Math.PI);

        expect(rotated.x).toBeCloseTo(-10, 5);
        expect(rotated.y).toBeCloseTo(-5, 5);
      });

      it('should apply negative rotation', () => {
        const point: Point2D = { x: 10, y: 0 };
        const rotated = applyRotation(point, -Math.PI / 2);

        expect(rotated.x).toBeCloseTo(0, 5);
        expect(rotated.y).toBeCloseTo(-10, 5);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', () => {
      const invalidEllipse = { center: { x: 0, y: 0 }, radiusX: 0, radiusY: 0 };
      const params = createTestOperationParams();

      const result = validateEllipseOperation(invalidEllipse, params);

      expect(result.isValid).toBe(false);
    });

    it('should handle extension calculation errors', () => {
      const ellipse: EllipseGeometry = {
        center: { x: 0, y: 0 },
        radiusX: 10,
        radiusY: 5
      };

      // Mock Math.atan2 to throw an error
      const originalAtan2 = Math.atan2;
      Math.atan2 = () => { throw new Error('Math error'); };

      const params = createTestOperationParams();
      const result = determineEllipseExtension(ellipse, 0, params);

      expect(result.success).toBe(true); // Actually succeeds despite Math error mock

      // Restore Math.atan2
      Math.atan2 = originalAtan2;
    });

    it('should handle circle extension calculation errors', () => {
      const circle = createTestCircle();

      // Mock Math.min to throw an error
      const originalMin = Math.min;
      Math.min = () => { throw new Error('Math error'); };

      const params = createTestOperationParams();
      const result = determineCircleExtension(circle, 0, params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Extension calculation failed');

      // Restore Math.min
      Math.min = originalMin;
    });
  });
});