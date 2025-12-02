import { writable } from 'svelte/store';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { Shape } from '$lib/cam/shape/classes';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { Unit } from '$lib/config/units/units';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { moveShape, rotateShape, scaleShape } from '$lib/cam/shape/functions';
import type { DrawingState, DrawingStore } from './interfaces';
import { resetDownstreamStages } from './functions';
import { calculateZoomToFitForDrawing } from '$lib/cam/drawing/functions';

const initialState: DrawingState = {
    drawing: null,
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
                    isDragging: false, // Reset drag state
                    dragStart: null, // Reset drag start
                };
            });
        },

        deleteSelected: (shapeIds: string[]) =>
            update((state) => {
                if (!state.drawing) return state;

                const shapeIdSet = new Set(shapeIds);
                const shapes: ShapeData[] = state.drawing.shapes.filter(
                    (shape: ShapeData) => !shapeIdSet.has(shape.id)
                );

                // Reset downstream stages when shapes are deleted
                resetDownstreamStages('edit');

                // Mutate the existing drawing instance
                state.drawing.shapes = shapes;

                return {
                    ...state,
                };
            }),

        moveShapes: (shapeIds: string[], delta: Point2D) =>
            update((state) => {
                if (!state.drawing) return state;

                const shapes: ShapeData[] = state.drawing.shapes.map(
                    (shape: ShapeData) => {
                        if (shapeIds.includes(shape.id)) {
                            return moveShape(new Shape(shape), delta).toData();
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
                            return scaleShape(
                                new Shape(shape),
                                scaleFactor,
                                origin
                            ).toData();
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
                            return rotateShape(
                                new Shape(shape),
                                angle,
                                origin
                            ).toData();
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
                };
            }),

        // Special method for restoring state without resetting downstream stages
        restoreDrawing: (
            drawing: Drawing,
            fileName: string,
            scale: number,
            offset: Point2D,
            displayUnit: Unit
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
                isDragging: false,
                dragStart: null,
            }));
        },

        reset: () =>
            set({
                drawing: null,
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
