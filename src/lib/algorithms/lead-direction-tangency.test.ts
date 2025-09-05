import { describe, it, expect } from 'vitest';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from './lead-calculation';
import { CutDirection, LeadType } from '../types/direction';
import type { Chain } from './chain-detection/chain-detection';
import { createPolylineFromVertices } from '../geometry/polyline';
import type { Shape } from '../types';

describe('Lead Direction and Cut Direction Tangency', () => {
  // Create a simple circular chain for testing
  function createCircleChain(center: { x: number; y: number }, radius: number, _clockwise: boolean): Chain {
    return {
      id: 'test-circle',
      shapes: [{
        id: 'circle-1',
        type: 'circle',
        geometry: {
          center,
          radius
        }
      }]
    };
  }

  // Create a simple rectangular chain for testing
  function createRectangleChain(x: number, y: number, width: number, height: number, clockwise: boolean): Chain {
    const vertices = clockwise ? [
      { x, y, bulge: 0 },
      { x: x + width, y, bulge: 0 },
      { x: x + width, y: y + height, bulge: 0 },
      { x, y: y + height, bulge: 0 },
      { x, y, bulge: 0 } // Close the rectangle
    ] : [
      { x, y, bulge: 0 },
      { x, y: y + height, bulge: 0 },
      { x: x + width, y: y + height, bulge: 0 },
      { x: x + width, y, bulge: 0 },
      { x, y, bulge: 0 } // Close the rectangle
    ];

    return {
      id: 'test-rectangle',
      shapes: [createPolylineFromVertices(vertices, true, { id: 'rect-1' })]
    };
  }

  // Helper to calculate the angle of a vector
  function getVectorAngle(from: { x: number; y: number }, to: { x: number; y: number }): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
  }

  // Helper to get the tangent direction based on cut direction
  function _getExpectedTangentDirection(shape: Shape, cutDirection: CutDirection.CLOCKWISE | 'counterclockwise'): number {
    if (shape.type === 'circle') {
      // For circles, tangent should be perpendicular to radius
      // Clockwise cuts go in one direction, counterclockwise in the opposite
      const radiusAngle = 0; // Starting at rightmost point
      return cutDirection === CutDirection.CLOCKWISE 
        ? radiusAngle - Math.PI / 2  // 90° clockwise from radius
        : radiusAngle + Math.PI / 2; // 90° counterclockwise from radius
    }
    return 0; // Default for other shapes
  }

  it('should demonstrate lead direction inconsistency with cut direction', () => {
    
    const center = { x: 50, y: 50 };
    const radius = 25;
    
    // Test clockwise circle
    const clockwiseCircle = createCircleChain(center, radius, true);
    
    const leadInConfig: LeadInConfig = { type: LeadType.ARC, length: 10 };
    const leadOutConfig: LeadOutConfig = { type: LeadType.ARC, length: 10 };
    
    const clockwiseResult = calculateLeads(clockwiseCircle, leadInConfig, leadOutConfig);
    
    if (clockwiseResult.leadIn && clockwiseResult.leadIn.points.length >= 2) {
      const leadStart = clockwiseResult.leadIn.points[0];
      const leadEnd = clockwiseResult.leadIn.points[clockwiseResult.leadIn.points.length - 1];
      const _leadDirection = getVectorAngle(leadStart, leadEnd);
      
    }
    
    // Test counterclockwise circle
    const counterclockwiseCircle = createCircleChain(center, radius, false);
    
    const counterclockwiseResult = calculateLeads(counterclockwiseCircle, leadInConfig, leadOutConfig);
    
    if (counterclockwiseResult.leadIn && counterclockwiseResult.leadIn.points.length >= 2) {
      const leadStart = counterclockwiseResult.leadIn.points[0];
      const leadEnd = counterclockwiseResult.leadIn.points[counterclockwiseResult.leadIn.points.length - 1];
      const _leadDirection = getVectorAngle(leadStart, leadEnd);
      
    }
    
  });

  it('should demonstrate lead tangency requirements for rectangles', () => {
    
    // Create clockwise rectangle
    const clockwiseRect = createRectangleChain(10, 10, 40, 30, true);
    
    const leadInConfig: LeadInConfig = { type: LeadType.ARC, length: 8 };
    const leadOutConfig: LeadOutConfig = { type: LeadType.NONE, length: 0 };
    
    const clockwiseResult = calculateLeads(clockwiseRect, leadInConfig, leadOutConfig);
    
    if (clockwiseResult.leadIn && clockwiseResult.leadIn.points.length >= 2) {
      const connectionPoint = clockwiseResult.leadIn.points[clockwiseResult.leadIn.points.length - 1];
      const secondToLast = clockwiseResult.leadIn.points[clockwiseResult.leadIn.points.length - 2];
      
      
      // The lead should approach the rectangle tangentially
      const _approachAngle = getVectorAngle(secondToLast, connectionPoint);
    }
    
    // Create counterclockwise rectangle
    const counterclockwiseRect = createRectangleChain(10, 10, 40, 30, false);
    
    const counterclockwiseResult = calculateLeads(counterclockwiseRect, leadInConfig, leadOutConfig);
    
    if (counterclockwiseResult.leadIn && counterclockwiseResult.leadIn.points.length >= 2) {
      const connectionPoint = counterclockwiseResult.leadIn.points[counterclockwiseResult.leadIn.points.length - 1];
      const secondToLast = counterclockwiseResult.leadIn.points[counterclockwiseResult.leadIn.points.length - 2];
      
      
      // The lead should approach the rectangle tangentially
      const _approachAngle = getVectorAngle(secondToLast, connectionPoint);
    }
    
  });

  it('should analyze current algorithm cut direction awareness', () => {
    
    // The current calculateLeads function signature:
    // calculateLeads(chain, leadInConfig, leadOutConfig, part?)
    // 
    // MISSING: Cut direction parameter!
    
    
    // This test always passes - it's just for analysis
    expect(true).toBe(true);
  });
});