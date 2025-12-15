/**
 * Viewport Culling for Canvas Performance Optimization
 *
 * Only renders shapes that are visible in the current viewport bounds
 * to dramatically improve performance with large drawings.
 */

import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';
import { shapeBoundingBox } from '$lib/cam/shape/functions';

/**
 * Default margin for viewport culling in world units
 */
const VIEWPORT_CULLING_MARGIN = 50;

/**
 * Fixed origin position: 10% from left, 90% from top
 */
const ORIGIN_POSITION_X = 0.1; // Origin at 10% from left edge
const ORIGIN_POSITION_Y = 0.9; // Origin at 90% from top edge

export interface ViewportBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export interface ShapeBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

/**
 * Convert BoundingBox to ShapeBounds format
 */
function convertBoundingBox(bbox: BoundingBoxData): ShapeBounds {
    return {
        minX: bbox.min.x,
        maxX: bbox.max.x,
        minY: bbox.min.y,
        maxY: bbox.max.y,
    };
}

/**
 * Calculate tight bounding box for any shape using existing bounding box utilities
 */
export function calculateShapeBounds(shape: ShapeData): ShapeBounds {
    try {
        const bbox = shapeBoundingBox(shape);
        return convertBoundingBox(bbox);
    } catch (error) {
        console.warn(
            `Failed to calculate bounds for shape ${shape.id}:`,
            error
        );
        return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
}

/**
 * Check if shape bounds intersect with viewport bounds
 */
export function isShapeInViewport(
    shapeBounds: ShapeBounds,
    viewport: ViewportBounds,
    margin: number = 0
): boolean {
    return !(
        shapeBounds.maxX + margin < viewport.minX ||
        shapeBounds.minX - margin > viewport.maxX ||
        shapeBounds.maxY + margin < viewport.minY ||
        shapeBounds.minY - margin > viewport.maxY
    );
}

/**
 * Calculate viewport bounds in world coordinates
 */
export function calculateViewportBounds(
    canvasWidth: number,
    canvasHeight: number,
    scale: number,
    offset: Point2D,
    physicalScale: number = 1
): ViewportBounds {
    const totalScale = scale * physicalScale;

    // Calculate origin position (10% from left, 90% from top)
    const originX = canvasWidth * ORIGIN_POSITION_X + offset.x;
    const originY = canvasHeight * ORIGIN_POSITION_Y + offset.y;

    // Convert canvas corners to world coordinates
    const topLeft = {
        x: (0 - originX) / totalScale,
        y: -(0 - originY) / totalScale,
    };

    const bottomRight = {
        x: (canvasWidth - originX) / totalScale,
        y: -(canvasHeight - originY) / totalScale,
    };

    return {
        minX: Math.min(topLeft.x, bottomRight.x),
        maxX: Math.max(topLeft.x, bottomRight.x),
        minY: Math.min(topLeft.y, bottomRight.y),
        maxY: Math.max(topLeft.y, bottomRight.y),
    };
}

/**
 * Filter shapes that are visible in viewport
 */
export function cullShapesToViewport(
    shapes: ShapeData[],
    viewport: ViewportBounds,
    margin: number = VIEWPORT_CULLING_MARGIN // Extra margin in world units
): { visibleShapes: ShapeData[]; culledCount: number } {
    const visibleShapes: ShapeData[] = [];
    let culledCount = 0;

    for (const shape of shapes) {
        const bounds = calculateShapeBounds(shape);

        if (isShapeInViewport(bounds, viewport, margin)) {
            visibleShapes.push(shape);
        } else {
            culledCount++;
        }
    }

    return { visibleShapes, culledCount };
}
