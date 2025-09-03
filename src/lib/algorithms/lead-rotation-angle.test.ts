import { describe, it, expect } from 'vitest';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from './lead-calculation';
import { LeadType } from '../types/direction';
import type { ShapeChain } from './chain-detection/chain-detection';
import type { Point2D } from '../../lib/types/geometry';

describe('Lead Rotation Angle', () => {
  // Simple horizontal line for testing lead angles
  const horizontalLine: ShapeChain = {
    id: 'test-line',
    shapes: [
      {
        id: 'line1',
        type: 'line',
        geometry: {
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 }
        }
      }
    ]
  };

  describe('Lead-in angle behavior', () => {
    it('should point to the right when angle is 0 degrees (unit circle convention)', () => {
      const leadInConfig: LeadInConfig = {
        type: LeadType.LINE,
        length: 5,
        angle: 0 // Should point right (+X direction)
      };

      const leadOutConfig: LeadOutConfig = {
        type: LeadType.NONE,
        length: 0
      };

      const result = calculateLeads(horizontalLine, leadInConfig, leadOutConfig);
      
      expect(result.leadIn).toBeDefined();
      expect(result.leadIn!.points.length).toBeGreaterThan(1);
      
      // Get the start point of the lead-in (should be away from connection point)
      const leadStartPoint = result.leadIn!.points[0];
      const connectionPoint = result.leadIn!.points[result.leadIn!.points.length - 1];
      
      // Lead-in with 0° angle should start to the right (+X) of the connection point
      expect(leadStartPoint.x).toBeGreaterThan(connectionPoint.x);
      expect(Math.abs(leadStartPoint.y - connectionPoint.y)).toBeLessThan(0.001); // Same Y coordinate
    });

    it('should point up when angle is 90 degrees', () => {
      const leadInConfig: LeadInConfig = {
        type: LeadType.LINE,
        length: 5,
        angle: 90 // Should point up (+Y direction)
      };

      const leadOutConfig: LeadOutConfig = {
        type: LeadType.NONE,
        length: 0
      };

      const result = calculateLeads(horizontalLine, leadInConfig, leadOutConfig);
      
      expect(result.leadIn).toBeDefined();
      
      const leadStartPoint = result.leadIn!.points[0];
      const connectionPoint = result.leadIn!.points[result.leadIn!.points.length - 1];
      
      // Lead-in with 90° angle should start above (+Y) the connection point
      expect(leadStartPoint.y).toBeGreaterThan(connectionPoint.y);
      expect(Math.abs(leadStartPoint.x - connectionPoint.x)).toBeLessThan(0.001); // Same X coordinate
    });

    it('should point to the left when angle is 180 degrees', () => {
      const leadInConfig: LeadInConfig = {
        type: LeadType.LINE,
        length: 5,
        angle: 180 // Should point left (-X direction)
      };

      const leadOutConfig: LeadOutConfig = {
        type: LeadType.NONE,
        length: 0
      };

      const result = calculateLeads(horizontalLine, leadInConfig, leadOutConfig);
      
      expect(result.leadIn).toBeDefined();
      
      const leadStartPoint = result.leadIn!.points[0];
      const connectionPoint = result.leadIn!.points[result.leadIn!.points.length - 1];
      
      // Lead-in with 180° angle should start to the left (-X) of the connection point
      expect(leadStartPoint.x).toBeLessThan(connectionPoint.x);
      expect(Math.abs(leadStartPoint.y - connectionPoint.y)).toBeLessThan(0.001); // Same Y coordinate
    });

    it('should point down when angle is 270 degrees', () => {
      const leadInConfig: LeadInConfig = {
        type: LeadType.LINE,
        length: 5,
        angle: 270 // Should point down (-Y direction)
      };

      const leadOutConfig: LeadOutConfig = {
        type: LeadType.NONE,
        length: 0
      };

      const result = calculateLeads(horizontalLine, leadInConfig, leadOutConfig);
      
      expect(result.leadIn).toBeDefined();
      
      const leadStartPoint = result.leadIn!.points[0];
      const connectionPoint = result.leadIn!.points[result.leadIn!.points.length - 1];
      
      // Lead-in with 270° angle should start below (-Y) the connection point
      expect(leadStartPoint.y).toBeLessThan(connectionPoint.y);
      expect(Math.abs(leadStartPoint.x - connectionPoint.x)).toBeLessThan(0.001); // Same X coordinate
    });
  });

  describe('Lead-out angle behavior', () => {
    it('should point to the right when angle is 0 degrees (unit circle convention)', () => {
      const leadInConfig: LeadInConfig = {
        type: LeadType.NONE,
        length: 0
      };

      const leadOutConfig: LeadOutConfig = {
        type: LeadType.LINE,
        length: 5,
        angle: 0 // Should point right (+X direction)
      };

      const result = calculateLeads(horizontalLine, leadInConfig, leadOutConfig);
      
      expect(result.leadOut).toBeDefined();
      expect(result.leadOut!.points.length).toBeGreaterThan(1);
      
      // Get the end point of the lead-out (should be away from connection point)
      const connectionPoint = result.leadOut!.points[0];
      const leadEndPoint = result.leadOut!.points[result.leadOut!.points.length - 1];
      
      // Lead-out with 0° angle should end to the right (+X) of the connection point
      expect(leadEndPoint.x).toBeGreaterThan(connectionPoint.x);
      expect(Math.abs(leadEndPoint.y - connectionPoint.y)).toBeLessThan(0.001); // Same Y coordinate
    });

    it('should point up when angle is 90 degrees', () => {
      const leadOutConfig: LeadOutConfig = {
        type: LeadType.LINE,
        length: 5,
        angle: 90 // Should point up (+Y direction)
      };

      const leadInConfig: LeadInConfig = {
        type: LeadType.NONE,
        length: 0
      };

      const result = calculateLeads(horizontalLine, leadInConfig, leadOutConfig);
      
      expect(result.leadOut).toBeDefined();
      
      const connectionPoint = result.leadOut!.points[0];
      const leadEndPoint = result.leadOut!.points[result.leadOut!.points.length - 1];
      
      // Lead-out with 90° angle should end above (+Y) the connection point
      expect(leadEndPoint.y).toBeGreaterThan(connectionPoint.y);
      expect(Math.abs(leadEndPoint.x - connectionPoint.x)).toBeLessThan(0.001); // Same X coordinate
    });
  });

  describe('Arc lead angle behavior', () => {
    it('should have center positioned to the right when angle is 0 degrees', () => {
      const leadInConfig: LeadInConfig = {
        type: LeadType.ARC,
        length: 5,
        angle: 0 // Arc center should be to the right (+X direction)
      };

      const leadOutConfig: LeadOutConfig = {
        type: LeadType.NONE,
        length: 0
      };

      const result = calculateLeads(horizontalLine, leadInConfig, leadOutConfig);
      
      expect(result.leadIn).toBeDefined();
      expect(result.leadIn!.points.length).toBeGreaterThan(2);
      
      const points = result.leadIn!.points;
      const connectionPoint = points[points.length - 1];
      
      // For arc leads with 0° angle, the center should be to the right of connection point
      // The lead should start somewhere to the right and curve back to the connection point
      const startPoint = points[0];
      expect(startPoint.x).toBeGreaterThan(connectionPoint.x);
    });
  });
});