import { writable } from 'svelte/store';
import {
    type Drawing,
    type Point2D,
    type Shape,
    WorkflowStage,
} from '$lib/types';
import { Unit } from '$lib/utils/units';
import {
    moveShape,
    rotateShape,
    scaleShape,
} from '$lib/geometry/shape/functions';
import type { DrawingState, DrawingStore } from './interfaces';
import { resetDownstreamStages } from './functions';

function createDrawingStore(): DrawingStore {
    const { subscribe, update } = writable<DrawingState>({
        drawing: null,
        selectedShapes: new Set(),
        hoveredShape: null,
        selectedOffsetShape: null,
        isDragging: false,
        dragStart: null,
        scale: 1,
        offset: { x: 0, y: 0 },
        fileName: null,
        layerVisibility: {},
        displayUnit: Unit.MM,
    });

    return {
        subscribe,
        setDrawing: (drawing: Drawing, fileName?: string) => {
            // Reset all application state when importing a new file
            resetDownstreamStages('edit');

            return update((state) => ({
                ...state,
                drawing,
                fileName: fileName || null,
                displayUnit: drawing.units, // Set display unit from drawing's detected units
                scale: 1, // Always start at 100% zoom
                offset: { x: 0, y: 0 }, // Reset offset
                selectedShapes: new Set(), // Clear selection
                hoveredShape: null, // Clear hover state
                isDragging: false, // Reset drag state
                dragStart: null, // Reset drag start
            }));
        },

        selectShape: (shapeId: string, multi = false) =>
            update((state) => {
                const selectedShapes: Set<string> = new Set(
                    multi ? state.selectedShapes : []
                );
                selectedShapes.add(shapeId);
                return { ...state, selectedShapes };
            }),

        deselectShape: (shapeId: string) =>
            update((state) => {
                const selectedShapes: Set<string> = new Set(
                    state.selectedShapes
                );
                selectedShapes.delete(shapeId);
                return { ...state, selectedShapes };
            }),

        clearSelection: () =>
            update((state) => ({
                ...state,
                selectedShapes: new Set(),
            })),

        deleteSelected: () =>
            update((state) => {
                if (!state.drawing) return state;

                const shapes: Shape[] = state.drawing.shapes.filter(
                    (shape) => !state.selectedShapes.has(shape.id)
                );

                // Reset downstream stages when shapes are deleted
                resetDownstreamStages('edit');

                return {
                    ...state,
                    drawing: { ...state.drawing, shapes },
                    selectedShapes: new Set(),
                };
            }),

        moveShapes: (shapeIds: string[], delta: Point2D) =>
            update((state) => {
                if (!state.drawing) return state;

                const shapes: Shape[] = state.drawing.shapes.map((shape) => {
                    if (shapeIds.includes(shape.id)) {
                        return moveShape(shape, delta);
                    }
                    return shape;
                });

                // Reset downstream stages when shapes are moved
                resetDownstreamStages('edit');

                return {
                    ...state,
                    drawing: { ...state.drawing, shapes },
                };
            }),

        scaleShapes: (
            shapeIds: string[],
            scaleFactor: number,
            origin: Point2D
        ) =>
            update((state) => {
                if (!state.drawing) return state;

                const shapes: Shape[] = state.drawing.shapes.map((shape) => {
                    if (shapeIds.includes(shape.id)) {
                        return scaleShape(shape, scaleFactor, origin);
                    }
                    return shape;
                });

                // Reset downstream stages when shapes are scaled
                resetDownstreamStages('edit');

                return {
                    ...state,
                    drawing: { ...state.drawing, shapes },
                };
            }),

        rotateShapes: (shapeIds: string[], angle: number, origin: Point2D) =>
            update((state) => {
                if (!state.drawing) return state;

                const shapes: Shape[] = state.drawing.shapes.map((shape) => {
                    if (shapeIds.includes(shape.id)) {
                        return rotateShape(shape, angle, origin);
                    }
                    return shape;
                });

                // Reset downstream stages when shapes are rotated
                resetDownstreamStages('edit');

                return {
                    ...state,
                    drawing: { ...state.drawing, shapes },
                };
            }),

        setViewTransform: (scale: number, offset: Point2D) =>
            update((state) => ({
                ...state,
                scale,
                offset,
            })),

        setLayerVisibility: (layerName: string, visible: boolean) =>
            update((state) => ({
                ...state,
                layerVisibility: {
                    ...state.layerVisibility,
                    [layerName]: visible,
                },
            })),

        setHoveredShape: (shapeId: string | null) =>
            update((state) => ({
                ...state,
                hoveredShape: shapeId,
            })),

        setDisplayUnit: (unit: Unit) =>
            update((state) => ({
                ...state,
                displayUnit: unit,
            })),

        replaceAllShapes: (shapes: Shape[]) =>
            update((state) => {
                if (!state.drawing) return state;

                // Reset downstream stages when shapes are replaced (this happens during prepare stage operations)
                resetDownstreamStages(WorkflowStage.PREPARE);

                return {
                    ...state,
                    drawing: { ...state.drawing, shapes },
                    selectedShapes: new Set(), // Clear selection since shape IDs may have changed
                };
            }),

        // Special method for restoring state without resetting downstream stages
        restoreDrawing: (
            drawing: Drawing,
            fileName: string | null,
            scale: number,
            offset: Point2D,
            displayUnit: Unit,
            selectedShapes: Set<string>,
            hoveredShape: string | null
        ) => {
            return update((state) => ({
                ...state,
                drawing,
                fileName,
                scale,
                offset,
                displayUnit,
                selectedShapes,
                hoveredShape,
                isDragging: false,
                dragStart: null,
            }));
        },

        selectOffsetShape: (shape: Shape | null) =>
            update((state) => ({
                ...state,
                selectedOffsetShape: shape,
                selectedShapes: new Set(), // Clear regular shape selection when selecting offset shape
            })),

        clearOffsetShapeSelection: () =>
            update((state) => ({
                ...state,
                selectedOffsetShape: null,
            })),
    };
}

export const drawingStore: ReturnType<typeof createDrawingStore> =
    createDrawingStore();
