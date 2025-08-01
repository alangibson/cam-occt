import { describe, it, expect } from 'vitest';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from './lead-calculation';
import { LeadType, CutDirection } from '../types/direction';
import type { ShapeChain } from './chain-detection';
import type { DetectedPart } from './part-detection';
import type { Shape } from '../../types/geometry';

describe('Lead Calculation with Validation Pipeline', () => {
  // Helper to create a simple line chain
  function createLineChain(start: { x: number; y: number }, end: { x: number; y: number }): ShapeChain {
    const shape: Shape = {
      id: 'line1',
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
      id: 'circle1',
      type: 'circle',
      geometry: { center, radius },
      layer: 'layer1'
    };
    
    return {
      id: 'chain1',
      shapes: [shape]
    };
  }

  describe('validation integration', () => {
    it('should include validation results in lead calculation', () => {
      const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
      const leadIn: LeadInConfig = { type: LeadType.ARC, length: 5 };
      const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

      const result = calculateLeads(chain, leadIn, leadOut, CutDirection.NONE);

      expect(result.validation).toBeDefined();
      expect(result.validation!.isValid).toBe(true);
      expect(Array.isArray(result.validation!.warnings)).toBe(true);
      expect(['info', 'warning', 'error']).toContain(result.validation!.severity);
    });

    it('should prevent calculation with validation errors', () => {
      const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
      const leadIn: LeadInConfig = { type: LeadType.ARC, length: -5 }; // Invalid negative length
      const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

      const result = calculateLeads(chain, leadIn, leadOut, CutDirection.NONE);

      expect(result.validation).toBeDefined();
      expect(result.validation!.isValid).toBe(false);
      expect(result.validation!.severity).toBe('error');
      expect(result.leadIn).toBeUndefined(); // Should not calculate with errors
      expect(result.warnings).toContain('Lead-in length cannot be negative');
    });

    it('should proceed with calculation despite warnings', () => {
      const smallChain = createCircleChain({ x: 0, y: 0 }, 2); // Small circle
      const leadIn: LeadInConfig = { type: LeadType.ARC, length: 20 }; // Long lead (warning)
      const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

      const result = calculateLeads(smallChain, leadIn, leadOut, CutDirection.CLOCKWISE);

      expect(result.validation).toBeDefined();
      expect(result.validation!.isValid).toBe(true); // Valid despite warnings
      expect(result.validation!.severity).toBe('warning');
      expect(result.leadIn).toBeDefined(); // Should still calculate
      
      // Should have validation warnings in the overall warnings
      expect(result.warnings?.some(w => w.includes('Lead-in length is very large'))).toBe(true);
    });

    it('should handle empty chain validation', () => {
      const emptyChain: ShapeChain = { id: 'empty', shapes: [] };
      const leadIn: LeadInConfig = { type: LeadType.ARC, length: 5 };
      const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

      const result = calculateLeads(emptyChain, leadIn, leadOut, CutDirection.NONE);

      expect(result.validation).toBeDefined();
      expect(result.validation!.isValid).toBe(false);
      expect(result.validation!.severity).toBe('error');
      expect(result.leadIn).toBeUndefined();
      expect(result.warnings).toContain('Cannot generate leads for empty chain');
    });

    it('should provide actionable suggestions', () => {
      const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
      const leadIn: LeadInConfig = { type: LeadType.NONE, length: 5 }; // Type/length mismatch
      const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

      const result = calculateLeads(chain, leadIn, leadOut, CutDirection.NONE);

      expect(result.validation).toBeDefined();
      expect(result.validation!.suggestions).toBeDefined();
      expect(result.validation!.suggestions!.length).toBeGreaterThan(0);
      expect(result.validation!.suggestions!.some(s => 
        s.includes('Set lead-in length to 0 or change type')
      )).toBe(true);
    });

    it('should validate part context correctly', () => {
      const holeChain = createCircleChain({ x: 5, y: 5 }, 2);
      const shellChain = createCircleChain({ x: 5, y: 5 }, 10);
      
      const part: DetectedPart = {
        id: 'part1',
        shell: { 
          id: 'shell1', 
          chain: shellChain, 
          type: 'shell', 
          boundingBox: { minX: -5, maxX: 15, minY: -5, maxY: 15 }, 
          holes: [] 
        },
        holes: [{ 
          id: 'hole1', 
          chain: holeChain, 
          type: 'hole', 
          boundingBox: { minX: 3, maxX: 7, minY: 3, maxY: 7 }, 
          holes: [] 
        }]
      };

      const leadIn: LeadInConfig = { type: LeadType.ARC, length: 3 };
      const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

      const result = calculateLeads(holeChain, leadIn, leadOut, CutDirection.CLOCKWISE, part);

      expect(result.validation).toBeDefined();
      expect(result.validation!.warnings.some(w => w.includes('Generating leads for hole'))).toBe(true);
      expect(result.leadIn).toBeDefined(); // Should still generate leads for holes
    });

    it('should combine validation and calculation warnings', () => {
      const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
      const leadIn: LeadInConfig = { type: LeadType.ARC, length: 100 }; // Very long (validation warning)
      const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

      const result = calculateLeads(chain, leadIn, leadOut, CutDirection.NONE);

      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
      
      // Should include validation warnings
      expect(result.warnings!.some(w => w.includes('Lead-in length (100) is very long'))).toBe(true);
      
      // Note: Actual calculation warnings would be added during the calculation phase
      // This test verifies that validation warnings are properly included
    });

    it('should handle no-lead configuration', () => {
      const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
      const leadIn: LeadInConfig = { type: LeadType.NONE, length: 0 };
      const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

      const result = calculateLeads(chain, leadIn, leadOut, CutDirection.NONE);

      expect(result.validation).toBeDefined();
      expect(result.validation!.isValid).toBe(true);
      expect(result.leadIn).toBeUndefined();
      expect(result.leadOut).toBeUndefined();
      // Should still return early due to no leads requested
    });
  });

  describe('validation severity levels', () => {
    it('should handle info level validations', () => {
      const closedChain = createCircleChain({ x: 0, y: 0 }, 5);
      const leadIn: LeadInConfig = { type: LeadType.ARC, length: 5 };
      const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

      const result = calculateLeads(closedChain, leadIn, leadOut, CutDirection.NONE);

      expect(result.validation!.severity).toBe('info');
      expect(result.leadIn).toBeDefined(); // Should still calculate
    });

    it('should handle warning level validations', () => {
      const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
      const leadIn: LeadInConfig = { type: LeadType.ARC, length: 100 }; // Very long lead (warning)
      const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

      const result = calculateLeads(chain, leadIn, leadOut, CutDirection.NONE);

      expect(result.validation!.severity).toBe('warning');
      expect(result.leadIn).toBeDefined(); // Should still calculate despite warnings
    });

    it('should handle error level validations', () => {
      const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
      const leadIn: LeadInConfig = { type: LeadType.ARC, length: -5 }; // Invalid
      const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };

      const result = calculateLeads(chain, leadIn, leadOut, CutDirection.NONE);

      expect(result.validation!.severity).toBe('error');
      expect(result.validation!.isValid).toBe(false);
      expect(result.leadIn).toBeUndefined(); // Should NOT calculate with errors
    });
  });
});