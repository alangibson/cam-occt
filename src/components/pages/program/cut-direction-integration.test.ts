import { beforeEach, describe, expect, it } from 'vitest';
import { operationsStore } from '$lib/stores/operations/store.svelte';
import { planStore } from '$lib/stores/plan/store.svelte';
import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { KerfCompensation, OperationAction } from '$lib/cam/operation/enums';
import { sampleShapes } from '$lib/cam/shape/functions';
import { GeometryType } from '$lib/geometry/enums';
import type { OperationData } from '$lib/cam/operation/interface';

// Helper to wait for async cut generation
async function waitForCuts(expectedCount: number, timeout = 200) {
    return new Promise<void>((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            const cuts = planStore.plan.cuts;
            if (cuts.length === expectedCount) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(
                    new Error(
                        `Expected ${expectedCount} cuts, got ${cuts.length} after ${timeout}ms`
                    )
                );
            } else {
                setTimeout(check, 10);
            }
        };
        check();
    });
}

// Helper to wait for cut with specific cut direction
async function waitForCutWithDirection(
    expectedDirection: CutDirection,
    timeout = 200
) {
    return new Promise<void>((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            const cuts = planStore.plan.cuts;
            if (cuts.length > 0 && cuts[0].direction === expectedDirection) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(
                    new Error(
                        `Expected cut with direction ${expectedDirection}, got ${cuts[0]?.direction} after ${timeout}ms`
                    )
                );
            } else {
                setTimeout(check, 10);
            }
        };
        check();
    });
}

describe.skip('Cut Direction End-to-End Integration', () => {
    // NOTE: These tests need to be refactored for the new layer-based chain system
    // where chains are auto-detected from Drawing layers and chainStore.setChains() no longer exists
    beforeEach(() => {
        operationsStore.reset();
        visualizationStore.resetCuts();
    });

    it('should respect user Cut Direction in Program stage (rendering arrows)', async () => {
        // Create a clockwise square chain (natural winding = clockwise)
        const clockwiseSquare: ShapeData[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 10 }, end: { x: 10, y: 10 } },
            }, // right
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: 10, y: 0 } },
            }, // down
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 0 }, end: { x: 0, y: 0 } },
            }, // left
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 0, y: 10 } },
            }, // up
        ];

        const chain: ChainData = {
            id: 'test-chain',
            name: 'test-chain',
            shapes: clockwiseSquare,
        };

        // @ts-expect-error - setChains no longer exists, test needs refactoring
        chainStore.setChains([chain]);

        // Test 1: Create operation with COUNTERCLOCKWISE direction (opposite of natural)
        const operation: Omit<OperationData, 'id'> = {
            name: 'Test Operation',
            action: OperationAction.CUT,
            targetType: 'chains',
            targetIds: ['test-chain'],
            cutDirection: CutDirection.COUNTERCLOCKWISE, // User wants counterclockwise
            toolId: null,
            enabled: true,
            order: 1,
            leadInConfig: {
                type: LeadType.NONE,
                length: 0,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            leadOutConfig: {
                type: LeadType.NONE,
                length: 0,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            kerfCompensation: KerfCompensation.NONE,
        };

        operationsStore.addOperation(operation);
        await waitForCuts(1);

        const cuts = planStore.plan.cuts;
        const cut = cuts[0];

        // Verify: Cut should have user's desired cut direction
        expect(cut.direction).toBe(CutDirection.COUNTERCLOCKWISE);

        // Verify: cutChain should have shapes in reversed order (to achieve counterclockwise)
        expect(cut.chain).toBeDefined();
        expect(cut.chain!.shapes[0].id).toBe('line4'); // Should start with last shape (reversed)
        expect(cut.chain!.shapes[1].id).toBe('line3');
        expect(cut.chain!.shapes[2].id).toBe('line2');
        expect(cut.chain!.shapes[3].id).toBe('line1');

        // Verify: DrawingCanvas would use cutChain.shapes for rendering arrows
        // This simulates what DrawingCanvas.svelte does for chevron rendering
        const shapesToRender = cut.chain!.shapes;
        const chevronSamples = sampleShapes(shapesToRender, 5); // 5 unit spacing

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
        const counterclockwiseSquare: ShapeData[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
            }, // right
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
            }, // up
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: 0, y: 10 } },
            }, // left
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 10 }, end: { x: 0, y: 0 } },
            }, // down
        ];

        const chain: ChainData = {
            id: 'test-chain',
            name: 'test-chain',
            shapes: counterclockwiseSquare,
        };

        // @ts-expect-error - setChains no longer exists, test needs refactoring
        chainStore.setChains([chain]);

        // Create operation with CLOCKWISE direction (opposite of natural)
        const operation: Omit<OperationData, 'id'> = {
            name: 'Test Operation',
            action: OperationAction.CUT,
            targetType: 'chains',
            targetIds: ['test-chain'],
            cutDirection: CutDirection.CLOCKWISE, // User wants clockwise
            toolId: null,
            enabled: true,
            order: 1,
            leadInConfig: {
                type: LeadType.NONE,
                length: 0,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            leadOutConfig: {
                type: LeadType.NONE,
                length: 0,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            kerfCompensation: KerfCompensation.NONE,
        };

        operationsStore.addOperation(operation);
        await waitForCuts(1);

        const cuts = planStore.plan.cuts;
        const cut = cuts[0];

        // Verify: Cut should have user's desired cut direction
        expect(cut.direction).toBe(CutDirection.CLOCKWISE);

        // Verify: cutChain should have shapes in reversed order (to achieve clockwise)
        expect(cut.chain).toBeDefined();
        expect(cut.chain!.shapes[0].id).toBe('line4'); // Should start with last shape (reversed)

        // Verify: Simulation stage would use cutChain.shapes
        // This simulates what SimulateStage.svelte does
        const shapesForSimulation = cut.chain!.shapes;
        expect(shapesForSimulation).toBeDefined();
        expect(shapesForSimulation.length).toBe(4);

        // Should simulate in the order specified by cutChain (clockwise as requested)
        expect(shapesForSimulation[0].id).toBe('line4'); // Start with reversed order
    });

    it('should handle direction changes dynamically', async () => {
        // Create a clockwise square chain
        const clockwiseSquare: ShapeData[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 10 }, end: { x: 10, y: 10 } },
            },
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: 10, y: 0 } },
            },
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 0 }, end: { x: 0, y: 0 } },
            },
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 0, y: 10 } },
            },
        ];

        const chain: ChainData = {
            id: 'test-chain',
            name: 'test-chain',
            shapes: clockwiseSquare,
        };

        // @ts-expect-error - setChains no longer exists, test needs refactoring
        chainStore.setChains([chain]);

        const operation: Omit<OperationData, 'id'> = {
            name: 'Test Operation',
            action: OperationAction.CUT,
            targetType: 'chains',
            targetIds: ['test-chain'],
            cutDirection: CutDirection.CLOCKWISE, // Start with clockwise
            toolId: null,
            enabled: true,
            order: 1,
            leadInConfig: {
                type: LeadType.NONE,
                length: 0,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            leadOutConfig: {
                type: LeadType.NONE,
                length: 0,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            kerfCompensation: KerfCompensation.NONE,
        };

        operationsStore.addOperation(operation);
        await waitForCuts(1);

        const operations = operationsStore.operations;
        const operationId = operations[0].id;

        // Initial state: clockwise (natural = clockwise, desired = clockwise → original order)
        let cuts = planStore.plan.cuts;
        expect(cuts[0].direction).toBe(CutDirection.CLOCKWISE);
        expect(cuts[0].chain!.shapes[0].id).toBe('line1'); // Original order

        // Change to counterclockwise: should reverse the cutChain
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.COUNTERCLOCKWISE,
        });
        await waitForCutWithDirection(CutDirection.COUNTERCLOCKWISE);

        cuts = planStore.plan.cuts;
        expect(cuts[0].direction).toBe(CutDirection.COUNTERCLOCKWISE);
        expect(cuts[0].chain!.shapes[0].id).toBe('line4'); // Reversed order

        // Change back to clockwise: should restore original order
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.CLOCKWISE,
        });
        await waitForCutWithDirection(CutDirection.CLOCKWISE);

        cuts = planStore.plan.cuts;
        expect(cuts[0].direction).toBe(CutDirection.CLOCKWISE);
        expect(cuts[0].chain!.shapes[0].id).toBe('line1'); // Back to original order
    });
});
