import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { operationsStore } from './store';
import { cutStore } from '$lib/stores/cuts/store';
import { chainStore } from '$lib/stores/chains/store';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { KerfCompensation } from '$lib/stores/operations/enums';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { Operation } from './interfaces';

// Helper to wait for async cut generation
async function waitForCuts(expectedCount: number, timeout = 100) {
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
                setTimeout(check, 5);
            }
        };
        check();
    });
}

describe('Operations Store - Absolute Cut Direction Logic', () => {
    beforeEach(() => {
        // Reset all stores
        operationsStore.reset();
        cutStore.reset();
        chainStore.clearChains();
    });

    describe('Clockwise Natural Chain with Different Operation Cut Directions', () => {
        it('should create cutChain in original order when operation wants clockwise (natural = clockwise)', async () => {
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
                id: 'clockwise-square',
                shapes: clockwiseSquare,
            };

            chainStore.setChains([chain]);

            // Create operation with clockwise cut direction
            const operation: Omit<Operation, 'id'> = {
                name: 'Test Clockwise Operation',
                targetType: 'chains',
                targetIds: ['clockwise-square'],
                cutDirection: CutDirection.CLOCKWISE,
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

            // Wait for async cut generation
            await waitForCuts(1);

            // Check that cut was created with correct cutChain
            const cutsState = get(cutStore);
            expect(cutsState.cuts).toHaveLength(1);

            const cut = cutsState.cuts[0];
            expect(cut.cutChain).toBeDefined();
            expect(cut.cutChain!.shapes).toHaveLength(4);

            // Should be in original order (no reversal needed)
            expect(cut.cutChain!.shapes[0].id).toBe('line1');
            expect(cut.cutChain!.shapes[1].id).toBe('line2');
            expect(cut.cutChain!.shapes[2].id).toBe('line3');
            expect(cut.cutChain!.shapes[3].id).toBe('line4');
        });

        it('should create cutChain in reversed order when operation wants counterclockwise (natural = clockwise)', async () => {
            // Same clockwise square chain
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
                id: 'clockwise-square',
                shapes: clockwiseSquare,
            };

            chainStore.setChains([chain]);

            // Create operation with counterclockwise cut direction
            const operation: Omit<Operation, 'id'> = {
                name: 'Test Counterclockwise Operation',
                targetType: 'chains',
                targetIds: ['clockwise-square'],
                cutDirection: CutDirection.COUNTERCLOCKWISE,
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

            // Wait for async cut generation
            await waitForCuts(1);

            const cutsState = get(cutStore);
            const cut = cutsState.cuts[0];

            // Should be in reversed order (reversal needed)
            expect(cut.cutChain!.shapes[0].id).toBe('line4');
            expect(cut.cutChain!.shapes[1].id).toBe('line3');
            expect(cut.cutChain!.shapes[2].id).toBe('line2');
            expect(cut.cutChain!.shapes[3].id).toBe('line1');
        });
    });

    describe('Counterclockwise Natural Chain with Different Operation Cut Directions', () => {
        it('should create cutChain in original order when operation wants counterclockwise (natural = counterclockwise)', async () => {
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
                id: 'counterclockwise-square',
                shapes: counterclockwiseSquare,
            };

            chainStore.setChains([chain]);

            const operation: Omit<Operation, 'id'> = {
                name: 'Test Counterclockwise Operation',
                targetType: 'chains',
                targetIds: ['counterclockwise-square'],
                cutDirection: CutDirection.COUNTERCLOCKWISE,
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

            // Wait for async cut generation
            await waitForCuts(1);

            const cutsState = get(cutStore);
            const cut = cutsState.cuts[0];

            // Should be in original order (no reversal needed)
            expect(cut.cutChain!.shapes[0].id).toBe('line1');
            expect(cut.cutChain!.shapes[1].id).toBe('line2');
            expect(cut.cutChain!.shapes[2].id).toBe('line3');
            expect(cut.cutChain!.shapes[3].id).toBe('line4');
        });

        it('should create cutChain in reversed order when operation wants clockwise (natural = counterclockwise)', async () => {
            // Same counterclockwise square chain
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
                id: 'counterclockwise-square',
                shapes: counterclockwiseSquare,
            };

            chainStore.setChains([chain]);

            const operation: Omit<Operation, 'id'> = {
                name: 'Test Clockwise Operation',
                targetType: 'chains',
                targetIds: ['counterclockwise-square'],
                cutDirection: CutDirection.CLOCKWISE,
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

            // Wait for async cut generation
            await waitForCuts(1);

            const cutsState = get(cutStore);
            const cut = cutsState.cuts[0];

            // Should be in reversed order (reversal needed)
            expect(cut.cutChain!.shapes[0].id).toBe('line4');
            expect(cut.cutChain!.shapes[1].id).toBe('line3');
            expect(cut.cutChain!.shapes[2].id).toBe('line2');
            expect(cut.cutChain!.shapes[3].id).toBe('line1');
        });
    });

    describe('Circle Chains with Different Cut Directions', () => {
        it('should handle circle chains correctly for both cut directions', async () => {
            // Create a circle (circles have natural direction based on start/end angles)
            const circle: Shape[] = [
                {
                    id: 'circle1',
                    type: GeometryType.CIRCLE,
                    geometry: {
                        center: { x: 5, y: 5 },
                        radius: 3,
                    },
                },
            ];

            const chain: Chain = {
                id: 'circle-chain',
                shapes: circle,
            };

            chainStore.setChains([chain]);

            // Test clockwise operation
            const clockwiseOp: Omit<Operation, 'id'> = {
                name: 'Clockwise Circle',
                targetType: 'chains',
                targetIds: ['circle-chain'],
                cutDirection: CutDirection.CLOCKWISE,
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

            operationsStore.addOperation(clockwiseOp);

            // Wait for async cut generation
            await waitForCuts(1);

            let cutsState = get(cutStore);
            expect(cutsState.cuts).toHaveLength(1);
            expect(cutsState.cuts[0].cutChain).toBeDefined();
            expect(cutsState.cuts[0].cutDirection).toBe(CutDirection.CLOCKWISE);

            // Clear and test counterclockwise
            operationsStore.reset();
            cutStore.reset();

            const counterclockwiseOp: Omit<Operation, 'id'> = {
                name: 'Counterclockwise Circle',
                targetType: 'chains',
                targetIds: ['circle-chain'],
                cutDirection: CutDirection.COUNTERCLOCKWISE,
                toolId: null,
                enabled: true,
                order: 2,
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

            operationsStore.addOperation(counterclockwiseOp);

            // Wait for async cut generation
            await waitForCuts(1);

            cutsState = get(cutStore);
            expect(cutsState.cuts).toHaveLength(1);
            expect(cutsState.cuts[0].cutChain).toBeDefined();
            expect(cutsState.cuts[0].cutDirection).toBe(
                CutDirection.COUNTERCLOCKWISE
            );
        });
    });

    describe('Open Chains', () => {
        it('should handle open chains by respecting operation cut direction', async () => {
            // Create an open line chain
            const openLine: Shape[] = [
                {
                    id: 'line1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
                },
            ];

            const chain: Chain = {
                id: 'open-line',
                shapes: openLine,
            };

            chainStore.setChains([chain]);

            const operation: Omit<Operation, 'id'> = {
                name: 'Open Line Operation',
                targetType: 'chains',
                targetIds: ['open-line'],
                cutDirection: CutDirection.CLOCKWISE, // This should be applied to open chains
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

            // Wait for async cut generation
            await waitForCuts(1);

            const cutsState = get(cutStore);
            const cut = cutsState.cuts[0];

            expect(cut.cutDirection).toBe(CutDirection.CLOCKWISE); // Should respect operation's cut direction
            expect(cut.cutChain!.shapes[0].id).toBe('line1'); // Should use original order
        });
    });

    describe('Integration with Offset Shapes', () => {
        it('should apply cut direction logic to offset shapes when they exist', () => {
            // This test will verify that when offset shapes exist, the cut direction logic
            // is applied to the offset shapes rather than the original shapes
            // (Implementation will be added after the main fix)
            expect(true).toBe(true); // Placeholder
        });
    });
});
