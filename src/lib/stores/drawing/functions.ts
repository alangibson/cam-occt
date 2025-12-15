/**
 * Drawing Store Helper Functions
 *
 * Helper functions that work with drawing data but don't directly modify the store.
 */

import { WorkflowStage } from '$lib/stores/workflow/enums';
import { partStore } from '$lib/stores/parts/store.svelte';
import { overlayStore } from '$lib/stores/overlay/store.svelte';
import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
import { operationsStore } from '$lib/stores/operations/store.svelte';
import { workflowStore } from '$lib/stores/workflow/store.svelte';
import { planStore } from '$lib/stores/plan/store.svelte';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Drawing } from '$lib/cam/drawing/classes.svelte';
import { DEFAULT_PADDING, MIN_SVG_SIZE } from '$components/svg/constants';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';

const DEFAULT_ZOOM_MARGIN = 0.1; // 10% margin for zoom-to-fit
const MAX_ZOOM_SCALE = 5.0; // 500% maximum zoom
const ORIGIN_POSITION_X = 0.1; // Origin at 10% from left edge
const ORIGIN_POSITION_Y = 0.9; // Origin at 90% from top edge

/**
 * Helper function to reset downstream stages when drawing is modified
 */
export const resetDownstreamStages = (
    fromStage: WorkflowStage = WorkflowStage.IMPORT
): void => {
    // Clear stage-specific data
    // Chains are auto-generated from drawing layers, no need to clear them
    partStore.clearParts();

    // Clear other stores
    overlayStore.clearStageOverlay(WorkflowStage.PROGRAM);
    overlayStore.clearStageOverlay(WorkflowStage.SIMULATE);
    overlayStore.clearStageOverlay(WorkflowStage.EXPORT);
    visualizationStore.clearTessellation();

    // Clear program-specific stores
    visualizationStore.reset();
    operationsStore.reset();
    planStore.reset();

    // Reset workflow completion status for downstream stages
    workflowStore.invalidateDownstreamStages(fromStage);
};

/**
 * Calculate SVG viewport dimensions and offset from drawing bounds
 */
function svgViewport(bounds: BoundingBoxData) {
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

/**
 * Calculate viewport for drawing store from bounds
 * Used by DrawingStore viewport getter
 */
export function calculateViewport(bounds: BoundingBoxData): {
    width: number;
    height: number;
    offset: Point2D;
} {
    return svgViewport(bounds);
}

/**
 * Calculate optimal zoom and pan settings to fit a bounding box in the canvas
 * with a specified margin percentage.
 *
 * The CAD origin (0,0) is positioned at 10% from left and 90% from top of the canvas.
 */
export function calculateZoomToFit(
    boundingBox: { min: Point2D; max: Point2D },
    canvasWidth: number,
    canvasHeight: number,
    unitScale: number = 1,
    marginPercent: number = DEFAULT_ZOOM_MARGIN
): { scale: number; offset: Point2D } {
    // Calculate drawing dimensions in world units
    const drawingWidth = boundingBox.max.x - boundingBox.min.x;
    const drawingHeight = boundingBox.max.y - boundingBox.min.y;

    // Handle edge case of zero-size drawings
    if (drawingWidth === 0 && drawingHeight === 0) {
        return {
            scale: 1,
            offset: {
                x: canvasWidth * ORIGIN_POSITION_X,
                y: canvasHeight * ORIGIN_POSITION_Y,
            },
        };
    }

    // Calculate available canvas space (accounting for margin)
    const availableWidth = canvasWidth * (1 - 2 * marginPercent);
    const availableHeight = canvasHeight * (1 - 2 * marginPercent);

    // Calculate scale needed to fit width and height separately
    const scaleForWidth =
        drawingWidth > 0
            ? availableWidth / (drawingWidth * unitScale)
            : Number.MAX_VALUE;
    const scaleForHeight =
        drawingHeight > 0
            ? availableHeight / (drawingHeight * unitScale)
            : Number.MAX_VALUE;

    // Use the more restrictive scale (smaller value)
    const scale = Math.min(scaleForWidth, scaleForHeight, MAX_ZOOM_SCALE); // Cap at 500% max zoom

    // Position the CAD origin at 10% from left, 90% from top
    const panX = canvasWidth * ORIGIN_POSITION_X;
    const panY = canvasHeight * ORIGIN_POSITION_Y;

    return {
        scale,
        offset: { x: panX, y: panY },
    };
}

/**
 * Helper function to calculate zoom-to-fit settings for a drawing
 */
export function calculateZoomToFitForDrawing(
    drawing: Drawing,
    canvasDimensions: { width: number; height: number },
    unitScale: number
): { scale: number; offset: Point2D } {
    // Get bounding box for all shapes in the drawing
    const bounds = drawing.bounds;

    // Calculate zoom-to-fit with default margin
    return calculateZoomToFit(
        bounds,
        canvasDimensions.width,
        canvasDimensions.height,
        unitScale
    );
}

/**
 * Calculate zoom to 100% with origin positioned at 10% from left, 90% from top
 */
export function calculateZoom100(
    canvasWidth: number,
    canvasHeight: number
): { scale: number; offset: Point2D } {
    return {
        scale: 1,
        offset: {
            x: canvasWidth * ORIGIN_POSITION_X,
            y: canvasHeight * ORIGIN_POSITION_Y,
        },
    };
}
