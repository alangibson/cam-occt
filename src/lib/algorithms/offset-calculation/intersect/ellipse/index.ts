import type { Shape, Ellipse, Polyline, Point2D } from '$lib/types/geometry';
import { createPolylineFromVertices } from '$lib/geometry/polyline';
import type { IntersectionResult } from '../../chain/types';
import { EPSILON } from '../../../../geometry/math/constants';
import { findEllipseEllipseIntersections } from '../ellipse-ellipse/index';
import { findEllipseLineIntersections } from '../line-ellipse/index';
import { findEllipsePolylineIntersectionsVerb } from '../polyline-ellipse/index';
import { findEllipseSplineIntersectionsVerb } from '../ellipse-spline/index';
import { findEllipseLineIntersectionsVerb } from '../line-ellipse/index';
import { findEllipseCircleIntersectionsVerb } from '../circle-ellipse/index';
import { findEllipseArcIntersectionsVerb } from '../arc-ellipse/index';

/**
 * Bezier curve tessellation segments for ellipse intersection calculations
 */
const CUBIC_BEZIER_SEGMENTS = 32;

/**
 * Find intersections involving ellipses
 */
export function findEllipseIntersections(
    shape1: Shape,
    shape2: Shape
): IntersectionResult[] {
    // Determine which shape is the ellipse and which is the other
    const ellipseShape: Shape = shape1.type === 'ellipse' ? shape1 : shape2;
    const otherShape: Shape = shape1.type === 'ellipse' ? shape2 : shape1;
    const swapParams: boolean = shape1.type !== 'ellipse';

    if (ellipseShape.type !== 'ellipse') {
        // Both are ellipses
        return findEllipseEllipseIntersections(shape1, shape2);
    }

    switch (otherShape.type) {
        case 'line':
            return findEllipseLineIntersectionsVerb(
                ellipseShape,
                otherShape,
                swapParams
            );
        case 'arc':
            return findEllipseArcIntersectionsVerb(
                ellipseShape,
                otherShape,
                swapParams
            );
        case 'circle':
            return findEllipseCircleIntersectionsVerb(
                ellipseShape,
                otherShape,
                swapParams
            );
        case 'polyline':
            return findEllipsePolylineIntersectionsVerb(
                ellipseShape,
                otherShape,
                swapParams
            );
        case 'spline':
            return findEllipseSplineIntersectionsVerb(
                ellipseShape,
                otherShape,
                swapParams
            );
        default:
            // For unknown types, use a simplified approximation
            return findEllipseGenericIntersections(
                ellipseShape,
                otherShape,
                swapParams
            );
    }
}

/**
 * Find intersections between ellipse and generic shapes using NURBS
 */
export function findEllipseGenericIntersections(
    ellipseShape: Shape,
    otherShape: Shape,
    swapParams: boolean
): IntersectionResult[] {
    switch (otherShape.type) {
        case 'line':
            return findEllipseLineIntersectionsVerb(
                ellipseShape,
                otherShape,
                swapParams
            );
        case 'polyline':
            return findEllipsePolylineIntersectionsVerb(
                ellipseShape,
                otherShape,
                swapParams
            );
        case 'spline':
            return findEllipseSplineIntersectionsVerb(
                ellipseShape,
                otherShape,
                swapParams
            );
        default:
            // For unknown types, fall back to the analytical ellipse-line method as the last resort
            return findEllipseLineIntersections(
                ellipseShape,
                otherShape,
                swapParams
            );
    }
}

/**
 * Approximate an ellipse as a polyline for intersection calculations
 */
export function approximateEllipseAsPolyline(
    ellipse: Ellipse,
    segments: number = CUBIC_BEZIER_SEGMENTS
): Polyline {
    const {
        center,
        majorAxisEndpoint,
        minorToMajorRatio,
        startParam,
        endParam,
    } = ellipse;
    const points: Point2D[] = [];

    const a: number = Math.sqrt(
        majorAxisEndpoint.x ** 2 + majorAxisEndpoint.y ** 2
    );
    const b: number = a * minorToMajorRatio;
    const rotAngle: number = Math.atan2(
        majorAxisEndpoint.y,
        majorAxisEndpoint.x
    );
    const cosRot: number = Math.cos(rotAngle);
    const sinRot: number = Math.sin(rotAngle);

    // Handle ellipse arcs vs full ellipses
    const isArc: boolean = startParam !== undefined && endParam !== undefined;
    const tStart: number = isArc ? startParam! : 0;
    const tEnd: number = isArc ? endParam! : 2 * Math.PI;

    let paramRange: number = tEnd - tStart;
    if (paramRange < 0) paramRange += 2 * Math.PI;

    for (let i: number = 0; i <= segments; i++) {
        const t: number = tStart + (i / segments) * paramRange;
        const localX: number = a * Math.cos(t);
        const localY: number = b * Math.sin(t);

        // Transform to world coordinates
        const worldX: number = center.x + localX * cosRot - localY * sinRot;
        const worldY: number = center.y + localX * sinRot + localY * cosRot;

        points.push({ x: worldX, y: worldY });
    }

    const closed: boolean =
        !isArc && Math.abs(paramRange - 2 * Math.PI) < EPSILON;
    const polylineShape: Shape = createPolylineFromVertices(points, closed);
    return polylineShape.geometry as Polyline;
}
