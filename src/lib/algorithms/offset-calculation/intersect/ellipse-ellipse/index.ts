import type { Shape } from '$lib/geometry/shape';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import { findEllipseEllipseIntersectionsVerb as findEllipseEllipseIntersectionsVerbUtil } from '$lib/algorithms/offset-calculation/intersect/ellipse';

/**
 * Find intersections between two ellipses using verb-nurbs
 * Implements INTERSECTION.md recommendation #135: "Use verb.intersect.curves() with two ellipse objects"
 */
export function findEllipseEllipseIntersectionsVerb(
    shape1: Shape,
    shape2: Shape
): IntersectionResult[] {
    return findEllipseEllipseIntersectionsVerbUtil(shape1, shape2, false);
}

/**
 * Find intersections between two ellipses using NURBS
 */
export function findEllipseEllipseIntersections(
    shape1: Shape,
    shape2: Shape
): IntersectionResult[] {
    // Use NURBS-based intersection as recommended in INTERSECTION.md
    return findEllipseEllipseIntersectionsVerb(shape1, shape2);
}
