import { Drawing } from '$lib/cam/drawing/classes.svelte';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { Unit, getPhysicalScaleFactor } from '$lib/config/units/units';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import {
    resetDownstreamStages,
    calculateZoomToFitForDrawing,
    calculateZoom100,
    calculateViewport,
} from './functions';
import { DEFAULT_SVG_SIZE } from '$components/svg/constants';

class DrawingStore {
    // The current drawing containing all shapes, chains, and parts
    drawing = $state<Drawing | null>(null);
    // Whether the user is currently dragging the canvas for panning
    isDragging = $state(false);
    // The starting point of the current drag operation in screen coordinates
    dragStart = $state<Point2D | null>(null);
    // The current zoom scale factor (1.0 = 100%)
    scale = $state(1);
    // The pan offset applied to the canvas viewport
    // in CAD (ie 0,0 == bottom-left) coordinates
    offset = $state<Point2D>({ x: 0, y: 0 });
    // The pan offset applied to the canvas viewport
    // in display/SVG (ie 0,0 == top-left) coordinates
    pan = $state<Point2D>({ x: 0, y: 0 });
    // Visibility state for each layer (layer name -> visible)
    layerVisibility = $state<{ [layerName: string]: boolean }>({});
    // The unit system for display (MM or Inch)
    displayUnit = $state<Unit>(Unit.MM);
    // The pixel dimensions of the drawing container
    containerDimensions = $state<{ width: number; height: number } | null>(
        null
    );

    // TODO Scale from CAD dimensions to SVG/screen dimensions
    // get scale() {
    //     return thisunitScale * zoomScale;
    // }

    // Calculate physical scale factor for unit display
    get unitScale(): number {
        return this.drawing
            ? getPhysicalScaleFactor(this.drawing.units, this.displayUnit)
            : 1;
    }

    // Calculate SVG viewport dimensions and offset from drawing bounds
    get viewport(): { width: number; height: number; offset: Point2D } {
        if (!this.drawing) {
            return {
                width: DEFAULT_SVG_SIZE,
                height: DEFAULT_SVG_SIZE,
                offset: { x: 0, y: 0 },
            };
        }

        return calculateViewport(this.drawing.bounds);
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

        // if (this.containerDimensions) {
        //     // Calculate zoom-to-fit if canvas dimensions are available
        //     const zoomToFit = calculateZoomToFitForDrawing(
        //         drawing,
        //         this.containerDimensions,
        //         this.unitScale,
        //         this.viewport
        //     );
        //     this.scale = zoomToFit.scale;
        //     this.offset = zoomToFit.offset;
        // }
    }

    // Offset is in display/SVG (ie 0,0 == top-left) coordinates
    setViewTransform(scale: number, offset: Point2D) {
        this.scale = scale;
        this.pan = offset;
        this.offset = {
            x: offset.x,
            y: (this.containerDimensions?.height ?? 0) - offset.y,
        };
    }

    setContainerDimensions(width: number, height: number) {
        const canvasDimensions = { width, height };

        // If we have a drawing and this is the first time setting canvas dimensions,
        // automatically calculate zoom-to-fit
        if (this.drawing && !this.containerDimensions) {
            // const zoomToFit = calculateZoomToFitForDrawing(
            //     this.drawing,
            //     canvasDimensions,
            //     this.unitScale,
            //     this.viewport
            // );

            this.containerDimensions = canvasDimensions;
            // this.scale = zoomToFit.scale;
            // this.offset = zoomToFit.offset;
        } else {
            this.containerDimensions = canvasDimensions;
        }
    }

    zoomToFit() {
        // Only calculate zoom-to-fit if we have a drawing and canvas dimensions
        if (this.drawing && this.containerDimensions) {
            // Handle empty drawings
            if (this.drawing.shapes.length === 0) {
                const zoom100 = calculateZoom100(
                    this.containerDimensions.width,
                    this.containerDimensions.height
                );
                this.scale = zoom100.scale;
                this.pan = zoom100.offset;
                this.offset = {
                    x: zoom100.offset.x,
                    y: this.containerDimensions.height - zoom100.offset.y,
                };
                return;
            }

            const zoomToFit = calculateZoomToFitForDrawing(
                this.drawing,
                this.containerDimensions,
                this.unitScale
            );
            this.scale = zoomToFit.scale;
            this.pan = zoomToFit.offset;
            // Keep offset in sync (convert from display to CAD coordinates)
            this.offset = {
                x: zoomToFit.offset.x,
                y: this.containerDimensions.height - zoomToFit.offset.y,
            };
        }
    }

    zoomToPhysical() {
        // Only calculate zoom to 100% if we have canvas dimensions
        if (this.containerDimensions) {
            const zoom100 = calculateZoom100(
                this.containerDimensions.width,
                this.containerDimensions.height
            );
            this.scale = zoom100.scale;
            this.pan = zoom100.offset;
            // Keep offset in sync (convert from display to CAD coordinates)
            this.offset = {
                x: zoom100.offset.x,
                y: this.containerDimensions.height - zoom100.offset.y,
            };
        }
    }

    // Zoom to physical size on screen
    // TODO zoomToPhysical()

    setLayerVisibility(layerName: string, visible: boolean) {
        this.layerVisibility = {
            ...this.layerVisibility,
            [layerName]: visible,
        };
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
        this.containerDimensions = null;
    }
}

export const drawingStore: DrawingStore = new DrawingStore();
