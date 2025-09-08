/**
 * Ray-Arc Intersection Algorithm
 *
 * Exact geometric intersection between rays and arc segments
 * Uses algebraic methods to solve ray-circle intersection
 * then filters results by arc's angular range
 */

import type { Arc, Point2D } from '../../types/geometry';
import type { Ray, RayIntersection, RayTracingConfig } from './types';
import { DEFAULT_RAYTRACING_CONFIG } from './types';
import { approxEqual, isAngleInArcRange } from './utils';
import {
    setupQuadraticIntersection,
    solveQuadraticIntersection,
    setupHorizontalRayIntersection,
    validateRayIntersectionPoint,
} from './ray-intersection-base';

/**
 * Counts how many times a ray crosses an arc segment
 *
 * @param ray - The ray to test (typically horizontal for point-in-polygon)
 * @param arc - The arc segment geometry
 * @param config - Configuration for numerical tolerance
 * @returns Number of crossings (0, 1, or 2 for arcs)
 */
export function countRayArcCrossings(
    ray: Ray,
    arc: Arc,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    // Handle degenerate case: zero-radius arc
    if (arc.radius <= config.epsilon) {
        return 0; // Degenerate arcs don't count as intersections
    }

    const intersections = findRayArcIntersections(ray, arc, config);
    return intersections.filter(
        (intersection) => intersection.t >= -config.epsilon
    ).length;
}

/**
 * Finds all intersections between a ray and an arc segment
 *
 * @param ray - The ray to test
 * @param arc - The arc segment geometry
 * @param config - Configuration for numerical tolerance
 * @returns Array of intersection points
 */
export function findRayArcIntersections(
    ray: Ray,
    arc: Arc,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): RayIntersection[] {
    const { center, radius, startAngle, endAngle, clockwise = false } = arc;
    const { direction } = ray;
    const { epsilon } = config;

    // First, find intersections with the full circle containing this arc
    const circleIntersections = findRayCircleIntersections(
        ray,
        { center, radius },
        config
    );

    // Filter intersections to only those within the arc's angular range
    const arcIntersections: RayIntersection[] = [];

    for (const intersection of circleIntersections) {
        // Calculate angle from center to intersection point
        const dx: number = intersection.point.x - center.x;
        const dy: number = intersection.point.y - center.y;
        const angle: number = Math.atan2(dy, dx);

        // Check if this angle falls within the arc's range
        if (isAngleInArcRange(angle, startAngle, endAngle, clockwise)) {
            // Determine intersection type
            let type: 'crossing' | 'tangent' | 'endpoint' = 'crossing';

            // Check if intersection is at arc endpoints
            if (
                approxEqual(angle, startAngle, epsilon) ||
                approxEqual(angle, endAngle, epsilon)
            ) {
                type = 'endpoint';
            }

            // Check for tangent intersection (ray direction perpendicular to radius)
            const radiusVec = { x: dx / radius, y: dy / radius };
            const dotProduct = Math.abs(
                direction.x * radiusVec.x + direction.y * radiusVec.y
            );
            if (dotProduct < epsilon) {
                type = 'tangent';
            }

            arcIntersections.push({
                ...intersection,
                type,
                shapeParameter: normalizeArcParameter(
                    angle,
                    startAngle,
                    endAngle,
                    clockwise
                ),
            });
        }
    }

    return arcIntersections;
}

/**
 * Finds intersections between a ray and a full circle
 * Helper function for arc intersection calculation
 */
function findRayCircleIntersections(
    ray: Ray,
    circle: { center: Point2D; radius: number },
    config: RayTracingConfig
): RayIntersection[] {
    const { center, radius } = circle;
    const { epsilon } = config;

    // Set up quadratic equation for ray-circle intersection
    const { a, b, c } = setupQuadraticIntersection(ray, center, radius);

    // Solve quadratic equation
    const roots = solveQuadraticIntersection(a, b, c, epsilon);
    const intersections: RayIntersection[] = [];

    for (const t of roots) {
        if (validateRayIntersectionPoint(t, config)) {
            const intersectionPoint = {
                x: ray.origin.x + t * ray.direction.x,
                y: ray.origin.y + t * ray.direction.y,
            };

            intersections.push({
                point: intersectionPoint,
                t,
                type: roots.length === 1 ? 'tangent' : 'crossing',
            });
        }
    }

    return intersections;
}

/**
 * Converts an angle to a normalized parameter (0-1) along the arc
 */
function normalizeArcParameter(
    angle: number,
    startAngle: number,
    endAngle: number,
    clockwise: boolean
): number {
    if (clockwise) {
        // For clockwise arcs, parameter decreases with angle
        let totalAngle = startAngle - endAngle;
        if (totalAngle <= 0) totalAngle += 2 * Math.PI;

        let angleFromStart = startAngle - angle;
        if (angleFromStart < 0) angleFromStart += 2 * Math.PI;
        if (angleFromStart > totalAngle) angleFromStart -= 2 * Math.PI;

        return Math.max(0, Math.min(1, angleFromStart / totalAngle));
    } else {
        // For counter-clockwise arcs, parameter increases with angle
        let totalAngle = endAngle - startAngle;
        if (totalAngle <= 0) totalAngle += 2 * Math.PI;

        let angleFromStart = angle - startAngle;
        if (angleFromStart < 0) angleFromStart += 2 * Math.PI;
        if (angleFromStart > totalAngle) angleFromStart -= 2 * Math.PI;

        return Math.max(0, Math.min(1, angleFromStart / totalAngle));
    }
}

/**
 * Specialized function for horizontal ray-arc intersection
 * Optimized for the common case in point-in-polygon testing
 *
 * @param rayOrigin - Starting point of horizontal ray
 * @param arc - Arc segment to test
 * @param config - Configuration options
 * @returns Number of crossings
 */
export function countHorizontalRayArcCrossings(
    rayOrigin: Point2D,
    arc: Arc,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    const { center, radius, startAngle, endAngle, clockwise = false } = arc;
    const { epsilon } = config;

    // Set up horizontal ray intersection
    const intersection = setupHorizontalRayIntersection(
        rayOrigin,
        center,
        radius,
        config
    );

    if (!intersection) {
        return 0; // No intersection
    }

    const { discriminant, dy } = intersection;

    let crossings = 0;

    if (Math.abs(discriminant) < epsilon) {
        // Tangent case - single intersection
        const x: number = center.x;
        if (x > rayOrigin.x + epsilon) {
            const angle: number = Math.atan2(dy, 0); // dy, 0 because x = center.x
            if (isAngleInArcRange(angle, startAngle, endAngle, clockwise)) {
                crossings++;
            }
        }
    } else {
        // Two intersections
        const sqrtDisc = Math.sqrt(discriminant);
        const x1 = center.x - sqrtDisc;
        const x2 = center.x + sqrtDisc;

        // Check each intersection for arc range inclusion
        for (const x of [x1, x2]) {
            if (x > rayOrigin.x + epsilon) {
                const angle: number = Math.atan2(dy, x - center.x);
                if (isAngleInArcRange(angle, startAngle, endAngle, clockwise)) {
                    crossings++;
                }
            }
        }
    }

    return crossings;
}
