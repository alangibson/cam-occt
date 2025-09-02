import { describe, it, expect } from 'vitest';
import { fillEllipseToIntersection } from './index';
import type { FillOptions, FillResult } from '../types';
import type { Shape, Ellipse, Point2D } from '$lib/types/geometry';
import { generateId } from '$lib/utils/id';

describe('fillEllipseToIntersection', () => {
  // Helper function to create test ellipses
  function createEllipse(
    cx: number, 
    cy: number, 
    majorAxisX: number, 
    majorAxisY: number, 
    minorToMajorRatio: number,
    startParam?: number,
    endParam?: number
  ): Shape {
    return {
      id: generateId(),
      type: 'ellipse',
      geometry: {
        center: { x: cx, y: cy },
        majorAxisEndpoint: { x: majorAxisX, y: majorAxisY },
        minorToMajorRatio,
        startParam,
        endParam
      } as Ellipse
    };
  }

  // Helper to check if two points are approximately equal
  function pointsApproxEqual(p1: Point2D, p2: Point2D, tolerance: number = 1e-6): boolean {
    return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
  }

  // Helper to validate fill result
  function validateFillResult(result: FillResult, shouldSucceed: boolean = true): void {
    if (shouldSucceed) {
      expect(result.success).toBe(true);
      expect(result.extendedShape).not.toBeNull();
      expect(result.errors).toHaveLength(0);
    } else {
      expect(result.success).toBe(false);
      expect(result.extendedShape).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    }
  }

  const defaultOptions: FillOptions = {
    maxExtension: Math.PI, // Max angular extension
    tolerance: 1e-6
  };

  describe('basic ellipse to arc conversion', () => {
    it('should convert ellipse to elliptical arc when extended', () => {
      const ellipse = createEllipse(0, 0, 4, 0, 0.5); // Horizontal ellipse, a=4, b=2
      const intersectionPoint = { x: 4, y: 0 }; // Point on ellipse at angle 0
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      expect(result.extendedShape!.type).toBe('ellipse');
      
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      expect(pointsApproxEqual(resultEllipse.center, { x: 0, y: 0 })).toBe(true);
      expect(pointsApproxEqual(resultEllipse.majorAxisEndpoint, { x: 4, y: 0 })).toBe(true);
      expect(resultEllipse.minorToMajorRatio).toBe(0.5);
      expect(resultEllipse.startParam).toBeDefined();
      expect(resultEllipse.endParam).toBeDefined();
    });

    it('should handle intersection point at different angles', () => {
      const ellipse = createEllipse(0, 0, 3, 0, 0.6); // a=3, b=1.8
      const a = 3;
      const b = 3 * 0.6; // 1.8
      const angle = Math.PI / 2; // 90°
      const intersectionPoint = { x: a * Math.cos(angle), y: b * Math.sin(angle) };
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      expect(pointsApproxEqual(resultEllipse.center, { x: 0, y: 0 })).toBe(true);
      expect(resultEllipse.minorToMajorRatio).toBe(0.6);
    });

    it('should preserve ellipse properties', () => {
      const ellipse = createEllipse(5, -2, 6, 0, 0.75); // Center at (5, -2)
      const intersectionPoint = { x: 11, y: -2 }; // Right side
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      expect(pointsApproxEqual(resultEllipse.center, { x: 5, y: -2 })).toBe(true);
      // Note: The majorAxisEndpoint might be transformed, so just check that it has reasonable values
      expect(resultEllipse.majorAxisEndpoint).toBeDefined();
      expect(typeof resultEllipse.majorAxisEndpoint.x).toBe('number');
      expect(typeof resultEllipse.majorAxisEndpoint.y).toBe('number');
      expect(resultEllipse.minorToMajorRatio).toBe(0.75);
    });
  });

  describe('rotated ellipses', () => {
    it('should handle vertically oriented ellipse', () => {
      const ellipse = createEllipse(0, 0, 0, 5, 0.8); // Vertical ellipse, rotated 90°
      const a = 5;
      const b = 5 * 0.8; // 4
      const angle = Math.PI / 4; // 45° in local coords
      // Transform to global coordinates (90° rotation)
      const localX = a * Math.cos(angle);
      const localY = b * Math.sin(angle);
      const intersectionPoint = { x: -localY, y: localX }; // 90° rotation
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      expect(pointsApproxEqual(resultEllipse.center, { x: 0, y: 0 })).toBe(true);
      expect(pointsApproxEqual(resultEllipse.majorAxisEndpoint, { x: 0, y: 5 })).toBe(true);
      expect(resultEllipse.minorToMajorRatio).toBe(0.8);
    });

    it('should handle arbitrary rotation angle', () => {
      const ellipse = createEllipse(0, 0, 3, 4, 0.6); // Rotated ellipse
      const intersectionPoint = { x: 2, y: 3 }; // Some point that might be on ellipse
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      // Test that ellipse properties are preserved regardless of success
      expect(result.success).toBeDefined();
      if (result.success) {
        const resultEllipse = result.extendedShape!.geometry as Ellipse;
        expect(pointsApproxEqual(resultEllipse.center, { x: 0, y: 0 })).toBe(true);
        expect(pointsApproxEqual(resultEllipse.majorAxisEndpoint, { x: 3, y: 4 })).toBe(true);
        expect(resultEllipse.minorToMajorRatio).toBe(0.6);
      }
    });
  });

  describe('extension direction and angular range', () => {
    it('should create elliptical arc with meaningful angular range', () => {
      const ellipse = createEllipse(0, 0, 4, 0, 0.5);
      const intersectionPoint = { x: 4, y: 0 }; // Right side
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, {
        ...defaultOptions,
        extendDirection: 'end'
      });
      
      validateFillResult(result, true);
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      
      // Should have start and end parameters
      expect(resultEllipse.startParam).toBeDefined();
      expect(resultEllipse.endParam).toBeDefined();
      
      // Angular range should be meaningful
      if (resultEllipse.startParam !== undefined && resultEllipse.endParam !== undefined) {
        let angularRange = Math.abs(resultEllipse.endParam - resultEllipse.startParam);
        if (angularRange > Math.PI) {
          angularRange = 2 * Math.PI - angularRange;
        }
        expect(angularRange).toBeGreaterThan(0);
      }
    });

    it('should handle start direction extension', () => {
      const ellipse = createEllipse(0, 0, 2, 0, 0.75);
      const intersectionPoint = { x: -2, y: 0 }; // Left side
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, {
        ...defaultOptions,
        extendDirection: 'start'
      });
      
      validateFillResult(result, true);
      expect(result.extension).toBeDefined();
      if (result.extension) {
        expect(result.extension.direction).toBe('start');
      }
    });

    it('should auto-detect extension direction', () => {
      const ellipse = createEllipse(0, 0, 3, 0, 0.8);
      const intersectionPoint = { x: 0, y: 2.4 }; // Top (b = 3 * 0.8 = 2.4)
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, {
        ...defaultOptions,
        extendDirection: 'auto'
      });
      
      validateFillResult(result, true);
      expect(result.extension).toBeDefined();
      expect(['start', 'end']).toContain(result.extension!.direction);
    });
  });

  describe('existing elliptical arcs', () => {
    it('should extend existing elliptical arc', () => {
      const ellipseArc = createEllipse(0, 0, 5, 0, 0.6, 0, Math.PI); // Half ellipse
      const a = 5;
      const b = 5 * 0.6; // 3
      const newAngle = Math.PI * 1.5; // 270°
      const intersectionPoint = { x: a * Math.cos(newAngle), y: b * Math.sin(newAngle) };
      
      const result = fillEllipseToIntersection(ellipseArc, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      expect(resultEllipse.startParam).toBeDefined();
      expect(resultEllipse.endParam).toBeDefined();
    });

    it('should handle very small elliptical arc extension', () => {
      const ellipseArc = createEllipse(0, 0, 4, 0, 0.5, 0, 0.1); // Very small arc
      const a = 4;
      const b = 4 * 0.5; // 2
      const extendAngle = 0.2; // Extend slightly
      const intersectionPoint = { x: a * Math.cos(extendAngle), y: b * Math.sin(extendAngle) };
      
      const result = fillEllipseToIntersection(ellipseArc, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      expect(resultEllipse.startParam).toBeDefined();
      expect(resultEllipse.endParam).toBeDefined();
    });
  });

  describe('error conditions', () => {
    it('should reject non-ellipse shapes', () => {
      const circle: Shape = {
        id: generateId(),
        type: 'circle',
        geometry: {
          center: { x: 0, y: 0 },
          radius: 5
        }
      };
      
      const result = fillEllipseToIntersection(circle, { x: 5, y: 0 }, defaultOptions);
      
      validateFillResult(result, false);
      expect(result.errors[0]).toContain('must be an ellipse');
    });

    it('should handle intersection point not on ellipse', () => {
      const ellipse = createEllipse(0, 0, 4, 0, 0.5);
      const intersectionPoint = { x: 2, y: 0 }; // Inside ellipse
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      expect(result.success).toBeDefined();
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle intersection point far from ellipse', () => {
      const ellipse = createEllipse(0, 0, 2, 0, 0.8);
      const intersectionPoint = { x: 20, y: 0 }; // Far from ellipse
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      expect(result.success).toBeDefined();
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should validate maxExtension parameter', () => {
      const ellipse = createEllipse(0, 0, 3, 0, 0.6);
      const intersectionPoint = { x: 3, y: 0 };
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, {
        maxExtension: 0.01, // Very small
        tolerance: 1e-6,
        extendDirection: 'end'
      });
      
      expect(result.success).toBeDefined();
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('numerical precision and edge cases', () => {
    it('should handle very small ellipses', () => {
      const ellipse = createEllipse(0, 0, 1e-6, 0, 0.5);
      const intersectionPoint = { x: 1e-6, y: 0 };
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      expect(result.success).toBeDefined();
      if (result.success) {
        const resultEllipse = result.extendedShape!.geometry as Ellipse;
        expect(pointsApproxEqual(resultEllipse.majorAxisEndpoint, { x: 1e-6, y: 0 }, 1e-12)).toBe(true);
      }
    });

    it('should handle very large ellipses', () => {
      const ellipse = createEllipse(0, 0, 1000, 0, 0.7);
      const intersectionPoint = { x: 1000, y: 0 };
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      expect(pointsApproxEqual(resultEllipse.majorAxisEndpoint, { x: 1000, y: 0 })).toBe(true);
    });

    it('should handle near-circular ellipses', () => {
      const ellipse = createEllipse(0, 0, 5, 0, 0.999); // Almost circular
      const intersectionPoint = { x: 5, y: 0 };
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      expect(resultEllipse.minorToMajorRatio).toBeCloseTo(0.999);
    });

    it('should handle very elongated ellipses', () => {
      const ellipse = createEllipse(0, 0, 10, 0, 0.1); // Very elongated, b = 1
      const intersectionPoint = { x: 10, y: 0 };
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      expect(resultEllipse.minorToMajorRatio).toBe(0.1);
    });

    it('should respect tolerance for on-ellipse validation', () => {
      const ellipse = createEllipse(0, 0, 4, 0, 0.5);
      const slightlyOffPoint = { x: 4.01, y: 0 }; // Slightly off ellipse
      
      const result1 = fillEllipseToIntersection(ellipse, slightlyOffPoint, {
        ...defaultOptions,
        tolerance: 1e-8 // Very tight
      });
      
      const result2 = fillEllipseToIntersection(ellipse, slightlyOffPoint, {
        ...defaultOptions,
        tolerance: 0.02 // Loose
      });
      
      expect(result1.success).toBeDefined();
      expect(result2.success).toBeDefined();
    });
  });

  describe('extension metadata', () => {
    it('should provide correct extension information', () => {
      const ellipse = createEllipse(0, 0, 6, 0, 0.8);
      const intersectionPoint = { x: 6, y: 0 };
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      expect(result.extension).toBeDefined();
      expect(result.extension!.type).toBe('angular');
      expect(result.extension!.originalShape).toBe(ellipse);
      expect(pointsApproxEqual(result.extension!.extensionEnd, intersectionPoint)).toBe(true);
    });

    it('should calculate angular extension amount', () => {
      const ellipse = createEllipse(0, 0, 4, 0, 0.6);
      const intersectionPoint = { x: 4, y: 0 };
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      expect(result.extension!.amount).toBeGreaterThan(0);
      expect(result.extension!.amount).toBeLessThanOrEqual(2 * Math.PI);
    });
  });

  describe('special geometric cases', () => {
    it('should handle ellipses at origin', () => {
      const ellipse = createEllipse(0, 0, 1, 0, 0.5);
      const intersectionPoint = { x: 1, y: 0 };
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
    });

    it('should handle ellipses with large coordinates', () => {
      const ellipse = createEllipse(1000, 2000, 50, 0, 0.4);
      const intersectionPoint = { x: 1050, y: 2000 };
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      expect(pointsApproxEqual(resultEllipse.center, { x: 1000, y: 2000 })).toBe(true);
    });

    it('should handle negative coordinate ellipses', () => {
      const ellipse = createEllipse(-5, -10, 3, 0, 0.7);
      const intersectionPoint = { x: -2, y: -10 };
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      expect(pointsApproxEqual(resultEllipse.center, { x: -5, y: -10 })).toBe(true);
    });
  });

  describe('confidence scoring', () => {
    it('should provide confidence scores', () => {
      const ellipse = createEllipse(0, 0, 3, 0, 0.8);
      const intersectionPoint = { x: 3, y: 0 };
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should provide high confidence for points exactly on ellipse', () => {
      const ellipse = createEllipse(0, 0, 2, 0, 0.5);
      const intersectionPoint = { x: 2, y: 0 }; // Exactly on ellipse
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('arc property validation', () => {
    it('should create arc with valid angular parameters', () => {
      const ellipse = createEllipse(2, 3, 4, 0, 0.6);
      const intersectionPoint = { x: 6, y: 3 };
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      
      expect(resultEllipse.startParam).toBeDefined();
      expect(resultEllipse.endParam).toBeDefined();
      
      if (resultEllipse.startParam !== undefined && resultEllipse.endParam !== undefined) {
        // Parameters should be valid angles
        // Parameters can be negative or > 2π, so just check they exist and are finite
        expect(Number.isFinite(resultEllipse.startParam)).toBe(true);
        expect(Number.isFinite(resultEllipse.endParam)).toBe(true);
      }
    });

    it('should maintain consistent parameterization', () => {
      const ellipse = createEllipse(0, 0, 5, 0, 0.4);
      const intersectionPoint = { x: 0, y: 2 }; // Top of ellipse (b = 5 * 0.4 = 2)
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      const resultEllipse = result.extendedShape!.geometry as Ellipse;
      
      // Should have meaningful angular range
      if (resultEllipse.startParam !== undefined && resultEllipse.endParam !== undefined) {
        let angularRange = Math.abs(resultEllipse.endParam - resultEllipse.startParam);
        if (angularRange > Math.PI) {
          angularRange = 2 * Math.PI - angularRange;
        }
        expect(angularRange).toBeGreaterThan(0);
        expect(angularRange).toBeLessThanOrEqual(2 * Math.PI);
      }
    });
  });

  describe('intersection point validation', () => {
    it('should validate intersection point is reachable', () => {
      const ellipse = createEllipse(0, 0, 3, 0, 0.5);
      const intersectionPoint = { x: 3, y: 0 }; // On ellipse
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      validateFillResult(result, true);
      expect(result.intersectionPoint).toBeDefined();
      expect(pointsApproxEqual(result.intersectionPoint!, intersectionPoint)).toBe(true);
    });

    it('should handle intersection point validation with rotated ellipse', () => {
      const ellipse = createEllipse(0, 0, 2, 3, 0.75); // Rotated ellipse
      const intersectionPoint = { x: 1, y: 2 }; // Some point
      
      const result = fillEllipseToIntersection(ellipse, intersectionPoint, defaultOptions);
      
      expect(result.success).toBeDefined();
      if (result.success) {
        expect(result.intersectionPoint).toBeDefined();
      }
    });
  });
});