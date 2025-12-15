import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drawingStore } from './store.svelte';
import { selectionStore } from '$lib/stores/selection/store.svelte';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import { Unit } from '$lib/config/units/units';
import { GeometryType } from '$lib/geometry/enums';
import { overlayStore } from '$lib/stores/overlay/store.svelte';
import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
import { operationsStore } from '$lib/stores/operations/store.svelte';
import { workflowStore } from '$lib/stores/workflow/store.svelte';
import { WorkflowStage } from '$lib/stores/workflow/enums';

// Mock dependent modules
vi.mock('../chains/functions', () => ({
    clearChains: vi.fn(),
}));

vi.mock('../parts/functions', () => ({
    clearParts: vi.fn(),
}));

// Mock the stores with correct paths
vi.mock('../overlay/store.svelte', () => ({
    overlayStore: {
        clearStageOverlay: vi.fn(),
    },
}));

vi.mock('../visualization/classes.svelte', () => ({
    visualizationStore: {
        reset: vi.fn(),
        resetCuts: vi.fn(),
        resetRapids: vi.fn(),
        clearTessellation: vi.fn(),
    },
}));

vi.mock('../operations/store.svelte', () => ({
    operationsStore: {
        reset: vi.fn(),
    },
}));

vi.mock('../workflow/store.svelte', () => ({
    workflowStore: {
        invalidateDownstreamStages: vi.fn(),
    },
}));

vi.mock('../workflow/enums', () => ({
    WorkflowStage: {
        IMPORT: 'import',
        EDIT: 'edit',
        PREPARE: 'prepare',
        PROGRAM: 'program',
        SIMULATE: 'simulate',
        EXPORT: 'export',
    },
}));

describe('drawingStore', () => {
    beforeEach(() => {
        // Clear all mocks
        vi.clearAllMocks();
    });

    const createTestDrawing = (): DrawingData => ({
        shapes: [
            {
                id: 'line-1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 10 },
                },
            },
            {
                id: 'circle-1',
                type: GeometryType.CIRCLE,
                geometry: {
                    center: { x: 5, y: 5 },
                    radius: 3,
                },
            },
        ],
        units: Unit.MM,
        fileName: 'test.dxf',
    });

    describe('setDrawing', () => {
        it('should set drawing and reset state', async () => {
            const drawingData = createTestDrawing();
            const drawing = new Drawing(drawingData);

            await drawingStore.setDrawing(drawing, 'test.dxf');

            const state = drawingStore;
            expect(state.drawing).toEqual(drawing);
            expect(state.drawing?.fileName).toBe('test.dxf');
            expect(state.displayUnit).toBe(Unit.MM);
            expect(state.scale).toBe(1);
            expect(state.offset).toEqual({ x: 0, y: 0 });
        });

        it('should reset downstream stages', async () => {
            const drawingData = createTestDrawing();
            const drawing = new Drawing(drawingData);

            await drawingStore.setDrawing(drawing, 'test.dxf');

            // Wait for async operations to complete
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Use mocked stores

            expect(overlayStore.clearStageOverlay).toHaveBeenCalledWith(
                WorkflowStage.PROGRAM
            );
            expect(overlayStore.clearStageOverlay).toHaveBeenCalledWith(
                WorkflowStage.PROGRAM
            );
            expect(visualizationStore.reset).toHaveBeenCalled();
            expect(operationsStore.reset).toHaveBeenCalled();
            expect(
                workflowStore.invalidateDownstreamStages
            ).toHaveBeenCalledWith(WorkflowStage.IMPORT);
        });

        it('should handle drawing without filename', async () => {
            const drawingData = createTestDrawing();
            const drawing = new Drawing(drawingData);

            await drawingStore.setDrawing(drawing, '');

            const state = drawingStore;
            expect(state.drawing?.fileName).toBe('');
        });
    });

    describe('selectShape', () => {
        beforeEach(async () => {
            await drawingStore.setDrawing(
                new Drawing(createTestDrawing()),
                'test.dxf'
            );
            selectionStore.reset();
        });

        it('should select single shape', () => {
            selectionStore.selectShape('line-1');

            const state = selectionStore.getState();
            expect(state.shapes.selected.has('line-1')).toBe(true);
            expect(state.shapes.selected.size).toBe(1);
        });

        it('should replace selection when multi is false', () => {
            selectionStore.selectShape('line-1');
            selectionStore.selectShape('circle-1'); // Should replace, not add

            const state = selectionStore.getState();
            expect(state.shapes.selected.has('line-1')).toBe(false);
            expect(state.shapes.selected.has('circle-1')).toBe(true);
            expect(state.shapes.selected.size).toBe(1);
        });

        it('should add to selection when multi is true', () => {
            selectionStore.selectShape('line-1');
            selectionStore.selectShape('circle-1', true); // Should add

            const state = selectionStore.getState();
            expect(state.shapes.selected.has('line-1')).toBe(true);
            expect(state.shapes.selected.has('circle-1')).toBe(true);
            expect(state.shapes.selected.size).toBe(2);
        });
    });

    describe('deselectShape', () => {
        beforeEach(async () => {
            await drawingStore.setDrawing(
                new Drawing(createTestDrawing()),
                'test.dxf'
            );
            selectionStore.reset();
            selectionStore.selectShape('line-1');
            selectionStore.selectShape('circle-1', true);
        });

        it('should remove shape from selection', () => {
            selectionStore.deselectShape('line-1');

            const state = selectionStore.getState();
            expect(state.shapes.selected.has('line-1')).toBe(false);
            expect(state.shapes.selected.has('circle-1')).toBe(true);
            expect(state.shapes.selected.size).toBe(1);
        });

        it('should handle deselecting non-selected shape', () => {
            selectionStore.deselectShape('non-existent');

            const state = selectionStore.getState();
            expect(state.shapes.selected.size).toBe(2); // Should remain unchanged
        });
    });

    describe('clearSelection', () => {
        beforeEach(async () => {
            await drawingStore.setDrawing(
                new Drawing(createTestDrawing()),
                'test.dxf'
            );
            selectionStore.reset();
            selectionStore.selectShape('line-1');
            selectionStore.selectShape('circle-1', true);
        });

        it('should clear all selections', () => {
            selectionStore.clearShapeSelection();

            const state = selectionStore.getState();
            expect(state.shapes.selected.size).toBe(0);
        });
    });

    describe('setViewTransform', () => {
        it('should update scale and pan', () => {
            const scale = 2;
            const pan = { x: 100, y: 50 };

            drawingStore.setViewTransform(scale, pan);

            const state = drawingStore;
            expect(state.scale).toBe(scale);
            expect(state.pan).toEqual(pan);
        });
    });

    describe('setLayerVisibility', () => {
        it('should update layer visibility', () => {
            drawingStore.setLayerVisibility('Layer1', false);

            const state = drawingStore;
            expect(state.layerVisibility['Layer1']).toBe(false);
        });

        it('should add new layer visibility setting', () => {
            drawingStore.setLayerVisibility('NewLayer', true);

            const state = drawingStore;
            expect(state.layerVisibility['NewLayer']).toBe(true);
        });

        it('should preserve existing layer settings', () => {
            drawingStore.setLayerVisibility('Layer1', false);
            drawingStore.setLayerVisibility('Layer2', true);

            const state = drawingStore;
            expect(state.layerVisibility['Layer1']).toBe(false);
            expect(state.layerVisibility['Layer2']).toBe(true);
        });
    });

    describe('setHoveredShape', () => {
        it('should set hovered shape', () => {
            selectionStore.setHoveredShape('line-1');

            const state = selectionStore.getState();
            expect(state.shapes.hovered).toBe('line-1');
        });

        it('should clear hovered shape', () => {
            selectionStore.setHoveredShape('line-1');
            selectionStore.setHoveredShape(null);

            const state = selectionStore.getState();
            expect(state.shapes.hovered).toBeNull();
        });
    });

    describe('setDisplayUnit', () => {
        it('should update display unit', () => {
            drawingStore.displayUnit = Unit.INCH;

            const state = drawingStore;
            expect(state.displayUnit).toBe(Unit.INCH);
        });

        it('should switch between units', () => {
            drawingStore.displayUnit = Unit.INCH;
            drawingStore.displayUnit = Unit.MM;

            const state = drawingStore;
            expect(state.displayUnit).toBe(Unit.MM);
        });
    });

    describe('restoreDrawing', () => {
        it('should restore complete drawing state without resetting downstream stages', async () => {
            const drawingData = createTestDrawing();
            const drawing = new Drawing(drawingData);
            const scale = 2;
            const offset = { x: 100, y: 50 };

            drawingStore.restoreDrawing(
                drawing,
                'restored.dxf',
                scale,
                offset,
                Unit.INCH
            );

            const state = drawingStore;
            expect(state.drawing).toEqual(drawing);
            expect(state.drawing?.fileName).toBe('restored.dxf');
            expect(state.scale).toBe(scale);
            expect(state.offset).toEqual(offset);
            expect(state.displayUnit).toBe(Unit.INCH);
            expect(state.isDragging).toBe(false);
            expect(state.dragStart).toBeNull();

            // Should NOT have called workflow reset functions
            expect(
                workflowStore.invalidateDownstreamStages
            ).not.toHaveBeenCalled();
        });
    });
});
