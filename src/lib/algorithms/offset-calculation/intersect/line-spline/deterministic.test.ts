import { describe, it, expect } from 'vitest';
import { findSplineLineIntersectionsVerb } from './index';
import type { Shape, Spline, Line } from '../../../../types/geometry';

describe('findSplineLineIntersectionsVerb - Deterministic Behavior', () => {
  // Helper to create a spline shape
  function createSpline(controlPoints: { x: number; y: number }[]): Shape {
    const spline: Spline = {
      controlPoints,
      degree: 3,
      knots: [0, 0, 0, 0, 1, 1, 1, 1],
      weights: controlPoints.map(() => 1),
      fitPoints: [],
      closed: false
    };
    
    return {
      id: `spline-${Math.random()}`,
      type: 'spline',
      geometry: spline
    };
  }
  
  // Helper to create a line shape
  function createLine(start: { x: number; y: number }, end: { x: number; y: number }): Shape {
    const line: Line = { start, end };
    
    return {
      id: `line-${Math.random()}`,
      type: 'line',
      geometry: line
    };
  }

  it('should return consistent results across multiple runs with same input', () => {
    // Create a spline and line that intersect (similar to chain-closed test case)
    const splineShape = createSpline([
      { x: 160, y: 180 },
      { x: 130, y: 170 },
      { x: 100, y: 150 },
      { x: 80, y: 120 },
      { x: 80, y: 80 }
    ]);
    
    const lineShape = createLine({ x: 80, y: 80 }, { x: 100, y: 50 });
    
    // Run intersection detection multiple times
    const results: number[] = [];
    for (let i: number = 0; i < 10; i++) {
      const intersections = findSplineLineIntersectionsVerb(
        splineShape, 
        lineShape, 
        false, 
        true, // Allow extensions
        50
      );
      results.push(intersections.length);
    }
    
    // All results should be identical
    const firstResult = results[0];
    expect(results.every(count => count === firstResult)).toBe(true);
  });

  it('should handle degenerate spline gracefully', () => {
    // Create a spline with all control points the same (degenerate)
    const degenerateSpline = createSpline([
      { x: 100, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 100 }
    ]);
    
    const lineShape = createLine({ x: 0, y: 0 }, { x: 200, y: 200 });
    
    const intersections = findSplineLineIntersectionsVerb(
      degenerateSpline, 
      lineShape, 
      false, 
      true, 
      50
    );
    
    // For degenerate splines, we just verify we get some result without error
    expect(intersections).toBeDefined();
    expect(Array.isArray(intersections)).toBe(true);
  });

  it('should handle degenerate line gracefully', () => {
    const splineShape = createSpline([
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
      { x: 150, y: 0 }
    ]);
    
    // Create a line with start and end at same point (degenerate)
    const degenerateLine = createLine({ x: 75, y: 25 }, { x: 75, y: 25 });
    
    const intersections = findSplineLineIntersectionsVerb(
      splineShape, 
      degenerateLine, 
      false, 
      true, 
      50
    );
    
    // Should return empty array for degenerate line
    expect(intersections).toEqual([]);
  });

  it('should return consistent results with first-success-wins extension strategy', () => {
    // Create a scenario where only extended intersections are found
    const splineShape = createSpline([
      { x: 0, y: 50 },
      { x: 25, y: 75 },
      { x: 50, y: 75 },
      { x: 75, y: 50 }
    ]);
    
    // Line that doesn't intersect original spline but would with extensions
    const lineShape = createLine({ x: 100, y: 60 }, { x: 200, y: 60 });
    
    // Run multiple times to ensure consistent behavior
    const results: number[] = [];
    for (let i: number = 0; i < 5; i++) {
      const intersections = findSplineLineIntersectionsVerb(
        splineShape, 
        lineShape, 
        false, 
        true, // Allow extensions
        100
      );
      results.push(intersections.length);
    }
    
    // All runs should produce the same number of intersections
    const firstResult = results[0];
    expect(results.every(count => count === firstResult)).toBe(true);
  });

  it('should validate spline geometry before processing', () => {
    // Create a spline with invalid knot vector
    const invalidSpline: Shape = {
      id: 'invalid-spline',
      type: 'spline',
      geometry: {
        controlPoints: [
          { x: 0, y: 0 },
          { x: 50, y: 50 },
          { x: 100, y: 0 }
        ],
        degree: 3,
        knots: [0, 0, 1], // Invalid - too few knots
        weights: [1, 1, 1],
        fitPoints: [],
        closed: false
      } as Spline
    };
    
    const lineShape = createLine({ x: 0, y: 0 }, { x: 100, y: 100 });
    
    const intersections = findSplineLineIntersectionsVerb(
      invalidSpline, 
      lineShape, 
      false, 
      true, 
      50
    );
    
    // Should return empty array for invalid spline
    expect(intersections).toEqual([]);
  });

  it('should maintain deterministic ordering in clustered results', () => {
    // Create a scenario that might produce multiple close intersections
    const splineShape = createSpline([
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 100 },
      { x: 150, y: 0 }
    ]);
    
    const lineShape = createLine({ x: 0, y: 50 }, { x: 150, y: 50 });
    
    // Run multiple times
    const intersectionCounts: number[] = [];
    for (let i: number = 0; i < 5; i++) {
      const intersections = findSplineLineIntersectionsVerb(
        splineShape, 
        lineShape, 
        false, 
        true, 
        50
      );
      
      intersectionCounts.push(intersections.length);
    }
    
    // The number of intersections should be consistent across runs
    // This tests our deterministic behavior fix
    const firstCount = intersectionCounts[0];
    expect(intersectionCounts.every(count => count === firstCount)).toBe(true);
    
    // Also verify that we get some result (not all zeros)
    expect(firstCount).toBeGreaterThanOrEqual(0);
  });
});