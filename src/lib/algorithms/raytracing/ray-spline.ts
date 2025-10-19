/**
 * Ray-Spline (NURBS) Intersection Algorithm
 *
 * Approximation-based intersection between rays and NURBS splines.
 * Uses subdivision and bounding box checks for efficiency,
 * falling back to sampling when exact solutions are impractical.
 */

import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';
import type { Ray, RayIntersection, RayTracingConfig } from './types';
import { DEFAULT_SPLINE_DEGREE } from '$lib/geometry/spline/constants';
import { DEFAULT_RAYTRACING_CONFIG } from './types';

/**
 * Default sample count for ray-spline intersection approximation
 */
const DEFAULT_SPLINE_SAMPLE_COUNT = 50;

/**
 * Counts how many times a ray crosses a spline
 *
 * @param ray - The ray to test (typically horizontal for point-in-polygon)
 * @param spline - The NURBS spline geometry
 * @param config - Configuration for numerical tolerance
 * @returns Number of crossings
 */
export function countRaySplineCrossings(
    ray: Ray,
    spline: Spline,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    // For now, use a sampling-based approximation
    // TODO: Implement exact subdivision-based intersection
    return countRaySplineCrossingsApproximate(ray, spline, config);
}

/**
 * Finds all intersections between a ray and a spline
 *
 * @param ray - The ray to test
 * @param spline - The NURBS spline geometry
 * @param config - Configuration for numerical tolerance
 * @returns Array of intersection points
 */
export function findRaySplineIntersections(
    ray: Ray,
    spline: Spline,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): RayIntersection[] {
    // For now, use a sampling-based approximation
    // TODO: Implement exact subdivision-based intersection
    return findRaySplineIntersectionsApproximate(ray, spline, config);
}

/**
 * Sampling-based approximation for ray-spline crossing count
 * Converts spline to polyline approximation and tests intersections
 */
function countRaySplineCrossingsApproximate(
    ray: Ray,
    spline: Spline,
    config: RayTracingConfig
): number {
    const samples: Point2D[] = sampleSplinePoints(
        spline,
        config.splineSampleCount || DEFAULT_SPLINE_SAMPLE_COUNT
    );

    if (samples.length < 2) {
        return 0;
    }

    let crossings: number = 0;

    // Test each line segment of the approximation
    for (let i: number = 0; i < samples.length - 1; i++) {
        const start: Point2D = samples[i];
        const end: Point2D = samples[i + 1];

        const segmentCrossing: number = countRayLineSegmentCrossing(
            ray,
            start,
            end,
            config
        );
        crossings += segmentCrossing;
    }

    return crossings;
}

/**
 * Sampling-based approximation for ray-spline intersections
 */
function findRaySplineIntersectionsApproximate(
    ray: Ray,
    spline: Spline,
    config: RayTracingConfig
): RayIntersection[] {
    const samples: Point2D[] = sampleSplinePoints(
        spline,
        config.splineSampleCount || DEFAULT_SPLINE_SAMPLE_COUNT
    );
    const intersections: RayIntersection[] = [];

    if (samples.length < 2) {
        return intersections;
    }

    // Find intersections with each line segment
    for (let i: number = 0; i < samples.length - 1; i++) {
        const start: Point2D = samples[i];
        const end: Point2D = samples[i + 1];

        const segmentIntersection: RayIntersection | null =
            findRayLineSegmentIntersection(ray, start, end, config);
        if (segmentIntersection) {
            intersections.push({
                ...segmentIntersection,
                type: 'crossing', // Approximate intersections are crossings
                shapeParameter: i / (samples.length - 1), // Approximate parameter
            });
        }
    }

    return intersections.sort((a, b) => a.t - b.t);
}

/**
 * Sample points along a NURBS spline
 *
 * @param spline - The spline to sample
 * @param sampleCount - Number of sample points
 * @returns Array of points along the spline
 */
function sampleSplinePoints(spline: Spline, sampleCount: number): Point2D[] {
    const points: Point2D[] = [];

    // Handle degenerate cases
    if (spline.controlPoints.length === 0 || sampleCount < 2) {
        return points;
    }

    // For linear splines (degree 1), just sample control points
    if (spline.degree <= 1) {
        return spline.controlPoints.slice();
    }

    // Use fit points if available (these are often more accurate for visualization)
    if (spline.fitPoints && spline.fitPoints.length >= 2) {
        return spline.fitPoints.slice();
    }

    // Fallback: use De Boor's algorithm for NURBS evaluation
    // For now, implement a simple approximation by sampling control polygon
    if (spline.controlPoints.length === 2) {
        // Linear case
        return [spline.controlPoints[0], spline.controlPoints[1]];
    }

    // Sample uniformly along parameter space
    for (let i: number = 0; i < sampleCount; i++) {
        const t: number = i / (sampleCount - 1);
        const point: Point2D | null = evaluateSplineAtParameter(spline, t);
        if (point) {
            points.push(point);
        }
    }

    // If evaluation failed, fall back to control points
    if (points.length === 0) {
        return spline.controlPoints.slice();
    }

    return points;
}

/**
 * Evaluate a NURBS spline at a given parameter
 * Simplified implementation - TODO: implement full NURBS evaluation
 *
 * @param spline - The spline to evaluate
 * @param t - Parameter value (0 to 1)
 * @returns Point on the spline, or null if evaluation fails
 */
function evaluateSplineAtParameter(spline: Spline, t: number): Point2D | null {
    const {
        controlPoints,
        degree,
    }: { controlPoints: Point2D[]; degree: number } = spline;

    if (controlPoints.length === 0 || t < 0 || t > 1) {
        return null;
    }

    if (controlPoints.length === 1) {
        return { ...controlPoints[0] };
    }

    // For now, implement simple Bézier-like evaluation for cubic cases
    // eslint-disable-next-line no-magic-numbers
    if (degree === DEFAULT_SPLINE_DEGREE && controlPoints.length === 4) {
        return evaluateCubicBezier(controlPoints, t);
    }

    // For other cases, use simple linear interpolation between control points
    if (controlPoints.length === 2) {
        const p0: Point2D = controlPoints[0];
        const p1: Point2D = controlPoints[1];
        return {
            x: p0.x + t * (p1.x - p0.x),
            y: p0.y + t * (p1.y - p0.y),
        };
    }

    // Multi-segment linear approximation
    const segmentCount: number = controlPoints.length - 1;
    const segmentT: number = t * segmentCount;
    const segmentIndex: number = Math.floor(segmentT);
    const localT: number = segmentT - segmentIndex;

    if (segmentIndex >= segmentCount) {
        return { ...controlPoints[controlPoints.length - 1] };
    }

    const p0: Point2D = controlPoints[segmentIndex];
    const p1: Point2D = controlPoints[segmentIndex + 1];

    return {
        x: p0.x + localT * (p1.x - p0.x),
        y: p0.y + localT * (p1.y - p0.y),
    };
}

/**
 * Evaluate a cubic Bézier curve at parameter t
 */
function evaluateCubicBezier(controlPoints: Point2D[], t: number): Point2D {
    const [p0, p1, p2, p3]: Point2D[] = controlPoints;
    const u: number = 1 - t;
    const tt: number = t * t;
    const uu: number = u * u;
    const uuu: number = uu * u;
    const ttt: number = tt * t;

    return {
        // eslint-disable-next-line no-magic-numbers
        x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
        // eslint-disable-next-line no-magic-numbers
        y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
    };
}

/**
 * Count ray-line segment crossings (helper for spline approximation)
 */
function countRayLineSegmentCrossing(
    ray: Ray,
    start: Point2D,
    end: Point2D,
    config: RayTracingConfig
): number {
    const intersection: RayIntersection | null = findRayLineSegmentIntersection(
        ray,
        start,
        end,
        config
    );
    return intersection && intersection.t >= -config.epsilon ? 1 : 0;
}

/**
 * Find ray-line segment intersection (helper for spline approximation)
 */
function findRayLineSegmentIntersection(
    ray: Ray,
    start: Point2D,
    end: Point2D,
    config: RayTracingConfig
): RayIntersection | null {
    const { origin, direction }: { origin: Point2D; direction: Point2D } = ray;
    const { epsilon }: { epsilon: number } = config;

    // Line segment vector
    const lineVec: Point2D = {
        x: end.x - start.x,
        y: end.y - start.y,
    };

    // Vector from ray origin to line start
    const toStart: Point2D = {
        x: start.x - origin.x,
        y: start.y - origin.y,
    };

    // Check for parallel lines
    const denominator: number =
        direction.x * lineVec.y - direction.y * lineVec.x;

    if (Math.abs(denominator) < epsilon) {
        return null; // Parallel or collinear
    }

    // Solve for parameters
    const t: number =
        (toStart.x * lineVec.y - toStart.y * lineVec.x) / denominator;
    const s: number =
        (toStart.x * direction.y - toStart.y * direction.x) / denominator;

    // Check if intersection is on ray (t >= 0) and on line segment (0 <= s <= 1)
    if (t >= -epsilon && s >= -epsilon && s <= 1 + epsilon) {
        const intersectionPoint: Point2D = {
            x: origin.x + t * direction.x,
            y: origin.y + t * direction.y,
        };

        return {
            point: intersectionPoint,
            t,
            shapeParameter: s,
            type: 'crossing',
        };
    }

    return null;
}

/**
 * Specialized function for horizontal ray-spline intersection
 * Optimized for the common case in point-in-polygon testing
 *
 * @param rayOrigin - Starting point of horizontal ray
 * @param spline - Spline to test
 * @param config - Configuration options
 * @returns Number of crossings
 */
export function countHorizontalRaySplineCrossings(
    rayOrigin: Point2D,
    spline: Spline,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    // Create horizontal ray for compatibility
    const ray: Ray = {
        origin: rayOrigin,
        direction: { x: 1, y: 0 },
    };

    return countRaySplineCrossings(ray, spline, config);
}

// TODO: Future improvements
// - Implement exact NURBS-ray intersection using subdivision
// - Add bounding box pre-checks for performance
// - Handle rational splines (weights) properly
// - Implement adaptive sampling based on curvature
// - Add support for conic sections (specific NURBS cases)
