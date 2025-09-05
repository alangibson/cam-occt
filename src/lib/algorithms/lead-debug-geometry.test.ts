import { describe, it, expect } from 'vitest';
import { calculateLeads, type LeadInConfig } from './lead-calculation';
import { CutDirection, LeadType } from '../types/direction';
import type { Chain } from './chain-detection/chain-detection';
import type { DetectedPart } from './part-detection';
import type { Shape, Point2D } from '../../lib/types/geometry';

describe('Lead Geometry Debug', () => {
  // Helper to create a simple line chain
  function createLineChain(start: { x: number; y: number }, end: { x: number; y: number }): Chain {
    const shape: Shape = {
      id: 'shape1',
      type: LeadType.LINE,
      geometry: { start, end },
      layer: 'layer1'
    };
    
    return {
      id: 'chain1',
      shapes: [shape]
    };
  }

  // Helper to check if a point is inside a rectangle
  function isPointInRectangle(point: Point2D, minX: number, minY: number, maxX: number, maxY: number): boolean {
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  }

  it('should show lead geometry for simple case', () => {
    // Create a simple shell line from (0,0) to (10,0) 
    const shellChain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
    
    // No part context - should generate a basic lead
    const leadIn: LeadInConfig = { type: LeadType.ARC, length: 5 };
    const result = calculateLeads(shellChain, leadIn, { type: LeadType.NONE, length: 0 });
    
    expect(result.leadIn).toBeDefined();
    const points = result.leadIn!.points;
    
    points.forEach((_point, _i) => {
      // Log each point for debugging
    });
    
    // Check: lead should start away from line and end at (0,0)
    const endPoint = points[points.length - 1];
    
    expect(endPoint.x).toBeCloseTo(0, 5);
    expect(endPoint.y).toBeCloseTo(0, 5);
    
  });

  it('should show part geometry and solid area detection', () => {
    // Test our understanding of the part geometry
    const shellChain = createLineChain({ x: 0, y: 0 }, { x: 100, y: 0 }); // Bottom edge of shell
    
    const part: DetectedPart = {
      id: 'part1',
      shell: { 
        id: 'shell1', 
        chain: shellChain, 
        type: 'shell', 
        boundingBox: { minX: 0, maxX: 100, minY: 0, maxY: 100 }, 
        holes: [] 
      },
      holes: [{ 
        id: 'hole1', 
        chain: createLineChain({ x: 70, y: 70 }, { x: 90, y: 70 }), // Some hole
        type: 'hole', 
        boundingBox: { minX: 70, maxX: 90, minY: 70, maxY: 90 }, 
        holes: [] 
      }]
    };

    // Test specific points
    const testPoints: Point2D[] = [
      { x: 50, y: 50 },   // Inside shell, outside hole = SOLID
      { x: 80, y: 80 },   // Inside shell, inside hole = NOT SOLID
      { x: -10, y: 50 },  // Outside shell = NOT SOLID
      { x: 110, y: 50 },  // Outside shell = NOT SOLID
    ];

    testPoints.forEach((point, _i) => {
      const inShell = isPointInRectangle(point, 0, 0, 100, 100);
      const inHole = isPointInRectangle(point, 70, 70, 90, 90);
      const _inSolid = inShell && !inHole;
      
    });

    // Generate a lead for this shell
    const leadIn: LeadInConfig = { type: LeadType.ARC, length: 20 };
    const result = calculateLeads(shellChain, leadIn, { type: LeadType.NONE, length: 0 }, CutDirection.NONE, part);
    
    expect(result.leadIn).toBeDefined();
    const points = result.leadIn!.points;
    
    points.forEach((point, i) => {
      const inShell = isPointInRectangle(point, 0, 0, 100, 100);
      const inHole = isPointInRectangle(point, 70, 70, 90, 90);
      const _inSolid = inShell && !inHole;
      
      if (i < 5 || i >= points.length - 2) { // Show first few and last few points
        // Log detailed point information
      }
    });
  });
});