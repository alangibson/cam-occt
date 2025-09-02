import { describe, it, expect } from 'vitest';
import { findLineLineIntersections } from './index';
import type { Line } from '../../../../../lib/types/geometry';

describe('Line-Line Extension Intersections', () => {
  
  it('finds intersection between original lines', () => {
    const line1: Line = {
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 }
    };
    const line2: Line = {
      start: { x: 5, y: -5 },
      end: { x: 5, y: 5 }
    };
    
    const intersections = findLineLineIntersections(line1, line2);
    
    expect(intersections).toHaveLength(1);
    expect(intersections[0].point).toEqual({ x: 5, y: 0 });
    expect(intersections[0].onExtension).toBe(false);
  });

  it('finds gap intersection when extending both lines', () => {
    // Two lines that would intersect if extended
    const line1: Line = {
      start: { x: 0, y: 0 },
      end: { x: 5, y: 0 }  // stops at x=5
    };
    const line2: Line = {
      start: { x: 10, y: -5 },
      end: { x: 10, y: 5 }  // would intersect at (10, 0) if line1 extended
    };
    
    const intersections = findLineLineIntersections(line1, line2, false, true, 1000);
    
    expect(intersections).toHaveLength(1);
    expect(intersections[0].point).toEqual({ x: 10, y: 0 });
    expect(intersections[0].onExtension).toBe(true);
  });

  it('handles swapped parameters correctly', () => {
    const line1: Line = {
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 }
    };
    const line2: Line = {
      start: { x: 5, y: -5 },
      end: { x: 5, y: 5 }
    };
    
    const normal = findLineLineIntersections(line1, line2, false);
    const swapped = findLineLineIntersections(line1, line2, true);
    
    expect(normal[0].param1).toBe(swapped[0].param2);
    expect(normal[0].param2).toBe(swapped[0].param1);
  });

  it('removes duplicate intersections from extension attempts', () => {
    // Lines that already intersect normally
    const line1: Line = {
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 }
    };
    const line2: Line = {
      start: { x: 5, y: -5 },
      end: { x: 5, y: 5 }
    };
    
    // Even with extensions enabled, should only return one intersection
    const intersections = findLineLineIntersections(line1, line2, false, true, 1000);
    
    expect(intersections).toHaveLength(1);
    expect(intersections[0].onExtension).toBe(false);
  });

  it('finds intersection when first line needs extension', () => {
    const line1: Line = {
      start: { x: 0, y: 0 },
      end: { x: 3, y: 0 }  // short line
    };
    const line2: Line = {
      start: { x: 5, y: -2 },
      end: { x: 5, y: 2 }  // intersects extended line1 at (5,0)
    };
    
    const intersections = findLineLineIntersections(line1, line2, false, true, 1000);
    
    expect(intersections).toHaveLength(1);
    expect(intersections[0].point).toEqual({ x: 5, y: 0 });
    expect(intersections[0].onExtension).toBe(true);
  });

  it('finds intersection when second line needs extension', () => {
    const line1: Line = {
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 }
    };
    const line2: Line = {
      start: { x: 5, y: -2 },
      end: { x: 5, y: -1 }  // short line that doesn't reach line1
    };
    
    const intersections = findLineLineIntersections(line1, line2, false, true, 1000);
    
    expect(intersections).toHaveLength(1);
    expect(intersections[0].point).toEqual({ x: 5, y: 0 });
    expect(intersections[0].onExtension).toBe(true);
  });

  it('returns empty array when lines never intersect even with extensions', () => {
    const line1: Line = {
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 }  // horizontal line
    };
    const line2: Line = {
      start: { x: 0, y: 5 },
      end: { x: 10, y: 5 }  // parallel horizontal line
    };
    
    const intersections = findLineLineIntersections(line1, line2, false, true, 1000);
    
    expect(intersections).toHaveLength(0);
  });

  it('handles collinear overlapping lines with extensions', () => {
    const line1: Line = {
      start: { x: 0, y: 0 },
      end: { x: 5, y: 0 }
    };
    const line2: Line = {
      start: { x: 3, y: 0 },
      end: { x: 8, y: 0 }  // overlaps from x=3 to x=5
    };
    
    const intersections = findLineLineIntersections(line1, line2, false, true, 1000);
    
    expect(intersections.length).toBeGreaterThanOrEqual(1);
    // Should find overlap endpoints
    expect(intersections.some(i => i.point.x === 3 && i.point.y === 0)).toBe(true);
    expect(intersections.some(i => i.point.x === 5 && i.point.y === 0)).toBe(true);
  });

  it('handles vertical lines correctly', () => {
    const line1: Line = {
      start: { x: 0, y: 0 },
      end: { x: 0, y: 3 }  // vertical line, short
    };
    const line2: Line = {
      start: { x: -2, y: 5 },
      end: { x: 2, y: 5 }  // horizontal line above
    };
    
    const intersections = findLineLineIntersections(line1, line2, false, true, 1000);
    
    expect(intersections).toHaveLength(1);
    expect(intersections[0].point).toEqual({ x: 0, y: 5 });
    expect(intersections[0].onExtension).toBe(true);
  });

  it('respects extension length parameter', () => {
    const line1: Line = {
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 }  // very short line
    };
    const line2: Line = {
      start: { x: 1000, y: -1 },
      end: { x: 1000, y: 1 }  // far away vertical line
    };
    
    // With short extension, should not find intersection
    const shortExtension = findLineLineIntersections(line1, line2, false, true, 500);
    expect(shortExtension).toHaveLength(0);
    
    // With long extension, should find intersection
    const longExtension = findLineLineIntersections(line1, line2, false, true, 2000);
    expect(longExtension).toHaveLength(1);
    expect(longExtension[0].point).toEqual({ x: 1000, y: 0 });
  });
});