import { describe, it, expect } from 'vitest';
import { analyzeChainTraversal, normalizeChain } from './chain-normalization';
import type { ShapeChain } from './chain-detection';
import type { Shape } from '../../types';

describe('Chain Normalization', () => {
  // Helper function to create a line shape
  function createLine(id: string, start: { x: number; y: number }, end: { x: number; y: number }): Shape {
    return {
      id,
      type: 'line',
      geometry: { start, end }
    } as Shape;
  }

  // Helper function to create a test chain
  function createChain(id: string, shapes: Shape[]): ShapeChain {
    return {
      id,
      shapes
    };
  }

  describe('analyzeChainTraversal', () => {
    it('should detect no issues in properly connected chain', () => {
      const shapes = [
        createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),  // Line 1: (0,0) to (10,0)
        createLine('line2', { x: 10, y: 0 }, { x: 10, y: 10 }), // Line 2: (10,0) to (10,10) - connects end-to-start
        createLine('line3', { x: 10, y: 10 }, { x: 0, y: 10 })  // Line 3: (10,10) to (0,10) - connects end-to-start
      ];

      const chain = createChain('chain-1', shapes);
      const results = analyzeChainTraversal([chain]);

      expect(results).toHaveLength(1);
      expect(results[0].chainId).toBe('chain-1');
      expect(results[0].canTraverse).toBe(true);
      expect(results[0].issues).toHaveLength(0);
    });

    it('should detect coincident endpoints issue', () => {
      const shapes = [
        createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),   // Line 1: ends at (10,0)
        createLine('line2', { x: 5, y: 5 }, { x: 10, y: 0 }),   // Line 2: also ends at (10,0) - problem!
        createLine('line3', { x: 5, y: 5 }, { x: 0, y: 10 })    // Line 3: starts at (5,5) - can connect if line2 is reversed
      ];

      const chain = createChain('chain-1', shapes);
      const results = analyzeChainTraversal([chain]);

      expect(results).toHaveLength(1);
      expect(results[0].canTraverse).toBe(false);
      expect(results[0].issues.length).toBeGreaterThan(0);
      
      const endpointIssue = results[0].issues.find(issue => issue.type === 'coincident_endpoints');
      expect(endpointIssue).toBeDefined();
      expect(endpointIssue?.description).toContain('both end at the same point');
    });

    it('should detect coincident startpoints issue', () => {
      const shapes = [
        createLine('line1', { x: 0, y: 0 }, { x: 5, y: 5 }),    // Line 1: ends at (5,5)
        createLine('line2', { x: 5, y: 5 }, { x: 10, y: 0 }),   // Line 2: starts at (5,5) - good connection
        createLine('line3', { x: 5, y: 5 }, { x: 0, y: 10 })    // Line 3: also starts at (5,5) - problem!
      ];

      const chain = createChain('chain-1', shapes);
      const results = analyzeChainTraversal([chain]);

      expect(results).toHaveLength(1);
      expect(results[0].canTraverse).toBe(false);
      expect(results[0].issues.length).toBeGreaterThan(0);
      
      const startpointIssue = results[0].issues.find(issue => issue.type === 'coincident_startpoints');
      expect(startpointIssue).toBeDefined();
      expect(startpointIssue?.description).toContain('both start at the same point');
    });

    it('should detect broken traversal with non-adjacent coincident points', () => {
      const shapes = [
        createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),   // Line 1
        createLine('line2', { x: 10, y: 0 }, { x: 10, y: 10 }), // Line 2 - connects properly
        createLine('line3', { x: 5, y: 5 }, { x: 0, y: 0 }),    // Line 3 - coincident with line1 start (non-adjacent)
        createLine('line4', { x: 10, y: 10 }, { x: 0, y: 10 })  // Line 4
      ];

      const chain = createChain('chain-1', shapes);
      const results = analyzeChainTraversal([chain]);

      expect(results).toHaveLength(1);
      expect(results[0].issues.length).toBeGreaterThan(0);
      
      const traversalIssue = results[0].issues.find(issue => issue.type === 'broken_traversal');
      expect(traversalIssue).toBeDefined();
      expect(traversalIssue?.description).toContain('Non-sequent shapes');
    });

    it('should handle single shape chain', () => {
      const shapes = [
        createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })
      ];

      const chain = createChain('chain-1', shapes);
      const results = analyzeChainTraversal([chain]);

      expect(results).toHaveLength(1);
      expect(results[0].canTraverse).toBe(true);
      expect(results[0].issues).toHaveLength(0);
    });

    it('should handle empty chain', () => {
      const chain = createChain('chain-1', []);
      const results = analyzeChainTraversal([chain]);

      expect(results).toHaveLength(1);
      expect(results[0].canTraverse).toBe(true);
      expect(results[0].issues).toHaveLength(0);
    });
  });

  describe('normalizeChain', () => {
    it('should reorder shapes for proper traversal', () => {
      // Create shapes in wrong order
      const shapes = [
        createLine('line1', { x: 10, y: 0 }, { x: 10, y: 10 }), // Should be second
        createLine('line2', { x: 0, y: 0 }, { x: 10, y: 0 }),   // Should be first  
        createLine('line3', { x: 10, y: 10 }, { x: 0, y: 10 })  // Should be third
      ];

      const chain = createChain('chain-1', shapes);
      const normalizedChain = normalizeChain(chain);

      // Should reorder to: line2 -> line1 -> line3
      expect(normalizedChain.shapes).toHaveLength(3);
      expect(normalizedChain.shapes[0].id).toBe('line2'); // (0,0) to (10,0)
      expect(normalizedChain.shapes[1].id).toBe('line1'); // (10,0) to (10,10)
      expect(normalizedChain.shapes[2].id).toBe('line3'); // (10,10) to (0,10)
      
      // Verify the chain can now be traversed
      const analysis = analyzeChainTraversal([normalizedChain]);
      expect(analysis[0].canTraverse).toBe(true);
      expect(analysis[0].issues).toHaveLength(0);
    });

    it('should reverse shapes when needed for proper connectivity', () => {
      // Create shapes where line2 needs to be reversed
      const shapes = [
        createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),   // (0,0) to (10,0)
        createLine('line2', { x: 10, y: 10 }, { x: 10, y: 0 }), // (10,10) to (10,0) - backwards!
        createLine('line3', { x: 10, y: 10 }, { x: 0, y: 10 })  // (10,10) to (0,10)
      ];

      const chain = createChain('chain-1', shapes);
      const normalizedChain = normalizeChain(chain);

      // Should keep line1, reverse line2, then add line3
      expect(normalizedChain.shapes).toHaveLength(3);
      
      // Check that line2 was reversed
      const normalizedLine2 = normalizedChain.shapes[1];
      const line2Geom = normalizedLine2.geometry as any;
      expect(line2Geom.start.x).toBe(10);
      expect(line2Geom.start.y).toBe(0);
      expect(line2Geom.end.x).toBe(10);
      expect(line2Geom.end.y).toBe(10);
      
      // Verify the chain can now be traversed
      const analysis = analyzeChainTraversal([normalizedChain]);
      expect(analysis[0].canTraverse).toBe(true);
      expect(analysis[0].issues).toHaveLength(0);
    });

    it('should fix coincident endpoints issue', () => {
      // Create shapes with coincident endpoints that can be fixed by reordering
      const shapes = [
        createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),   // ends at (10,0)
        createLine('line2', { x: 5, y: 5 }, { x: 10, y: 0 }),   // also ends at (10,0) - needs reversal!
        createLine('line3', { x: 5, y: 5 }, { x: 0, y: 10 })    // should connect to reversed line2
      ];

      const chain = createChain('chain-1', shapes);
      
      // Before normalization - should have issues
      const beforeAnalysis = analyzeChainTraversal([chain]);
      expect(beforeAnalysis[0].canTraverse).toBe(false);
      expect(beforeAnalysis[0].issues.length).toBeGreaterThan(0);
      
      const normalizedChain = normalizeChain(chain);
      
      // Log for debugging
      console.log('Normalized shapes:');
      normalizedChain.shapes.forEach((shape, i) => {
        const geom = shape.geometry as any;
        console.log(`  Shape ${i}: ${shape.id} from (${geom.start.x},${geom.start.y}) to (${geom.end.x},${geom.end.y})`);
      });
      
      // After normalization - should be fixed
      const afterAnalysis = analyzeChainTraversal([normalizedChain]);
      console.log('After analysis:', afterAnalysis[0]);
      expect(afterAnalysis[0].canTraverse).toBe(true);
      expect(afterAnalysis[0].issues).toHaveLength(0);
    });

    it('should handle disconnected shapes', () => {
      const shapes = [
        createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),
        createLine('line2', { x: 20, y: 20 }, { x: 30, y: 30 }) // Disconnected
      ];

      const chain = createChain('chain-1', shapes);
      const normalizedChain = normalizeChain(chain);

      // Should still have 2 shapes
      expect(normalizedChain.shapes).toHaveLength(2);
    });

    it('should preserve arc sweep direction when reversing', () => {
      // Helper function to create arc shapes
      function createArc(id: string, center: { x: number; y: number }, radius: number, startAngle: number, endAngle: number, clockwise: boolean = false): Shape {
        return {
          id,
          type: 'arc',
          geometry: {
            center,
            radius,
            startAngle,
            endAngle,
            clockwise
          }
        } as Shape;
      }

      // Create shapes that require arc reversal for proper chain connectivity
      const shapes = [
        createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),   // Line from (0,0) to (10,0)
        createArc('arc1', { x: 10, y: 5 }, 5, Math.PI/2, -Math.PI/2, true), // CW arc ending at (10,0), starting at (10,10)
        createLine('line2', { x: 10, y: 10 }, { x: 0, y: 10 })  // Line from (10,10) to (0,10)
      ];

      const chain = createChain('chain-1', shapes);
      const normalizedChain = normalizeChain(chain);

      // Find the reversed arc in the normalized chain
      const normalizedArc = normalizedChain.shapes.find(shape => shape.id === 'arc1');
      expect(normalizedArc).toBeDefined();
      
      if (normalizedArc && normalizedArc.type === 'arc') {
        const arcGeom = normalizedArc.geometry as any;
        
        // The arc should have been reversed (angles swapped)
        expect(arcGeom.startAngle).toBeCloseTo(-Math.PI/2, 5);
        expect(arcGeom.endAngle).toBeCloseTo(Math.PI/2, 5);
        
        // CRITICAL: The clockwise flag should be flipped to maintain sweep direction
        expect(arcGeom.clockwise).toBe(false); // Originally true, should now be false
      }
      
      // Verify the chain can be traversed properly after normalization
      const analysis = analyzeChainTraversal([normalizedChain]);
      expect(analysis[0].canTraverse).toBe(true);
      expect(analysis[0].issues).toHaveLength(0);
    });

    it('should preserve bulge directions when reversing polylines', () => {
      // Helper function to create polyline with bulges
      function createPolylineWithBulges(id: string, vertices: Array<{x: number, y: number, bulge?: number}>): Shape {
        const points = vertices.map(v => ({ x: v.x, y: v.y }));
        return {
          id,
          type: 'polyline',
          geometry: {
            points,
            vertices
          }
        } as Shape;
      }

      // Create shapes that require polyline reversal for proper connectivity
      // line1 ends at (10,0), poly1 should connect at (10,0) but ends at (20,0) instead
      // So poly1 needs to be reversed to start at (20,0) and end at (10,0)
      const shapes = [
        createLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),
        createPolylineWithBulges('poly1', [
          { x: 20, y: 0, bulge: 0.5 },   // CCW arc segment (positive bulge) - start point  
          { x: 15, y: 10, bulge: -0.3 }, // CW arc segment (negative bulge)
          { x: 10, y: 0, bulge: 0 }      // Straight segment - end point that should connect to line1
        ]),
        createLine('line2', { x: 20, y: 0 }, { x: 30, y: 0 })
      ];

      const chain = createChain('chain-1', shapes);
      const normalizedChain = normalizeChain(chain);


      // Find the polyline in normalized chain
      const normalizedPoly = normalizedChain.shapes.find(shape => shape.id === 'poly1');
      expect(normalizedPoly).toBeDefined();
      
      if (normalizedPoly && normalizedPoly.type === 'polyline') {
        const polyGeom = normalizedPoly.geometry as any;
        
        // Verify vertices array was reversed
        expect(polyGeom.vertices).toHaveLength(3);
        
        // Verify points were reversed  
        // Original order: [(20,0), (15,10), (10,0)] -> Reversed: [(10,0), (15,10), (20,0)]
        expect(polyGeom.points[0]).toEqual({ x: 10, y: 0 });
        expect(polyGeom.points[1]).toEqual({ x: 15, y: 10 });
        expect(polyGeom.points[2]).toEqual({ x: 20, y: 0 });
        
        // CRITICAL: Verify bulge values were negated to preserve arc directions
        // Original vertices: [{x:20,y:0,bulge:0.5}, {x:15,y:10,bulge:-0.3}, {x:10,y:0,bulge:0}]
        // Reversed: [{x:10,y:0,bulge:0}, {x:15,y:10,bulge:-0.3}, {x:20,y:0,bulge:0.5}]  
        // Negated: [{x:10,y:0,bulge:0}, {x:15,y:10,bulge:0.3}, {x:20,y:0,bulge:-0.5}]
        // Shifted: [{x:10,y:0,bulge:0.3}, {x:15,y:10,bulge:-0.5}, {x:20,y:0,bulge:0}]
        expect(polyGeom.vertices[0].bulge).toBeCloseTo(0.3, 5);   // Was -0.3, negated to 0.3, then shifted
        expect(polyGeom.vertices[1].bulge).toBeCloseTo(-0.5, 5);  // Was 0.5, negated to -0.5, then shifted  
        expect(polyGeom.vertices[2].bulge).toBeCloseTo(0, 5);     // Was 0, remains 0, then shifted
      }
    });
  });
});