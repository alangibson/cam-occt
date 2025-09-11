/**
 * Shape Bounding Box Utilities
 *
 * Consolidates bounding box calculation functions that were duplicated across:
 * - geometric-containment-jsts.ts
 * - part-detection.ts
 */

import type { BoundingBox } from '$lib/geometry/bounding-box';
import {
    combineBoundingBoxes,
    getBoundingBoxForShape,
} from '$lib/geometry/bounding-box';
import type { Spline } from '$lib/geometry/spline';
import type { Chain } from '../algorithms/chain-detection/chain-detection';
import type { Point2D, Polyline, Shape } from '../types';
import { GeometryType } from '../types/geometry';

/**
 * Calculates the bounding box of a chain by aggregating bounds of all shapes
 */
export function calculateChainBoundingBox(chain: Chain): BoundingBox {
    const shapeBounds = chain.shapes.map((shape) =>
        getBoundingBoxForShape(shape)
    );
    return combineBoundingBoxes(shapeBounds);
}

/**
 * Gets the bounding box of a single shape
 * @deprecated Use getBoundingBoxForShape from '$lib/geometry/bounding-box' instead
 */
export function getShapeBoundingBox(shape: Shape): BoundingBox {
    return getBoundingBoxForShape(shape);
}

/**
 * Calculates the bounding box of a spline using NURBS sampling
 * @deprecated Use getBoundingBoxForSpline from '$lib/geometry/bounding-box' instead
 */
export function calculateSplineBoundingBox(spline: Spline): BoundingBox {
    return getBoundingBoxForShape({
        type: GeometryType.SPLINE,
        geometry: spline,
    } as Shape);
}

/**
 * Calculates the bounding box of a polyline
 * @deprecated Use getBoundingBoxForPolyline from '$lib/geometry/bounding-box' instead
 */
export function calculatePolylineBoundingBox(polyline: Polyline): BoundingBox {
    return getBoundingBoxForShape({
        type: GeometryType.POLYLINE,
        geometry: polyline,
    } as Shape);
}

/**
 * Get all significant points from a shape for bounding box calculation
 * Consolidated from translate-to-positive.ts and dxf-parser.ts
 */
export function getShapePointsForBounds(shape: Shape): Point2D[] {
    const bounds = getBoundingBoxForShape(shape);
    return [bounds.min, bounds.max];
}
