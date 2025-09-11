/**
 * Ray-Line Intersection Algorithm
 *
 * Exact geometric intersection between rays and line segments
 * without any sampling or approximation
 */

import type { Line, Point2D } from '$lib/types/geometry';
import type { Ray, RayIntersection, RayTracingConfig } from './types';
import { DEFAULT_RAYTRACING_CONFIG } from './types';
import { approxEqual, isBetween } from './utils';

/**
 * Counts how many times a ray crosses a line segment
 *
 * @param ray - The ray to test (typically horizontal for point-in-polygon)
 * @param line - The line segment geometry
 * @param config - Configuration for numerical tolerance
 * @returns Number of crossings (0 or 1 for line segments)
 */
export function countRayLineCrossings(
    ray: Ray,
    line: Line,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    // Check for degenerate line (very small or zero length)
    const dx: number = line.end.x - line.start.x;
    const dy: number = line.end.y - line.start.y;
    const lineLength = Math.sqrt(dx * dx + dy * dy);

    if (lineLength <= config.epsilon) {
        return 0; // Degenerate lines don't count as intersections
    }

    const intersections = findRayLineIntersections(ray, line, config);
    return intersections.filter(
        (intersection) => intersection.t >= -config.epsilon
    ).length;
}

/**
 * Finds all intersections between a ray and a line segment
 *
 * @param ray - The ray to test
 * @param line - The line segment geometry
 * @param config - Configuration for numerical tolerance
 * @returns Array of intersection points
 */
export function findRayLineIntersections(
    ray: Ray,
    line: Line,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): RayIntersection[] {
    const { start, end } = line;
    const { origin, direction } = ray;
    const { epsilon } = config;

    // Line segment vector
    const lineVec = {
        x: end.x - start.x,
        y: end.y - start.y,
    };

    // Vector from ray origin to line start
    const toStart = {
        x: start.x - origin.x,
        y: start.y - origin.y,
    };

    // Solve ray-line intersection using parametric form:
    // Ray: P = origin + t * direction (t >= 0)
    // Line: Q = start + s * lineVec (0 <= s <= 1)
    // At intersection: origin + t * direction = start + s * lineVec

    // Cross product for parallel check
    const denominator = direction.x * lineVec.y - direction.y * lineVec.x;

    if (Math.abs(denominator) < epsilon) {
        // Ray and line are parallel
        return handleParallelCase(ray, line, config);
    }

    // Solve for parameters
    const t: number =
        (toStart.x * lineVec.y - toStart.y * lineVec.x) / denominator;
    const s = (toStart.x * direction.y - toStart.y * direction.x) / denominator;

    // Check if intersection is on the ray (t >= 0) and on the line segment (0 <= s <= 1)
    if (t >= -epsilon && isBetween(s, 0, 1, epsilon)) {
        const intersectionPoint = {
            x: origin.x + t * direction.x,
            y: origin.y + t * direction.y,
        };

        // Determine intersection type
        let type: 'crossing' | 'tangent' | 'endpoint' = 'crossing';
        if (approxEqual(s, 0, epsilon) || approxEqual(s, 1, epsilon)) {
            type = 'endpoint';
        }

        return [
            {
                point: intersectionPoint,
                t,
                shapeParameter: s,
                type,
            },
        ];
    }

    return [];
}

/**
 * Handles the special case where ray and line are parallel
 */
function handleParallelCase(
    ray: Ray,
    line: Line,
    config: RayTracingConfig
): RayIntersection[] {
    const { start } = line;
    const { origin, direction } = ray;
    const { epsilon } = config;

    // Check if line lies on the ray
    // This happens when the ray origin is collinear with the line

    // Vector from ray origin to line start
    const toStart = {
        x: start.x - origin.x,
        y: start.y - origin.y,
    };

    // Cross product should be zero if collinear
    const crossProduct = direction.x * toStart.y - direction.y * toStart.x;

    if (Math.abs(crossProduct) > epsilon) {
        // Not collinear, no intersection
        return [];
    }

    // Collinear case - for point-in-polygon testing, collinear overlaps typically don't count as crossings
    // Return empty array to be consistent with standard ray casting
    return [];
}

/**
 * Specialized function for horizontal ray-line intersection
 * Optimized for the common case in point-in-polygon testing
 *
 * @param rayOrigin - Starting point of horizontal ray
 * @param line - Line segment to test
 * @param config - Configuration options
 * @returns Number of crossings (0 or 1)
 */
export function countHorizontalRayLineCrossings(
    rayOrigin: Point2D,
    line: Line,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    const { start, end } = line;
    const y: number = rayOrigin.y;
    const { epsilon } = config;

    // Quick bounds check: does the line segment cross the ray's y-level?
    const minY: number = Math.min(start.y, end.y);
    const maxY: number = Math.max(start.y, end.y);

    if (y < minY - epsilon || y > maxY + epsilon) {
        return 0; // Ray doesn't intersect line's y-range
    }

    // Handle horizontal line (parallel to ray)
    if (Math.abs(start.y - end.y) < epsilon) {
        return 0; // Horizontal lines don't cross horizontal rays
    }

    // Check if ray passes through an endpoint
    const startOnRay = approxEqual(start.y, y, epsilon);
    const endOnRay = approxEqual(end.y, y, epsilon);

    if (startOnRay && endOnRay) {
        return 0; // Entire line on ray (handled as no crossing)
    }

    // Apply lower-inclusive rule for consistent boundary handling
    if (startOnRay || endOnRay) {
        const pointOnRay = startOnRay ? start : end;
        const otherPoint = startOnRay ? end : start;

        // First check if intersection is to the right of ray origin
        if (pointOnRay.x <= rayOrigin.x + epsilon) {
            return 0; // Intersection is behind or at ray origin
        }

        if (config.boundaryRule === 'lower-inclusive') {
            // Only count if the other point is above the ray
            return otherPoint.y > y + epsilon ? 1 : 0;
        }
    }

    // Standard case: find x-coordinate where line crosses ray
    const t: number = (y - start.y) / (end.y - start.y);
    const x: number = start.x + t * (end.x - start.x);

    // Count crossing if it's to the right of ray origin
    return x > rayOrigin.x + epsilon ? 1 : 0;
}
