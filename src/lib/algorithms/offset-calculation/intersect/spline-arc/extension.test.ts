import { describe, test, expect } from 'vitest';
import { findSplineArcIntersectionsVerb } from './index';
import type { Shape, Spline, Arc } from '../../../../types/geometry';

describe('Spline-Arc Extension Intersections', () => {
  test('should find intersection with extended spline', () => {
    // Create a simple linear spline that doesn't reach the arc
    const spline: Spline = {
      degree: 1,
      controlPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      knots: [0, 0, 1, 1],
      weights: [1, 1]
    };
    
    const splineShape: Shape = {
      type: 'spline',
      geometry: spline
    };
    
    // Arc positioned away from the spline, centered at x=20
    const arc: Arc = {
      center: { x: 20, y: 0 },
      radius: 5,
      startAngle: 0,
      endAngle: 2 * Math.PI,
      clockwise: false
    };
    
    const arcShape: Shape = {
      type: 'arc',
      geometry: arc
    };
    
    // Without extensions - should find no intersections
    const noExtensions = findSplineArcIntersectionsVerb(splineShape, arcShape, false, false);
    expect(noExtensions).toHaveLength(0);
    
    // With extensions - should find intersection where extended spline meets arc
    const withExtensions = findSplineArcIntersectionsVerb(splineShape, arcShape, false, true, 1000);
    expect(withExtensions.length).toBeGreaterThan(0);
    
    // Verify the intersection is marked as being on an extension
    const intersection = withExtensions[0];
    expect(intersection.onExtension).toBe(true);
  });

  test('should find intersection with extended arc', () => {
    // Use the same working geometry from our debug test
    const spline: Spline = {
      degree: 1,
      controlPoints: [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      knots: [0, 0, 1, 1],
      weights: [1, 1]
    };
    
    const splineShape: Shape = {
      type: 'spline',
      geometry: spline
    };
    
    // Small arc that should intersect spline when extended
    const arc: Arc = {
      center: { x: 15, y: 5 },
      radius: 5,
      startAngle: Math.PI,      // 180 degrees - left side
      endAngle: Math.PI * 1.1,  // 198 degrees - small portion
      clockwise: false
    };
    
    const arcShape: Shape = {
      type: 'arc',
      geometry: arc
    };
    
    // Without extensions - should find no intersections (small arc doesn't reach horizontal line at y=0)
    const noExtensions = findSplineArcIntersectionsVerb(splineShape, arcShape, false, false);
    expect(noExtensions).toHaveLength(0);
    
    // With extensions - should find intersection where extended arc meets spline
    const withExtensions = findSplineArcIntersectionsVerb(splineShape, arcShape, false, true, 20);
    expect(withExtensions.length).toBeGreaterThan(0);
    
    // Verify the intersection is marked as being on an extension
    const intersection = withExtensions[0];
    expect(intersection.onExtension).toBe(true);
  });

  test('should find intersection with both extended shapes', () => {
    // Create a short horizontal spline that needs extension
    const spline: Spline = {
      degree: 1,
      controlPoints: [
        { x: 0, y: 0 },
        { x: 8, y: 0 }
      ],
      knots: [0, 0, 1, 1],
      weights: [1, 1]
    };
    
    const splineShape: Shape = {
      type: 'spline',
      geometry: spline
    };
    
    // Small arc positioned away from the short spline - both need extension to intersect
    const arc: Arc = {
      center: { x: 15, y: 5 },
      radius: 5,
      startAngle: Math.PI,      // 180 degrees - left side
      endAngle: Math.PI * 1.1,  // 198 degrees - small portion
      clockwise: false
    };
    
    const arcShape: Shape = {
      type: 'arc',
      geometry: arc
    };
    
    // Without extensions - should find no intersections
    const noExtensions = findSplineArcIntersectionsVerb(splineShape, arcShape, false, false);
    expect(noExtensions).toHaveLength(0);
    
    // With extensions - should find intersection where both shapes are extended
    const withExtensions = findSplineArcIntersectionsVerb(splineShape, arcShape, false, true, 20);
    expect(withExtensions.length).toBeGreaterThan(0);
    
    // Verify the intersection is marked as being on an extension
    const intersection = withExtensions[0];
    expect(intersection.onExtension).toBe(true);
  });

  test('should return original intersections when they exist', () => {
    // Create a spline that intersects with the arc normally
    const spline: Spline = {
      degree: 1,
      controlPoints: [
        { x: 5, y: 5 },
        { x: 25, y: 5 }
      ],
      knots: [0, 0, 1, 1],
      weights: [1, 1]
    };
    
    const splineShape: Shape = {
      type: 'spline',
      geometry: spline
    };
    
    // Arc that intersects the spline
    const arc: Arc = {
      center: { x: 15, y: 5 },
      radius: 5,
      startAngle: 0,
      endAngle: 2 * Math.PI,
      clockwise: false
    };
    
    const arcShape: Shape = {
      type: 'arc',
      geometry: arc
    };
    
    // Should find intersections (spline passes through circle)
    const intersections = findSplineArcIntersectionsVerb(splineShape, arcShape, false, true, 1000);
    expect(intersections.length).toBeGreaterThan(0);
    
    // These should not be marked as extensions since they exist on original shapes
    intersections.forEach(intersection => {
      expect(intersection.onExtension || false).toBe(false);
    });
  });
});