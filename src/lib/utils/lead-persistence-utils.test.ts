/**
 * Tests for lead persistence utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  calculateAndStorePathLeads,
  hasValidCachedLeads,
  getCachedLeadGeometry,
  calculateAndStoreOperationLeads
} from './lead-persistence-utils';
import type { Path } from '../stores/paths';
import type { Operation } from '../stores/operations';
import type { ShapeChain } from '../algorithms/chain-detection';
import { LeadType, CutDirection } from '../types/direction';

// Mock the stores
vi.mock('../stores/paths', () => ({
  pathStore: {
    updatePathLeadGeometry: vi.fn()
  }
}));

vi.mock('../stores/chains', () => ({
  chainStore: {
    subscribe: vi.fn(() => vi.fn()),
  }
}));

vi.mock('../stores/parts', () => ({
  partStore: {
    subscribe: vi.fn(() => vi.fn()),
  }
}));

// Mock the lead calculation algorithm
vi.mock('../algorithms/lead-calculation', () => ({
  calculateLeads: vi.fn(() => ({
    leadIn: {
      points: [{ x: 0, y: 0 }, { x: 5, y: 5 }],
      type: LeadType.ARC
    },
    leadOut: {
      points: [{ x: 10, y: 10 }, { x: 15, y: 15 }],
      type: LeadType.LINE
    },
    warnings: ['Test warning']
  }))
}));

// Mock svelte/store get function
vi.mock('svelte/store', () => ({
  get: vi.fn(() => ({
    chains: [],
    parts: [],
    paths: []
  }))
}));

describe('Lead Persistence Utils', () => {
  const mockPath: Path = {
    id: 'path-1',
    name: 'Test Path',
    operationId: 'op-1',
    chainId: 'chain-1',
    toolId: 'tool-1',
    enabled: true,
    order: 1,
    cutDirection: CutDirection.CLOCKWISE,
    leadInType: LeadType.ARC,
    leadInLength: 5,
    leadInFlipSide: false,
    leadInAngle: 45,
    leadOutType: LeadType.LINE,
    leadOutLength: 3,
    leadOutFlipSide: false,
    leadOutAngle: 90
  };

  const mockOperation: Operation = {
    id: 'op-1',
    name: 'Test Operation',
    toolId: 'tool-1',
    targetType: 'chains',
    targetIds: ['chain-1'],
    enabled: true,
    order: 1,
    cutDirection: CutDirection.CLOCKWISE,
    leadInType: LeadType.ARC,
    leadInLength: 5,
    leadInFlipSide: false,
    leadInAngle: 45,
    leadOutType: LeadType.LINE,
    leadOutLength: 3,
    leadOutFlipSide: false,
    leadOutAngle: 90
  };

  const mockChain: ShapeChain = {
    id: 'chain-1',
    shapes: [
      { id: 'shape-1', type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }
    ],
    isClosed: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasValidCachedLeads', () => {
    it('should return false for path without cached leads', () => {
      const pathWithoutCache = {
        ...mockPath,
        calculatedLeadIn: undefined,
        calculatedLeadOut: undefined
      };
      const result = hasValidCachedLeads(pathWithoutCache);
      expect(result).toBe(false);
    });

    it('should return true for path with valid cached leads', () => {
      const pathWithCache: Path = {
        ...mockPath,
        calculatedLeadIn: {
          points: [{ x: 0, y: 0 }, { x: 5, y: 5 }],
          type: LeadType.ARC,
          generatedAt: '2023-01-01T12:00:00.000Z',
          version: '1.0.0'
        },
        calculatedLeadOut: {
          points: [{ x: 10, y: 10 }, { x: 15, y: 15 }],
          type: LeadType.LINE,
          generatedAt: '2023-01-01T12:00:00.000Z',
          version: '1.0.0'
        }
      };

      const result = hasValidCachedLeads(pathWithCache);
      expect(result).toBe(true);
    });

    it('should return false for path with mismatched lead types', () => {
      const pathWithMismatch: Path = {
        ...mockPath,
        leadInType: LeadType.LINE, // Different from cached type
        calculatedLeadIn: {
          points: [{ x: 0, y: 0 }, { x: 5, y: 5 }],
          type: LeadType.ARC, // Cached as ARC but path expects LINE
          generatedAt: '2023-01-01T12:00:00.000Z',
          version: '1.0.0'
        }
      };

      const result = hasValidCachedLeads(pathWithMismatch);
      expect(result).toBe(false);
    });

    it('should return false for path with outdated version', () => {
      const pathWithOldVersion: Path = {
        ...mockPath,
        calculatedLeadIn: {
          points: [{ x: 0, y: 0 }, { x: 5, y: 5 }],
          type: LeadType.ARC,
          generatedAt: '2023-01-01T12:00:00.000Z',
          version: '0.9.0' // Old version
        }
      };

      const result = hasValidCachedLeads(pathWithOldVersion);
      expect(result).toBe(false);
    });

    it('should handle paths with lead type "none"', () => {
      const pathWithNoLeads: Path = {
        ...mockPath,
        leadInType: LeadType.NONE,
        leadOutType: LeadType.NONE
      };

      const result = hasValidCachedLeads(pathWithNoLeads);
      expect(result).toBe(true); // No leads needed, so cache is "valid"
    });
  });

  describe('getCachedLeadGeometry', () => {
    it('should return cached lead geometry', () => {
      const pathWithCache: Path = {
        ...mockPath,
        calculatedLeadIn: {
          points: [{ x: 0, y: 0 }, { x: 5, y: 5 }],
          type: LeadType.ARC,
          generatedAt: '2023-01-01T12:00:00.000Z',
          version: '1.0.0'
        },
        calculatedLeadOut: {
          points: [{ x: 10, y: 10 }, { x: 15, y: 15 }],
          type: LeadType.LINE,
          generatedAt: '2023-01-01T12:00:00.000Z',
          version: '1.0.0'
        },
        leadValidation: {
          isValid: true,
          warnings: ['Test warning'],
          errors: [],
          severity: 'warning',
          validatedAt: '2023-01-01T12:00:00.000Z'
        }
      };

      const result = getCachedLeadGeometry(pathWithCache);

      expect(result.leadIn).toEqual({
        points: [{ x: 0, y: 0 }, { x: 5, y: 5 }],
        type: LeadType.ARC
      });
      expect(result.leadOut).toEqual({
        points: [{ x: 10, y: 10 }, { x: 15, y: 15 }],
        type: LeadType.LINE
      });
      expect(result.validation).toEqual(pathWithCache.leadValidation);
    });

    it('should return null for missing cached leads', () => {
      const result = getCachedLeadGeometry(mockPath);

      expect(result.leadIn).toBeNull();
      expect(result.leadOut).toBeNull();
      expect(result.validation).toBeUndefined();
    });
  });

  describe('calculateAndStorePathLeads', () => {
    it('should calculate and store lead geometry', async () => {
      const { pathStore } = await import('../stores/paths');
      
      await calculateAndStorePathLeads(mockPath, mockOperation, mockChain, []);

      expect(pathStore.updatePathLeadGeometry).toHaveBeenCalledWith(
        'path-1',
        expect.objectContaining({
          leadIn: {
            points: [{ x: 0, y: 0 }, { x: 5, y: 5 }],
            type: LeadType.ARC
          },
          leadOut: {
            points: [{ x: 10, y: 10 }, { x: 15, y: 15 }],
            type: LeadType.LINE
          },
          validation: {
            isValid: true,
            warnings: ['Test warning'],
            errors: [],
            severity: 'warning'
          }
        })
      );
    });

    it('should skip calculation when both leads are disabled', async () => {
      const pathNoLeads: Path = {
        ...mockPath,
        leadInType: LeadType.NONE,
        leadOutType: LeadType.NONE
      };

      const { pathStore } = await import('../stores/paths');
      
      await calculateAndStorePathLeads(pathNoLeads, mockOperation, mockChain, []);

      expect(pathStore.updatePathLeadGeometry).not.toHaveBeenCalled();
    });

    it('should handle calculation errors gracefully', async () => {
      const { calculateLeads } = await import('../algorithms/lead-calculation');
      const { pathStore } = await import('../stores/paths');
      
      // Mock calculation to throw error
      vi.mocked(calculateLeads).mockImplementationOnce(() => {
        throw new Error('Calculation failed');
      });

      await calculateAndStorePathLeads(mockPath, mockOperation, mockChain, []);

      expect(pathStore.updatePathLeadGeometry).toHaveBeenCalledWith(
        'path-1',
        expect.objectContaining({
          validation: {
            isValid: false,
            warnings: [],
            errors: ['Calculation failed'],
            severity: 'error'
          }
        })
      );
    });
  });

  describe('calculateAndStoreOperationLeads', () => {
    it('should calculate leads for all paths in operation', async () => {
      const { get } = await import('svelte/store');
      const { pathStore } = await import('../stores/paths');
      
      // Mock store states
      vi.mocked(get).mockImplementation((store) => {
        if (store === pathStore) {
          return { paths: [mockPath] };
        }
        if (store.subscribe) { // chainStore or partStore
          return { chains: [mockChain], parts: [] };
        }
        return {};
      });

      await calculateAndStoreOperationLeads(mockOperation);

      expect(pathStore.updatePathLeadGeometry).toHaveBeenCalledTimes(1);
    });
  });
});