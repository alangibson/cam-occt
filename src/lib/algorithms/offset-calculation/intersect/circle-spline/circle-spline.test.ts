import { describe, it, expect } from 'vitest';
import { findSplineCircleIntersectionsVerb } from './index';
import type { Shape, Circle, Spline } from '../../../../../lib/types/geometry';

describe('Circle-Spline Intersection with Extensions', () => {
  it('should find intersection when spline is extended', () => {
    // Create a circle at origin
    const circleShape: Shape = {
      id: 'circle1',
      type: 'circle',
      geometry: {
        center: { x: 0, y: 0 },
        radius: 50
      } as Circle
    };

    // Create a spline that doesn't intersect the circle but would if extended
    // The spline starts at (60, 0) and curves away, but if extended backward would hit the circle
    const splineShape: Shape = {
      id: 'spline1',
      type: 'spline',
      geometry: {
        controlPoints: [
          { x: 60, y: 0 },    // Start just outside the circle
          { x: 80, y: 20 },   // Control point
          { x: 100, y: 0 }    // End point
        ],
        degree: 2,
        knots: [0, 0, 0, 1, 1, 1],
        weights: [1, 1, 1],
        fitPoints: [],
        closed: false
      } as Spline
    };

    // Test without extensions - should find no intersections
    const noExtensionResults = findSplineCircleIntersectionsVerb(
      splineShape,
      circleShape,
      false,
      false,
      100
    );
    expect(noExtensionResults).toHaveLength(0);

    // Test with extensions - should find intersections
    const withExtensionResults = findSplineCircleIntersectionsVerb(
      splineShape,
      circleShape,
      false,
      true,
      100
    );
    
    // Should find at least one intersection where the extended spline meets the circle
    expect(withExtensionResults.length).toBeGreaterThan(0);
    
    // Verify the intersection is marked as being on an extension
    if (withExtensionResults.length > 0) {
      expect(withExtensionResults[0].onExtension).toBe(true);
      
      // The intersection point should be on the circle (within tolerance)
      const point = withExtensionResults[0].point;
      const distanceFromCenter = Math.sqrt(point.x * point.x + point.y * point.y);
      expect(Math.abs(distanceFromCenter - 50)).toBeLessThan(0.1);
    }
  });

  it('should find intersection on original shapes without needing extension', () => {
    // Create a circle at origin
    const circleShape: Shape = {
      id: 'circle1',
      type: 'circle',
      geometry: {
        center: { x: 0, y: 0 },
        radius: 50
      } as Circle
    };

    // Create a spline that passes through the circle
    const splineShape: Shape = {
      id: 'spline1',
      type: 'spline',
      geometry: {
        controlPoints: [
          { x: -60, y: 0 },   // Start outside
          { x: 0, y: 0 },     // Pass through center
          { x: 60, y: 0 }     // End outside
        ],
        degree: 2,
        knots: [0, 0, 0, 1, 1, 1],
        weights: [1, 1, 1],
        fitPoints: [],
        closed: false
      } as Spline
    };

    // Test with extensions enabled - should still find the original intersections
    const results = findSplineCircleIntersectionsVerb(
      splineShape,
      circleShape,
      false,
      true,
      100
    );
    
    // Should find intersections
    expect(results.length).toBeGreaterThan(0);
    
    // These should NOT be marked as extension intersections
    results.forEach(result => {
      expect(result.onExtension).toBe(false);
    });
  });

  it('should handle case where spline extension passes through circle center', () => {
    // Create a circle at (100, 100)
    const circleShape: Shape = {
      id: 'circle1',
      type: 'circle',
      geometry: {
        center: { x: 100, y: 100 },
        radius: 30
      } as Circle
    };

    // Create a straight spline that points toward the circle center when extended
    const splineShape: Shape = {
      id: 'spline1',
      type: 'spline',
      geometry: {
        controlPoints: [
          { x: 0, y: 0 },      // Start at origin
          { x: 50, y: 50 }     // End at (50, 50), pointing toward (100, 100)
        ],
        degree: 1,  // Linear spline
        knots: [0, 0, 1, 1],
        weights: [1, 1],
        fitPoints: [],
        closed: false
      } as Spline
    };

    // Test with extensions
    const results = findSplineCircleIntersectionsVerb(
      splineShape,
      circleShape,
      false,
      true,
      200  // Long enough extension to reach the circle
    );
    
    // Should find one intersection (system returns only one intersection per shape pair)
    expect(results.length).toBe(1);
    
    // Should be on extensions
    expect(results[0].onExtension).toBe(true);
    
    // Check that the point is on the circle
    const point = results[0].point;
    const dx: number = point.x - 100;
    const dy: number = point.y - 100;
    const distance: number = Math.sqrt(dx * dx + dy * dy);
    expect(Math.abs(distance - 30)).toBeLessThan(0.1);
  });
});