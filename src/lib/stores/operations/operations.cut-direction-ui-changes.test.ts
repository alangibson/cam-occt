import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { operationsStore } from './store';
import { planStore } from '$lib/stores/plan/store';
import { cutStore } from '$lib/stores/cuts/store';
import { drawingStore } from '$lib/stores/drawing/store';
import { toolStore } from '$lib/stores/tools/store';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import { Unit } from '$lib/config/units/units';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { KerfCompensation } from '$lib/cam/operation/enums';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { OperationData } from '$lib/cam/operation/interface';

// Helper to wait for async cut generation
async function waitForCuts(expectedCount: number, timeout = 200) {
    return new Promise<void>((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            const cuts = get(planStore).plan.cuts;
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
            const cuts = get(planStore).plan.cuts;
            if (cuts.length > 0 && cuts[0].cutDirection === expectedDirection) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(
                    new Error(
                        `Expected cut with direction ${expectedDirection}, got ${cuts[0]?.cutDirection} after ${timeout}ms`
                    )
                );
            } else {
                setTimeout(check, 10);
            }
        };
        check();
    });
}

// Helper to create a drawing and get auto-detected chain
function createDrawingWithChain(
    shapes: ShapeData[],
    layerName = 'test-layer'
): { drawing: Drawing; chainId: string } {
    const drawingData: DrawingData = {
        shapes,
        units: Unit.MM,
        fileName: '',
    };

    const drawing = new Drawing(drawingData);
    const layer = drawing.layers[layerName];

    if (!layer || layer.chains.length === 0) {
        throw new Error(`No chains detected in layer ${layerName}`);
    }

    return { drawing, chainId: layer.chains[0].id };
}

describe('Operations Store - Cut Direction UI Changes Integration Test', () => {
    beforeEach(() => {
        // Reset all stores
        operationsStore.reset();
        cutStore.reset();
        drawingStore.reset();
        toolStore.reset();

        // Add a minimal test tool (no kerf to avoid affecting cut direction tests)
        toolStore.reorderTools([
            {
                id: 'test-tool',
                toolNumber: 1,
                toolName: 'Test Tool',
                kerfWidth: 0, // No kerf for cut direction tests
                feedRate: 100,
                pierceHeight: 4.0,
                pierceDelay: 0.5,
                cutHeight: 2.0,
                arcVoltage: 120,
                kerfWidthMetric: 0,
                kerfWidthImperial: 0,
                feedRateMetric: 100,
                feedRateImperial: 40,
                pierceHeightMetric: 4.0,
                pierceHeightImperial: 0.15,
                cutHeightMetric: 2.0,
                cutHeightImperial: 0.08,
                thcEnable: true,
                gasPressure: 4.5,
                pauseAtEnd: 0,
                puddleJumpHeight: 1.0,
                puddleJumpHeightMetric: 1.0,
                puddleJumpHeightImperial: 0.04,
                puddleJumpDelay: 0,
                plungeRate: 50,
                plungeRateMetric: 50,
                plungeRateImperial: 20,
            },
        ]);
    });

    it('should consistently apply Cut Direction changes when user switches back and forth', async () => {
        // Create a clockwise square chain (natural winding = clockwise)
        // Going: right → down → left → up (clockwise when Y+ is up)
        const clockwiseSquare: ShapeData[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 10 }, end: { x: 10, y: 10 } },
                layer: 'test-layer',
            }, // right
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: 10, y: 0 } },
                layer: 'test-layer',
            }, // down
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 0 }, end: { x: 0, y: 0 } },
                layer: 'test-layer',
            }, // left
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 0, y: 10 } },
                layer: 'test-layer',
            }, // up
        ];

        // Create drawing and get auto-detected chain
        const { drawing, chainId } = createDrawingWithChain(clockwiseSquare);
        drawingStore.setDrawing(drawing, 'test.dxf');

        // Create initial operation with clockwise cut direction
        const operation: Omit<OperationData, 'id'> = {
            name: 'Test Operation',
            targetType: 'chains',
            targetIds: [chainId],
            cutDirection: CutDirection.CLOCKWISE,
            toolId: 'test-tool',
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

        // Get the operation ID for updates
        const operations = get(operationsStore);
        const operationId = operations[0].id;

        // Apply the operation to generate cuts
        await operationsStore.applyOperation(operationId);
        await waitForCuts(1);

        // Test 1: Initial clockwise direction
        // Natural = clockwise, desired = clockwise → no reversal
        let cuts = get(planStore).plan.cuts;
        expect(cuts).toHaveLength(1);
        expect(cuts[0].cutDirection).toBe(CutDirection.CLOCKWISE);
        expect(cuts[0].cutChain!.shapes[0].id).toBe('line1'); // Original order

        // Test 2: Change to counterclockwise
        // Natural = clockwise, desired = counterclockwise → reversal needed
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.COUNTERCLOCKWISE,
        });
        await operationsStore.applyOperation(operationId);
        await waitForCutWithDirection(CutDirection.COUNTERCLOCKWISE);

        cuts = get(planStore).plan.cuts;
        expect(cuts[0].cutDirection).toBe(CutDirection.COUNTERCLOCKWISE);
        expect(cuts[0].cutChain!.shapes[0].id).toBe('line4'); // Reversed order

        // Test 3: Change back to clockwise
        // Natural = clockwise, desired = clockwise → no reversal (should be back to original)
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.CLOCKWISE,
        });
        await operationsStore.applyOperation(operationId);
        await waitForCutWithDirection(CutDirection.CLOCKWISE);

        cuts = get(planStore).plan.cuts;
        expect(cuts[0].cutDirection).toBe(CutDirection.CLOCKWISE);
        cuts = get(planStore).plan.cuts;
        expect(cuts[0].cutChain!.shapes[0].id).toBe('line1'); // Back to original order

        // Test 4: Change to counterclockwise again
        // Natural = clockwise, desired = counterclockwise → reversal needed (should be consistent)
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.COUNTERCLOCKWISE,
        });
        await operationsStore.applyOperation(operationId);
        await waitForCutWithDirection(CutDirection.COUNTERCLOCKWISE);

        cuts = get(planStore).plan.cuts;
        expect(cuts[0].cutDirection).toBe(CutDirection.COUNTERCLOCKWISE);
        cuts = get(planStore).plan.cuts;
        expect(cuts[0].cutChain!.shapes[0].id).toBe('line4'); // Reversed order again

        // Test 5: Final change back to clockwise
        // Natural = clockwise, desired = clockwise → no reversal (should be consistent)
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.CLOCKWISE,
        });
        await operationsStore.applyOperation(operationId);
        await waitForCutWithDirection(CutDirection.CLOCKWISE);

        cuts = get(planStore).plan.cuts;
        expect(cuts[0].cutDirection).toBe(CutDirection.CLOCKWISE);
        cuts = get(planStore).plan.cuts;
        expect(cuts[0].cutChain!.shapes[0].id).toBe('line1'); // Back to original order
    });

    it('should work correctly with counterclockwise natural chains', async () => {
        // Create a counterclockwise square chain (natural winding = counterclockwise)
        // Going: right → up → left → down (counterclockwise when Y+ is up)
        const counterclockwiseSquare: ShapeData[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
                layer: 'test-layer',
            }, // right
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
                layer: 'test-layer',
            }, // up
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: 0, y: 10 } },
                layer: 'test-layer',
            }, // left
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 10 }, end: { x: 0, y: 0 } },
                layer: 'test-layer',
            }, // down
        ];

        // Create drawing and get auto-detected chain
        const { drawing, chainId } = createDrawingWithChain(
            counterclockwiseSquare
        );
        drawingStore.setDrawing(drawing, 'test.dxf');

        // Create initial operation with counterclockwise cut direction
        const operation: Omit<OperationData, 'id'> = {
            name: 'Test Operation',
            targetType: 'chains',
            targetIds: [chainId],
            cutDirection: CutDirection.COUNTERCLOCKWISE,
            toolId: 'test-tool',
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

        // Get the operation ID for updates
        const operations = get(operationsStore);
        const operationId = operations[0].id;

        // Apply the operation to generate cuts
        await operationsStore.applyOperation(operationId);
        await waitForCuts(1);

        // Test 1: Initial counterclockwise direction
        // Natural = counterclockwise, desired = counterclockwise → no reversal
        // After normalization, chain goes: line1 → line2 → line3 → line4 (counterclockwise)
        let cuts = get(planStore).plan.cuts;
        expect(cuts).toHaveLength(1);
        cuts = get(planStore).plan.cuts;
        expect(cuts[0].cutDirection).toBe(CutDirection.COUNTERCLOCKWISE);
        cuts = get(planStore).plan.cuts;
        expect(cuts[0].cutChain!.shapes[0].id).toBe('line1'); // Normalized order

        // Test 2: Change to clockwise
        // Natural = counterclockwise, desired = clockwise → reversal needed
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.CLOCKWISE,
        });
        await operationsStore.applyOperation(operationId);
        await waitForCutWithDirection(CutDirection.CLOCKWISE);

        cuts = get(planStore).plan.cuts;
        expect(cuts[0].cutDirection).toBe(CutDirection.CLOCKWISE);
        cuts = get(planStore).plan.cuts;
        expect(cuts[0].cutChain!.shapes[0].id).toBe('line4'); // Reversed order (backward: line4 → line3 → line2 → line1)

        // Test 3: Change back to counterclockwise
        // Natural = counterclockwise, desired = counterclockwise → no reversal (should be back to normalized order)
        operationsStore.updateOperation(operationId, {
            cutDirection: CutDirection.COUNTERCLOCKWISE,
        });
        await operationsStore.applyOperation(operationId);
        await waitForCutWithDirection(CutDirection.COUNTERCLOCKWISE);

        cuts = get(planStore).plan.cuts;
        expect(cuts[0].cutDirection).toBe(CutDirection.COUNTERCLOCKWISE);
        cuts = get(planStore).plan.cuts;
        expect(cuts[0].cutChain!.shapes[0].id).toBe('line1'); // Back to normalized order (line1 → line2 → line3 → line4)
    });

    it('should work correctly with multiple rapid direction changes', async () => {
        // Create a clockwise chain
        const clockwiseSquare: ShapeData[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 10 }, end: { x: 10, y: 10 } },
                layer: 'test-layer',
            },
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: 10, y: 0 } },
                layer: 'test-layer',
            },
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 0 }, end: { x: 0, y: 0 } },
                layer: 'test-layer',
            },
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 0, y: 10 } },
                layer: 'test-layer',
            },
        ];

        // Create drawing and get auto-detected chain
        const { drawing, chainId } = createDrawingWithChain(clockwiseSquare);
        drawingStore.setDrawing(drawing, 'test.dxf');

        const operation: Omit<OperationData, 'id'> = {
            name: 'Test Operation',
            targetType: 'chains',
            targetIds: [chainId],
            cutDirection: CutDirection.CLOCKWISE,
            toolId: 'test-tool',
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

        const operations = get(operationsStore);
        const operationId = operations[0].id;

        // Apply the operation to generate cuts
        await operationsStore.applyOperation(operationId);
        await waitForCuts(1);

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
            await operationsStore.applyOperation(operationId);
            await waitForCutWithDirection(direction);

            let cuts = get(planStore).plan.cuts;
            expect(cuts[0].cutDirection).toBe(direction);

            if (direction === CutDirection.CLOCKWISE) {
                // Natural = clockwise, desired = clockwise → original order
                cuts = get(planStore).plan.cuts;
                expect(cuts[0].cutChain!.shapes[0].id).toBe('line1');
            } else {
                // Natural = clockwise, desired = counterclockwise → reversed order
                cuts = get(planStore).plan.cuts;
                expect(cuts[0].cutChain!.shapes[0].id).toBe('line4');
            }
        }
    });
});
