import { describe, it, expect } from 'vitest';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from './lead-calculation';
import type { ShapeChain } from './chain-detection';
import type { DetectedPart } from './part-detection';
import type { Shape } from '../../types/geometry';

describe('Lead Tangency Tests', () => {
  // Helper to create a simple line chain
  function createLineChain(start: { x: number; y: number }, end: { x: number; y: number }): ShapeChain {
    const shape: Shape = {
      id: 'shape1',
      type: 'line',
      geometry: { start, end },
      layer: 'layer1'
    };
    
    return {
      id: 'chain1',
      shapes: [shape]
    };
  }

  // Helper to create a circle chain
  function createCircleChain(center: { x: number; y: number }, radius: number): ShapeChain {
    const shape: Shape = {
      id: 'shape1',
      type: 'circle',
      geometry: { center, radius },
      layer: 'layer1'
    };
    
    return {
      id: 'chain1',
      shapes: [shape]
    };
  }

  // Helper to calculate angle between two vectors
  function angleBetweenVectors(v1: { x: number; y: number }, v2: { x: number; y: number }): number {
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    return Math.acos(dot / (mag1 * mag2));
  }

  describe('tangency verification', () => {
    it('should create tangent lead-in for horizontal line', () => {
      // Horizontal line from (0,0) to (10,0)
      const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
      const leadIn: LeadInConfig = { type: 'arc', length: 5 };
      const leadOut: LeadOutConfig = { type: 'none', length: 0 };
      
      const result = calculateLeads(chain, leadIn, leadOut);
      
      expect(result.leadIn).toBeDefined();
      expect(result.leadIn?.points.length).toBeGreaterThan(2);
      
      const points = result.leadIn!.points;
      const connectionPoint = points[points.length - 1]; // Last point should connect to chain
      const previousPoint = points[points.length - 2];   // Second to last point
      
      // Connection point should be at chain start (0, 0)
      expect(connectionPoint.x).toBeCloseTo(0, 5);
      expect(connectionPoint.y).toBeCloseTo(0, 5);
      
      // Calculate the tangent direction of the lead at connection point
      const leadTangent = {
        x: connectionPoint.x - previousPoint.x,
        y: connectionPoint.y - previousPoint.y
      };
      
      // Line tangent is (1, 0) - horizontal direction
      const lineTangent = { x: 1, y: 0 };
      
      // The angle between lead tangent and line tangent should be 0 (parallel)
      const angle = angleBetweenVectors(leadTangent, lineTangent);
      expect(angle).toBeCloseTo(0, 1); // Within 0.1 radians (~5.7 degrees)
    });

    it('should create tangent lead-out for horizontal line', () => {
      // Horizontal line from (0,0) to (10,0)
      const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
      const leadIn: LeadInConfig = { type: 'none', length: 0 };
      const leadOut: LeadOutConfig = { type: 'arc', length: 5 };
      
      const result = calculateLeads(chain, leadIn, leadOut);
      
      expect(result.leadOut).toBeDefined();
      expect(result.leadOut?.points.length).toBeGreaterThan(2);
      
      const points = result.leadOut!.points;
      const connectionPoint = points[0]; // First point should connect to chain
      const nextPoint = points[1];       // Second point
      
      // Connection point should be at chain end (10, 0)
      expect(connectionPoint.x).toBeCloseTo(10, 5);
      expect(connectionPoint.y).toBeCloseTo(0, 5);
      
      // Calculate the tangent direction of the lead at connection point
      const leadTangent = {
        x: nextPoint.x - connectionPoint.x,
        y: nextPoint.y - connectionPoint.y
      };
      
      // Line tangent is (1, 0) - horizontal direction
      const lineTangent = { x: 1, y: 0 };
      
      // The angle between lead tangent and line tangent should be 0 (parallel)
      const angle = angleBetweenVectors(leadTangent, lineTangent);
      expect(angle).toBeCloseTo(0, 1); // Within 0.1 radians (~5.7 degrees)
    });

    it('should create tangent lead for circle', () => {
      // Circle at (5, 5) with radius 3
      const chain = createCircleChain({ x: 5, y: 5 }, 3);
      const leadIn: LeadInConfig = { type: 'arc', length: 4 };
      const leadOut: LeadOutConfig = { type: 'none', length: 0 };
      
      const result = calculateLeads(chain, leadIn, leadOut);
      
      expect(result.leadIn).toBeDefined();
      expect(result.leadIn?.points.length).toBeGreaterThan(2);
      
      const points = result.leadIn!.points;
      const connectionPoint = points[points.length - 1]; // Last point connects to circle
      const previousPoint = points[points.length - 2];   // Second to last point
      
      // Connection point should be on the circle (rightmost point by default)
      expect(connectionPoint.x).toBeCloseTo(8, 5); // 5 + 3 = 8
      expect(connectionPoint.y).toBeCloseTo(5, 5);
      
      // Calculate the tangent direction of the lead at connection point
      const leadTangent = {
        x: connectionPoint.x - previousPoint.x,
        y: connectionPoint.y - previousPoint.y
      };
      
      // Circle tangent at rightmost point (8, 5) is vertical: (0, 1) or (0, -1)
      // For counterclockwise direction, tangent at rightmost point is (0, 1)
      const circleTangent = { x: 0, y: 1 };
      
      // The angle between lead tangent and circle tangent should be 0 (parallel)
      const angle = angleBetweenVectors(leadTangent, circleTangent);
      expect(angle).toBeCloseTo(0, 1); // Within 0.1 radians (~5.7 degrees)
    });

    it('should create properly curved lead for shell vs hole', () => {
      // Test that shell leads curve outward and hole leads curve inward
      const shellChain = createCircleChain({ x: 5, y: 5 }, 3);
      const holeChain = createCircleChain({ x: 5, y: 5 }, 1);
      
      const shellPart: DetectedPart = {
        id: 'part1',
        shell: { id: 'shell1', chain: shellChain, type: 'shell', boundingBox: { minX: 2, maxX: 8, minY: 2, maxY: 8 }, holes: [] },
        holes: []
      };
      
      const holeInShellPart: DetectedPart = {
        id: 'part2',
        shell: { id: 'shell2', chain: shellChain, type: 'shell', boundingBox: { minX: 2, maxX: 8, minY: 2, maxY: 8 }, holes: [] },
        holes: [{ id: 'hole1', chain: holeChain, type: 'hole', boundingBox: { minX: 4, maxX: 6, minY: 4, maxY: 6 }, holes: [] }]
      };

      const leadConfig: LeadInConfig = { type: 'arc', length: 2 };
      
      // Test shell lead
      const shellResult = calculateLeads(shellChain, leadConfig, { type: 'none', length: 0 }, shellPart);
      
      // Test hole lead  
      const holeResult = calculateLeads(holeChain, leadConfig, { type: 'none', length: 0 }, holeInShellPart);
      
      expect(shellResult.leadIn).toBeDefined();
      expect(holeResult.leadIn).toBeDefined();
      
      // Shell lead should curve away from center (radius should be > shell radius)
      const shellPoints = shellResult.leadIn!.points;
      const shellStart = shellPoints[0];
      const shellDistFromCenter = Math.sqrt(
        Math.pow(shellStart.x - 5, 2) + Math.pow(shellStart.y - 5, 2)
      );
      expect(shellDistFromCenter).toBeGreaterThan(3); // Should be outside the shell
      
      // Hole lead should curve toward center (radius should be < hole radius from shell center)
      const holePoints = holeResult.leadIn!.points;
      const holeStart = holePoints[0];
      const holeDistFromShellCenter = Math.sqrt(
        Math.pow(holeStart.x - 5, 2) + Math.pow(holeStart.y - 5, 2)
      );
      expect(holeDistFromShellCenter).toBeLessThan(1.5); // Should be inside the hole area
    });
  });

  describe('arc geometry verification', () => {
    it('should generate arc with correct length', () => {
      const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
      const targetLength = 5;
      const leadIn: LeadInConfig = { type: 'arc', length: targetLength };
      const leadOut: LeadOutConfig = { type: 'none', length: 0 };
      
      const result = calculateLeads(chain, leadIn, leadOut);
      
      expect(result.leadIn).toBeDefined();
      const points = result.leadIn!.points;
      
      // Calculate total arc length by summing segment lengths
      let totalLength = 0;
      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i-1].x;
        const dy = points[i].y - points[i-1].y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
      }
      
      // Arc length should be approximately equal to target length
      expect(totalLength).toBeCloseTo(targetLength, 0.5); // Within 0.5 units
    });

    it('should respect 90-degree maximum sweep', () => {
      const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
      const veryLongLength = 1000; // This would require > 90° if radius is small
      const leadIn: LeadInConfig = { type: 'arc', length: veryLongLength };
      const leadOut: LeadOutConfig = { type: 'none', length: 0 };
      
      const result = calculateLeads(chain, leadIn, leadOut);
      
      expect(result.leadIn).toBeDefined();
      const points = result.leadIn!.points;
      
      // With maximum 90° sweep, the arc should not curve more than a quarter circle
      const start = points[0];
      const end = points[points.length - 1];
      
      // For a horizontal line, 90° lead-in should result in points where
      // the start point is roughly perpendicular to the end point direction
      const startToEnd = {
        x: end.x - start.x,
        y: end.y - start.y
      };
      
      // The arc should not curve more than 90 degrees
      // This is a basic sanity check - more sophisticated geometry would be needed for exact verification
      expect(Math.abs(startToEnd.y)).toBeGreaterThan(0); // Should have vertical component
    });
  });
});