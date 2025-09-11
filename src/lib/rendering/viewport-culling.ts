/**
 * Viewport Culling for Canvas Performance Optimization
 *
 * Only renders shapes that are visible in the current viewport bounds
 * to dramatically improve performance with large drawings.
 */

import type { Point2D, Shape } from '../types/geometry';
import type { BoundingBox } from '$lib/geometry/bounding-box';
import { getBoundingBoxForShape } from '$lib/geometry/bounding-box';
import { QUARTER_PERCENT, THREE_QUARTERS_PERCENT } from '$lib/geometry/math';
/**
 * Default margin for viewport culling in world units
 */
const VIEWPORT_CULLING_MARGIN = 50;

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
function convertBoundingBox(bbox: BoundingBox): ShapeBounds {
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
export function calculateShapeBounds(shape: Shape): ShapeBounds {
    try {
        const bbox = getBoundingBoxForShape(shape);
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

    // Calculate origin position
    const originX = canvasWidth * QUARTER_PERCENT + offset.x;
    const originY = canvasHeight * THREE_QUARTERS_PERCENT + offset.y;

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
    shapes: Shape[],
    viewport: ViewportBounds,
    margin: number = VIEWPORT_CULLING_MARGIN // Extra margin in world units
): { visibleShapes: Shape[]; culledCount: number } {
    const visibleShapes: Shape[] = [];
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
