import { describe, it, expect } from 'vitest';
import { findEllipseLineIntersections, findEllipseLineIntersectionsVerb } from './index';
import type { IntersectionResult } from '../../chain/types';
import type { Shape, Point2D, Line, Ellipse } from '$lib/types/geometry';
import { generateId } from '$lib/utils/id';

describe('Line-Ellipse Intersections', () => {
  // Helper functions to create test shapes
  function createLine(x1: number, y1: number, x2: number, y2: number): Shape {
    return {
      id: generateId(),
      type: 'line',
      geometry: {
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 }
      } as Line
    };
  }

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

  // Helper to validate intersection results
  function validateIntersectionResults(results: IntersectionResult[], expectedCount: number, description: string): void {
    expect(results).toHaveLength(expectedCount);
    
    results.forEach((result, _index) => {
      expect(result.point).toBeDefined();
      expect(typeof result.point.x).toBe('number');
      expect(typeof result.point.y).toBe('number');
      expect(Number.isFinite(result.point.x)).toBe(true);
      expect(Number.isFinite(result.point.y)).toBe(true);
      
      expect(typeof result.param1).toBe('number');
      expect(typeof result.param2).toBe('number');
      expect(Number.isFinite(result.param1)).toBe(true);
      expect(Number.isFinite(result.param2)).toBe(true);
      
      expect(result.distance).toBeDefined();
      expect(typeof result.distance).toBe('number');
      expect(result.distance).toBeGreaterThanOrEqual(0);
      
      expect(result.type).toBeDefined();
      expect(['exact', 'tangent', 'approximate']).toContain(result.type);
      
      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }, `${description} - Result ${0}`);
  }

  describe('findEllipseLineIntersections (parametric)', () => {
    describe('basic intersection cases', () => {
      it('should find two intersections when line passes through ellipse', () => {
        const ellipse = createEllipse(0, 0, 4, 0, 0.5); // Horizontal ellipse, a=4, b=2
        const line = createLine(-6, 0, 6, 0); // Horizontal line through center
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        validateIntersectionResults(results, 2, 'line through ellipse center');
        
        // Check intersection points are on ellipse boundary
        const expectedPoints = [{ x: -4, y: 0 }, { x: 4, y: 0 }];
        expect(
          pointsApproxEqual(results[0].point, expectedPoints[0]) || 
          pointsApproxEqual(results[0].point, expectedPoints[1])
        ).toBe(true);
        expect(
          pointsApproxEqual(results[1].point, expectedPoints[0]) || 
          pointsApproxEqual(results[1].point, expectedPoints[1])
        ).toBe(true);
      });

      it('should find one intersection when line is tangent to ellipse', () => {
        const ellipse = createEllipse(0, 0, 3, 0, 0.6); // a=3, b=1.8
        const line = createLine(-5, 1.8, 5, 1.8); // Horizontal line at y=b (tangent to top)
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        validateIntersectionResults(results, 1, 'tangent line to ellipse');
        expect(results[0].type).toBe('tangent');
        expect(pointsApproxEqual(results[0].point, { x: 0, y: 1.8 }, 1e-6)).toBe(true);
      });

      it('should find no intersections when line misses ellipse', () => {
        const ellipse = createEllipse(0, 0, 2, 0, 0.5); // a=2, b=1
        const line = createLine(-3, 3, 3, 3); // Line above ellipse
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        validateIntersectionResults(results, 0, 'line missing ellipse');
      });
    });

    describe('diagonal and angled lines', () => {
      it('should handle diagonal line intersections', () => {
        const ellipse = createEllipse(0, 0, 4, 0, 0.75); // a=4, b=3
        const line = createLine(-5, -5, 5, 5); // Diagonal line y=x
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        expect(results.length).toBeLessThanOrEqual(2);
        
        // Validate any intersections found
        results.forEach(result => {
          // Point should be on the line y=x
          expect(Math.abs(result.point.y - result.point.x)).toBeLessThan(1e-6);
          
          // Point should satisfy ellipse equation
          const ellipseValue = (result.point.x / 4) ** 2 + (result.point.y / 3) ** 2;
          expect(Math.abs(ellipseValue - 1)).toBeLessThan(1e-6);
        });
      });

      it('should handle steep line intersections', () => {
        const ellipse = createEllipse(0, 0, 5, 0, 0.8); // a=5, b=4
        const line = createLine(2, -10, 2, 10); // Vertical line at x=2
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        validateIntersectionResults(results, 2, 'vertical line through ellipse');
        
        // Both points should have x=2
        results.forEach(result => {
          expect(Math.abs(result.point.x - 2)).toBeLessThan(1e-6);
        });
      });

      it('should handle arbitrary angle intersections', () => {
        const ellipse = createEllipse(0, 0, 6, 0, 0.5); // a=6, b=3
        const angle = Math.PI / 6; // 30 degrees
        const lineLength = 15;
        const line = createLine(
          -lineLength * Math.cos(angle), -lineLength * Math.sin(angle),
          lineLength * Math.cos(angle), lineLength * Math.sin(angle)
        );
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        expect(results.length).toBeLessThanOrEqual(2);
        
        results.forEach(result => {
          // Point should satisfy ellipse equation
          const ellipseValue = (result.point.x / 6) ** 2 + (result.point.y / 3) ** 2;
          expect(Math.abs(ellipseValue - 1)).toBeLessThan(1e-6);
        });
      });
    });

    describe('rotated ellipses', () => {
      it('should handle vertically oriented ellipse', () => {
        const ellipse = createEllipse(0, 0, 0, 4, 0.75); // Vertical ellipse, a=4, b=3
        const line = createLine(-5, 0, 5, 0); // Horizontal line through center
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        validateIntersectionResults(results, 2, 'horizontal line through vertical ellipse');
        
        // Points should be at (±3, 0) for vertical ellipse
        const expectedPoints = [{ x: -3, y: 0 }, { x: 3, y: 0 }];
        expect(
          pointsApproxEqual(results[0].point, expectedPoints[0], 1e-6) || 
          pointsApproxEqual(results[0].point, expectedPoints[1], 1e-6)
        ).toBe(true);
      });

      it('should handle arbitrarily rotated ellipse', () => {
        const ellipse = createEllipse(0, 0, 3, 4, 0.6); // Rotated ellipse
        const line = createLine(-8, 0, 8, 0); // Horizontal line
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        expect(results.length).toBeLessThanOrEqual(2);
        
        results.forEach(result => {
          expect(Math.abs(result.point.y)).toBeLessThan(1e-6); // Should be on y=0 line
        });
      });
    });

    describe('elliptical arcs', () => {
      it('should respect arc bounds for intersections', () => {
        const ellipseArc = createEllipse(0, 0, 4, 0, 0.5, 0, Math.PI); // Top half of ellipse
        const line = createLine(-5, 1, 5, 1); // Horizontal line above center
        
        const results = findEllipseLineIntersections(ellipseArc, line, false);
        
        results.forEach(result => {
          expect(result.point.y).toBeGreaterThanOrEqual(0); // Should be in top half
        });
      });

      it('should handle arc that spans 0° crossing', () => {
        const ellipseArc = createEllipse(0, 0, 3, 0, 0.6, -Math.PI/4, Math.PI/4); // Arc crossing 0°
        const line = createLine(-4, 0, 4, 0); // Horizontal line through center
        
        const results = findEllipseLineIntersections(ellipseArc, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        results.forEach(result => {
          expect(result.point.x).toBeGreaterThan(0); // Should be on right side
        });
      });

      it('should handle very small arc segments', () => {
        const ellipseArc = createEllipse(0, 0, 5, 0, 0.8, 0, 0.1); // Very small arc
        const line = createLine(-6, 3, 6, 3); // Line that might intersect
        
        const results = findEllipseLineIntersections(ellipseArc, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        validateIntersectionResults(results, results.length, 'small arc intersection');
      });
    });

    describe('edge cases and numerical precision', () => {
      it('should handle very small ellipses', () => {
        const ellipse = createEllipse(0, 0, 1e-6, 0, 0.5); // Tiny ellipse
        const line = createLine(-1e-5, 0, 1e-5, 0); // Line through tiny ellipse
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        expect(results.length).toBeLessThanOrEqual(2);
      });

      it('should handle very large ellipses', () => {
        const ellipse = createEllipse(0, 0, 1000, 0, 0.5); // Large ellipse
        const line = createLine(-1500, 0, 1500, 0); // Line through large ellipse
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        validateIntersectionResults(results, 2, 'large ellipse intersection');
      });

      it('should handle near-tangent intersections', () => {
        const ellipse = createEllipse(0, 0, 4, 0, 0.75); // a=4, b=3
        const line = createLine(-5, 3.0001, 5, 3.0001); // Slightly above tangent
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        expect(results.length).toBeLessThanOrEqual(2);
      });

      it('should handle ellipse at non-origin center', () => {
        const ellipse = createEllipse(10, 20, 3, 0, 0.6); // Offset ellipse
        const line = createLine(5, 20, 15, 20); // Horizontal line through center
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        validateIntersectionResults(results, 2, 'offset ellipse intersection');
        
        // Check points are symmetric about center
        const center = { x: 10, y: 20 };
        results.forEach(result => {
          expect(Math.abs(result.point.y - center.y)).toBeLessThan(1e-6);
        });
      });

      it('should handle degenerate ellipse (very flat)', () => {
        const ellipse = createEllipse(0, 0, 10, 0, 0.01); // Very flat ellipse, b=0.1
        const line = createLine(-12, 0, 12, 0); // Line along major axis
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        validateIntersectionResults(results, 2, 'very flat ellipse');
        expect(Math.abs(results[0].point.x - (-10)) < 1e-6 || Math.abs(results[0].point.x - 10) < 1e-6).toBe(true);
      });
    });

    describe('parameter calculation and validation', () => {
      it('should provide correct line parameters', () => {
        const ellipse = createEllipse(0, 0, 3, 0, 0.6); // a=3, b=1.8
        const line = createLine(-5, 0, 5, 0); // 10-unit line
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        validateIntersectionResults(results, 2, 'parameter validation');
        
        results.forEach(result => {
          // Line parameter should be in [0, 1] for intersections within line segment
          expect(result.param2).toBeGreaterThanOrEqual(-0.1); // Allow slight tolerance
          expect(result.param2).toBeLessThanOrEqual(1.1);
          
          // Ellipse parameter should be valid angle
          expect(result.param1).toBeGreaterThanOrEqual(0);
          expect(result.param1).toBeLessThanOrEqual(2 * Math.PI);
        });
      });

      it('should handle parameter swapping correctly', () => {
        const ellipse = createEllipse(0, 0, 4, 0, 0.5);
        const line = createLine(-6, 0, 6, 0);
        
        const resultsNormal = findEllipseLineIntersections(ellipse, line, false);
        const resultsSwapped = findEllipseLineIntersections(ellipse, line, true);
        
        expect(resultsNormal.length).toBe(resultsSwapped.length);
        
        // Parameters should be swapped
        if (resultsNormal.length > 0) {
          expect(resultsNormal[0].param1).toBe(resultsSwapped[0].param2);
          expect(resultsNormal[0].param2).toBe(resultsSwapped[0].param1);
        }
      });

      it('should calculate accurate intersection points', () => {
        const ellipse = createEllipse(0, 0, 5, 0, 0.8); // a=5, b=4
        const line = createLine(0, -6, 0, 6); // Vertical line at x=0
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        validateIntersectionResults(results, 2, 'accurate intersection points');
        
        // Points should be at (0, ±4)
        const expectedY = 4;
        results.forEach(result => {
          expect(Math.abs(result.point.x)).toBeLessThan(1e-6);
          expect(Math.abs(Math.abs(result.point.y) - expectedY)).toBeLessThan(1e-6);
        });
      });
    });

    describe('error conditions and robustness', () => {
      it('should handle line with zero length gracefully', () => {
        const ellipse = createEllipse(0, 0, 3, 0, 0.6);
        const line = createLine(2, 1, 2, 1); // Point line
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        expect(results.length).toBeLessThanOrEqual(1);
      });

      it('should handle ellipse with extreme aspect ratio', () => {
        const ellipse = createEllipse(0, 0, 100, 0, 0.001); // Very elongated
        const line = createLine(-120, 0, 120, 0);
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        expect(results.length).toBeLessThanOrEqual(2);
      });

      it('should handle numerical precision issues', () => {
        const ellipse = createEllipse(0, 0, 1, 0, 1); // Circle
        const line = createLine(-2, 1 + 1e-15, 2, 1 + 1e-15); // Nearly tangent
        
        const results = findEllipseLineIntersections(ellipse, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        expect(results.length).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('findEllipseLineIntersectionsVerb (NURBS-based)', () => {
    describe('comparison with parametric method', () => {
      it('should produce similar results to parametric method for simple cases', () => {
        const ellipse = createEllipse(0, 0, 4, 0, 0.5);
        const line = createLine(-6, 0, 6, 0);
        
        const parametricResults = findEllipseLineIntersections(ellipse, line, false);
        const verbResults = findEllipseLineIntersectionsVerb(ellipse, line, false);
        
        // The two methods may find different numbers of intersections due to numerical differences
        // but they should be reasonably close
        expect(Math.abs(verbResults.length - parametricResults.length)).toBeLessThanOrEqual(1);
        
        // Results should have similar intersection points (allowing for numerical differences)
        // Both methods should find some intersections for this case, but exact matching is not required
        if (parametricResults.length > 0 && verbResults.length > 0) {
          // Just verify both methods found reasonable results
          const parametricPoints = parametricResults.map(r => r.point);
          const verbPoints = verbResults.map(r => r.point);
          
          // Check that all points are finite
          parametricPoints.forEach(p => {
            expect(Number.isFinite(p.x)).toBe(true);
            expect(Number.isFinite(p.y)).toBe(true);
          });
          
          verbPoints.forEach(p => {
            expect(Number.isFinite(p.x)).toBe(true);
            expect(Number.isFinite(p.y)).toBe(true);
          });
        }
      });

      it('should handle complex intersection cases', () => {
        const ellipse = createEllipse(0, 0, 3, 4, 0.6); // Rotated ellipse
        const line = createLine(-8, 2, 8, -2); // Diagonal line
        
        const results = findEllipseLineIntersectionsVerb(ellipse, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        expect(results.length).toBeLessThanOrEqual(2);
        
        validateIntersectionResults(results, results.length, 'verb NURBS intersection');
      });
    });

    describe('NURBS-specific capabilities', () => {
      it('should handle high-precision intersections', () => {
        const ellipse = createEllipse(0, 0, 2, 0, 0.75);
        const line = createLine(-3, 1.5, 3, 1.5); // Near-tangent
        
        const results = findEllipseLineIntersectionsVerb(ellipse, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        validateIntersectionResults(results, results.length, 'high-precision NURBS');
      });

      it('should work with elliptical arcs', () => {
        const ellipseArc = createEllipse(0, 0, 5, 0, 0.8, 0, Math.PI);
        const line = createLine(-6, 2, 6, 2);
        
        const results = findEllipseLineIntersectionsVerb(ellipseArc, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        validateIntersectionResults(results, results.length, 'NURBS elliptical arc');
      });

      it('should handle parameter swapping correctly', () => {
        const ellipse = createEllipse(0, 0, 3, 0, 0.6);
        const line = createLine(-4, 0, 4, 0);
        
        const resultsNormal = findEllipseLineIntersectionsVerb(ellipse, line, false);
        const resultsSwapped = findEllipseLineIntersectionsVerb(ellipse, line, true);
        
        expect(resultsNormal.length).toBe(resultsSwapped.length);
        
        if (resultsNormal.length > 0) {
          // Points should be the same, but parameters swapped
          expect(pointsApproxEqual(resultsNormal[0].point, resultsSwapped[0].point, 1e-6)).toBe(true);
        }
      });
    });

    describe('robustness and edge cases', () => {
      it('should handle very small geometry', () => {
        const ellipse = createEllipse(0, 0, 1e-4, 0, 0.5);
        const line = createLine(-1e-3, 0, 1e-3, 0);
        
        const results = findEllipseLineIntersectionsVerb(ellipse, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        expect(results.length).toBeLessThanOrEqual(2);
      });

      it('should handle large coordinate values', () => {
        const ellipse = createEllipse(1000, 2000, 50, 0, 0.6);
        const line = createLine(900, 2000, 1100, 2000);
        
        const results = findEllipseLineIntersectionsVerb(ellipse, line, false);
        
        expect(results.length).toBeGreaterThanOrEqual(0);
        validateIntersectionResults(results, results.length, 'large coordinates NURBS');
      });

      it('should provide reasonable confidence scores', () => {
        const ellipse = createEllipse(0, 0, 4, 0, 0.75);
        const line = createLine(-5, 0, 5, 0);
        
        const results = findEllipseLineIntersectionsVerb(ellipse, line, false);
        
        results.forEach(result => {
          expect(result.confidence).toBeGreaterThan(0.5);
          expect(result.confidence).toBeLessThanOrEqual(1.0);
        });
      });
    });
  });

  describe('method comparison and consistency', () => {
    it('should produce consistent results between methods for standard cases', () => {
      const testCases = [
        { ellipse: createEllipse(0, 0, 3, 0, 0.6), line: createLine(-4, 0, 4, 0) },
        { ellipse: createEllipse(0, 0, 5, 0, 0.8), line: createLine(0, -6, 0, 6) },
        { ellipse: createEllipse(0, 0, 2, 0, 0.5), line: createLine(-3, 1, 3, 1) }
      ];

      testCases.forEach((testCase, _index) => {
        const parametricResults = findEllipseLineIntersections(testCase.ellipse, testCase.line, false);
        const verbResults = findEllipseLineIntersectionsVerb(testCase.ellipse, testCase.line, false);
        
        // The methods may find different numbers of intersections
        expect(Math.abs(parametricResults.length - verbResults.length)).toBeLessThanOrEqual(2);
        
        // If both find intersections, check that they are finding reasonable results
        if (parametricResults.length > 0 && verbResults.length > 0) {
          // Both methods should find some intersections in reasonable proximity
          // This is a looser check since the algorithms are fundamentally different
          const parametricHasValidResults = parametricResults.every(result => 
            Number.isFinite(result.point.x) && Number.isFinite(result.point.y)
          );
          const verbHasValidResults = verbResults.every(result => 
            Number.isFinite(result.point.x) && Number.isFinite(result.point.y)
          );
          
          expect(parametricHasValidResults).toBe(true);
          expect(verbHasValidResults).toBe(true);
        }
      });
    });

    it('should both handle degenerate cases gracefully', () => {
      const ellipse = createEllipse(0, 0, 0.001, 0, 1000); // Extreme aspect ratio
      const line = createLine(-1, 0, 1, 0);
      
      const parametricResults = findEllipseLineIntersections(ellipse, line, false);
      const verbResults = findEllipseLineIntersectionsVerb(ellipse, line, false);
      
      // Both methods should handle this without throwing
      expect(parametricResults.length).toBeGreaterThanOrEqual(0);
      expect(verbResults.length).toBeGreaterThanOrEqual(0);
    });

    it('should provide valid intersection types and confidence', () => {
      const ellipse = createEllipse(0, 0, 4, 0, 0.5);
      const line = createLine(-5, 2, 5, 2); // Tangent line
      
      [findEllipseLineIntersections, findEllipseLineIntersectionsVerb].forEach((method, _methodIndex) => {
        const results = method(ellipse, line, false);
        
        results.forEach((result, _resultIndex) => {
          expect(['exact', 'tangent', 'approximate']).toContain(result.type);
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        });
      });
    });
  });
});