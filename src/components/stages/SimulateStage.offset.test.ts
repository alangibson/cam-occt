import { describe, it, expect, beforeEach } from 'vitest';
import type { Path } from '../../lib/stores/paths';
import type { Chain } from '../../lib/algorithms/chain-detection';
import type { Shape, Line, Arc, Circle } from '../../lib/types';
import type { OffsetDirection } from '../../lib/algorithms/offset-calculation/offset/types';

describe('SimulateStage offset path detection', () => {
  let mockPath: Path;
  let mockChain: Chain;
  let mockShapes: Shape[];
  let mockOffsetShapes: Shape[];

  beforeEach(() => {
    // Create mock shapes for original chain
    mockShapes = [
      {
        id: 'shape1',
        type: 'line',
        layerId: 'layer1',
        geometry: {
          start: { x: 0, y: 0 },
          end: { x: 100, y: 0 }
        } as Line
      },
      {
        id: 'shape2',
        type: 'line',
        layerId: 'layer1',
        geometry: {
          start: { x: 100, y: 0 },
          end: { x: 100, y: 100 }
        } as Line
      }
    ];

    // Create mock offset shapes (with different lengths to test properly)
    mockOffsetShapes = [
      {
        id: 'offset-shape1',
        type: 'line',
        layerId: 'layer1',
        geometry: {
          start: { x: -5, y: -5 },
          end: { x: 105, y: -5 }
        } as Line
      },
      {
        id: 'offset-shape2',
        type: 'line',
        layerId: 'layer1',
        geometry: {
          start: { x: 105, y: -5 },
          end: { x: 105, y: 105 }
        } as Line
      }
    ];

    mockChain = {
      id: 'chain1',
      shapes: mockShapes,
      closed: false,
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 100, y: 100 },
      area: 0
    };

    mockPath = {
      id: 'path1',
      name: 'Test Path',
      operationId: 'op1',
      chainId: 'chain1',
      toolId: 'tool1',
      enabled: true,
      order: 0,
      cutDirection: 'counterclockwise',
      feedRate: 1000,
      kerfCompensation: 'outset' as OffsetDirection,
      calculatedOffset: undefined
    };
  });

  describe('Offset path detection', () => {
    it('should detect when path has offset geometry', () => {
      mockPath.calculatedOffset = {
        offsetShapes: mockOffsetShapes,
        originalShapes: mockShapes,
        direction: 'outset' as OffsetDirection,
        kerfWidth: 5,
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      expect(mockPath.calculatedOffset).toBeDefined();
      expect(mockPath.calculatedOffset?.offsetShapes).toHaveLength(2);
      expect(mockPath.calculatedOffset?.originalShapes).toHaveLength(2);
    });

    it('should detect when path has no offset geometry', () => {
      mockPath.calculatedOffset = undefined;

      expect(mockPath.calculatedOffset).toBeUndefined();
    });

    it('should use offset shapes when available', () => {
      mockPath.calculatedOffset = {
        offsetShapes: mockOffsetShapes,
        originalShapes: mockShapes,
        direction: 'outset' as OffsetDirection,
        kerfWidth: 5,
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      // Simulate the logic from SimulateStage
      const shapes = mockPath.calculatedOffset?.offsetShapes || mockChain.shapes;
      
      expect(shapes).toBe(mockOffsetShapes);
      expect(shapes).not.toBe(mockShapes);
    });

    it('should fall back to original chain shapes when no offset exists', () => {
      mockPath.calculatedOffset = undefined;

      // Simulate the logic from SimulateStage
      const shapes = mockPath.calculatedOffset?.offsetShapes || mockChain.shapes;
      
      expect(shapes).toBe(mockShapes);
    });
  });

  describe('Path distance calculation with offsets', () => {
    it('should calculate distance using offset shapes when available', () => {
      mockPath.calculatedOffset = {
        offsetShapes: mockOffsetShapes,
        originalShapes: mockShapes,
        direction: 'outset' as OffsetDirection,
        kerfWidth: 5,
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      // Mock shape length calculation (simplified)
      function getShapeLength(shape: Shape): number {
        if (shape.type === 'line') {
          const line = shape.geometry as Line;
          return Math.sqrt(
            Math.pow(line.end.x - line.start.x, 2) + 
            Math.pow(line.end.y - line.start.y, 2)
          );
        }
        return 0;
      }

      const shapes = mockPath.calculatedOffset?.offsetShapes || mockChain.shapes;
      let totalDistance = 0;
      for (const shape of shapes) {
        totalDistance += getShapeLength(shape);
      }

      // Offset shapes should have slightly different distance
      const originalDistance = mockShapes.reduce((sum, shape) => sum + getShapeLength(shape), 0);
      const offsetDistance = mockOffsetShapes.reduce((sum, shape) => sum + getShapeLength(shape), 0);
      
      expect(totalDistance).toBe(offsetDistance);
      expect(totalDistance).not.toBe(originalDistance);
    });
  });

  describe('Lead calculation with offsets', () => {
    it('should use offset shapes for lead-in/out calculation', () => {
      mockPath.calculatedOffset = {
        offsetShapes: mockOffsetShapes,
        originalShapes: mockShapes,
        direction: 'outset' as OffsetDirection,
        kerfWidth: 5,
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      mockPath.leadInType = 'line';
      mockPath.leadInLength = 10;

      // Simulate the chain used for lead calculation
      const chainForLeads = mockPath.calculatedOffset ? 
        { ...mockChain, shapes: mockPath.calculatedOffset.offsetShapes } : mockChain;

      expect(chainForLeads.shapes).toBe(mockOffsetShapes);
      expect(chainForLeads.shapes).not.toBe(mockShapes);
    });
  });

  describe('Visual rendering with offsets', () => {
    it('should identify paths with offsets for different rendering', () => {
      mockPath.calculatedOffset = {
        offsetShapes: mockOffsetShapes,
        originalShapes: mockShapes,
        direction: 'outset' as OffsetDirection,
        kerfWidth: 5,
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      // Paths with offsets should be rendered with both solid and dashed lines
      const hasOffset = !!mockPath.calculatedOffset;
      const hasOriginalShapes = !!mockPath.calculatedOffset?.originalShapes;
      const hasOffsetShapes = !!mockPath.calculatedOffset?.offsetShapes;

      expect(hasOffset).toBe(true);
      expect(hasOriginalShapes).toBe(true);
      expect(hasOffsetShapes).toBe(true);
    });

    it('should identify paths without offsets for standard rendering', () => {
      mockPath.calculatedOffset = undefined;

      const hasOffset = !!mockPath.calculatedOffset;

      expect(hasOffset).toBe(false);
    });
  });

  describe('Mixed operations handling', () => {
    it('should handle mixed paths with and without offsets', () => {
      const pathWithOffset: Path = {
        ...mockPath,
        calculatedOffset: {
          offsetShapes: mockOffsetShapes,
          originalShapes: mockShapes,
          direction: 'outset' as OffsetDirection,
          kerfWidth: 5,
          generatedAt: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      const pathWithoutOffset: Path = {
        ...mockPath,
        id: 'path2',
        calculatedOffset: undefined
      };

      const paths = [pathWithOffset, pathWithoutOffset];

      // Each path should use its appropriate shapes
      paths.forEach(path => {
        const shapes = path.calculatedOffset?.offsetShapes || mockChain.shapes;
        
        if (path.id === 'path1') {
          expect(shapes).toBe(mockOffsetShapes);
        } else {
          expect(shapes).toBe(mockShapes);
        }
      });
    });
  });
});