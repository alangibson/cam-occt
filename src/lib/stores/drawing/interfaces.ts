/**
 * Drawing Store Interfaces
 *
 * Type definitions for the drawing store.
 */

import type { Drawing, Shape } from '$lib/geometry/shape';
import type { Point2D } from '$lib/geometry/point';
import { Unit } from '$lib/config/units/units';

export interface DrawingState {
    drawing: Drawing | null;
    selectedShapes: Set<string>;
    hoveredShape: string | null;
    selectedOffsetShape: Shape | null;
    isDragging: boolean;
    dragStart: Point2D | null;
    scale: number;
    offset: Point2D;
    fileName: string | null;
    layerVisibility: { [layerName: string]: boolean };
    displayUnit: Unit;
    canvasDimensions: { width: number; height: number } | null;
}

export interface DrawingStore {
    subscribe: (run: (value: DrawingState) => void) => () => void;
    setDrawing: (drawing: Drawing, fileName?: string) => void;
    selectShape: (shapeIdOrShape: string | Shape, multi?: boolean) => void;
    deselectShape: (shapeId: string) => void;
    clearSelection: () => void;
    deleteSelected: () => void;
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
    setHoveredShape: (shapeId: string | null) => void;
    setDisplayUnit: (unit: Unit) => void;
    replaceAllShapes: (shapes: Shape[]) => void;
    restoreDrawing: (
        drawing: Drawing,
        fileName: string | null,
        scale: number,
        offset: Point2D,
        displayUnit: Unit,
        selectedShapes: Set<string>,
        hoveredShape: string | null
    ) => void;
    selectOffsetShape: (shape: Shape | null) => void;
    clearOffsetShapeSelection: () => void;
    reset: () => void;
}
