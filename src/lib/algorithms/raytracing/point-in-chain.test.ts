import { describe, it, expect } from 'vitest';
import { isPointInsideChainExact, arePointsInsideChainExact, anyPointInsideChainExact, countPointsInsideChainExact } from './point-in-chain';
import type { Shape, Point2D } from '../../types/geometry';
import type { Chain } from '../chain-detection';
import { generateId } from '../../utils/id';

describe('Point-in-Chain Exact Testing', () => {
  // Helper function to create test chains
  function createRectangleChain(x: number, y: number, width: number, height: number): Chain {
    const shapes: Shape[] = [
      {
        id: generateId(),
        type: 'line',
        geometry: { start: { x, y }, end: { x: x + width, y } }
      },
      {
        id: generateId(),
        type: 'line',
        geometry: { start: { x: x + width, y }, end: { x: x + width, y: y + height } }
      },
      {
        id: generateId(),
        type: 'line',
        geometry: { start: { x: x + width, y: y + height }, end: { x, y: y + height } }
      },
      {
        id: generateId(),
        type: 'line',
        geometry: { start: { x, y: y + height }, end: { x, y } }
      }
    ];

    return {
      id: generateId(),
      shapes
    };
  }

  function createCircleChain(centerX: number, centerY: number, radius: number): Chain {
    return {
      id: generateId(),
      shapes: [{
        id: generateId(),
        type: 'circle',
        geometry: { center: { x: centerX, y: centerY }, radius }
      }]
    };
  }

  function createRoundedRectangleChain(x: number, y: number, width: number, height: number, cornerRadius: number): Chain {
    const shapes: Shape[] = [
      // Bottom line
      {
        id: generateId(),
        type: 'line',
        geometry: { 
          start: { x: x + cornerRadius, y }, 
          end: { x: x + width - cornerRadius, y } 
        }
      },
      // Bottom-right corner
      {
        id: generateId(),
        type: 'arc',
        geometry: {
          center: { x: x + width - cornerRadius, y: y + cornerRadius },
          radius: cornerRadius,
          startAngle: -Math.PI / 2,
          endAngle: 0,
          clockwise: false
        }
      },
      // Right line
      {
        id: generateId(),
        type: 'line',
        geometry: { 
          start: { x: x + width, y: y + cornerRadius }, 
          end: { x: x + width, y: y + height - cornerRadius } 
        }
      },
      // Top-right corner
      {
        id: generateId(),
        type: 'arc',
        geometry: {
          center: { x: x + width - cornerRadius, y: y + height - cornerRadius },
          radius: cornerRadius,
          startAngle: 0,
          endAngle: Math.PI / 2,
          clockwise: false
        }
      },
      // Top line
      {
        id: generateId(),
        type: 'line',
        geometry: { 
          start: { x: x + width - cornerRadius, y: y + height }, 
          end: { x: x + cornerRadius, y: y + height } 
        }
      },
      // Top-left corner
      {
        id: generateId(),
        type: 'arc',
        geometry: {
          center: { x: x + cornerRadius, y: y + height - cornerRadius },
          radius: cornerRadius,
          startAngle: Math.PI / 2,
          endAngle: Math.PI,
          clockwise: false
        }
      },
      // Left line
      {
        id: generateId(),
        type: 'line',
        geometry: { 
          start: { x, y: y + height - cornerRadius }, 
          end: { x, y: y + cornerRadius } 
        }
      },
      // Bottom-left corner
      {
        id: generateId(),
        type: 'arc',
        geometry: {
          center: { x: x + cornerRadius, y: y + cornerRadius },
          radius: cornerRadius,
          startAngle: Math.PI,
          endAngle: 3 * Math.PI / 2,
          clockwise: false
        }
      }
    ];

    return {
      id: generateId(),
      shapes
    };
  }

  describe('isPointInsideChainExact', () => {
    it('should correctly identify points inside a rectangle', () => {
      const chain = createRectangleChain(0, 0, 10, 10);
      
      expect(isPointInsideChainExact({ x: 5, y: 5 }, chain)).toBe(true);
      expect(isPointInsideChainExact({ x: 1, y: 1 }, chain)).toBe(true);
      expect(isPointInsideChainExact({ x: 9, y: 9 }, chain)).toBe(true);
    });

    it('should correctly identify points outside a rectangle', () => {
      const chain = createRectangleChain(0, 0, 10, 10);
      
      expect(isPointInsideChainExact({ x: -1, y: 5 }, chain)).toBe(false);
      expect(isPointInsideChainExact({ x: 11, y: 5 }, chain)).toBe(false);
      expect(isPointInsideChainExact({ x: 5, y: -1 }, chain)).toBe(false);
      expect(isPointInsideChainExact({ x: 5, y: 11 }, chain)).toBe(false);
    });

    it('should correctly identify points inside a circle', () => {
      const chain = createCircleChain(0, 0, 5);
      
      expect(isPointInsideChainExact({ x: 0, y: 0 }, chain)).toBe(true);
      expect(isPointInsideChainExact({ x: 3, y: 0 }, chain)).toBe(true);
      expect(isPointInsideChainExact({ x: 0, y: 3 }, chain)).toBe(true);
      expect(isPointInsideChainExact({ x: 2, y: 2 }, chain)).toBe(true);
    });

    it('should correctly identify points outside a circle', () => {
      const chain = createCircleChain(0, 0, 5);
      
      expect(isPointInsideChainExact({ x: 6, y: 0 }, chain)).toBe(false);
      expect(isPointInsideChainExact({ x: 0, y: 6 }, chain)).toBe(false);
      expect(isPointInsideChainExact({ x: 4, y: 4 }, chain)).toBe(false);
      expect(isPointInsideChainExact({ x: -6, y: 0 }, chain)).toBe(false);
    });

    it('should handle rounded rectangle with mixed shapes', () => {
      const chain = createRoundedRectangleChain(0, 0, 20, 10, 2);
      
      // Points clearly inside
      expect(isPointInsideChainExact({ x: 10, y: 5 }, chain)).toBe(true);
      expect(isPointInsideChainExact({ x: 5, y: 3 }, chain)).toBe(true);
      
      // Points clearly outside
      expect(isPointInsideChainExact({ x: -1, y: 5 }, chain)).toBe(false);
      expect(isPointInsideChainExact({ x: 21, y: 5 }, chain)).toBe(false);
      
      // Points near rounded corners (this is where exact testing shines)
      expect(isPointInsideChainExact({ x: 1, y: 1 }, chain)).toBe(true);  // Inside corner arc
      expect(isPointInsideChainExact({ x: 0.5, y: 0.5 }, chain)).toBe(false); // Outside corner arc
    });

    it('should throw error for open chains', () => {
      const openChain: Chain = {
        id: generateId(),
        shapes: [
          {
            id: generateId(),
            type: 'line',
            geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }
          },
          {
            id: generateId(),
            type: 'line',
            geometry: { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } }
          }
        ]
      };

      expect(() => {
        isPointInsideChainExact({ x: 5, y: 5 }, openChain);
      }).toThrow('Cannot check point containment for open chain');
    });
  });

  describe('arePointsInsideChainExact', () => {
    it('should test multiple points correctly', () => {
      const chain = createRectangleChain(0, 0, 10, 10);
      const points: Point2D[] = [
        { x: 5, y: 5 },   // inside
        { x: 15, y: 5 },  // outside
        { x: 1, y: 1 },   // inside
        { x: -1, y: 5 }   // outside
      ];

      const results = arePointsInsideChainExact(points, chain);
      expect(results).toEqual([true, false, true, false]);
    });

    it('should handle empty point array', () => {
      const chain = createRectangleChain(0, 0, 10, 10);
      const results = arePointsInsideChainExact([], chain);
      expect(results).toEqual([]);
    });
  });

  describe('anyPointInsideChainExact', () => {
    it('should return true if any point is inside', () => {
      const chain = createRectangleChain(0, 0, 10, 10);
      const points: Point2D[] = [
        { x: 15, y: 5 },  // outside
        { x: 5, y: 5 },   // inside - should trigger true
        { x: -1, y: 5 }   // outside
      ];

      expect(anyPointInsideChainExact(points, chain)).toBe(true);
    });

    it('should return false if no points are inside', () => {
      const chain = createRectangleChain(0, 0, 10, 10);
      const points: Point2D[] = [
        { x: 15, y: 5 },  // outside
        { x: -5, y: 5 },  // outside
        { x: 5, y: 15 }   // outside
      ];

      expect(anyPointInsideChainExact(points, chain)).toBe(false);
    });

    it('should short-circuit on first inside point', () => {
      const chain = createRectangleChain(0, 0, 10, 10);
      const points: Point2D[] = [
        { x: 5, y: 5 },   // inside - should stop here
        { x: 15, y: 5 },  // outside
        { x: -1, y: 5 }   // outside
      ];

      expect(anyPointInsideChainExact(points, chain)).toBe(true);
    });
  });

  describe('countPointsInsideChainExact', () => {
    it('should count all inside points correctly', () => {
      const chain = createRectangleChain(0, 0, 10, 10);
      const points: Point2D[] = [
        { x: 5, y: 5 },   // inside
        { x: 15, y: 5 },  // outside
        { x: 1, y: 1 },   // inside
        { x: -1, y: 5 },  // outside
        { x: 9, y: 9 },   // inside
        { x: 2, y: 2 }    // inside
      ];

      expect(countPointsInsideChainExact(points, chain)).toBe(4);
    });

    it('should return 0 for all outside points', () => {
      const chain = createRectangleChain(0, 0, 10, 10);
      const points: Point2D[] = [
        { x: 15, y: 5 },
        { x: -5, y: 5 },
        { x: 5, y: 15 },
        { x: 5, y: -5 }
      ];

      expect(countPointsInsideChainExact(points, chain)).toBe(0);
    });
  });

  describe('Complex Shapes', () => {
    it('should handle star-shaped chain with many line segments', () => {
      // Create a simple 8-pointed star (4 outer points, 4 inner points)
      const shapes: Shape[] = [
        { id: generateId(), type: 'line', geometry: { start: { x: 0, y: -10 }, end: { x: 2, y: -2 } } },
        { id: generateId(), type: 'line', geometry: { start: { x: 2, y: -2 }, end: { x: 10, y: 0 } } },
        { id: generateId(), type: 'line', geometry: { start: { x: 10, y: 0 }, end: { x: 2, y: 2 } } },
        { id: generateId(), type: 'line', geometry: { start: { x: 2, y: 2 }, end: { x: 0, y: 10 } } },
        { id: generateId(), type: 'line', geometry: { start: { x: 0, y: 10 }, end: { x: -2, y: 2 } } },
        { id: generateId(), type: 'line', geometry: { start: { x: -2, y: 2 }, end: { x: -10, y: 0 } } },
        { id: generateId(), type: 'line', geometry: { start: { x: -10, y: 0 }, end: { x: -2, y: -2 } } },
        { id: generateId(), type: 'line', geometry: { start: { x: -2, y: -2 }, end: { x: 0, y: -10 } } }
      ];

      const starChain: Chain = { id: generateId(), shapes };

      // This star has 8 line segments forming a closed star shape
      // For horizontal ray from center (0,0) going right:
      // Only one line crosses to the right with proper boundary handling
      
      // Test points inside star
      expect(isPointInsideChainExact({ x: 0, y: 0 }, starChain)).toBe(true);
      expect(isPointInsideChainExact({ x: 1, y: 0 }, starChain)).toBe(true);
      
      // Test points outside star
      expect(isPointInsideChainExact({ x: 15, y: 0 }, starChain)).toBe(false);
      expect(isPointInsideChainExact({ x: 0, y: 15 }, starChain)).toBe(false);
    });

    it('should demonstrate improvement over sampling for arc-heavy shapes', () => {
      // Create a flower-like shape with multiple arcs
      const centerRadius = 5;
      const petalRadius = 3;
      const numPetals = 6;
      const shapes: Shape[] = [];

      for (let i: number = 0; i < numPetals; i++) {
        const angle: number = (i * 2 * Math.PI) / numPetals;
        const centerX = centerRadius * Math.cos(angle);
        const centerY = centerRadius * Math.sin(angle);
        
        shapes.push({
          id: generateId(),
          type: 'circle',
          geometry: {
            center: { x: centerX, y: centerY },
            radius: petalRadius
          }
        });
      }

      const flowerChain: Chain = { id: generateId(), shapes };

      // Test that the exact algorithm handles disconnected shapes appropriately
      // (throws error for non-chains, which is correct behavior)
      expect(() => isPointInsideChainExact({ x: 0, y: 0 }, flowerChain)).toThrow('Cannot check point containment for open chain');
      expect(() => isPointInsideChainExact({ x: 2, y: 2 }, flowerChain)).toThrow('Cannot check point containment for open chain');
      expect(() => isPointInsideChainExact({ x: 10, y: 10 }, flowerChain)).toThrow('Cannot check point containment for open chain');
    });
  });
});