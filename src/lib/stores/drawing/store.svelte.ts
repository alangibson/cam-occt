import { Drawing } from '$lib/cam/drawing/classes.svelte';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { Unit, getPhysicalScaleFactor } from '$lib/config/units/units';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { resetDownstreamStages } from './functions';
import { calculateZoomToFitForDrawing } from '$lib/cam/drawing/functions';
import {
    DEFAULT_PADDING,
    DEFAULT_SVG_SIZE,
    MIN_SVG_SIZE,
} from '$components/svg/constants';

class DrawingStore {
    drawing = $state<Drawing | null>(null);
    isDragging = $state(false);
    dragStart = $state<Point2D | null>(null);
    scale = $state(1);
    offset = $state<Point2D>({ x: 0, y: 0 });
    layerVisibility = $state<{ [layerName: string]: boolean }>({});
    displayUnit = $state<Unit>(Unit.MM);
    canvasDimensions = $state<{ width: number; height: number } | null>(null);

    // Derived: Calculate physical scale factor for unit display
    get unitScale(): number {
        return this.drawing
            ? getPhysicalScaleFactor(this.drawing.units, this.displayUnit)
            : 1;
    }

    // Derived: Calculate SVG viewport dimensions and offset from drawing bounds
    get viewport(): { width: number; height: number; offset: Point2D } {
        if (!this.drawing) {
            return {
                width: DEFAULT_SVG_SIZE,
                height: DEFAULT_SVG_SIZE,
                offset: { x: 0, y: 0 },
            };
        }

        const bounds = this.drawing.bounds;

        // Calculate dimensions from bounds
        const boundsWidth = bounds.max.x - bounds.min.x;
        const boundsHeight = bounds.max.y - bounds.min.y;

        // Calculate SVG viewport size with padding
        const totalPadding = DEFAULT_PADDING;
        const width = Math.max(boundsWidth + 2 * totalPadding, MIN_SVG_SIZE);
        const height = Math.max(boundsHeight + 2 * totalPadding, MIN_SVG_SIZE);

        // Set transform offsets to map CNC coordinates to SVG coordinates
        const offset: Point2D = {
            x: bounds.min.x - totalPadding,
            y: bounds.min.y - totalPadding,
        };

        return { width, height, offset };
    }

    setDrawing(drawing: Drawing, fileName: string) {
        // Reset all application state when importing a new file
        resetDownstreamStages(WorkflowStage.IMPORT);

        // Update the drawing's fileName property
        drawing.fileName = fileName;

        this.drawing = drawing;
        this.displayUnit = drawing.units; // Set display unit from drawing's detected units
        this.isDragging = false; // Reset drag state
        this.dragStart = null; // Reset drag start

        // Calculate zoom-to-fit if canvas dimensions are available
        const zoomToFit = calculateZoomToFitForDrawing(
            drawing,
            this.canvasDimensions,
            this.displayUnit
        );

        this.scale = zoomToFit.scale;
        this.offset = zoomToFit.offset;
    }

    setViewTransform(scale: number, offset: Point2D) {
        this.scale = scale;
        this.offset = offset;
    }

    setCanvasDimensions(width: number, height: number) {
        const canvasDimensions = { width, height };

        // If we have a drawing and this is the first time setting canvas dimensions,
        // automatically calculate zoom-to-fit
        if (this.drawing && !this.canvasDimensions) {
            const zoomToFit = calculateZoomToFitForDrawing(
                this.drawing,
                canvasDimensions,
                this.displayUnit
            );

            this.canvasDimensions = canvasDimensions;
            this.scale = zoomToFit.scale;
            this.offset = zoomToFit.offset;
        } else {
            this.canvasDimensions = canvasDimensions;
        }
    }

    zoomToFit() {
        // Only calculate zoom-to-fit if we have a drawing and canvas dimensions
        if (this.drawing && this.canvasDimensions) {
            const zoomToFit = calculateZoomToFitForDrawing(
                this.drawing,
                this.canvasDimensions,
                this.displayUnit
            );

            this.scale = zoomToFit.scale;
            this.offset = zoomToFit.offset;
        }
    }

    setLayerVisibility(layerName: string, visible: boolean) {
        this.layerVisibility = {
            ...this.layerVisibility,
            [layerName]: visible,
        };
    }

    setDisplayUnit(unit: Unit) {
        this.displayUnit = unit;
    }

    // Special method for restoring state without resetting downstream stages
    restoreDrawing(
        drawing: Drawing,
        fileName: string,
        scale: number,
        offset: Point2D,
        displayUnit: Unit
    ) {
        // Update the drawing's fileName property
        if (drawing) {
            drawing.fileName = fileName;
        }

        this.drawing = drawing;
        this.scale = scale;
        this.offset = offset;
        this.displayUnit = displayUnit;
        this.isDragging = false;
        this.dragStart = null;
    }

    reset() {
        this.drawing = null;
        this.isDragging = false;
        this.dragStart = null;
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.layerVisibility = {};
        this.displayUnit = Unit.MM;
        this.canvasDimensions = null;
    }
}

export const drawingStore: DrawingStore = new DrawingStore();
