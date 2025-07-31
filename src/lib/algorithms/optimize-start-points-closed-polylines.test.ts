import { describe, it, expect } from 'vitest';
import { optimizeStartPoints } from './optimize-start-points';
import { isChainClosed } from './part-detection';
import type { Shape } from '../../types';
import type { ShapeChain } from './chain-detection';

describe('optimizeStartPoints - closed polylines', () => {
  const tolerance = 0.1;

  it('should recognize single closed polylines as closed chains', () => {
    // Simulate ADLER.dxf style - single closed polyline in a chain
    const closedPolyline: Shape = {
      id: 'closed-polyline-1',
      type: 'polyline',
      geometry: {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
          { x: 0, y: 0 } // Duplicate first point to ensure geometric closure
        ],
        closed: true // This is the key flag from DXF parsing
      }
    };

    const chain: ShapeChain = {
      id: 'chain-1',
      shapes: [closedPolyline]
    };

    // First, verify that isChainClosed correctly identifies this as closed
    expect(isChainClosed(chain, tolerance)).toBe(true);

    // Now test optimization
    const result = optimizeStartPoints([chain], tolerance);
    
    // Should have split the polyline (original 1 shape -> 2 split shapes)
    expect(result.length).toBe(2);
    
    // Should have split the polyline
    const splitShapes = result.filter(s => s.id.includes('-split-'));
    expect(splitShapes.length).toBe(2);
  });

  it('should handle ADLER.dxf scenario - multiple single closed polyline chains', () => {
    // Simulate typical ADLER.dxf structure - each chain contains one closed polyline
    const chains: ShapeChain[] = [];
    
    for (let i = 0; i < 3; i++) {
      const closedPolyline: Shape = {
        id: `adler-polyline-${i}`,
        type: 'polyline',
        geometry: {
          points: [
            { x: i * 20, y: 0 },
            { x: i * 20 + 15, y: 0 },
            { x: i * 20 + 15, y: 8 },
            { x: i * 20 + 10, y: 12 },
            { x: i * 20 + 5, y: 8 },
            { x: i * 20, y: 8 },
            { x: i * 20, y: 0 } // Duplicate first point
          ],
          closed: true
        }
      };

      chains.push({
        id: `adler-chain-${i}`,
        shapes: [closedPolyline]
      });
    }

    // Verify all chains are recognized as closed
    chains.forEach(chain => {
      expect(isChainClosed(chain, tolerance)).toBe(true);
    });

    const result = optimizeStartPoints(chains, tolerance);
    
    // Should have optimized all 3 chains (3 original polylines -> 6 split shapes)
    expect(result.length).toBe(6);
    
    // All should have been split
    const splitShapes = result.filter(s => s.id.includes('-split-'));
    expect(splitShapes.length).toBe(6);
  });

  it('should not optimize open polylines', () => {
    const openPolyline: Shape = {
      id: 'open-polyline-1',
      type: 'polyline',
      geometry: {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 }
        ],
        closed: false
      }
    };

    const chain: ShapeChain = {
      id: 'open-chain',
      shapes: [openPolyline]
    };

    // Verify it's not recognized as closed
    expect(isChainClosed(chain, tolerance)).toBe(false);

    const result = optimizeStartPoints([chain], tolerance);
    
    // Should not have been modified
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('open-polyline-1');
  });

  it('should handle polylines without explicit closed flag by checking geometric closure', () => {
    // Some polylines might not have the closed flag but are geometrically closed
    const geometricallyClosedPolyline: Shape = {
      id: 'geo-closed-polyline',
      type: 'polyline',
      geometry: {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 10 },
          { x: 0.05, y: 0.05 } // Distance = sqrt(0.05² + 0.05²) ≈ 0.071 < 0.1 tolerance
        ],
        closed: false // No explicit closed flag, relies on geometric closure
      }
    };

    const chain: ShapeChain = {
      id: 'geo-closed-chain',
      shapes: [geometricallyClosedPolyline]
    };

    // Should fall back to geometric check and recognize as closed
    expect(isChainClosed(chain, tolerance)).toBe(true);

    const result = optimizeStartPoints([chain], tolerance);
    
    // Should have been optimized
    expect(result.length).toBe(2);
    const splitShapes = result.filter(s => s.id.includes('-split-'));
    expect(splitShapes.length).toBe(2);
  });
});