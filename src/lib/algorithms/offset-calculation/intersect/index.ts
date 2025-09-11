import type {
    Shape,
    Point2D,
    Line,
    Arc,
    Circle,
    Polyline,
} from '$lib/types/geometry';
import type { IntersectionResult } from '../chain/types';
import { EPSILON } from '../../../geometry/math/constants';
import {
    getShapeStartPoint,
    getShapeEndPoint,
} from '$lib/geometry/shape/functions';
import { pointDistance } from '../shared/trim-extend-utils';
import {
    MAX_ITERATIONS,
    CONFIDENCE_THRESHOLD,
    CONFIDENCE_HIGH_THRESHOLD,
} from '../../../geometry/constants';

// Re-export shared utility for backward compatibility
export { pointDistance } from '../shared/trim-extend-utils';

// Import intersection functions from dedicated modules and chain module
import { findLineLineIntersections } from './line-line/index';
import { findLineArcIntersections } from './line-arc/index';
import { findLineCircleIntersections } from './line-circle/index';
import { findArcArcIntersections } from './arc-arc/index';
import { findPolylineIntersections } from './polyline/index';
import { findPolylinePolylineIntersections } from './polyline-polyline/index';
import { findPolylineArcIntersections } from './polyline-arc/index';

// Import verb-based spline intersection methods
import { findSplineLineIntersectionsVerb } from './line-spline/index';
import { findSplineSplineIntersectionsVerb } from './spline-spline/index';

// Import circle-spline intersection from dedicated module
import { findSplineCircleIntersectionsVerb } from './circle-spline';

// Import spline-arc intersection from dedicated module
import { findSplineArcIntersectionsVerb } from './spline-arc/index';

// Import ellipse-spline intersection from dedicated module
import { findEllipseSplineIntersectionsVerb } from './ellipse-spline/index';

// Import ellipse-polyline intersection from dedicated module
import { findEllipsePolylineIntersectionsVerb } from './polyline-ellipse/index';

// Import ellipse-line intersection from dedicated module
import { findEllipseLineIntersectionsVerb } from './line-ellipse/index';

// Import circle-ellipse intersection from dedicated module
import { findEllipseCircleIntersectionsVerb } from './circle-ellipse/index';

// Import ellipse-ellipse intersection from dedicated module
import { findEllipseEllipseIntersectionsVerb } from './ellipse-ellipse/index';

// Import ellipse-arc intersection from dedicated module
import { findEllipseArcIntersectionsVerb } from './arc-ellipse/index';

// Import spline-polyline intersection from dedicated module
import { findSplinePolylineIntersectionsVerb } from './polyline-spline/index';

/**
 * Intersection Detection Module
 *
 * This module provides robust intersection detection for all shape combinations
 * used in chain offset operations. It uses exact analytic solutions where possible
 * and high-quality numerical methods for complex cases like splines.
 *
 * Key features:
 * - Exact solutions for line-line, line-arc, arc-arc intersections
 * - Robust spline intersections using verb-nurbs library (with subdivision fallback)
 * - Intersection clustering to handle near-duplicate points
 * - Parameter snapping for intersections near shape endpoints
 * - Comprehensive confidence scoring
 */
const DEFAULT_CLUSTERING_TOLERANCE: number = 1e-3;

/**
 * Types of intersections to detect
 */
export type IntersectionType = 'true' | 'infinite';

/**
 * Default intersection type (infinite maintains existing behavior)
 */
export const DEFAULT_INTERSECTION_TYPE: IntersectionType = 'infinite';

/**
 * Find all intersections between two shapes
 * This is the main entry point for intersection detection
 */
export function findShapeIntersections(
    shape1: Shape,
    shape2: Shape,
    tolerance: number = DEFAULT_CLUSTERING_TOLERANCE,
    allowExtensions: boolean = false,
    extensionLength: number = MAX_ITERATIONS,
    intersectionType: IntersectionType = DEFAULT_INTERSECTION_TYPE
): IntersectionResult[] {
    const intersections: IntersectionResult[] = findIntersectionsByType(
        shape1,
        shape2,
        allowExtensions,
        extensionLength,
        intersectionType
    );
    const clustered: IntersectionResult[] = clusterIntersections(
        intersections,
        tolerance
    );

    // CRITICAL: For chain offset operations, ensure only one intersection per shape pair
    // This enforces the mathematical constraint that consecutive offset shapes should
    // only have one meaningful intersection point
    if (clustered.length > 1) {
        // Select the best intersection based on distance to shape endpoints
        return [selectBestIntersectionForShapePair(clustered, shape1, shape2)];
    }

    return clustered;
}

/**
 * Route intersection detection based on shape types
 */
export function findIntersectionsByType(
    shape1: Shape,
    shape2: Shape,
    allowExtensions: boolean = false,
    extensionLength: number = MAX_ITERATIONS,
    intersectionType: IntersectionType = DEFAULT_INTERSECTION_TYPE
): IntersectionResult[] {
    const type1: string = shape1.type;
    const type2: string = shape2.type;

    // Sort types to reduce number of cases (handle both orderings)
    const [firstType, secondType] = [type1, type2].sort();
    const swapShapes: boolean = firstType !== type1;
    const [first, second] = swapShapes ? [shape2, shape1] : [shape1, shape2];

    // Line-Line intersections
    if (firstType === 'line' && secondType === 'line') {
        return findLineLineIntersections(
            first.geometry as Line,
            second.geometry as Line,
            swapShapes,
            allowExtensions,
            extensionLength,
            intersectionType
        );
    }

    // Line-Arc intersections
    if (firstType === 'arc' && secondType === 'line') {
        return findLineArcIntersections(
            second.geometry as Line,
            first.geometry as Arc,
            true,
            allowExtensions,
            extensionLength
        );
    }

    // Line-Circle intersections
    if (firstType === 'circle' && secondType === 'line') {
        return findLineCircleIntersections(
            second.geometry as Line,
            first.geometry as Circle,
            true,
            allowExtensions,
            extensionLength
        );
    }

    // Line-Polyline intersections
    if (firstType === 'line' && secondType === 'polyline') {
        return findPolylineIntersections(second, first, intersectionType);
    }

    // Line-Spline intersections
    if (firstType === 'line' && secondType === 'spline') {
        return findSplineLineIntersectionsVerb(
            second,
            first,
            true,
            allowExtensions,
            extensionLength
        );
    }

    // Line-Ellipse intersections
    if (firstType === 'ellipse' && secondType === 'line') {
        return findEllipseLineIntersectionsVerb(first, second, false);
    }

    // Arc-Arc intersections
    if (firstType === 'arc' && secondType === 'arc') {
        return findArcArcIntersections(
            first.geometry as Arc,
            second.geometry as Arc,
            false,
            allowExtensions,
            extensionLength
        );
    }

    // Arc-Circle intersections
    if (firstType === 'arc' && secondType === 'circle') {
        // Circle as full arc
        const circle: import('$lib/types/geometry').Circle =
            second.geometry as Circle;
        const circleAsArc: Arc = {
            center: circle.center,
            radius: circle.radius,
            startAngle: 0,
            endAngle: Math.PI * 2,
            clockwise: true,
        };
        return findArcArcIntersections(
            first.geometry as Arc,
            circleAsArc,
            false,
            allowExtensions,
            extensionLength
        );
    }

    // Arc-Polyline intersections
    if (firstType === 'arc' && secondType === 'polyline') {
        return findPolylineArcIntersections(
            second.geometry as Polyline,
            first.geometry as Arc,
            true,
            allowExtensions,
            extensionLength
        );
    }

    // Arc-Spline intersections
    if (firstType === 'arc' && secondType === 'spline') {
        return findSplineArcIntersectionsVerb(
            second,
            first,
            true,
            allowExtensions,
            extensionLength
        );
    }

    // Arc-Ellipse intersections
    if (firstType === 'arc' && secondType === 'ellipse') {
        return findEllipseArcIntersectionsVerb(second, first, true);
    }

    // Circle-Circle intersections
    if (firstType === 'circle' && secondType === 'circle') {
        // Both circles as full arcs
        const circle1: Circle = first.geometry as Circle;
        const circle2: Circle = second.geometry as Circle;
        const circle1AsArc: Arc = {
            center: circle1.center,
            radius: circle1.radius,
            startAngle: 0,
            endAngle: Math.PI * 2,
            clockwise: true,
        };
        const circle2AsArc: Arc = {
            center: circle2.center,
            radius: circle2.radius,
            startAngle: 0,
            endAngle: Math.PI * 2,
            clockwise: true,
        };
        return findArcArcIntersections(circle1AsArc, circle2AsArc);
    }

    // Circle-Polyline intersections
    if (firstType === 'circle' && secondType === 'polyline') {
        return findPolylineIntersections(second, first);
    }

    // Circle-Spline intersections
    if (firstType === 'circle' && secondType === 'spline') {
        return findSplineCircleIntersectionsVerb(
            second,
            first,
            true,
            allowExtensions,
            extensionLength
        );
    }

    // Circle-Ellipse intersections
    if (firstType === 'circle' && secondType === 'ellipse') {
        return findEllipseCircleIntersectionsVerb(second, first, true);
    }

    // Polyline-Polyline intersections
    if (firstType === 'polyline' && secondType === 'polyline') {
        return findPolylinePolylineIntersections(
            first,
            second,
            intersectionType
        );
    }

    // Polyline-Spline intersections
    if (firstType === 'polyline' && secondType === 'spline') {
        return findSplinePolylineIntersectionsVerb(
            second,
            first,
            true,
            allowExtensions,
            extensionLength
        );
    }

    // Polyline-Ellipse intersections
    if (firstType === 'ellipse' && secondType === 'polyline') {
        return findEllipsePolylineIntersectionsVerb(first, second, false);
    }

    // Spline-Spline intersections
    if (firstType === 'spline' && secondType === 'spline') {
        return findSplineSplineIntersectionsVerb(
            first,
            second,
            swapShapes,
            allowExtensions,
            extensionLength
        );
    }

    // Spline-Ellipse intersections
    if (firstType === 'ellipse' && secondType === 'spline') {
        return findEllipseSplineIntersectionsVerb(first, second, false);
    }

    // Ellipse-Ellipse intersections
    if (firstType === 'ellipse' && secondType === 'ellipse') {
        return findEllipseEllipseIntersectionsVerb(first, second);
    }

    return [];
}

/**
 * Cluster intersection points that are very close together
 * This handles numerical precision issues and near-duplicate intersections
 * Enhanced for deterministic behavior and better precision handling
 */
export function clusterIntersections(
    intersections: IntersectionResult[],
    tolerance: number
): IntersectionResult[] {
    if (intersections.length <= 1) return intersections;

    // Sort intersections by x, then y for deterministic clustering
    const sortedIntersections: IntersectionResult[] = [...intersections].sort(
        (a, b) => {
            const dx: number = a.point.x - b.point.x;
            if (Math.abs(dx) > EPSILON) return dx;
            return a.point.y - b.point.y;
        }
    );

    const clusters: IntersectionResult[][] = [];
    const used: Set<number> = new Set<number>();

    for (let i: number = 0; i < sortedIntersections.length; i++) {
        if (used.has(i)) continue;

        const cluster: IntersectionResult[] = [sortedIntersections[i]];
        used.add(i);

        for (let j: number = i + 1; j < sortedIntersections.length; j++) {
            if (used.has(j)) continue;

            const dist: number = pointDistance(
                sortedIntersections[i].point,
                sortedIntersections[j].point
            );
            if (dist < tolerance) {
                cluster.push(sortedIntersections[j]);
                used.add(j);
            }
        }

        clusters.push(cluster);
    }

    // Merge each cluster into a single intersection result
    return clusters.map((cluster) => {
        if (cluster.length === 1) return cluster[0];

        // Calculate centroid of cluster with higher precision
        let sumX: number = 0,
            sumY: number = 0;
        for (const intersection of cluster) {
            sumX += intersection.point.x;
            sumY += intersection.point.y;
        }
        const centroid: Point2D = {
            x: sumX / cluster.length,
            y: sumY / cluster.length,
        };

        // Use the intersection with highest confidence as base
        const bestIntersection: IntersectionResult = cluster.reduce(
            (best, current) =>
                current.confidence > best.confidence ? current : best
        );

        // Determine if all intersections in cluster have same type
        const allSameType: boolean = cluster.every(
            (int) => int.type === bestIntersection.type
        );

        return {
            ...bestIntersection,
            point: centroid,
            type: allSameType ? bestIntersection.type : 'approximate',
            confidence: allSameType
                ? Math.min(
                      bestIntersection.confidence,
                      CONFIDENCE_HIGH_THRESHOLD
                  ) // High confidence for same-type clusters
                : Math.min(bestIntersection.confidence, CONFIDENCE_THRESHOLD), // Lower confidence for mixed-type clusters
        };
    });
}

/**
 * Calculate distance between two points
 */

/**
 * Select the best intersection from multiple candidates for consecutive offset shapes
 * Uses distance to shape endpoints as the primary criterion
 */
function selectBestIntersectionForShapePair(
    intersections: IntersectionResult[],
    shape1: Shape,
    shape2: Shape
): IntersectionResult {
    if (intersections.length === 1) {
        return intersections[0];
    }

    // Get start and end points for both shapes
    const shape1Start: Point2D = getShapeStartPoint(shape1);
    const shape1End: Point2D = getShapeEndPoint(shape1);
    const shape2Start: Point2D = getShapeStartPoint(shape2);
    const shape2End: Point2D = getShapeEndPoint(shape2);

    let bestIntersection: IntersectionResult = intersections[0];
    let bestScore: number = calculateIntersectionDistanceScore(
        bestIntersection,
        shape1Start,
        shape1End,
        shape2Start,
        shape2End
    );

    for (let i: number = 1; i < intersections.length; i++) {
        const score: number = calculateIntersectionDistanceScore(
            intersections[i],
            shape1Start,
            shape1End,
            shape2Start,
            shape2End
        );

        // Lower scores are better (closer to endpoints)
        if (score < bestScore) {
            bestScore = score;
            bestIntersection = intersections[i];
        }
    }

    return bestIntersection;
}

/**
 * Calculate a distance-based score for intersection quality
 * Lower scores indicate better intersections (closer to shape endpoints)
 */
function calculateIntersectionDistanceScore(
    intersection: IntersectionResult,
    shape1Start: Point2D,
    shape1End: Point2D,
    shape2Start: Point2D,
    shape2End: Point2D
): number {
    const { point } = intersection;

    // Calculate distances from intersection point to all four shape endpoints
    const distToShape1Start: number = pointDistance(point, shape1Start);
    const distToShape1End: number = pointDistance(point, shape1End);
    const distToShape2Start: number = pointDistance(point, shape2Start);
    const distToShape2End: number = pointDistance(point, shape2End);

    // For consecutive offset shapes, the best intersection should be close to
    // the connection points (end of first shape, start of second shape)
    return Math.min(
        distToShape1Start,
        distToShape1End,
        distToShape2Start,
        distToShape2End
    );
}
