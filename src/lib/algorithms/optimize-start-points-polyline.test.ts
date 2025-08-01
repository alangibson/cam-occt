import { describe, it, expect } from 'vitest';
import { optimizeStartPoints } from './optimize-start-points';
import type { Shape } from '../../types';
import type { ShapeChain } from './chain-detection';
import { CutDirection, LeadType } from '../types/direction';

describe('optimizeStartPoints - polyline splitting', () => {
  const tolerance = 0.1;

  it('should split a 2-point polyline at its midpoint', () => {
    const shapes: Shape[] = [
      {
        id: 'polyline1',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 }
          ],
          closed: false
        }
      },
      {
        id: 'polyline2',
        type: 'polyline',
        geometry: {
          points: [
            { x: 10, y: 0 },
            { x: 0, y: 0 }
          ],
          closed: false
        }
      }
    ];

    const chain: ShapeChain = {
      id: 'chain1',
      shapes
    };

    const result = optimizeStartPoints([chain], tolerance);
    
    // Should have 3 shapes (2 original minus 1 + 2 split halves)
    expect(result.length).toBe(3);
    
    // Find the split polyline pieces
    const splitPieces = result.filter(s => s.id.includes('polyline1-split'));
    expect(splitPieces.length).toBe(2);
    
    // Check the midpoint is at (5, 0)
    const firstHalf = splitPieces.find(s => s.id.includes('split-1'));
    const secondHalf = splitPieces.find(s => s.id.includes('split-2'));
    
    const firstGeom = firstHalf!.geometry as any;
    const secondGeom = secondHalf!.geometry as any;
    
    // First half: (0,0) to (5,0)
    expect(firstGeom.points[0]).toEqual({ x: 0, y: 0 });
    expect(firstGeom.points[1].x).toBeCloseTo(5);
    expect(firstGeom.points[1].y).toBeCloseTo(0);
    
    // Second half: (5,0) to (10,0)
    expect(secondGeom.points[0].x).toBeCloseTo(5);
    expect(secondGeom.points[0].y).toBeCloseTo(0);
    expect(secondGeom.points[1]).toEqual({ x: 10, y: 0 });
  });

  it('should split a multi-point polyline at its path midpoint', () => {
    // Create a polyline that forms an L shape
    const shapes: Shape[] = [
      {
        id: 'L-polyline',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 }
          ],
          closed: false
        }
      },
      {
        id: 'closing-line',
        type: LeadType.LINE,
        geometry: {
          start: { x: 10, y: 10 },
          end: { x: 0, y: 0 }
        }
      }
    ];

    const chain: ShapeChain = {
      id: 'L-chain',
      shapes
    };

    const result = optimizeStartPoints([chain], tolerance);
    
    // The line will be preferred over the 3-point polyline
    const splitLines = result.filter(s => s.id.includes('closing-line-split'));
    expect(splitLines.length).toBe(2);
    
    // The line from (10,10) to (0,0) has length √200 ≈ 14.14
    // Midpoint would be at (5, 5)
    const firstHalf = splitLines.find(s => s.id.includes('split-1'));
    const secondHalf = splitLines.find(s => s.id.includes('split-2'));
    
    const firstGeom = firstHalf!.geometry as any;
    const secondGeom = secondHalf!.geometry as any;
    
    // First half should go from (10,10) to (5,5)
    expect(firstGeom.start).toEqual({ x: 10, y: 10 });
    expect(firstGeom.end.x).toBeCloseTo(5);
    expect(firstGeom.end.y).toBeCloseTo(5);
    
    // Second half should go from (5,5) to (0,0)
    expect(secondGeom.start.x).toBeCloseTo(5);
    expect(secondGeom.start.y).toBeCloseTo(5);
    expect(secondGeom.end).toEqual({ x: 0, y: 0 });
  });

  it('should split a complex polyline at the correct midpoint along its path', () => {
    // Create a polyline with uneven segment lengths
    const shapes: Shape[] = [
      {
        id: 'complex-polyline',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 3, y: 0 },    // segment length: 3
            { x: 3, y: 4 },    // segment length: 4
            { x: 8, y: 4 }     // segment length: 5
          ],
          closed: false
        }
      },
      {
        id: 'closing-polyline',
        type: 'polyline',
        geometry: {
          points: [
            { x: 8, y: 4 },
            { x: 0, y: 0 }
          ],
          closed: false
        }
      }
    ];

    const chain: ShapeChain = {
      id: 'complex-chain',
      shapes
    };

    const result = optimizeStartPoints([chain], tolerance);
    
    // Should split the second polyline (2-point polyline is preferred)
    const splitPolylines = result.filter(s => s.id.includes('closing-polyline-split'));
    expect(splitPolylines.length).toBe(2);
    
    // The closing polyline from (8,4) to (0,0) has length √80 ≈ 8.94
    // Midpoint would be at (4, 2)
    
    const firstHalf = splitPolylines.find(s => s.id.includes('split-1'));
    const secondHalf = splitPolylines.find(s => s.id.includes('split-2'));
    
    const firstGeom = firstHalf!.geometry as any;
    const secondGeom = secondHalf!.geometry as any;
    
    // First half should go from (8,4) to (4,2)
    expect(firstGeom.points.length).toBe(2);
    expect(firstGeom.points[0]).toEqual({ x: 8, y: 4 });
    expect(firstGeom.points[1].x).toBeCloseTo(4);
    expect(firstGeom.points[1].y).toBeCloseTo(2);
    
    // Second half should go from (4,2) to (0,0)
    expect(secondGeom.points.length).toBe(2);
    expect(secondGeom.points[0].x).toBeCloseTo(4);
    expect(secondGeom.points[0].y).toBeCloseTo(2);
    expect(secondGeom.points[1]).toEqual({ x: 0, y: 0 });
  });
});