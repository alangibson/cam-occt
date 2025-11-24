import { writable } from 'svelte/store';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { Unit } from '$lib/config/units/units';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { moveShape, rotateShape, scaleShape } from '$lib/cam/shape/functions';
import type { DrawingState, DrawingStore } from './interfaces';
import { resetDownstreamStages } from './functions';
import { calculateZoomToFitForDrawing } from '$lib/cam/drawing/functions';

const initialState: DrawingState = {
    drawing: null,
    selectedShapes: new Set(),
    hoveredShape: null,
    selectedOffsetShape: null,
    isDragging: false,
    dragStart: null,
    scale: 1,
    offset: { x: 0, y: 0 },
    layerVisibility: {},
    displayUnit: Unit.MM,
    canvasDimensions: null,
};

function createDrawingStore(): DrawingStore {
    const { subscribe, update, set } = writable<DrawingState>(initialState);

    return {
        subscribe,
        setDrawing: (drawing: Drawing, fileName: string) => {
            // Reset all application state when importing a new file
            resetDownstreamStages('edit');

            // Update the drawing's fileName property
            drawing.fileName = fileName;

            return update((state) => {
                const displayUnit = drawing.units; // Set display unit from drawing's detected units

                // Calculate zoom-to-fit if canvas dimensions are available
                const zoomToFit = calculateZoomToFitForDrawing(
                    drawing,
                    state.canvasDimensions,
                    displayUnit
                );

                return {
                    ...state,
                    drawing,
                    displayUnit,
                    scale: zoomToFit.scale,
                    offset: zoomToFit.offset,
                    selectedShapes: new Set(), // Clear selection
                    hoveredShape: null, // Clear hover state
                    isDragging: false, // Reset drag state
                    dragStart: null, // Reset drag start
                };
            });
        },

        selectShape: (shapeIdOrShape: string | ShapeData, multi = false) =>
            update((state) => {
                if (!state.drawing) return state;

                // Extract ID and full shape object
                const shapeId =
                    typeof shapeIdOrShape === 'string'
                        ? shapeIdOrShape
                        : shapeIdOrShape.id;
                const shapeObj =
                    typeof shapeIdOrShape === 'object'
                        ? shapeIdOrShape
                        : state.drawing.shapes.find(
                              (s: ShapeData) => s.id === shapeId
                          );

                // Check if this is an original shape (in drawing.shapes)
                const isOriginalShape = state.drawing.shapes.some(
                    (s: ShapeData) => s.id === shapeId
                );

                if (isOriginalShape) {
                    // Existing logic for original shapes
                    const selectedShapes = new Set(
                        multi ? state.selectedShapes : []
                    );
                    selectedShapes.add(shapeId);
                    return {
                        ...state,
                        selectedShapes,
                        selectedOffsetShape: null, // Clear offset selection
                    };
                } else {
                    // This is an offset shape - use existing selectOffsetShape logic
                    return {
                        ...state,
                        selectedOffsetShape: shapeObj || null,
                        selectedShapes: new Set(), // Clear regular shape selection
                    };
                }
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

                const shapes: ShapeData[] = state.drawing.shapes.filter(
                    (shape: ShapeData) => !state.selectedShapes.has(shape.id)
                );

                // Reset downstream stages when shapes are deleted
                resetDownstreamStages('edit');

                // Mutate the existing drawing instance
                state.drawing.shapes = shapes;

                return {
                    ...state,
                    selectedShapes: new Set(),
                };
            }),

        moveShapes: (shapeIds: string[], delta: Point2D) =>
            update((state) => {
                if (!state.drawing) return state;

                const shapes: ShapeData[] = state.drawing.shapes.map(
                    (shape: ShapeData) => {
                        if (shapeIds.includes(shape.id)) {
                            return moveShape(shape, delta);
                        }
                        return shape;
                    }
                );

                // Reset downstream stages when shapes are moved
                resetDownstreamStages('edit');

                // Mutate the existing drawing instance
                state.drawing.shapes = shapes;

                return {
                    ...state,
                };
            }),

        scaleShapes: (
            shapeIds: string[],
            scaleFactor: number,
            origin: Point2D
        ) =>
            update((state) => {
                if (!state.drawing) return state;

                const shapes: ShapeData[] = state.drawing.shapes.map(
                    (shape: ShapeData) => {
                        if (shapeIds.includes(shape.id)) {
                            return scaleShape(shape, scaleFactor, origin);
                        }
                        return shape;
                    }
                );

                // Reset downstream stages when shapes are scaled
                resetDownstreamStages('edit');

                // Mutate the existing drawing instance
                state.drawing.shapes = shapes;

                return {
                    ...state,
                };
            }),

        rotateShapes: (shapeIds: string[], angle: number, origin: Point2D) =>
            update((state) => {
                if (!state.drawing) return state;

                const shapes: ShapeData[] = state.drawing.shapes.map(
                    (shape: ShapeData) => {
                        if (shapeIds.includes(shape.id)) {
                            return rotateShape(shape, angle, origin);
                        }
                        return shape;
                    }
                );

                // Reset downstream stages when shapes are rotated
                resetDownstreamStages('edit');

                // Mutate the existing drawing instance
                state.drawing.shapes = shapes;

                return {
                    ...state,
                };
            }),

        setViewTransform: (scale: number, offset: Point2D) =>
            update((state) => ({
                ...state,
                scale,
                offset,
            })),

        setCanvasDimensions: (width: number, height: number) =>
            update((state) => {
                const canvasDimensions = { width, height };

                // If we have a drawing and this is the first time setting canvas dimensions,
                // automatically calculate zoom-to-fit
                if (state.drawing && !state.canvasDimensions) {
                    const zoomToFit = calculateZoomToFitForDrawing(
                        state.drawing,
                        canvasDimensions,
                        state.displayUnit
                    );

                    return {
                        ...state,
                        canvasDimensions,
                        scale: zoomToFit.scale,
                        offset: zoomToFit.offset,
                    };
                }

                return {
                    ...state,
                    canvasDimensions,
                };
            }),

        zoomToFit: () =>
            update((state) => {
                // Only calculate zoom-to-fit if we have a drawing and canvas dimensions
                if (state.drawing && state.canvasDimensions) {
                    const zoomToFit = calculateZoomToFitForDrawing(
                        state.drawing,
                        state.canvasDimensions,
                        state.displayUnit
                    );

                    return {
                        ...state,
                        scale: zoomToFit.scale,
                        offset: zoomToFit.offset,
                    };
                }

                // No changes if conditions aren't met
                return state;
            }),

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

        replaceAllShapes: (shapes: ShapeData[]) =>
            update((state) => {
                if (!state.drawing) return state;

                // Reset downstream stages when shapes are replaced (this happens during prepare stage operations)
                resetDownstreamStages(WorkflowStage.PREPARE);

                // Mutate the existing drawing instance
                state.drawing.shapes = shapes;

                return {
                    ...state,
                    selectedShapes: new Set(), // Clear selection since shape IDs may have changed
                };
            }),

        // Special method for restoring state without resetting downstream stages
        restoreDrawing: (
            drawing: Drawing,
            fileName: string,
            scale: number,
            offset: Point2D,
            displayUnit: Unit,
            selectedShapes: Set<string>,
            hoveredShape: string | null
        ) => {
            // Update the drawing's fileName property
            if (drawing) {
                drawing.fileName = fileName;
            }

            return update((state) => ({
                ...state,
                drawing,
                scale,
                offset,
                displayUnit,
                selectedShapes,
                hoveredShape,
                isDragging: false,
                dragStart: null,
            }));
        },

        selectOffsetShape: (shape: ShapeData | null) =>
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

        reset: () =>
            set({
                drawing: null,
                selectedShapes: new Set(),
                hoveredShape: null,
                selectedOffsetShape: null,
                isDragging: false,
                dragStart: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                layerVisibility: {},
                displayUnit: Unit.MM,
                canvasDimensions: null,
            }),
    };
}

export const drawingStore: ReturnType<typeof createDrawingStore> =
    createDrawingStore();
