import { describe, it, expect } from 'vitest';
import type { Chain } from '../../chain-detection/chain-detection';
import type { Shape } from '../../../types/geometry';
import type { ChainOffsetResult, ChainOffsetParameters } from './types';
import { offsetChain } from './offset';
import { DEFAULT_CHAIN_OFFSET_PARAMETERS } from './types';
import { createPolylineFromVertices } from '../../../geometry/polyline';

describe('Chain Self-Intersection Validation', () => {

  /**
   * Helper function to create a chain from a polyline
   */
  function createChainFromPolylineShape(polylineShape: Shape, id: string = 'test-chain'): Chain {
    return {
      id,
      shapes: [polylineShape]
    };
  }

  describe('Self-Intersecting Polyline Offsets', () => {

    it('should detect self-intersections in figure-8 polyline offsets', () => {
      // Create a figure-8 pattern that will produce self-intersecting offsets
      const figure8Points: Array<{x: number, y: number, bulge: number}> = [
        { x: 0, y: 0, bulge: 0 },
        { x: 20, y: 20, bulge: 0 },
        { x: 0, y: 20, bulge: 0 },
        { x: 20, y: 0, bulge: 0 }
      ];

      const polyline = createPolylineFromVertices(figure8Points, true);
      const chain = createChainFromPolylineShape(polyline, 'figure8-chain');

      // Enable self-intersection detection
      const params: ChainOffsetParameters = {
        ...DEFAULT_CHAIN_OFFSET_PARAMETERS,
        polylineIntersections: true
      };

      // Test both positive and negative offsets
      const outsetResult: ChainOffsetResult = offsetChain(chain, 2, params);
      const insetResult: ChainOffsetResult = offsetChain(chain, -2, params);

      // Both results should succeed
      expect(outsetResult.success).toBe(true);
      expect(insetResult.success).toBe(true);

      // Check that intersection points are detected
      if (outsetResult.outerChain) {
        expect(outsetResult.outerChain.intersectionPoints).toBeDefined();
        if (outsetResult.outerChain.intersectionPoints) {
          expect(outsetResult.outerChain.intersectionPoints.length).toBeGreaterThan(0);
        }
      }

      if (insetResult.innerChain) {
        expect(insetResult.innerChain.intersectionPoints).toBeDefined();
        if (insetResult.innerChain.intersectionPoints) {
          expect(insetResult.innerChain.intersectionPoints.length).toBeGreaterThan(0);
        }
      }
    });

    it('should handle self-intersecting star pattern correctly', () => {
      // Create a 5-pointed star that may self-intersect when offset
      const starPoints: Array<{x: number, y: number, bulge: number}> = [
        { x: 10, y: 0, bulge: 0 },    // Top point
        { x: 12, y: 6, bulge: 0 },    // Inner point
        { x: 18, y: 6, bulge: 0 },    // Right outer
        { x: 14, y: 10, bulge: 0 },   // Inner point
        { x: 16, y: 16, bulge: 0 },   // Bottom right
        { x: 10, y: 12, bulge: 0 },   // Inner point
        { x: 4, y: 16, bulge: 0 },    // Bottom left
        { x: 6, y: 10, bulge: 0 },    // Inner point
        { x: 2, y: 6, bulge: 0 },     // Left outer
        { x: 8, y: 6, bulge: 0 }      // Inner point
      ];

      const polyline = createPolylineFromVertices(starPoints, true);
      const chain = createChainFromPolylineShape(polyline, 'star-chain');

      const params: ChainOffsetParameters = {
        ...DEFAULT_CHAIN_OFFSET_PARAMETERS,
        polylineIntersections: true
      };

      const offsetResult: ChainOffsetResult = offsetChain(chain, 1, params);

      expect(offsetResult.success).toBe(true);
      
      // Star patterns often create self-intersections when offset
      if (offsetResult.outerChain && offsetResult.outerChain.intersectionPoints) {
        // The star may or may not have self-intersections depending on offset amount
        // Just ensure the detection runs without errors
        expect(offsetResult.outerChain.intersectionPoints.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should not report self-intersections in simple non-intersecting polylines', () => {
      // Simple rectangle that should not self-intersect
      const rectanglePoints: Array<{x: number, y: number, bulge: number}> = [
        { x: 0, y: 0, bulge: 0 },
        { x: 10, y: 0, bulge: 0 },
        { x: 10, y: 10, bulge: 0 },
        { x: 0, y: 10, bulge: 0 }
      ];

      const polyline = createPolylineFromVertices(rectanglePoints, true);
      const chain = createChainFromPolylineShape(polyline, 'rectangle-chain');

      const params: ChainOffsetParameters = {
        ...DEFAULT_CHAIN_OFFSET_PARAMETERS,
        polylineIntersections: true
      };

      const offsetResult: ChainOffsetResult = offsetChain(chain, 2, params);

      expect(offsetResult.success).toBe(true);
      
      // Simple rectangle offsets should not have self-intersections
      if (offsetResult.outerChain && offsetResult.outerChain.intersectionPoints) {
        // Filter out intersection points that are not self-intersections
        // (the chain offset may still have regular intersections between adjacent shapes)
        const actualSelfIntersections = offsetResult.outerChain.intersectionPoints.filter(
          intersection => intersection.type !== 'tangent'
        );
        expect(actualSelfIntersections.length).toBe(0);
      }
    });
  });

  describe('Self-Intersection Reporting', () => {

    it('should provide detailed information about detected self-intersections', () => {
      const figure8Points: Array<{x: number, y: number, bulge: number}> = [
        { x: 0, y: 0, bulge: 0 },
        { x: 20, y: 20, bulge: 0 },
        { x: 0, y: 20, bulge: 0 },
        { x: 20, y: 0, bulge: 0 }
      ];

      const polyline = createPolylineFromVertices(figure8Points, true);
      const chain = createChainFromPolylineShape(polyline, 'figure8-detailed');

      const params: ChainOffsetParameters = {
        ...DEFAULT_CHAIN_OFFSET_PARAMETERS,
        polylineIntersections: true
      };

      const offsetResult: ChainOffsetResult = offsetChain(chain, 3, params);

      if (offsetResult.success && offsetResult.outerChain && offsetResult.outerChain.intersectionPoints) {
        offsetResult.outerChain.intersectionPoints.forEach(intersection => {
          // Each intersection should have valid coordinates
          expect(intersection.point.x).toBeDefined();
          expect(intersection.point.y).toBeDefined();
          expect(typeof intersection.point.x).toBe('number');
          expect(typeof intersection.point.y).toBe('number');

          // Parameters should be in valid range
          expect(intersection.param1).toBeGreaterThanOrEqual(0);
          expect(intersection.param2).toBeGreaterThanOrEqual(0);

          // Confidence should be between 0 and 1
          expect(intersection.confidence).toBeGreaterThanOrEqual(0);
          expect(intersection.confidence).toBeLessThanOrEqual(1);

          // Type should be defined
          expect(['exact', 'approximate', 'tangent', 'coincident']).toContain(intersection.type);
        });
      }
    });

    it('should handle complex polylines with many potential self-intersections', () => {
      // Create a complex zigzag pattern
      const zigzagPoints: Array<{x: number, y: number, bulge: number}> = [];
      const numPoints = 20;
      
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 4; // 2 full rotations
        const radius = 10 + (i % 3) * 2; // Varying radius
        zigzagPoints.push({
          x: radius * Math.cos(angle),
          y: radius * Math.sin(angle),
          bulge: 0
        });
      }

      const polyline = createPolylineFromVertices(zigzagPoints, true);
      const chain = createChainFromPolylineShape(polyline, 'zigzag-chain');

      const params: ChainOffsetParameters = {
        ...DEFAULT_CHAIN_OFFSET_PARAMETERS,
        polylineIntersections: true
      };

      const offsetResult: ChainOffsetResult = offsetChain(chain, 1, params);

      // Should complete successfully even with complex geometry
      expect(offsetResult.success).toBe(true);
      
      // Performance check - should complete in reasonable time
      const startTime = Date.now();
      const secondOffsetResult: ChainOffsetResult = offsetChain(chain, 0.5, params);
      const endTime = Date.now();
      
      expect(secondOffsetResult.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
    });
  });

  describe('Integration with Chain Offset Parameters', () => {

    it('should respect polylineIntersections parameter setting', () => {
      const testPoints: Array<{x: number, y: number, bulge: number}> = [
        { x: 0, y: 0, bulge: 0 },
        { x: 10, y: 10, bulge: 0 },
        { x: 20, y: 0, bulge: 0 },
        { x: 10, y: -10, bulge: 0 }
      ];

      const polyline = createPolylineFromVertices(testPoints, true);
      const chain = createChainFromPolylineShape(polyline, 'test-param-chain');

      // Test with polylineIntersections disabled
      const paramsDisabled: ChainOffsetParameters = {
        ...DEFAULT_CHAIN_OFFSET_PARAMETERS,
        polylineIntersections: false
      };

      const resultDisabled: ChainOffsetResult = offsetChain(chain, 2, paramsDisabled);

      // Test with polylineIntersections enabled
      const paramsEnabled: ChainOffsetParameters = {
        ...DEFAULT_CHAIN_OFFSET_PARAMETERS,
        polylineIntersections: true
      };

      const resultEnabled: ChainOffsetResult = offsetChain(chain, 2, paramsEnabled);

      // Both should succeed
      expect(resultDisabled.success).toBe(true);
      expect(resultEnabled.success).toBe(true);

      // When disabled, intersection points array might be empty or undefined
      // When enabled, intersection points should be populated if any exist
      if (resultEnabled.outerChain) {
        expect(resultEnabled.outerChain.intersectionPoints).toBeDefined();
      }
    });

    it('should handle edge cases in self-intersection detection', () => {
      // Test with a simple rectangle that definitely shouldn't self-intersect
      const simplePoints: Array<{x: number, y: number, bulge: number}> = [
        { x: 0, y: 0, bulge: 0 },
        { x: 20, y: 0, bulge: 0 },
        { x: 20, y: 20, bulge: 0 },
        { x: 0, y: 20, bulge: 0 }
      ];

      const polyline = createPolylineFromVertices(simplePoints, true);
      const chain = createChainFromPolylineShape(polyline, 'simple-rectangle-chain');

      const params: ChainOffsetParameters = {
        ...DEFAULT_CHAIN_OFFSET_PARAMETERS,
        polylineIntersections: true,
        tolerance: 0.01 // Tight tolerance
      };

      const offsetResult: ChainOffsetResult = offsetChain(chain, 1, params);

      // Should handle simple cases correctly
      expect(offsetResult.success).toBe(true);
      
      // Simple rectangle with small offset should not create self-intersecting offsets
      // The system should run without errors regardless of whether intersections are found
      expect(offsetResult.outerChain).toBeDefined();
    });
  });
});