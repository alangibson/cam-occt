import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pathToToolPath, pathsToToolPaths } from './path-to-toolpath';
import type { Path } from '../stores/paths';
import type { Tool } from '../stores/tools';
import type { Shape, Point2D, Line } from '../types';
import type { OffsetDirection } from '../algorithms/offset-calculation/offset/types';
import { LeadType, CutDirection } from '../types/direction';

// Mock getShapePoints function
vi.mock('../geometry/shape-utils', () => ({
  getShapePoints: vi.fn()
}));

import { getShapePoints } from '../geometry/shape-utils';
const mockGetShapePoints = vi.mocked(getShapePoints);

describe('pathToToolPath', () => {
  const createMockPath = (overrides: Partial<Path> = {}): Path => ({
    id: 'test-path',
    name: 'Test Path',
    operationId: 'test-operation',
    chainId: 'test-chain',
    toolId: null,
    enabled: true,
    order: 0,
    cutDirection: 'clockwise' as CutDirection,
    feedRate: 2000,
    pierceHeight: 4.0,
    pierceDelay: 1.0,
    kerfWidth: 1.5,
    leadInLength: 5.0,
    leadOutLength: 5.0,
    ...overrides
  });

  const createMockLine = (id: string, start: Point2D, end: Point2D): Shape => ({
    id,
    type: 'line',
    geometry: { start, end } as Line,
    layer: 'test'
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic path conversion', () => {
    it('should convert path with original shapes', () => {
      const path = createMockPath({ toolId: 'test-tool-1' });
      const shapes: Shape[] = [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })];
      const tools: Tool[] = [{
        id: 'test-tool-1',
        toolNumber: 1,
        toolName: 'Test Tool',
        feedRate: 2000,
        rapidRate: 5000,
        pierceHeight: 4.0,
        pierceDelay: 1.0,
        arcVoltage: 120,
        kerfWidth: 1.5,
        thcEnable: true,
        gasPressure: 4.5,
        pauseAtEnd: 0,
        puddleJumpHeight: 50,
        puddleJumpDelay: 0,
        plungeRate: 500
      }];
      
      mockGetShapePoints.mockReturnValueOnce([
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ]);

      const result = pathToToolPath(path, shapes, tools);

      expect(result).toEqual({
        id: 'test-path',
        shapeId: 'test-chain',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        leadIn: undefined,
        leadOut: undefined,
        isRapid: false,
        parameters: {
          feedRate: 2000,
          pierceHeight: 4.0,
          pierceDelay: 1.0,
          cutHeight: 1.5,
          kerf: 1.5,
          leadInLength: 5.0,
          leadOutLength: 5.0,
          isHole: false,
          holeUnderspeedPercent: undefined
        },
        originalShape: undefined
      });
    });

    it('should use offset shapes when available', () => {
      const path = createMockPath({
        calculatedOffset: {
          offsetShapes: [createMockLine('offset1', { x: 1, y: 1 }, { x: 11, y: 1 })],
          originalShapes: [createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 })],
          direction: 'outset' as OffsetDirection,
          kerfWidth: 1.0,
          generatedAt: '2023-01-01T00:00:00Z',
          version: '1.0'
        }
      });
      const originalShapes: Shape[] = [createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 })];
      
      mockGetShapePoints.mockReturnValueOnce([
        { x: 1, y: 1 },
        { x: 11, y: 1 }
      ]);

      const result = pathToToolPath(path, originalShapes, []);

      expect(result.points).toEqual([{ x: 1, y: 1 }, { x: 11, y: 1 }]);
      expect(mockGetShapePoints).toHaveBeenCalledWith(path.calculatedOffset!.offsetShapes[0]);
    });

    it('should use default parameters when path values are undefined', () => {
      const path = createMockPath({
        feedRate: undefined,
        pierceHeight: undefined,
        pierceDelay: undefined,
        kerfWidth: undefined,
        leadInLength: undefined,
        leadOutLength: undefined
      });
      const shapes: Shape[] = [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })];
      
      mockGetShapePoints.mockReturnValueOnce([{ x: 0, y: 0 }, { x: 10, y: 0 }]);

      const result = pathToToolPath(path, shapes, []);

      expect(result.parameters).toEqual({
        feedRate: 1000,
        pierceHeight: 3.8,
        pierceDelay: 0.5,
        cutHeight: 1.5,
        kerf: 0,
        leadInLength: 0,
        leadOutLength: 0,
        isHole: false,
        holeUnderspeedPercent: undefined
      });
    });
  });

  describe('multiple shapes handling', () => {
    it('should combine points from multiple shapes', () => {
      const path = createMockPath();
      const shapes: Shape[] = [
        createMockLine('line1', { x: 0, y: 0 }, { x: 5, y: 0 }),
        createMockLine('line2', { x: 5, y: 0 }, { x: 10, y: 0 })
      ];
      
      mockGetShapePoints
        .mockReturnValueOnce([{ x: 0, y: 0 }, { x: 5, y: 0 }])
        .mockReturnValueOnce([{ x: 5, y: 0 }, { x: 10, y: 0 }]);

      const result = pathToToolPath(path, shapes, []);

      expect(result.points).toEqual([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 }
      ]);
    });

    it('should skip duplicate points when shapes connect', () => {
      const path = createMockPath();
      const shapes: Shape[] = [
        createMockLine('line1', { x: 0, y: 0 }, { x: 5, y: 0 }),
        createMockLine('line2', { x: 5, y: 0 }, { x: 10, y: 0 })
      ];
      
      mockGetShapePoints
        .mockReturnValueOnce([{ x: 0, y: 0 }, { x: 5, y: 0 }])
        .mockReturnValueOnce([{ x: 5, y: 0 }, { x: 10, y: 0 }]);

      const result = pathToToolPath(path, shapes, []);

      // Should skip the duplicate point at (5, 0)
      expect(result.points).toEqual([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 }
      ]);
    });

    it('should include all points when shapes do not connect', () => {
      const path = createMockPath();
      const shapes: Shape[] = [
        createMockLine('line1', { x: 0, y: 0 }, { x: 5, y: 0 }),
        createMockLine('line2', { x: 6, y: 0 }, { x: 10, y: 0 }) // Gap at x=5 to x=6
      ];
      
      mockGetShapePoints
        .mockReturnValueOnce([{ x: 0, y: 0 }, { x: 5, y: 0 }])
        .mockReturnValueOnce([{ x: 6, y: 0 }, { x: 10, y: 0 }]);

      const result = pathToToolPath(path, shapes, []);

      expect(result.points).toEqual([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 6, y: 0 },
        { x: 10, y: 0 }
      ]);
    });

    it('should handle tolerance for point matching', () => {
      const path = createMockPath();
      const shapes: Shape[] = [
        createMockLine('line1', { x: 0, y: 0 }, { x: 5, y: 0 }),
        createMockLine('line2', { x: 5.0005, y: 0 }, { x: 10, y: 0 }) // Within tolerance
      ];
      
      mockGetShapePoints
        .mockReturnValueOnce([{ x: 0, y: 0 }, { x: 5, y: 0 }])
        .mockReturnValueOnce([{ x: 5.0005, y: 0 }, { x: 10, y: 0 }]);

      const result = pathToToolPath(path, shapes, []);

      // Should skip duplicate point since within tolerance
      expect(result.points).toEqual([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 }
      ]);
    });
  });

  describe('lead-in handling', () => {
    it('should include lead-in when using original geometry', () => {
      const leadInPoints: Point2D[] = [{ x: -5, y: 0 }, { x: 0, y: 0 }];
      const path = createMockPath({
        calculatedLeadIn: { 
          points: leadInPoints,
          type: LeadType.LINE,
          generatedAt: '2023-01-01T00:00:00Z',
          version: '1.0'
        }
      });
      const shapes: Shape[] = [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })];
      
      mockGetShapePoints.mockReturnValueOnce([{ x: 0, y: 0 }, { x: 10, y: 0 }]);

      const result = pathToToolPath(path, shapes, []);

      expect(result.leadIn).toEqual(leadInPoints);
    });

    it('should include lead-in when it connects to offset geometry', () => {
      const leadInPoints: Point2D[] = [{ x: -4, y: 1 }, { x: 1, y: 1 }];
      const path = createMockPath({
        calculatedOffset: {
          offsetShapes: [createMockLine('offset1', { x: 1, y: 1 }, { x: 11, y: 1 })],
          originalShapes: [createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 })],
          direction: 'outset' as OffsetDirection,
          kerfWidth: 1.0,
          generatedAt: '2023-01-01T00:00:00Z',
          version: '1.0'
        },
        calculatedLeadIn: { 
          points: leadInPoints,
          type: LeadType.LINE,
          generatedAt: '2023-01-01T00:00:00Z',
          version: '1.0'
        }
      });
      const originalShapes: Shape[] = [createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 })];
      
      mockGetShapePoints.mockReturnValueOnce([{ x: 1, y: 1 }, { x: 11, y: 1 }]);

      const result = pathToToolPath(path, originalShapes, []);

      expect(result.leadIn).toEqual(leadInPoints);
    });

    it('should exclude lead-in when it does not connect to offset geometry', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const leadInPoints: Point2D[] = [{ x: -5, y: 0 }, { x: 0, y: 0 }]; // Connects to original, not offset
      const path = createMockPath({
        calculatedOffset: {
          offsetShapes: [createMockLine('offset1', { x: 1, y: 1 }, { x: 11, y: 1 })],
          originalShapes: [createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 })],
          direction: 'outset' as OffsetDirection,
          kerfWidth: 1.0,
          generatedAt: '2023-01-01T00:00:00Z',
          version: '1.0'
        },
        calculatedLeadIn: { 
          points: leadInPoints,
          type: LeadType.LINE,
          generatedAt: '2023-01-01T00:00:00Z',
          version: '1.0'
        }
      });
      const originalShapes: Shape[] = [createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 })];
      
      mockGetShapePoints.mockReturnValueOnce([{ x: 1, y: 1 }, { x: 11, y: 1 }]);

      const result = pathToToolPath(path, originalShapes, []);

      expect(result.leadIn).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cached lead-in doesn't connect to offset path")
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle empty lead-in points', () => {
      const path = createMockPath({
        calculatedLeadIn: { 
          points: [],
          type: LeadType.LINE,
          generatedAt: '2023-01-01T00:00:00Z',
          version: '1.0'
        }
      });
      const shapes: Shape[] = [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })];
      
      mockGetShapePoints.mockReturnValueOnce([{ x: 0, y: 0 }, { x: 10, y: 0 }]);

      const result = pathToToolPath(path, shapes, []);

      expect(result.leadIn).toBeUndefined();
    });
  });

  describe('lead-out handling', () => {
    it('should include lead-out when using original geometry', () => {
      const leadOutPoints: Point2D[] = [{ x: 10, y: 0 }, { x: 15, y: 0 }];
      const path = createMockPath({
        calculatedLeadOut: { 
          points: leadOutPoints,
          type: LeadType.LINE,
          generatedAt: '2023-01-01T00:00:00Z',
          version: '1.0'
        }
      });
      const shapes: Shape[] = [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })];
      
      mockGetShapePoints.mockReturnValueOnce([{ x: 0, y: 0 }, { x: 10, y: 0 }]);

      const result = pathToToolPath(path, shapes, []);

      expect(result.leadOut).toEqual(leadOutPoints);
    });

    it('should include lead-out when it connects to offset geometry', () => {
      const leadOutPoints: Point2D[] = [{ x: 11, y: 1 }, { x: 16, y: 1 }];
      const path = createMockPath({
        calculatedOffset: {
          offsetShapes: [createMockLine('offset1', { x: 1, y: 1 }, { x: 11, y: 1 })],
          originalShapes: [createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 })],
          direction: 'outset' as OffsetDirection,
          kerfWidth: 1.0,
          generatedAt: '2023-01-01T00:00:00Z',
          version: '1.0'
        },
        calculatedLeadOut: { 
          points: leadOutPoints,
          type: LeadType.LINE,
          generatedAt: '2023-01-01T00:00:00Z',
          version: '1.0'
        }
      });
      const originalShapes: Shape[] = [createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 })];
      
      mockGetShapePoints.mockReturnValueOnce([{ x: 1, y: 1 }, { x: 11, y: 1 }]);

      const result = pathToToolPath(path, originalShapes, []);

      expect(result.leadOut).toEqual(leadOutPoints);
    });

    it('should exclude lead-out when it does not connect to offset geometry', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const leadOutPoints: Point2D[] = [{ x: 10, y: 0 }, { x: 15, y: 0 }]; // Connects to original, not offset
      const path = createMockPath({
        calculatedOffset: {
          offsetShapes: [createMockLine('offset1', { x: 1, y: 1 }, { x: 11, y: 1 })],
          originalShapes: [createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 })],
          direction: 'outset' as OffsetDirection,
          kerfWidth: 1.0,
          generatedAt: '2023-01-01T00:00:00Z',
          version: '1.0'
        },
        calculatedLeadOut: { 
          points: leadOutPoints,
          type: LeadType.LINE,
          generatedAt: '2023-01-01T00:00:00Z',
          version: '1.0'
        }
      });
      const originalShapes: Shape[] = [createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 })];
      
      mockGetShapePoints.mockReturnValueOnce([{ x: 1, y: 1 }, { x: 11, y: 1 }]);

      const result = pathToToolPath(path, originalShapes, []);

      expect(result.leadOut).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cached lead-out doesn't connect to offset path")
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle empty shapes array', () => {
      const path = createMockPath();
      const shapes: Shape[] = [];

      const result = pathToToolPath(path, shapes, []);

      expect(result.points).toEqual([]);
    });

    it('should handle single point shapes', () => {
      const path = createMockPath();
      const shapes: Shape[] = [createMockLine('point', { x: 5, y: 5 }, { x: 5, y: 5 })];
      
      mockGetShapePoints.mockReturnValueOnce([{ x: 5, y: 5 }]);

      const result = pathToToolPath(path, shapes, []);

      expect(result.points).toEqual([{ x: 5, y: 5 }]);
    });
  });
});

describe('pathsToToolPaths', () => {
  const createMockPath = (overrides: Partial<Path> = {}): Path => ({
    id: 'test-path',
    name: 'Test Path',
    operationId: 'test-operation',
    chainId: 'test-chain',
    toolId: null,
    enabled: true,
    order: 0,
    cutDirection: 'clockwise' as CutDirection,
    feedRate: 2000,
    pierceHeight: 4.0,
    pierceDelay: 1.0,
    kerfWidth: 1.5,
    leadInLength: 5.0,
    leadOutLength: 5.0,
    ...overrides
  });

  const createMockLine = (id: string, start: Point2D, end: Point2D): Shape => ({
    id,
    type: 'line',
    geometry: { start, end } as Line,
    layer: 'test'
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic conversion', () => {
    it('should convert multiple paths in order', () => {
      const paths: Path[] = [
        createMockPath({ id: 'path-2', order: 2 }),
        createMockPath({ id: 'path-1', order: 1 }),
        createMockPath({ id: 'path-3', order: 3 })
      ];
      
      const chainShapes = new Map<string, Shape[]>([
        ['test-chain', [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })]]
      ]);

      mockGetShapePoints
        .mockReturnValue([{ x: 0, y: 0 }, { x: 10, y: 0 }]);

      const result = pathsToToolPaths(paths, chainShapes, []);

      expect(result).toHaveLength(5); // 3 paths + 2 rapids
      expect(result[0].id).toBe('path-1');
      expect(result[1].id).toBe('rapid-0');
      expect(result[2].id).toBe('path-2');
      expect(result[3].id).toBe('rapid-1');
      expect(result[4].id).toBe('path-3');
    });

    it('should skip disabled paths', () => {
      const paths: Path[] = [
        createMockPath({ id: 'path-1', order: 1, enabled: true }),
        createMockPath({ id: 'path-2', order: 2, enabled: false }),
        createMockPath({ id: 'path-3', order: 3, enabled: true })
      ];
      
      const chainShapes = new Map<string, Shape[]>([
        ['test-chain', [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })]]
      ]);

      mockGetShapePoints
        .mockReturnValue([{ x: 0, y: 0 }, { x: 10, y: 0 }]);

      const result = pathsToToolPaths(paths, chainShapes, []);

      expect(result).toHaveLength(3); // 2 enabled paths + 1 rapid
      expect(result[0].id).toBe('path-1');
      expect(result[1].id).toBe('rapid-0');
      expect(result[2].id).toBe('path-3');
    });

    it('should skip paths with missing chain shapes', () => {
      const paths: Path[] = [
        createMockPath({ id: 'path-1', chainId: 'existing-chain' }),
        createMockPath({ id: 'path-2', chainId: 'missing-chain' })
      ];
      
      const chainShapes = new Map<string, Shape[]>([
        ['existing-chain', [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })]]
      ]);

      mockGetShapePoints
        .mockReturnValueOnce([{ x: 0, y: 0 }, { x: 10, y: 0 }]);

      const result = pathsToToolPaths(paths, chainShapes, []);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('path-1');
    });
  });

  describe('rapid generation', () => {
    it('should generate rapids between tool paths', () => {
      const paths: Path[] = [
        createMockPath({ id: 'path-1', order: 1 }),
        createMockPath({ id: 'path-2', order: 2 })
      ];
      
      const chainShapes = new Map<string, Shape[]>([
        ['test-chain', [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })]]
      ]);

      mockGetShapePoints
        .mockReturnValue([{ x: 0, y: 0 }, { x: 10, y: 0 }]);

      const result = pathsToToolPaths(paths, chainShapes, []);

      expect(result).toHaveLength(3); // 2 paths + 1 rapid
      
      const rapid = result[1];
      expect(rapid.id).toBe('rapid-0');
      expect(rapid.isRapid).toBe(true);
      expect(rapid.shapeId).toBe('');
      expect(rapid.parameters).toBeUndefined();
      expect(rapid.points).toEqual([
        { x: 10, y: 0 }, // End of first path
        { x: 0, y: 0 }   // Start of second path
      ]);
    });

    it('should use lead-in start point for rapid destination', () => {
      const paths: Path[] = [
        createMockPath({ id: 'path-1', order: 1 }),
        createMockPath({ 
          id: 'path-2', 
          order: 2,
          calculatedLeadIn: { 
            points: [{ x: -5, y: 5 }, { x: 0, y: 5 }],
            type: LeadType.LINE,
            generatedAt: '2023-01-01T00:00:00Z',
            version: '1.0'
          }
        })
      ];
      
      const chainShapes = new Map<string, Shape[]>([
        ['test-chain', [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })]]
      ]);

      mockGetShapePoints
        .mockReturnValue([{ x: 0, y: 0 }, { x: 10, y: 0 }]);

      const result = pathsToToolPaths(paths, chainShapes, []);

      const rapid = result[1];
      expect(rapid.points).toEqual([
        { x: 10, y: 0 }, // End of first path
        { x: -5, y: 5 }  // Start of lead-in for second path
      ]);
    });

    it('should not generate rapid for zero distance moves', () => {
      const paths: Path[] = [
        createMockPath({ id: 'path-1', order: 1 }),
        createMockPath({ id: 'path-2', order: 2 })
      ];
      
      const chainShapes = new Map<string, Shape[]>([
        ['test-chain', [createMockLine('line1', { x: 0, y: 0 }, { x: 0, y: 0 })]] // Same start/end
      ]);

      mockGetShapePoints
        .mockReturnValue([{ x: 0, y: 0 }]);

      const result = pathsToToolPaths(paths, chainShapes, []);

      expect(result).toHaveLength(2); // Only 2 paths, no rapid
      expect(result.every(tp => !tp.isRapid)).toBe(true);
    });

    it('should not generate rapid for very small movements', () => {
      const paths: Path[] = [
        createMockPath({ id: 'path-1', order: 1 }),
        createMockPath({ id: 'path-2', order: 2 })
      ];
      
      const chainShapes = new Map<string, Shape[]>([
        ['test-chain', [createMockLine('line1', { x: 0, y: 0 }, { x: 0.0005, y: 0 })]] // Within tolerance
      ]);

      mockGetShapePoints
        .mockReturnValueOnce([{ x: 0, y: 0 }, { x: 0.0005, y: 0 }])
        .mockReturnValueOnce([{ x: 0, y: 0 }, { x: 0.0005, y: 0 }]);

      const result = pathsToToolPaths(paths, chainShapes, []);

      expect(result).toHaveLength(2); // Only 2 paths, no rapid due to small distance
    });
  });

  describe('empty input handling', () => {
    it('should handle empty paths array', () => {
      const paths: Path[] = [];
      const chainShapes = new Map<string, Shape[]>();

      const result = pathsToToolPaths(paths, chainShapes, []);

      expect(result).toEqual([]);
    });

    it('should handle empty chainShapes map', () => {
      const paths: Path[] = [createMockPath()];
      const chainShapes = new Map<string, Shape[]>();

      const result = pathsToToolPaths(paths, chainShapes, []);

      expect(result).toEqual([]);
    });
  });
});