/**
 * Ray-Circle Intersection Algorithm
 *
 * Exact geometric intersection between rays and circles
 * Circles always produce 0 or 2 intersections (never 1 unless tangent)
 */

import type { Point2D } from '$lib/geometry/point';
import type { Circle } from '$lib/geometry/circle';
import type { Ray, RayIntersection, RayTracingConfig } from './types';
import { DEFAULT_RAYTRACING_CONFIG } from './types';
import {
    countHorizontalRayCrossings,
    createRayIntersectionPoints,
    setupHorizontalRayIntersection,
    setupQuadraticIntersection,
    solveQuadraticIntersection,
} from './ray-intersection-base';

/**
 * Counts how many times a ray crosses a circle
 *
 * @param ray - The ray to test (typically horizontal for point-in-polygon)
 * @param circle - The circle geometry
 * @param config - Configuration for numerical tolerance
 * @returns Number of crossings (0, 1 for tangent, or 2 for circle)
 */
export function countRayCircleCrossings(
    ray: Ray,
    circle: Circle,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    const intersections = findRayCircleIntersections(ray, circle, config);
    return intersections.filter(
        (intersection) => intersection.t >= -config.epsilon
    ).length;
}

/**
 * Finds all intersections between a ray and a circle
 *
 * @param ray - The ray to test
 * @param circle - The circle geometry
 * @param config - Configuration for numerical tolerance
 * @returns Array of intersection points (0, 1, or 2 elements)
 */
export function findRayCircleIntersections(
    ray: Ray,
    circle: Circle,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): RayIntersection[] {
    const { center, radius } = circle;
    const { epsilon } = config;

    // Set up quadratic equation for ray-circle intersection
    const { a, b, c } = setupQuadraticIntersection(ray, center, radius);

    // Solve quadratic equation
    const roots = solveQuadraticIntersection(a, b, c, epsilon);

    // Create intersection points from solutions
    return createRayIntersectionPoints(ray, roots, center, config);
}

/**
 * Specialized function for horizontal ray-circle intersection
 * Optimized for the common case in point-in-polygon testing
 *
 * @param rayOrigin - Starting point of horizontal ray
 * @param circle - Circle to test
 * @param config - Configuration options
 * @returns Number of crossings (0, 1, or 2)
 */
export function countHorizontalRayCircleCrossings(
    rayOrigin: Point2D,
    circle: Circle,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    const { center, radius } = circle;

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

    const { discriminant } = intersection;

    // Count crossings using shared logic
    return countHorizontalRayCrossings(rayOrigin, center, discriminant, config);
}

/**
 * Checks if a point lies exactly on a circle
 *
 * @param point - Point to test
 * @param circle - Circle geometry
 * @param config - Configuration for tolerance
 * @returns True if point is on the circle boundary
 */
export function isPointOnCircle(
    point: Point2D,
    circle: Circle,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): boolean {
    const { center, radius } = circle;
    const { epsilon } = config;

    const dx: number = point.x - center.x;
    const dy: number = point.y - center.y;
    const distance: number = Math.sqrt(dx * dx + dy * dy);

    return Math.abs(distance - radius) < epsilon;
}
