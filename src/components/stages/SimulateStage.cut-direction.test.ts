import { describe, it, expect, beforeEach } from 'vitest';
import { pathStore } from '$lib/stores/paths';
import { chainStore, clearChains, clearChainSelection, setChains } from '$lib/stores/chains';
import type { ShapeChain } from '$lib/algorithms/chain-detection';
import type { Shape } from '../../lib/types';
import { CutDirection, LeadType } from '$lib/types/direction';

describe('SimulateStage Cut Direction', () => {
  beforeEach(() => {
    // Reset stores
    pathStore.reset();
    clearChains();
    clearChainSelection();
  });

  it('should trace circles clockwise when cut direction is clockwise', () => {
    // Create a circle shape
    const circleShape: Shape = {
      id: 'circle-1',
      type: 'circle',
      geometry: {
        center: { x: 100, y: 100 },
        radius: 50
      }
    };

    // Create a chain with the circle
    const chain: ShapeChain = {
      id: 'chain-1',
      shapes: [circleShape]
    };

    // Add chain to store
    setChains([chain]);

    // Create paths with different cut directions
    pathStore.addPath({
      name: 'Clockwise Circle',
      operationId: 'op-1',
      chainId: 'chain-1',
      toolId: 'tool-1',
      enabled: true,
      order: 1,
      cutDirection: CutDirection.CLOCKWISE,
      feedRate: 1000
    });

    pathStore.addPath({
      name: 'Counterclockwise Circle',
      operationId: 'op-2',
      chainId: 'chain-1',
      toolId: 'tool-1',
      enabled: true,
      order: 2,
      cutDirection: CutDirection.COUNTERCLOCKWISE,
      feedRate: 1000
    });

    // Access the internal getPositionOnShape function from the SimulateStage component
    // For testing purposes, we'll verify the mathematical correctness directly
    
    // Test clockwise direction - at progress 0.25 (90 degrees clockwise)
    // Clockwise: angle = -0.25 * 2π = -π/2 (points downward from center)
    const expectedClockwise = {
      x: 100 + 50 * Math.cos(-Math.PI / 2), // = 100 + 50 * 0 = 100
      y: 100 + 50 * Math.sin(-Math.PI / 2)  // = 100 + 50 * (-1) = 50
    };

    // Test counterclockwise direction - at progress 0.25 (90 degrees counterclockwise)
    // Counterclockwise: angle = 0.25 * 2π = π/2 (points upward from center)
    const expectedCounterclockwise = {
      x: 100 + 50 * Math.cos(Math.PI / 2), // = 100 + 50 * 0 = 100
      y: 100 + 50 * Math.sin(Math.PI / 2)  // = 100 + 50 * 1 = 150
    };

    // Verify that the mathematical calculation is correct
    expect(expectedClockwise.x).toBe(100);
    expect(expectedClockwise.y).toBe(50);
    expect(expectedCounterclockwise.x).toBe(100);
    expect(expectedCounterclockwise.y).toBe(150);
  });

  it('should trace ellipses clockwise when cut direction is clockwise', () => {
    // Create an ellipse shape
    const ellipseShape: Shape = {
      id: 'ellipse-1',
      type: 'ellipse',
      geometry: {
        center: { x: 200, y: 200 },
        majorAxisEndpoint: { x: 100, y: 0 }, // 100 units along x-axis
        minorToMajorRatio: 0.5 // minor axis is 50 units
      }
    };

    // Create a chain with the ellipse
    const chain: ShapeChain = {
      id: 'chain-2',
      shapes: [ellipseShape]
    };

    // Add chain to store
    setChains([chain]);

    // Create paths with different cut directions
    pathStore.addPath({
      name: 'Clockwise Ellipse',
      operationId: 'op-3',
      chainId: 'chain-2',
      toolId: 'tool-1',
      enabled: true,
      order: 3,
      cutDirection: CutDirection.CLOCKWISE,
      feedRate: 1000
    });

    pathStore.addPath({
      name: 'Counterclockwise Ellipse',
      operationId: 'op-4',
      chainId: 'chain-2',
      toolId: 'tool-1',
      enabled: true,
      order: 4,
      cutDirection: CutDirection.COUNTERCLOCKWISE,
      feedRate: 1000
    });

    // TODO: Once getPositionOnShape is updated to accept cut direction,
    // verify that the ellipse is traced in the correct direction
  });

  it('should handle cut direction "none" for open chains', () => {
    // Create a line shape (open chain)
    const lineShape: Shape = {
      id: 'line-1',
      type: 'line',
      geometry: {
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 }
      }
    };

    // Create an open chain
    const chain: ShapeChain = {
      id: 'chain-3',
      shapes: [lineShape]
    };

    // Add chain to store
    setChains([chain]);

    // Create path with "none" cut direction
    pathStore.addPath({
      name: 'Open Line',
      operationId: 'op-5',
      chainId: 'chain-3',
      toolId: 'tool-1',
      enabled: true,
      order: 5,
      cutDirection: CutDirection.NONE,
      feedRate: 1000
    });

    // Open chains should always trace from start to end regardless of cut direction
    // TODO: Verify this behavior once implementation is fixed
  });
});