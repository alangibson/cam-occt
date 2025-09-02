import { describe, it, expect } from 'vitest';
import { translateToPositiveQuadrant } from './translate-to-positive';
import { polylineToPoints, polylineToVertices, createPolylineFromVertices } from '$lib/geometry/polyline';
import type { Shape } from '../../lib/types';
import type { Line, Circle, Arc, Polyline, Ellipse } from '../../lib/types/geometry';
import { CutDirection, LeadType } from '../types/direction';

describe('Translate to Positive Quadrant Algorithm', () => {
  describe('Basic Functionality', () => {
    it('should translate shapes with negative coordinates to positive quadrant', () => {
      const shapes: Shape[] = [
        {
          id: 'line1',
          type: LeadType.LINE,
          geometry: {
            start: { x: -10, y: -5 },
            end: { x: 0, y: 5 }
          }
        }
      ];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(1);
      const line: import("$lib/types/geometry").Line = result[0].geometry as Line;
      expect(line.start).toEqual({ x: 0, y: 0 }); // -10 + 10 = 0, -5 + 5 = 0
      expect(line.end).toEqual({ x: 10, y: 10 }); // 0 + 10 = 10, 5 + 5 = 10
    });

    it('should not translate shapes already in positive quadrant', () => {
      const shapes: Shape[] = [
        {
          id: 'line1',
          type: LeadType.LINE,
          geometry: {
            start: { x: 5, y: 10 },
            end: { x: 15, y: 20 }
          }
        }
      ];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(shapes[0]); // Should be unchanged
    });

    it('should translate only in X direction when only X is negative', () => {
      const shapes: Shape[] = [
        {
          id: 'line1',
          type: LeadType.LINE,
          geometry: {
            start: { x: -5, y: 10 },
            end: { x: 5, y: 20 }
          }
        }
      ];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(1);
      const line: import("$lib/types/geometry").Line = result[0].geometry as Line;
      expect(line.start).toEqual({ x: 0, y: 10 }); // Only X translated
      expect(line.end).toEqual({ x: 10, y: 20 });
    });

    it('should translate only in Y direction when only Y is negative', () => {
      const shapes: Shape[] = [
        {
          id: 'line1',
          type: LeadType.LINE,
          geometry: {
            start: { x: 5, y: -10 },
            end: { x: 15, y: 0 }
          }
        }
      ];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(1);
      const line: import("$lib/types/geometry").Line = result[0].geometry as Line;
      expect(line.start).toEqual({ x: 5, y: 0 }); // Only Y translated
      expect(line.end).toEqual({ x: 15, y: 10 });
    });
  });

  describe('Shape Types', () => {
    it('should translate circles correctly', () => {
      const shapes: Shape[] = [
        {
          id: 'circle1',
          type: 'circle',
          geometry: {
            center: { x: -5, y: -3 },
            radius: 2
          }
        }
      ];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(1);
      const circle: import("$lib/types/geometry").Circle = result[0].geometry as Circle;
      // Bounding box: center(-5,-3) ± radius(2) = min(-7,-5), max(-3,-1)
      // Translation: x+7, y+5
      expect(circle.center).toEqual({ x: 2, y: 2 }); // -5+7=2, -3+5=2
      expect(circle.radius).toBe(2);
    });

    it('should translate arcs correctly', () => {
      const shapes: Shape[] = [
        {
          id: 'arc1',
          type: LeadType.ARC,
          geometry: {
            center: { x: -10, y: -8 },
            radius: 3,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false
          }
        }
      ];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(1);
      const arc: import("$lib/types/geometry").Arc = result[0].geometry as Arc;
      // Bounding box: center(-10,-8) ± radius(3) = min(-13,-11), max(-7,-5)
      // Translation: x+13, y+11
      expect(arc.center).toEqual({ x: 3, y: 3 }); // -10+13=3, -8+11=3
      expect(arc.radius).toBe(3);
      expect(arc.startAngle).toBe(0);
      expect(arc.endAngle).toBe(Math.PI / 2);
      expect(arc.clockwise).toBe(false);
    });

    it('should translate polylines correctly', () => {
      // Create polyline using the new segments-based structure
      const polylineShape = createPolylineFromVertices([
        { x: -5, y: -10 },
        { x: 0, y: -5 },
        { x: 5, y: 0 }
      ], false);
      
      const shapes: Shape[] = [polylineShape];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(1);
      const polyline: import("$lib/types/geometry").Polyline = result[0].geometry as Polyline;
      // Min point: (-5, -10), translation: x+5, y+10
      const translatedPoints = polylineToPoints(polyline);
      expect(translatedPoints).toEqual([
        { x: 0, y: 0 },   // -5+5=0, -10+10=0
        { x: 5, y: 5 },   // 0+5=5, -5+10=5
        { x: 10, y: 10 }  // 5+5=10, 0+10=10
      ]);
      expect(polyline.closed).toBe(false);
    });

    it('should translate polylines with vertices (bulge data)', () => {
      // Create polyline using the new segments-based structure
      const polylineShape = createPolylineFromVertices([
          { x: -5, y: -10, bulge: 0.5 },
          { x: 0, y: -5, bulge: 0 }
        ], false);
      
      const shapes: Shape[] = [polylineShape];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(1);
      const polyline: import("$lib/types/geometry").Polyline = result[0].geometry as Polyline;
      const translatedVertices = polylineToVertices(polyline);
      expect(translatedVertices).toHaveLength(2);
      
      // Check first vertex with bulge preserved
      expect(translatedVertices[0].x).toBeCloseTo(0);
      expect(translatedVertices[0].y).toBeCloseTo(0);
      expect(translatedVertices[0].bulge).toBeCloseTo(0.5);
      
      // Check second vertex
      expect(translatedVertices[1].x).toBeCloseTo(5);
      expect(translatedVertices[1].y).toBeCloseTo(5);
      expect(translatedVertices[1].bulge).toBeCloseTo(0);
    });

    it('should translate ellipses correctly', () => {
      const shapes: Shape[] = [
        {
          id: 'ellipse1',
          type: 'ellipse',
          geometry: {
            center: { x: -8, y: -6 },
            majorAxisEndpoint: { x: 4, y: 0 }, // Vector, not translated
            minorToMajorRatio: 0.5
          }
        }
      ];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(1);
      const ellipse: import("$lib/types/geometry").Ellipse = result[0].geometry as Ellipse;
      // Major axis length = 4, minor = 2, max extent = 4
      // Bounding box: center(-8,-6) ± 4 = min(-12,-10), max(-4,-2)
      // Translation: x+12, y+10
      expect(ellipse.center).toEqual({ x: 4, y: 4 }); // -8+12=4, -6+10=4
      expect(ellipse.majorAxisEndpoint).toEqual({ x: 4, y: 0 }); // Vector unchanged
      expect(ellipse.minorToMajorRatio).toBe(0.5);
    });
  });

  describe('Multiple Shapes', () => {
    it('should translate multiple shapes by the same amount based on global minimum', () => {
      const shapes: Shape[] = [
        {
          id: 'line1',
          type: LeadType.LINE,
          geometry: {
            start: { x: -5, y: -3 },
            end: { x: 0, y: 0 }
          }
        },
        {
          id: 'circle1',
          type: 'circle',
          geometry: {
            center: { x: 10, y: -8 }, // Circle has most negative Y
            radius: 1
          }
        }
      ];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(2);
      
      // Global min: x=-5 (from line), y=-9 (from circle: -8-1=-9)
      // Translation: x+5, y+9
      
      const line: import("$lib/types/geometry").Line = result[0].geometry as Line;
      expect(line.start).toEqual({ x: 0, y: 6 }); // -5+5=0, -3+9=6
      expect(line.end).toEqual({ x: 5, y: 9 });   // 0+5=5, 0+9=9
      
      const circle: import("$lib/types/geometry").Circle = result[1].geometry as Circle;
      expect(circle.center).toEqual({ x: 15, y: 1 }); // 10+5=15, -8+9=1
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty shape array', () => {
      const result = translateToPositiveQuadrant([]);
      expect(result).toHaveLength(0);
    });

    it('should handle shapes at origin', () => {
      const shapes: Shape[] = [
        {
          id: 'line1',
          type: LeadType.LINE,
          geometry: {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 }
          }
        }
      ];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(shapes[0]); // Should be unchanged
    });

    it('should handle shapes with zero-size bounding box', () => {
      const shapes: Shape[] = [
        {
          id: 'line1',
          type: LeadType.LINE,
          geometry: {
            start: { x: -5, y: -5 },
            end: { x: -5, y: -5 } // Same point
          }
        }
      ];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(1);
      const line: import("$lib/types/geometry").Line = result[0].geometry as Line;
      expect(line.start).toEqual({ x: 0, y: 0 });
      expect(line.end).toEqual({ x: 0, y: 0 });
    });

    it('should preserve shape properties', () => {
      const shapes: Shape[] = [
        {
          id: 'line1',
          type: LeadType.LINE,
          geometry: {
            start: { x: -5, y: -5 },
            end: { x: 0, y: 0 }
          },
          layer: 'construction'
        }
      ];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('line1');
      expect(result[0].type).toBe('line');
      expect(result[0].layer).toBe('construction');
    });
  });

  describe('Precision', () => {
    it('should handle very small negative coordinates', () => {
      const shapes: Shape[] = [
        {
          id: 'line1',
          type: LeadType.LINE,
          geometry: {
            start: { x: -0.001, y: 5 },
            end: { x: 10, y: 15 }
          }
        }
      ];

      const result = translateToPositiveQuadrant(shapes);
      
      expect(result).toHaveLength(1);
      const line: import("$lib/types/geometry").Line = result[0].geometry as Line;
      expect(line.start.x).toBeCloseTo(0, 6); // Should be very close to 0
      expect(line.start.y).toBe(5); // Y unchanged
      expect(line.end.x).toBeCloseTo(10.001, 6);
      expect(line.end.y).toBe(15);
    });
  });
});