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
import { DEFAULT_RAYTRACING_CONFIG } from './types';
import { sampleSpline } from '$lib/geometry/spline/functions';

/**
 * Default sample count for ray-spline intersection approximation
 * Increased from 50 to 200 to handle complex splines accurately
 */
const DEFAULT_SPLINE_SAMPLE_COUNT = 200;

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
    const samples: Point2D[] = sampleSpline(
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
    const samples: Point2D[] = sampleSpline(
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
