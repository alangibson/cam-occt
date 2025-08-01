import { describe, it, expect } from 'vitest';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from './lead-calculation';
import { CutDirection, LeadType } from '../types/direction';
import type { ShapeChain } from './chain-detection';

describe('Lead Direction and Cut Direction Tangency', () => {
  // Create a simple circular chain for testing
  function createCircleChain(center: { x: number; y: number }, radius: number, clockwise: boolean): ShapeChain {
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
  function createRectangleChain(x: number, y: number, width: number, height: number, clockwise: boolean): ShapeChain {
    const points = clockwise ? [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
      { x, y } // Close the rectangle
    ] : [
      { x, y },
      { x, y: y + height },
      { x: x + width, y: y + height },
      { x: x + width, y },
      { x, y } // Close the rectangle
    ];

    return {
      id: 'test-rectangle',
      shapes: [{
        id: 'rect-1',
        type: 'polyline',
        geometry: {
          points,
          closed: true
        }
      }]
    };
  }

  // Helper to calculate the angle of a vector
  function getVectorAngle(from: { x: number; y: number }, to: { x: number; y: number }): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
  }

  // Helper to get the tangent direction based on cut direction
  function getExpectedTangentDirection(shape: any, cutDirection: CutDirection.CLOCKWISE | 'counterclockwise'): number {
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
    console.log('\n=== TESTING LEAD DIRECTION VS CUT DIRECTION ===');
    
    const center = { x: 50, y: 50 };
    const radius = 25;
    
    // Test clockwise circle
    const clockwiseCircle = createCircleChain(center, radius, true);
    console.log('\nTesting CLOCKWISE circle cut:');
    
    const leadInConfig: LeadInConfig = { type: LeadType.ARC, length: 10 };
    const leadOutConfig: LeadOutConfig = { type: LeadType.ARC, length: 10 };
    
    const clockwiseResult = calculateLeads(clockwiseCircle, leadInConfig, leadOutConfig);
    
    if (clockwiseResult.leadIn && clockwiseResult.leadIn.points.length >= 2) {
      const leadStart = clockwiseResult.leadIn.points[0];
      const leadEnd = clockwiseResult.leadIn.points[clockwiseResult.leadIn.points.length - 1];
      const leadDirection = getVectorAngle(leadStart, leadEnd);
      
      console.log(`Lead-in start: (${leadStart.x.toFixed(3)}, ${leadStart.y.toFixed(3)})`);
      console.log(`Lead-in end: (${leadEnd.x.toFixed(3)}, ${leadEnd.y.toFixed(3)})`);
      console.log(`Lead-in direction: ${(leadDirection * 180 / Math.PI).toFixed(1)}°`);
    }
    
    // Test counterclockwise circle
    const counterclockwiseCircle = createCircleChain(center, radius, false);
    console.log('\nTesting COUNTERCLOCKWISE circle cut:');
    
    const counterclockwiseResult = calculateLeads(counterclockwiseCircle, leadInConfig, leadOutConfig);
    
    if (counterclockwiseResult.leadIn && counterclockwiseResult.leadIn.points.length >= 2) {
      const leadStart = counterclockwiseResult.leadIn.points[0];
      const leadEnd = counterclockwiseResult.leadIn.points[counterclockwiseResult.leadIn.points.length - 1];
      const leadDirection = getVectorAngle(leadStart, leadEnd);
      
      console.log(`Lead-in start: (${leadStart.x.toFixed(3)}, ${leadStart.y.toFixed(3)})`);
      console.log(`Lead-in end: (${leadEnd.x.toFixed(3)}, ${leadEnd.y.toFixed(3)})`);
      console.log(`Lead-in direction: ${(leadDirection * 180 / Math.PI).toFixed(1)}°`);
    }
    
    console.log('\n⚠️  ISSUE: Leads should be different for clockwise vs counterclockwise cuts');
    console.log('   Currently the algorithm does not consider cut direction when calculating leads');
  });

  it('should demonstrate lead tangency requirements for rectangles', () => {
    console.log('\n=== TESTING LEAD TANGENCY ON RECTANGLES ===');
    
    // Create clockwise rectangle
    const clockwiseRect = createRectangleChain(10, 10, 40, 30, true);
    console.log('\nTesting CLOCKWISE rectangle cut:');
    
    const leadInConfig: LeadInConfig = { type: LeadType.ARC, length: 8 };
    const leadOutConfig: LeadOutConfig = { type: LeadType.NONE, length: 0 };
    
    const clockwiseResult = calculateLeads(clockwiseRect, leadInConfig, leadOutConfig);
    
    if (clockwiseResult.leadIn && clockwiseResult.leadIn.points.length >= 2) {
      const connectionPoint = clockwiseResult.leadIn.points[clockwiseResult.leadIn.points.length - 1];
      const secondToLast = clockwiseResult.leadIn.points[clockwiseResult.leadIn.points.length - 2];
      
      console.log(`Connection point: (${connectionPoint.x.toFixed(3)}, ${connectionPoint.y.toFixed(3)})`);
      console.log(`Second-to-last point: (${secondToLast.x.toFixed(3)}, ${secondToLast.y.toFixed(3)})`);
      
      // The lead should approach the rectangle tangentially
      const approachAngle = getVectorAngle(secondToLast, connectionPoint);
      console.log(`Lead approach angle: ${(approachAngle * 180 / Math.PI).toFixed(1)}°`);
    }
    
    // Create counterclockwise rectangle
    const counterclockwiseRect = createRectangleChain(10, 10, 40, 30, false);
    console.log('\nTesting COUNTERCLOCKWISE rectangle cut:');
    
    const counterclockwiseResult = calculateLeads(counterclockwiseRect, leadInConfig, leadOutConfig);
    
    if (counterclockwiseResult.leadIn && counterclockwiseResult.leadIn.points.length >= 2) {
      const connectionPoint = counterclockwiseResult.leadIn.points[counterclockwiseResult.leadIn.points.length - 1];
      const secondToLast = counterclockwiseResult.leadIn.points[counterclockwiseResult.leadIn.points.length - 2];
      
      console.log(`Connection point: (${connectionPoint.x.toFixed(3)}, ${connectionPoint.y.toFixed(3)})`);
      console.log(`Second-to-last point: (${secondToLast.x.toFixed(3)}, ${secondToLast.y.toFixed(3)})`);
      
      // The lead should approach the rectangle tangentially
      const approachAngle = getVectorAngle(secondToLast, connectionPoint);
      console.log(`Lead approach angle: ${(approachAngle * 180 / Math.PI).toFixed(1)}°`);
    }
    
    console.log('\n⚠️  ISSUE: Lead approach angles should differ based on cut direction');
    console.log('   Clockwise cuts need leads approaching from one side');
    console.log('   Counterclockwise cuts need leads approaching from the opposite side');
  });

  it('should analyze current algorithm cut direction awareness', () => {
    console.log('\n=== ANALYZING ALGORITHM CUT DIRECTION AWARENESS ===');
    
    // The current calculateLeads function signature:
    // calculateLeads(chain, leadInConfig, leadOutConfig, part?)
    // 
    // MISSING: Cut direction parameter!
    
    console.log('❌ PROBLEM IDENTIFIED:');
    console.log('   calculateLeads() does not receive cut direction information');
    console.log('   It only knows about:');
    console.log('   - Chain geometry');
    console.log('   - Lead configuration (type, length)');
    console.log('   - Part context (holes/shells)');
    console.log('');
    console.log('✅ SOLUTION NEEDED:');
    console.log('   calculateLeads() should receive cut direction parameter');
    console.log('   Lead curve direction should be based on:');
    console.log('   - Shape tangent direction');
    console.log('   - Cut direction (clockwise/counterclockwise)');
    console.log('   - Hole vs shell context');
    
    // This test always passes - it's just for analysis
    expect(true).toBe(true);
  });
});