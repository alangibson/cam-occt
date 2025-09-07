import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { operationsStore, type Operation } from '../lib/stores/operations';
import { pathStore } from '../lib/stores/paths';
import { setChains, clearChains } from '../lib/stores/chains';
import type { Chain } from '../lib/algorithms/chain-detection/chain-detection';
import type { Shape } from '../lib/types';
import { CutDirection, LeadType } from '../lib/types/direction';
import { KerfCompensation } from '../lib/types/kerf-compensation';
import { samplePathAtDistanceIntervals } from '../lib/geometry';

// Helper to wait for async path generation
async function waitForPaths(expectedCount: number, timeout = 200) {
  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      const pathsState = get(pathStore);
      if (pathsState.paths.length === expectedCount) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Expected ${expectedCount} paths, got ${pathsState.paths.length} after ${timeout}ms`));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

// Helper to wait for path with specific cut direction
async function waitForPathWithDirection(expectedDirection: CutDirection, timeout = 200) {
  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      const pathsState = get(pathStore);
      if (pathsState.paths.length > 0 && pathsState.paths[0].cutDirection === expectedDirection) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Expected path with direction ${expectedDirection}, got ${pathsState.paths[0]?.cutDirection} after ${timeout}ms`));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

describe('Cut Direction End-to-End Integration', () => {
  beforeEach(() => {
    operationsStore.reset();
    pathStore.reset();
    clearChains();
  });

  it('should respect user Cut Direction in Program stage (rendering arrows)', async () => {
    // Create a clockwise square chain (natural winding = clockwise)
    const clockwiseSquare: Shape[] = [
      { id: 'line1', type: 'line', geometry: { start: { x: 0, y: 10 }, end: { x: 10, y: 10 } } }, // right
      { id: 'line2', type: 'line', geometry: { start: { x: 10, y: 10 }, end: { x: 10, y: 0 } } }, // down  
      { id: 'line3', type: 'line', geometry: { start: { x: 10, y: 0 }, end: { x: 0, y: 0 } } },   // left
      { id: 'line4', type: 'line', geometry: { start: { x: 0, y: 0 }, end: { x: 0, y: 10 } } }    // up
    ];

    const chain: Chain = {
      id: 'test-chain',
      shapes: clockwiseSquare
    };

    setChains([chain]);

    // Test 1: Create operation with COUNTERCLOCKWISE direction (opposite of natural)
    const operation: Omit<Operation, 'id'> = {
      name: 'Test Operation',
      targetType: 'chains',
      targetIds: ['test-chain'],
      cutDirection: CutDirection.COUNTERCLOCKWISE, // User wants counterclockwise
      toolId: null,
      enabled: true,
      order: 1,
      leadInType: LeadType.NONE,
      leadInLength: 0,
      leadInFlipSide: false,
      leadInAngle: 0,
      leadInFit: false,
      leadOutType: LeadType.NONE,
      leadOutLength: 0,
      leadOutFlipSide: false,
      leadOutAngle: 0,
      leadOutFit: false,
      kerfCompensation: KerfCompensation.NONE
    };

    operationsStore.addOperation(operation);
    await waitForPaths(1);

    const pathsState = get(pathStore);
    const path = pathsState.paths[0];

    // Verify: Path should have user's desired cut direction
    expect(path.cutDirection).toBe(CutDirection.COUNTERCLOCKWISE);

    // Verify: cutChain should have shapes in reversed order (to achieve counterclockwise)
    expect(path.cutChain).toBeDefined();
    expect(path.cutChain!.shapes[0].id).toBe('line4'); // Should start with last shape (reversed)
    expect(path.cutChain!.shapes[1].id).toBe('line3');
    expect(path.cutChain!.shapes[2].id).toBe('line2');
    expect(path.cutChain!.shapes[3].id).toBe('line1');

    // Verify: DrawingCanvas would use cutChain.shapes for rendering arrows
    // This simulates what DrawingCanvas.svelte does for chevron rendering
    const shapesToRender = path.cutChain!.shapes;
    const chevronSamples = samplePathAtDistanceIntervals(shapesToRender, 5); // 5 unit spacing

    // Should sample points in the COUNTERCLOCKWISE direction as requested by user
    expect(chevronSamples.length).toBeGreaterThan(0);
    
    // First sample should be from the first shape in cutChain (which is line4 = reversed)
    const firstSample = chevronSamples[0];
    // The sampling starts from the beginning of the first shape, so we should verify
    // that the samples are following the cutChain order
    expect(firstSample.point).toBeDefined();
    
    // More importantly, verify that we're using the cutChain shapes (not original chain)
    // The key test is that cutChain has the correct order
    expect(shapesToRender[0].id).toBe('line4'); // First shape should be line4 (reversed)
  });

  it('should respect user Cut Direction in Simulation stage', async () => {
    // Create a counterclockwise square chain (natural winding = counterclockwise)
    const counterclockwiseSquare: Shape[] = [
      { id: 'line1', type: 'line', geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } },  // right
      { id: 'line2', type: 'line', geometry: { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } } }, // up
      { id: 'line3', type: 'line', geometry: { start: { x: 10, y: 10 }, end: { x: 0, y: 10 } } }, // left
      { id: 'line4', type: 'line', geometry: { start: { x: 0, y: 10 }, end: { x: 0, y: 0 } } }    // down
    ];

    const chain: Chain = {
      id: 'test-chain',
      shapes: counterclockwiseSquare
    };

    setChains([chain]);

    // Create operation with CLOCKWISE direction (opposite of natural)
    const operation: Omit<Operation, 'id'> = {
      name: 'Test Operation',
      targetType: 'chains',
      targetIds: ['test-chain'],
      cutDirection: CutDirection.CLOCKWISE, // User wants clockwise
      toolId: null,
      enabled: true,
      order: 1,
      leadInType: LeadType.NONE,
      leadInLength: 0,
      leadInFlipSide: false,
      leadInAngle: 0,
      leadInFit: false,
      leadOutType: LeadType.NONE,
      leadOutLength: 0,
      leadOutFlipSide: false,
      leadOutAngle: 0,
      leadOutFit: false,
      kerfCompensation: KerfCompensation.NONE
    };

    operationsStore.addOperation(operation);
    await waitForPaths(1);

    const pathsState = get(pathStore);
    const path = pathsState.paths[0];

    // Verify: Path should have user's desired cut direction  
    expect(path.cutDirection).toBe(CutDirection.CLOCKWISE);

    // Verify: cutChain should have shapes in reversed order (to achieve clockwise)
    expect(path.cutChain).toBeDefined();
    expect(path.cutChain!.shapes[0].id).toBe('line4'); // Should start with last shape (reversed)

    // Verify: Simulation stage would use cutChain.shapes
    // This simulates what SimulateStage.svelte does
    const shapesForSimulation = path.cutChain!.shapes;
    expect(shapesForSimulation).toBeDefined();
    expect(shapesForSimulation.length).toBe(4);
    
    // Should simulate in the order specified by cutChain (clockwise as requested)
    expect(shapesForSimulation[0].id).toBe('line4'); // Start with reversed order
  });

  it('should handle direction changes dynamically', async () => {
    // Create a clockwise square chain
    const clockwiseSquare: Shape[] = [
      { id: 'line1', type: 'line', geometry: { start: { x: 0, y: 10 }, end: { x: 10, y: 10 } } },
      { id: 'line2', type: 'line', geometry: { start: { x: 10, y: 10 }, end: { x: 10, y: 0 } } },
      { id: 'line3', type: 'line', geometry: { start: { x: 10, y: 0 }, end: { x: 0, y: 0 } } },
      { id: 'line4', type: 'line', geometry: { start: { x: 0, y: 0 }, end: { x: 0, y: 10 } } }
    ];

    const chain: Chain = {
      id: 'test-chain',
      shapes: clockwiseSquare
    };

    setChains([chain]);

    const operation: Omit<Operation, 'id'> = {
      name: 'Test Operation',
      targetType: 'chains',
      targetIds: ['test-chain'],
      cutDirection: CutDirection.CLOCKWISE, // Start with clockwise
      toolId: null,
      enabled: true,
      order: 1,
      leadInType: LeadType.NONE,
      leadInLength: 0,
      leadInFlipSide: false,
      leadInAngle: 0,
      leadInFit: false,
      leadOutType: LeadType.NONE,
      leadOutLength: 0,
      leadOutFlipSide: false,
      leadOutAngle: 0,
      leadOutFit: false,
      kerfCompensation: KerfCompensation.NONE
    };

    operationsStore.addOperation(operation);
    await waitForPaths(1);

    const operations = get(operationsStore);
    const operationId = operations[0].id;

    // Initial state: clockwise (natural = clockwise, desired = clockwise → original order)
    let pathsState = get(pathStore);
    expect(pathsState.paths[0].cutDirection).toBe(CutDirection.CLOCKWISE);
    expect(pathsState.paths[0].cutChain!.shapes[0].id).toBe('line1'); // Original order

    // Change to counterclockwise: should reverse the cutChain
    operationsStore.updateOperation(operationId, { cutDirection: CutDirection.COUNTERCLOCKWISE });
    await waitForPathWithDirection(CutDirection.COUNTERCLOCKWISE);

    pathsState = get(pathStore);
    expect(pathsState.paths[0].cutDirection).toBe(CutDirection.COUNTERCLOCKWISE);
    expect(pathsState.paths[0].cutChain!.shapes[0].id).toBe('line4'); // Reversed order

    // Change back to clockwise: should restore original order
    operationsStore.updateOperation(operationId, { cutDirection: CutDirection.CLOCKWISE });
    await waitForPathWithDirection(CutDirection.CLOCKWISE);

    pathsState = get(pathStore);
    expect(pathsState.paths[0].cutDirection).toBe(CutDirection.CLOCKWISE);
    expect(pathsState.paths[0].cutChain!.shapes[0].id).toBe('line1'); // Back to original order
  });
});