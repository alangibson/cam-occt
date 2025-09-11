import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { operationsStore, type Operation } from './operations';
import { pathStore } from './paths';
import { setChains, clearChains } from './chains';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Shape } from '$lib/types';
import { CutDirection, LeadType } from '$lib/types/direction';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import { GeometryType } from '$lib/geometry/shape';

// Helper to wait for async path generation
async function waitForPaths(expectedCount: number, timeout = 100) {
    return new Promise<void>((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            const pathsState = get(pathStore);
            if (pathsState.paths.length === expectedCount) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(
                    new Error(
                        `Expected ${expectedCount} paths, got ${pathsState.paths.length} after ${timeout}ms`
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
        pathStore.reset();
        clearChains();
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

            setChains([chain]);

            // Create operation with clockwise cut direction
            const operation: Omit<Operation, 'id'> = {
                name: 'Test Clockwise Operation',
                targetType: 'chains',
                targetIds: ['clockwise-square'],
                cutDirection: CutDirection.CLOCKWISE,
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
                kerfCompensation: KerfCompensation.NONE,
            };

            operationsStore.addOperation(operation);

            // Wait for async path generation
            await waitForPaths(1);

            // Check that path was created with correct cutChain
            const pathsState = get(pathStore);
            expect(pathsState.paths).toHaveLength(1);

            const path = pathsState.paths[0];
            expect(path.cutChain).toBeDefined();
            expect(path.cutChain!.shapes).toHaveLength(4);

            // Should be in original order (no reversal needed)
            expect(path.cutChain!.shapes[0].id).toBe('line1');
            expect(path.cutChain!.shapes[1].id).toBe('line2');
            expect(path.cutChain!.shapes[2].id).toBe('line3');
            expect(path.cutChain!.shapes[3].id).toBe('line4');
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

            setChains([chain]);

            // Create operation with counterclockwise cut direction
            const operation: Omit<Operation, 'id'> = {
                name: 'Test Counterclockwise Operation',
                targetType: 'chains',
                targetIds: ['clockwise-square'],
                cutDirection: CutDirection.COUNTERCLOCKWISE,
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
                kerfCompensation: KerfCompensation.NONE,
            };

            operationsStore.addOperation(operation);

            // Wait for async path generation
            await waitForPaths(1);

            const pathsState = get(pathStore);
            const path = pathsState.paths[0];

            // Should be in reversed order (reversal needed)
            expect(path.cutChain!.shapes[0].id).toBe('line4');
            expect(path.cutChain!.shapes[1].id).toBe('line3');
            expect(path.cutChain!.shapes[2].id).toBe('line2');
            expect(path.cutChain!.shapes[3].id).toBe('line1');
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

            setChains([chain]);

            const operation: Omit<Operation, 'id'> = {
                name: 'Test Counterclockwise Operation',
                targetType: 'chains',
                targetIds: ['counterclockwise-square'],
                cutDirection: CutDirection.COUNTERCLOCKWISE,
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
                kerfCompensation: KerfCompensation.NONE,
            };

            operationsStore.addOperation(operation);

            // Wait for async path generation
            await waitForPaths(1);

            const pathsState = get(pathStore);
            const path = pathsState.paths[0];

            // Should be in original order (no reversal needed)
            expect(path.cutChain!.shapes[0].id).toBe('line1');
            expect(path.cutChain!.shapes[1].id).toBe('line2');
            expect(path.cutChain!.shapes[2].id).toBe('line3');
            expect(path.cutChain!.shapes[3].id).toBe('line4');
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

            setChains([chain]);

            const operation: Omit<Operation, 'id'> = {
                name: 'Test Clockwise Operation',
                targetType: 'chains',
                targetIds: ['counterclockwise-square'],
                cutDirection: CutDirection.CLOCKWISE,
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
                kerfCompensation: KerfCompensation.NONE,
            };

            operationsStore.addOperation(operation);

            // Wait for async path generation
            await waitForPaths(1);

            const pathsState = get(pathStore);
            const path = pathsState.paths[0];

            // Should be in reversed order (reversal needed)
            expect(path.cutChain!.shapes[0].id).toBe('line4');
            expect(path.cutChain!.shapes[1].id).toBe('line3');
            expect(path.cutChain!.shapes[2].id).toBe('line2');
            expect(path.cutChain!.shapes[3].id).toBe('line1');
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

            setChains([chain]);

            // Test clockwise operation
            const clockwiseOp: Omit<Operation, 'id'> = {
                name: 'Clockwise Circle',
                targetType: 'chains',
                targetIds: ['circle-chain'],
                cutDirection: CutDirection.CLOCKWISE,
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
                kerfCompensation: KerfCompensation.NONE,
            };

            operationsStore.addOperation(clockwiseOp);

            // Wait for async path generation
            await waitForPaths(1);

            let pathsState = get(pathStore);
            expect(pathsState.paths).toHaveLength(1);
            expect(pathsState.paths[0].cutChain).toBeDefined();
            expect(pathsState.paths[0].cutDirection).toBe(
                CutDirection.CLOCKWISE
            );

            // Clear and test counterclockwise
            operationsStore.reset();
            pathStore.reset();

            const counterclockwiseOp: Omit<Operation, 'id'> = {
                name: 'Counterclockwise Circle',
                targetType: 'chains',
                targetIds: ['circle-chain'],
                cutDirection: CutDirection.COUNTERCLOCKWISE,
                toolId: null,
                enabled: true,
                order: 2,
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
                kerfCompensation: KerfCompensation.NONE,
            };

            operationsStore.addOperation(counterclockwiseOp);

            // Wait for async path generation
            await waitForPaths(1);

            pathsState = get(pathStore);
            expect(pathsState.paths).toHaveLength(1);
            expect(pathsState.paths[0].cutChain).toBeDefined();
            expect(pathsState.paths[0].cutDirection).toBe(
                CutDirection.COUNTERCLOCKWISE
            );
        });
    });

    describe('Open Chains', () => {
        it('should handle open chains (no reversal since direction is NONE)', async () => {
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

            setChains([chain]);

            const operation: Omit<Operation, 'id'> = {
                name: 'Open Line Operation',
                targetType: 'chains',
                targetIds: ['open-line'],
                cutDirection: CutDirection.CLOCKWISE, // This should be ignored for open chains
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
                kerfCompensation: KerfCompensation.NONE,
            };

            operationsStore.addOperation(operation);

            // Wait for async path generation
            await waitForPaths(1);

            const pathsState = get(pathStore);
            const path = pathsState.paths[0];

            expect(path.cutDirection).toBe(CutDirection.NONE); // Open chains should have NONE
            expect(path.cutChain!.shapes[0].id).toBe('line1'); // Should use original order
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
