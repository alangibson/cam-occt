import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { operationsStore } from '$lib/stores/operations/store';
import { cutStore } from '$lib/stores/cuts/store';
import { chainStore } from '$lib/stores/chains/store';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Shape } from '$lib/types';
import { CutDirection, LeadType } from '$lib/types/direction';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import { sampleShapesAtDistanceIntervals } from '$lib/geometry/shape/functions';
import { GeometryType } from '$lib/geometry/shape';
import type { Operation } from '$lib/stores/operations/interfaces';

// Helper to wait for async cut generation
async function waitForCuts(expectedCount: number, timeout = 200) {
    return new Promise<void>((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            const cutsState = get(cutStore);
            if (cutsState.cuts.length === expectedCount) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(
                    new Error(
                        `Expected ${expectedCount} cuts, got ${cutsState.cuts.length} after ${timeout}ms`
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
            const cutsState = get(cutStore);
            if (
                cutsState.cuts.length > 0 &&
                cutsState.cuts[0].cutDirection === expectedDirection
            ) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(
                    new Error(
                        `Expected cut with direction ${expectedDirection}, got ${cutsState.cuts[0]?.cutDirection} after ${timeout}ms`
                    )
                );
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
        cutStore.reset();
        chainStore.clearChains();
    });

    it('should respect user Cut Direction in Program stage (rendering arrows)', async () => {
        // Create a clockwise square chain (natural winding = clockwise)
        const clockwiseSquare: Shape[] = [
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

        const chain: Chain = {
            id: 'test-chain',
            shapes: clockwiseSquare,
        };

        chainStore.setChains([chain]);

        // Test 1: Create operation with COUNTERCLOCKWISE direction (opposite of natural)
        const operation: Omit<Operation, 'id'> = {
            name: 'Test Operation',
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

        const cutsState = get(cutStore);
        const cut = cutsState.cuts[0];

        // Verify: Cut should have user's desired cut direction
        expect(cut.cutDirection).toBe(CutDirection.COUNTERCLOCKWISE);

        // Verify: cutChain should have shapes in reversed order (to achieve counterclockwise)
        expect(cut.cutChain).toBeDefined();
        expect(cut.cutChain!.shapes[0].id).toBe('line4'); // Should start with last shape (reversed)
        expect(cut.cutChain!.shapes[1].id).toBe('line3');
        expect(cut.cutChain!.shapes[2].id).toBe('line2');
        expect(cut.cutChain!.shapes[3].id).toBe('line1');

        // Verify: DrawingCanvas would use cutChain.shapes for rendering arrows
        // This simulates what DrawingCanvas.svelte does for chevron rendering
        const shapesToRender = cut.cutChain!.shapes;
        const chevronSamples = sampleShapesAtDistanceIntervals(
            shapesToRender,
            5
        ); // 5 unit spacing

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

        const chain: Chain = {
            id: 'test-chain',
            shapes: counterclockwiseSquare,
        };

        chainStore.setChains([chain]);

        // Create operation with CLOCKWISE direction (opposite of natural)
        const operation: Omit<Operation, 'id'> = {
            name: 'Test Operation',
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

        const cutsState = get(cutStore);
        const cut = cutsState.cuts[0];

        // Verify: Cut should have user's desired cut direction
        expect(cut.cutDirection).toBe(CutDirection.CLOCKWISE);

        // Verify: cutChain should have shapes in reversed order (to achieve clockwise)
        expect(cut.cutChain).toBeDefined();
        expect(cut.cutChain!.shapes[0].id).toBe('line4'); // Should start with last shape (reversed)

        // Verify: Simulation stage would use cutChain.shapes
        // This simulates what SimulateStage.svelte does
        const shapesForSimulation = cut.cutChain!.shapes;
        expect(shapesForSimulation).toBeDefined();
        expect(shapesForSimulation.length).toBe(4);

        // Should simulate in the order specified by cutChain (clockwise as requested)
        expect(shapesForSimulation[0].id).toBe('line4'); // Start with reversed order
    });

    it('should handle direction changes dynamically', async () => {
        // Create a clockwise square chain
        const clockwiseSquare: Shape[] = [
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

        const chain: Chain = {
            id: 'test-chain',
            shapes: clockwiseSquare,
        };

        chainStore.setChains([chain]);

        const operation: Omit<Operation, 'id'> = {
            name: 'Test Operation',
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

        const operations = get(operationsStore);
        const operationId = operations[0].id;

        // Initial state: clockwise (natural = clockwise, desired = clockwise → original order)
        let cutsState = get(cutStore);
        expect(cutsState.cuts[0].cutDirection).toBe(CutDirection.CLOCKWISE);
        expect(cutsState.cuts[0].cutChain!.shapes[0].id).toBe('line1'); // Original order

        // Change to counterclockwise: should reverse the cutChain
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.COUNTERCLOCKWISE,
        });
        await waitForCutWithDirection(CutDirection.COUNTERCLOCKWISE);

        cutsState = get(cutStore);
        expect(cutsState.cuts[0].cutDirection).toBe(
            CutDirection.COUNTERCLOCKWISE
        );
        expect(cutsState.cuts[0].cutChain!.shapes[0].id).toBe('line4'); // Reversed order

        // Change back to clockwise: should restore original order
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.CLOCKWISE,
        });
        await waitForCutWithDirection(CutDirection.CLOCKWISE);

        cutsState = get(cutStore);
        expect(cutsState.cuts[0].cutDirection).toBe(CutDirection.CLOCKWISE);
        expect(cutsState.cuts[0].cutChain!.shapes[0].id).toBe('line1'); // Back to original order
    });
});
