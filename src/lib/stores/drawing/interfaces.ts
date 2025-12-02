/**
 * Drawing Store Interfaces
 *
 * Type definitions for the drawing store.
 */

import type { Drawing } from '$lib/cam/drawing/classes.svelte';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { Unit } from '$lib/config/units/units';

export interface DrawingState {
    drawing: Drawing | null;
    isDragging: boolean;
    dragStart: Point2D | null;
    scale: number;
    offset: Point2D;
    layerVisibility: { [layerName: string]: boolean };
    displayUnit: Unit;
    canvasDimensions: { width: number; height: number } | null;
}

export interface DrawingStore {
    subscribe: (run: (value: DrawingState) => void) => () => void;
    setDrawing: (drawing: Drawing, fileName: string) => void;
    deleteSelected: (shapeIds: string[]) => void;
    moveShapes: (shapeIds: string[], delta: Point2D) => void;
    scaleShapes: (
        shapeIds: string[],
        scaleFactor: number,
        origin: Point2D
    ) => void;
    rotateShapes: (shapeIds: string[], angle: number, origin: Point2D) => void;
    setViewTransform: (scale: number, offset: Point2D) => void;
    setCanvasDimensions: (width: number, height: number) => void;
    zoomToFit: () => void;
    setLayerVisibility: (layerName: string, visible: boolean) => void;
    setDisplayUnit: (unit: Unit) => void;
    replaceAllShapes: (shapes: ShapeData[]) => void;
    restoreDrawing: (
        drawing: Drawing,
        fileName: string,
        scale: number,
        offset: Point2D,
        displayUnit: Unit
    ) => void;
    reset: () => void;
}
