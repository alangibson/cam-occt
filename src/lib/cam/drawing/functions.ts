import { Unit, getPhysicalScaleFactor } from '$lib/config/units/units';
import { shapesBoundingBox } from '$lib/cam/shape/functions';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { ZOOM_TO_FIT_MARGIN } from './constants';
import type { Drawing } from './classes.svelte';
import { DEFAULT_PADDING, MIN_SVG_SIZE } from '$components/svg/constants';
import {
    QUARTER_PERCENT,
    THREE_QUARTERS_PERCENT,
} from '$lib/geometry/math/constants';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';

const DEFAULT_ZOOM_MARGIN = 0.1; // 10% margin for zoom-to-fit
const MAX_ZOOM_SCALE = 5.0; // 500% maximum zoom

/**
 * Calculate optimal zoom and pan settings to fit a bounding box in the canvas
 * with a specified margin percentage.
 */
function calculateZoomToFit(
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
            offset: { x: 0, y: 0 },
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

    // Calculate drawing center in world coordinates
    const drawingCenterX = (boundingBox.min.x + boundingBox.max.x) / 2;
    const drawingCenterY = (boundingBox.min.y + boundingBox.max.y) / 2;

    // Calculate where drawing center should be on screen (canvas center)
    const screenCenterX = canvasWidth / 2;
    const screenCenterY = canvasHeight / 2;

    // Calculate canvas origin position (fixed at 25% from left, 75% from top)
    const originX = canvasWidth * QUARTER_PERCENT;
    const originY = canvasHeight * THREE_QUARTERS_PERCENT;

    // Calculate where the drawing center would appear with the new scale
    const totalScale = scale * unitScale;
    const expectedScreenX = drawingCenterX * totalScale + originX;
    const expectedScreenY = -drawingCenterY * totalScale + originY;

    // Calculate offset needed to center the drawing
    const offsetX = screenCenterX - expectedScreenX;
    const offsetY = screenCenterY - expectedScreenY;

    return {
        scale,
        offset: { x: offsetX, y: offsetY },
    };
}

/**
 * Helper function to calculate zoom-to-fit settings for a drawing
 */
export function calculateZoomToFitForDrawing(
    drawing: Drawing,
    canvasDimensions: { width: number; height: number },
    displayUnit: Unit,
    unitScale: number,
    viewport: { width: number; height: number; offset: Point2D }
): { scale: number; offset: Point2D } {
    // Get bounding box for all shapes in the drawing
    const bounds = drawing.bounds;

    // Calculate zoom-to-fit
    const result: { scale: number; offset: Point2D } = calculateZoomToFit(
        bounds,
        canvasDimensions.width,
        canvasDimensions.height,
        unitScale,
        0
    );

    // The viewport transform will shift all coordinates before panzoom is applied.
    // The viewport transform applies: translate(-viewport.offset.x, viewport.height + viewport.offset.y)
    // which shifts the origin (0, 0) to position:
    //   viewportX = -viewportOffset.x * unitScale
    //   viewportY = (viewportHeight + viewportOffset.y) * unitScale
    //
    // After panzoom scaling, for the origin to appear at (originX, originY):
    //   originX = panzoomScale * (-viewportOffset.x * unitScale) + panzoomOffset.x
    //   originY = panzoomScale * ((viewportHeight + viewportOffset.y) * unitScale) + panzoomOffset.y
    //
    // Solving for panzoomOffset:
    //   panzoomOffset.x = originX + viewportOffset.x * totalScale
    //   panzoomOffset.y = originY - (viewportHeight + viewportOffset.y) * totalScale
    //
    // calculateZoomToFit returns an offset for centering the drawing:
    //   offset.x = screenCenterX - drawingCenterX * totalScale - originX
    //   offset.y = screenCenterY + drawingCenterY * totalScale - originY
    //
    // For drawing center to be at screen center with viewport transform:
    //   panzoomOffset.x = screenCenterX - (drawingCenterX - viewportOffset.x) * totalScale
    //                   = screenCenterX - drawingCenterX * totalScale + viewportOffset.x * totalScale
    //                   = (calculatedOffset.x + originX) + viewportOffset.x * totalScale
    //
    // Therefore:
    //   panzoomOffset.x = calculatedOffset.x + originX + viewportOffset.x * totalScale
    //   panzoomOffset.y = calculatedOffset.y + originY - (viewportHeight + viewportOffset.y) * totalScale
    const totalScale = result.scale * unitScale;
    const originX = canvasDimensions.width * 0.25;
    const originY = canvasDimensions.height * 0.75;

    const adjX = originX + viewport.offset.x * totalScale;
    const adjY = originY - (viewport.height + viewport.offset.y) * totalScale;

    // Debug: Log the calculation
    console.log('calculateZoomToFitForDrawing debug:');
    console.log('  result.offset:', result.offset);
    console.log('  result.scale:', result.scale);
    console.log('  unitScale:', unitScale);
    console.log('  originX:', originX, 'originY:', originY);
    console.log('  totalScale:', totalScale);
    console.log('  viewportOffset:', viewport.offset);
    console.log('  viewportHeight:', viewport.height);
    console.log('  adjustment x:', adjX, '  adjustment y:', adjY);
    console.log('  final offset x:', result.offset.x + adjX);
    console.log('  final offset y:', result.offset.y + adjY);

    return {
        scale: result.scale,
        offset: {
            x: result.offset.x + adjX,
            y: result.offset.y + adjY,
        },
    };
}

export function svgViewport(bounds: BoundingBoxData) {
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
