import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { operationsStore } from './store';
import { cutStore } from '$lib/stores/cuts/store';
import { chainStore } from '$lib/stores/chains/store';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Shape } from '$lib/geometry/shape';
import { CutDirection, LeadType } from '$lib/types/direction';
import { KerfCompensation } from '$lib/stores/operations/enums';
import { GeometryType } from '$lib/geometry/shape';
import type { Operation } from './interfaces';

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

describe('Operations Store - Cut Direction UI Changes Integration Test', () => {
    beforeEach(() => {
        // Reset all stores
        operationsStore.reset();
        cutStore.reset();
        chainStore.clearChains();
    });

    it('should consistently apply Cut Direction changes when user switches back and forth', async () => {
        // Create a clockwise square chain (natural winding = clockwise)
        // Going: right → down → left → up (clockwise when Y+ is up)
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

        // Create initial operation with clockwise cut direction
        const operation: Omit<Operation, 'id'> = {
            name: 'Test Operation',
            targetType: 'chains',
            targetIds: ['test-chain'],
            cutDirection: CutDirection.CLOCKWISE,
            toolId: null,
            enabled: true,
            kerfCompensation: KerfCompensation.NONE,
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
            order: 1,
        };

        operationsStore.addOperation(operation);
        await waitForCuts(1);

        // Get the operation ID for updates
        const operations = get(operationsStore);
        const operationId = operations[0].id;

        // Test 1: Initial clockwise direction
        // Natural = clockwise, desired = clockwise → no reversal
        let cutsState = get(cutStore);
        expect(cutsState.cuts).toHaveLength(1);
        expect(cutsState.cuts[0].cutDirection).toBe(CutDirection.CLOCKWISE);
        expect(cutsState.cuts[0].cutChain!.shapes[0].id).toBe('line1'); // Original order

        // Test 2: Change to counterclockwise
        // Natural = clockwise, desired = counterclockwise → reversal needed
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.COUNTERCLOCKWISE,
        });
        await waitForCutWithDirection(CutDirection.COUNTERCLOCKWISE);

        cutsState = get(cutStore);
        expect(cutsState.cuts[0].cutDirection).toBe(
            CutDirection.COUNTERCLOCKWISE
        );
        expect(cutsState.cuts[0].cutChain!.shapes[0].id).toBe('line4'); // Reversed order

        // Test 3: Change back to clockwise
        // Natural = clockwise, desired = clockwise → no reversal (should be back to original)
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.CLOCKWISE,
        });
        await waitForCutWithDirection(CutDirection.CLOCKWISE);

        cutsState = get(cutStore);
        expect(cutsState.cuts[0].cutDirection).toBe(CutDirection.CLOCKWISE);
        expect(cutsState.cuts[0].cutChain!.shapes[0].id).toBe('line1'); // Back to original order

        // Test 4: Change to counterclockwise again
        // Natural = clockwise, desired = counterclockwise → reversal needed (should be consistent)
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.COUNTERCLOCKWISE,
        });
        await waitForCutWithDirection(CutDirection.COUNTERCLOCKWISE);

        cutsState = get(cutStore);
        expect(cutsState.cuts[0].cutDirection).toBe(
            CutDirection.COUNTERCLOCKWISE
        );
        expect(cutsState.cuts[0].cutChain!.shapes[0].id).toBe('line4'); // Reversed order again

        // Test 5: Final change back to clockwise
        // Natural = clockwise, desired = clockwise → no reversal (should be consistent)
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.CLOCKWISE,
        });
        await waitForCutWithDirection(CutDirection.CLOCKWISE);

        cutsState = get(cutStore);
        expect(cutsState.cuts[0].cutDirection).toBe(CutDirection.CLOCKWISE);
        expect(cutsState.cuts[0].cutChain!.shapes[0].id).toBe('line1'); // Back to original order
    });

    it('should work correctly with counterclockwise natural chains', async () => {
        // Create a counterclockwise square chain (natural winding = counterclockwise)
        // Going: right → up → left → down (counterclockwise when Y+ is up)
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

        // Create initial operation with counterclockwise cut direction
        const operation: Omit<Operation, 'id'> = {
            name: 'Test Operation',
            targetType: 'chains',
            targetIds: ['test-chain'],
            cutDirection: CutDirection.COUNTERCLOCKWISE,
            toolId: null,
            enabled: true,
            kerfCompensation: KerfCompensation.NONE,
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
            order: 1,
        };

        operationsStore.addOperation(operation);
        await waitForCuts(1);

        // Get the operation ID for updates
        const operations = get(operationsStore);
        const operationId = operations[0].id;

        // Test 1: Initial counterclockwise direction
        // Natural = counterclockwise, desired = counterclockwise → no reversal
        let cutsState = get(cutStore);
        expect(cutsState.cuts).toHaveLength(1);
        expect(cutsState.cuts[0].cutDirection).toBe(
            CutDirection.COUNTERCLOCKWISE
        );
        expect(cutsState.cuts[0].cutChain!.shapes[0].id).toBe('line1'); // Original order

        // Test 2: Change to clockwise
        // Natural = counterclockwise, desired = clockwise → reversal needed
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.CLOCKWISE,
        });
        await waitForCutWithDirection(CutDirection.CLOCKWISE);

        cutsState = get(cutStore);
        expect(cutsState.cuts[0].cutDirection).toBe(CutDirection.CLOCKWISE);
        expect(cutsState.cuts[0].cutChain!.shapes[0].id).toBe('line4'); // Reversed order

        // Test 3: Change back to counterclockwise
        // Natural = counterclockwise, desired = counterclockwise → no reversal (should be back to original)
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.COUNTERCLOCKWISE,
        });
        await waitForCutWithDirection(CutDirection.COUNTERCLOCKWISE);

        cutsState = get(cutStore);
        expect(cutsState.cuts[0].cutDirection).toBe(
            CutDirection.COUNTERCLOCKWISE
        );
        expect(cutsState.cuts[0].cutChain!.shapes[0].id).toBe('line1'); // Back to original order
    });

    it('should work correctly with multiple rapid direction changes', async () => {
        // Create a clockwise chain
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
            cutDirection: CutDirection.CLOCKWISE,
            toolId: null,
            enabled: true,
            kerfCompensation: KerfCompensation.NONE,
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
            order: 1,
        };

        operationsStore.addOperation(operation);
        await waitForCuts(1);

        const operations = get(operationsStore);
        const operationId = operations[0].id;

        // Rapid changes: clockwise → counterclockwise → clockwise → counterclockwise → clockwise
        const directions = [
            CutDirection.COUNTERCLOCKWISE, // Should reverse
            CutDirection.CLOCKWISE, // Should un-reverse
            CutDirection.COUNTERCLOCKWISE, // Should reverse again
            CutDirection.CLOCKWISE, // Should un-reverse again
        ];

        for (let i = 0; i < directions.length; i++) {
            const direction = directions[i];

            operationsStore.updateOperation(operationId, {
                cutDirection: direction,
            });
            await waitForCutWithDirection(direction);

            const cutsState = get(cutStore);
            expect(cutsState.cuts[0].cutDirection).toBe(direction);

            if (direction === CutDirection.CLOCKWISE) {
                // Natural = clockwise, desired = clockwise → original order
                expect(cutsState.cuts[0].cutChain!.shapes[0].id).toBe('line1');
            } else {
                // Natural = clockwise, desired = counterclockwise → reversed order
                expect(cutsState.cuts[0].cutChain!.shapes[0].id).toBe('line4');
            }
        }
    });
});
