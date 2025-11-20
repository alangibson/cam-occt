import { Unit, getPhysicalScaleFactor } from '$lib/config/units/units';
import { getBoundingBoxForShapes } from '$lib/geometry/bounding-box/functions';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import { ZOOM_TO_FIT_MARGIN } from './constants';
import type { Drawing } from './classes.svelte';

/**
 * Helper function to calculate zoom-to-fit settings for a drawing
 */
export function calculateZoomToFitForDrawing(
    drawing: Drawing,
    canvasDimensions: { width: number; height: number } | null,
    displayUnit: Unit
): { scale: number; offset: Point2D } {
    // If no canvas dimensions available, use default zoom settings
    if (!canvasDimensions || drawing.shapes.length === 0) {
        return { scale: 1, offset: { x: 0, y: 0 } };
    }

    try {
        // Get bounding box for all shapes in the drawing
        const boundingBox = getBoundingBoxForShapes(drawing.shapes);

        // Get unit scale factor for proper display
        const unitScale = getPhysicalScaleFactor(drawing.units, displayUnit);

        // Calculate zoom-to-fit with 10% margin
        return CoordinateTransformer.calculateZoomToFit(
            boundingBox,
            canvasDimensions.width,
            canvasDimensions.height,
            unitScale,
            ZOOM_TO_FIT_MARGIN
        );
    } catch (error) {
        console.warn('Failed to calculate zoom-to-fit:', error);
        return { scale: 1, offset: { x: 0, y: 0 } };
    }
}
