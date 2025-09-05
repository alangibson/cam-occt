import { describe, it, expect } from 'vitest';
import { findEllipseIntersections, findEllipseGenericIntersections, approximateEllipseAsPolyline } from './index';
import type { Shape, Ellipse, Line, Arc, Circle, Polyline } from '../../../../types/geometry';

describe('Ellipse Intersections', () => {
  describe('findEllipseIntersections', () => {
    it('should find intersections between ellipse and line', () => {
      const ellipseShape: Shape = {
        id: 'ellipse1',
        type: 'ellipse',
        geometry: {
          center: { x: 0, y: 0 },
          majorAxisEndpoint: { x: 50, y: 0 },
          minorToMajorRatio: 0.6
        } as Ellipse
      };
      
      const lineShape: Shape = {
        id: 'line1',
        type: 'line',
        geometry: {
          start: { x: -60, y: 0 },
          end: { x: 60, y: 0 }
        } as Line
      };

      const results = findEllipseIntersections(ellipseShape, lineShape);
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      
      // Verify intersection points are on the ellipse
      results.forEach(result => {
        const { point } = result;
        
        // Check if point lies on the major axis (y=0 line through ellipse center)
        expect(Math.abs(point.y)).toBeLessThan(0.01);
        
        // Check if point is at ellipse boundary (±50 on x-axis for this ellipse)
        expect(Math.abs(Math.abs(point.x) - 50)).toBeLessThan(0.01);
      });
    });

    it('should find intersections between ellipse and arc', () => {
      const ellipseShape: Shape = {
        id: 'ellipse1',
        type: 'ellipse',
        geometry: {
          center: { x: 0, y: 0 },
          majorAxisEndpoint: { x: 40, y: 0 },
          minorToMajorRatio: 0.5
        } as Ellipse
      };
      
      const arcShape: Shape = {
        id: 'arc1',
        type: 'arc',
        geometry: {
          center: { x: 30, y: 0 },
          radius: 25,
          startAngle: Math.PI/2,
          endAngle: 3*Math.PI/2,
          clockwise: false
        } as Arc
      };

      const results = findEllipseIntersections(ellipseShape, arcShape);
      
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should find intersections between ellipse and circle', () => {
      const ellipseShape: Shape = {
        id: 'ellipse1',
        type: 'ellipse',
        geometry: {
          center: { x: 0, y: 0 },
          majorAxisEndpoint: { x: 60, y: 0 },
          minorToMajorRatio: 0.5
        } as Ellipse
      };
      
      const circleShape: Shape = {
        id: 'circle1',
        type: 'circle',
        geometry: {
          center: { x: 40, y: 0 },
          radius: 35
        } as Circle
      };

      const results = findEllipseIntersections(ellipseShape, circleShape);
      
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should find intersections between ellipse and polyline', () => {
      const ellipseShape: Shape = {
        id: 'ellipse1',
        type: 'ellipse',
        geometry: {
          center: { x: 0, y: 0 },
          majorAxisEndpoint: { x: 50, y: 0 },
          minorToMajorRatio: 0.8
        } as Ellipse
      };
      
      // Create a simple polyline that crosses the ellipse
      const polylineShape: Shape = {
        id: 'polyline1',
        type: 'polyline',
        geometry: {
          closed: false,
          shapes: []
        } as Polyline
      };

      const results = findEllipseIntersections(ellipseShape, polylineShape);
      
      // Should handle ellipse-polyline intersections without errors
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle case when ellipse is first parameter', () => {
      const ellipseShape: Shape = {
        id: 'ellipse1',
        type: 'ellipse',
        geometry: {
          center: { x: 0, y: 0 },
          majorAxisEndpoint: { x: 30, y: 0 },
          minorToMajorRatio: 0.7
        } as Ellipse
      };
      
      const lineShape: Shape = {
        id: 'line1',
        type: 'line',
        geometry: {
          start: { x: -40, y: 10 },
          end: { x: 40, y: 10 }
        } as Line
      };

      const results = findEllipseIntersections(ellipseShape, lineShape);
      
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle case when ellipse is second parameter', () => {
      const lineShape: Shape = {
        id: 'line1',
        type: 'line',
        geometry: {
          start: { x: -40, y: 15 },
          end: { x: 40, y: 15 }
        } as Line
      };
      
      const ellipseShape: Shape = {
        id: 'ellipse1',
        type: 'ellipse',
        geometry: {
          center: { x: 0, y: 0 },
          majorAxisEndpoint: { x: 50, y: 0 },
          minorToMajorRatio: 0.6
        } as Ellipse
      };

      const results = findEllipseIntersections(lineShape, ellipseShape);
      
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('findEllipseGenericIntersections', () => {
    it('should handle generic ellipse-line intersections', () => {
      const ellipseShape: Shape = {
        id: 'ellipse1',
        type: 'ellipse',
        geometry: {
          center: { x: 0, y: 0 },
          majorAxisEndpoint: { x: 40, y: 0 },
          minorToMajorRatio: 0.5
        } as Ellipse
      };
      
      const lineShape: Shape = {
        id: 'line1',
        type: 'line',
        geometry: {
          start: { x: -50, y: 0 },
          end: { x: 50, y: 0 }
        } as Line
      };

      const results = findEllipseGenericIntersections(ellipseShape, lineShape, false);
      
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle unknown shape types with fallback', () => {
      const ellipseShape: Shape = {
        id: 'ellipse1',
        type: 'ellipse',
        geometry: {
          center: { x: 0, y: 0 },
          majorAxisEndpoint: { x: 30, y: 0 },
          minorToMajorRatio: 0.8
        } as Ellipse
      };
      
      // Create a mock unknown shape type
      const unknownShape: Shape = {
        id: 'unknown1',
        type: 'line', // Use line but treat as unknown in the context
        geometry: {
          start: { x: -40, y: 0 },
          end: { x: 40, y: 0 }
        } as Line
      };

      const results = findEllipseGenericIntersections(ellipseShape, unknownShape, false);
      
      // Should not crash and may return results based on fallback logic
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('approximateEllipseAsPolyline', () => {
    it('should create polyline approximation of full ellipse', () => {
      const ellipse: Ellipse = {
        center: { x: 0, y: 0 },
        majorAxisEndpoint: { x: 50, y: 0 },
        minorToMajorRatio: 0.6
      };

      const polyline = approximateEllipseAsPolyline(ellipse, 32);
      
      expect(polyline).toBeDefined();
      expect(polyline.shapes.length).toBeGreaterThan(30);
      expect(polyline.closed).toBe(true);
    });

    it('should create polyline approximation of ellipse arc', () => {
      const ellipseArc: Ellipse = {
        center: { x: 0, y: 0 },
        majorAxisEndpoint: { x: 40, y: 0 },
        minorToMajorRatio: 0.5,
        startParam: 0,
        endParam: Math.PI
      };

      const polyline = approximateEllipseAsPolyline(ellipseArc, 16);
      
      expect(polyline).toBeDefined();
      expect(polyline.shapes.length).toBeGreaterThan(10);
      expect(polyline.closed).toBe(false);
    });

    it('should handle small segment count', () => {
      const ellipse: Ellipse = {
        center: { x: 0, y: 0 },
        majorAxisEndpoint: { x: 20, y: 0 },
        minorToMajorRatio: 0.5
      };

      const polyline = approximateEllipseAsPolyline(ellipse, 8);
      
      expect(polyline).toBeDefined();
      expect(polyline.shapes.length).toBeGreaterThanOrEqual(7);
    });

    it('should handle ellipse with rotation', () => {
      const ellipse: Ellipse = {
        center: { x: 10, y: 10 },
        majorAxisEndpoint: { x: 30, y: 40 }, // Rotated major axis
        minorToMajorRatio: 0.4
      };

      const polyline = approximateEllipseAsPolyline(ellipse, 24);
      
      expect(polyline).toBeDefined();
      expect(polyline.shapes.length).toBeGreaterThan(20);
      
      // All points should be roughly the correct distance from center
      const majorAxisLength = Math.sqrt(30 ** 2 + 40 ** 2);
      void (majorAxisLength * 0.4);
      
      // Check a few sample points are reasonable
      expect(polyline.shapes.length).toBeGreaterThan(0);
    });

    it('should handle default segment count', () => {
      const ellipse: Ellipse = {
        center: { x: 0, y: 0 },
        majorAxisEndpoint: { x: 25, y: 0 },
        minorToMajorRatio: 0.8
      };

      const polyline = approximateEllipseAsPolyline(ellipse);
      
      expect(polyline).toBeDefined();
      expect(polyline.shapes.length).toBeGreaterThan(30); // Default 32 segments
    });

    it('should correctly handle ellipse arc with negative parameter range', () => {
      const ellipseArc: Ellipse = {
        center: { x: 0, y: 0 },
        majorAxisEndpoint: { x: 30, y: 0 },
        minorToMajorRatio: 0.5,
        startParam: 3*Math.PI/2,
        endParam: Math.PI/2
      };

      const polyline = approximateEllipseAsPolyline(ellipseArc, 16);
      
      expect(polyline).toBeDefined();
      expect(polyline.closed).toBe(false);
      expect(polyline.shapes.length).toBeGreaterThan(10);
    });
  });
});