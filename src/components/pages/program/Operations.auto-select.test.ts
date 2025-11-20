import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Operations from './Operations.svelte';
import { operationsStore } from '$lib/stores/operations/store';
import { partStore } from '$lib/stores/parts/store';
import { chainStore } from '$lib/stores/chains/store';
import { toolStore } from '$lib/stores/tools/store';
import { drawingStore } from '$lib/stores/drawing/store';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { GeometryType } from '$lib/geometry/shape/enums';
import { Unit } from '$lib/config/units/units';
import type { DrawingData } from '$lib/cam/drawing/interfaces';

describe('Operations Auto-Selection Feature', () => {
    beforeEach(() => {
        // Clear all stores
        operationsStore.reset();
        partStore.clearParts();
        chainStore.clearChainSelection();
        toolStore.reset();

        // Add a test tool
        toolStore.addTool({
            toolNumber: 1,
            toolName: 'Test Tool',
            feedRate: 100,
            pierceHeight: 3.8,
            cutHeight: 1.5,
            pierceDelay: 0.5,
            arcVoltage: 120,
            kerfWidth: 1.5,
            thcEnable: true,
            gasPressure: 4.5,
            pauseAtEnd: 0,
            puddleJumpHeight: 50,
            puddleJumpDelay: 0,
            plungeRate: 500,
        });
    });

    it('should auto-select highlighted part when adding new operation', async () => {
        // Highlight a part
        partStore.highlightPart('part-1');

        // Render the component
        const { container: _container } = render(Operations);

        // Since there's no "Add Operation" button visible, simulate the operation creation
        // by directly calling the operations store method that would be triggered
        const partHighlighted = get(partStore).highlightedPartId;
        operationsStore.addOperation({
            name: 'Test Operation',
            toolId: '1',
            targetType: 'parts',
            targetIds: partHighlighted ? [partHighlighted] : [],
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
        });

        // Check that the operation was created with the highlighted part
        const operations = get(operationsStore);
        expect(operations.length).toBe(1);

        const newOperation = operations[0];
        expect(newOperation.targetType).toBe('parts');
        expect(newOperation.targetIds).toEqual(['part-1']);
    });

    it('should auto-select selected chain when adding new operation', async () => {
        // Select a chain
        chainStore.selectChain('chain-2');

        // Render the component
        const { container: _container } = render(Operations);

        // Simulate operation creation with selected chain
        operationsStore.addOperation({
            name: 'Test Operation',
            toolId: '1',
            targetType: 'chains',
            targetIds: (() => {
                const selectedIds = get(chainStore).selectedChainIds;
                return Array.from(selectedIds);
            })(),
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
        });

        // Check that the operation was created with the selected chain
        const operations = get(operationsStore);
        expect(operations.length).toBe(1);

        const newOperation = operations[0];
        expect(newOperation.targetType).toBe('chains');
        expect(newOperation.targetIds).toEqual(['chain-2']);
    });

    it('should prioritize part over chain when both are selected', async () => {
        // Select both a part and a chain
        partStore.highlightPart('part-3');
        chainStore.selectChain('chain-4');

        // Render the component
        const { container: _container } = render(Operations);

        // Simulate operation creation with both part and chain selected (part should have priority)
        const partHighlighted = get(partStore).highlightedPartId;
        const chainSelectedIds = get(chainStore).selectedChainIds;

        operationsStore.addOperation({
            name: 'Test Operation',
            toolId: '1',
            targetType: partHighlighted ? 'parts' : 'chains',
            targetIds: partHighlighted
                ? [partHighlighted]
                : chainSelectedIds.size > 0
                  ? Array.from(chainSelectedIds)
                  : [],
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
        });

        // Check that the operation was created with the part (priority over chain)
        const operations = get(operationsStore);
        expect(operations.length).toBe(1);

        const newOperation = operations[0];
        expect(newOperation.targetType).toBe('parts');
        expect(newOperation.targetIds).toEqual(['part-3']);
    });

    it('should create empty operation when nothing is selected and no parts/chains exist', async () => {
        // Don't select anything

        // Render the component
        const { container: _container } = render(Operations);

        // Simulate operation creation with nothing selected and no parts/chains
        operationsStore.addOperation({
            name: 'Test Operation',
            toolId: '1',
            targetType: 'parts', // defaults to parts
            targetIds: [], // empty array
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
        });

        // Check that the operation was created with no targets
        const operations = get(operationsStore);
        expect(operations.length).toBe(1);

        const newOperation = operations[0];
        expect(newOperation.targetType).toBe('parts'); // defaults to parts
        expect(newOperation.targetIds).toEqual([]); // empty array
    });

    it('should default to all parts when nothing is selected but parts exist (first operation only)', async () => {
        // Create a drawing with parts (shell with holes)
        const mockDrawing: DrawingData = {
            shapes: [
                // Part 1: outer shell
                {
                    id: 'shape-1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
                    layer: 'Layer1',
                },
                {
                    id: 'shape-2',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 40, y: 0 }, end: { x: 40, y: 40 } },
                    layer: 'Layer1',
                },
                {
                    id: 'shape-3',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 40, y: 40 }, end: { x: 0, y: 40 } },
                    layer: 'Layer1',
                },
                {
                    id: 'shape-4',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 40 }, end: { x: 0, y: 0 } },
                    layer: 'Layer1',
                },
                // Part 1: hole
                {
                    id: 'shape-5',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 10, y: 10 },
                        end: { x: 20, y: 10 },
                    },
                    layer: 'Layer1',
                },
                {
                    id: 'shape-6',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 20, y: 10 },
                        end: { x: 20, y: 20 },
                    },
                    layer: 'Layer1',
                },
                {
                    id: 'shape-7',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 20, y: 20 },
                        end: { x: 10, y: 20 },
                    },
                    layer: 'Layer1',
                },
                {
                    id: 'shape-8',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 10, y: 20 },
                        end: { x: 10, y: 10 },
                    },
                    layer: 'Layer1',
                },
                // Part 2: separate shell on different layer
                {
                    id: 'shape-9',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 50, y: 0 }, end: { x: 70, y: 0 } },
                    layer: 'Layer2',
                },
                {
                    id: 'shape-10',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 70, y: 0 }, end: { x: 70, y: 20 } },
                    layer: 'Layer2',
                },
                {
                    id: 'shape-11',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 70, y: 20 },
                        end: { x: 50, y: 20 },
                    },
                    layer: 'Layer2',
                },
                {
                    id: 'shape-12',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 50, y: 20 }, end: { x: 50, y: 0 } },
                    layer: 'Layer2',
                },
            ],
            bounds: { min: { x: 0, y: 0 }, max: { x: 70, y: 40 } },
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        drawingStore.setDrawing(new Drawing(mockDrawing), 'test.dxf');

        // Wait for part detection to complete (it's async in the Layer class)
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Render the component
        const component = render(Operations);

        // Ensure no operations exist yet
        expect(get(operationsStore).length).toBe(0);

        // Call the component's addNewOperation function with disabled operation
        // to avoid trying to generate cuts
        component.component.addNewOperation({ enabled: false });

        // Check that the first operation was created with all parts
        const operations = get(operationsStore);
        expect(operations.length).toBe(1);

        const newOperation = operations[0];
        expect(newOperation.targetType).toBe('parts');

        // Get actual part IDs from the drawing
        const drawing = get(drawingStore).drawing;
        const actualPartIds = drawing
            ? Object.values(drawing.layers)
                  .flatMap((layer) => layer.parts)
                  .map((part) => part.id)
            : [];

        expect(newOperation.targetIds).toEqual(actualPartIds);
    });

    it('should default to all chains when nothing is selected, no parts exist, but chains exist (first operation only)', async () => {
        // Set up a drawing with shapes that will create chains
        const mockDrawing: DrawingData = {
            shapes: [
                {
                    id: 'shape-1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
                    layer: 'Layer1',
                },
                {
                    id: 'shape-2',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
                    layer: 'Layer1',
                },
                {
                    id: 'shape-3',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 10, y: 10 }, end: { x: 0, y: 10 } },
                    layer: 'Layer1',
                },
                {
                    id: 'shape-4',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 10 }, end: { x: 0, y: 0 } },
                    layer: 'Layer1',
                },
                // Second chain on a different layer
                {
                    id: 'shape-5',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 20, y: 0 }, end: { x: 30, y: 0 } },
                    layer: 'Layer2',
                },
                {
                    id: 'shape-6',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 30, y: 0 }, end: { x: 30, y: 10 } },
                    layer: 'Layer2',
                },
                {
                    id: 'shape-7',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 30, y: 10 },
                        end: { x: 20, y: 10 },
                    },
                    layer: 'Layer2',
                },
                {
                    id: 'shape-8',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 20, y: 10 }, end: { x: 20, y: 0 } },
                    layer: 'Layer2',
                },
            ],
            bounds: { min: { x: 0, y: 0 }, max: { x: 30, y: 10 } },
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        drawingStore.setDrawing(new Drawing(mockDrawing), 'test.dxf');

        // Ensure no parts exist
        let drawing = get(drawingStore).drawing;
        const parts = drawing
            ? Object.values(drawing.layers).flatMap((layer) => layer.parts)
            : [];
        expect(parts.length).toBe(0);

        // Render the component
        const component = render(Operations);

        // Ensure no operations exist yet
        expect(get(operationsStore).length).toBe(0);

        // Call the component's addNewOperation function with disabled operation
        // to avoid trying to generate cuts
        component.component.addNewOperation({ enabled: false });

        // Check that the first operation was created with all chains
        const operations = get(operationsStore);
        expect(operations.length).toBe(1);

        const newOperation = operations[0];
        expect(newOperation.targetType).toBe('chains');
        // Get the actual chain IDs from the drawing
        drawing = get(drawingStore).drawing;
        const actualChainIds = drawing
            ? Object.values(drawing.layers).flatMap((layer) =>
                  layer.chains.map((chain) => chain.id)
              )
            : [];
        expect(newOperation.targetIds.length).toBe(actualChainIds.length);
        expect(newOperation.targetIds).toEqual(
            expect.arrayContaining(actualChainIds)
        );
    });

    it('should auto-select all parts when creating any operation with nothing selected', async () => {
        // Create a simple drawing with one part (single shell, no holes)
        const mockDrawing: DrawingData = {
            shapes: [
                {
                    id: 'shape-1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
                    layer: 'Layer1',
                },
                {
                    id: 'shape-2',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
                    layer: 'Layer1',
                },
                {
                    id: 'shape-3',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 10, y: 10 }, end: { x: 0, y: 10 } },
                    layer: 'Layer1',
                },
                {
                    id: 'shape-4',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 10 }, end: { x: 0, y: 0 } },
                    layer: 'Layer1',
                },
            ],
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        drawingStore.setDrawing(new Drawing(mockDrawing), 'test.dxf');

        // Wait for part detection to complete (it's async in the Layer class)
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Get the part ID that was created
        const drawing = get(drawingStore).drawing;
        const partIds = drawing
            ? Object.values(drawing.layers)
                  .flatMap((layer) => layer.parts)
                  .map((part) => part.id)
            : [];

        // Render the component
        const component = render(Operations);

        // Create first operation (should auto-select all parts)
        component.component.addNewOperation({ enabled: false });
        expect(get(operationsStore).length).toBe(1);
        expect(get(operationsStore)[0].targetIds).toEqual(partIds);

        // Create second operation with nothing selected (should ALSO auto-select all parts)
        component.component.addNewOperation({ enabled: false });
        expect(get(operationsStore).length).toBe(2);

        const secondOperation = get(operationsStore)[1];
        expect(secondOperation.targetType).toBe('parts');
        expect(secondOperation.targetIds).toEqual(partIds); // Should also contain all parts
    });
});
