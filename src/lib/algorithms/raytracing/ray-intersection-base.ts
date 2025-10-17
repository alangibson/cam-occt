/**
 * Ray Intersection Base Library
 *
 * Shared utilities for ray-shape intersection calculations
 * Consolidates common patterns from ray-arc and ray-circle intersection algorithms
 */

import type { Point2D } from '$lib/geometry/point';
import type { Ray, RayIntersection, RayTracingConfig } from './types';
import { DEFAULT_RAYTRACING_CONFIG } from './types';
import { solveQuadratic } from './utils';
import { FULL_CIRCLE_RADIANS } from '$lib/geometry/circle';
import { EPSILON } from '$lib/geometry/math/constants';

/**
 * Quadratic setup result for ray-circle intersection
 */
export interface QuadraticSetup {
    /** Coefficient of t² */
    a: number;
    /** Coefficient of t */
    b: number;
    /** Constant term */
    c: number;
    /** Translated ray origin (relative to circle center) */
    rayStart: Point2D;
}

/**
 * Sets up quadratic equation for ray-circle intersection
 * Common pattern used in both ray-arc and ray-circle calculations
 *
 * Ray equation: P = rayStart + t * direction
 * Circle equation: x² + y² = r²
 * Substituting: (rayStart.x + t*direction.x)² + (rayStart.y + t*direction.y)² = r²
 * Expands to: at² + bt + c = 0
 */
export function setupQuadraticIntersection(
    ray: Ray,
    circleCenter: Point2D,
    radius: number
): QuadraticSetup {
    const { origin, direction } = ray;

    // Translate coordinate system so circle is at origin
    const rayStart = {
        x: origin.x - circleCenter.x,
        y: origin.y - circleCenter.y,
    };

    // Expand quadratic equation: at² + bt + c = 0
    const a = direction.x * direction.x + direction.y * direction.y;

    const b = 2 * (rayStart.x * direction.x + rayStart.y * direction.y);
    const c =
        rayStart.x * rayStart.x + rayStart.y * rayStart.y - radius * radius;

    return { a, b, c, rayStart };
}

/**
 * Solves quadratic intersection equation and returns parameter values
 * Wrapper around the general quadratic solver for ray intersection context
 */
export function solveQuadraticIntersection(
    a: number,
    b: number,
    c: number,
    epsilon: number = EPSILON
): number[] {
    return solveQuadratic(a, b, c, epsilon);
}

/**
 * Validates if a ray intersection point should be counted
 * Checks if the parameter t is valid (on the ray, not behind it)
 */
export function validateRayIntersectionPoint(
    t: number,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): boolean {
    return t >= -config.epsilon;
}

/**
 * Creates intersection points from quadratic solution parameters
 * Common logic for converting t values to actual intersection points
 */
export function createRayIntersectionPoints(
    ray: Ray,
    tValues: number[],
    circleCenter: Point2D,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): RayIntersection[] {
    const { origin, direction } = ray;
    const intersections: RayIntersection[] = [];

    for (const t of tValues) {
        if (validateRayIntersectionPoint(t, config)) {
            const intersectionPoint = {
                x: origin.x + t * direction.x,
                y: origin.y + t * direction.y,
            };

            // Determine intersection type based on number of solutions
            let type: 'crossing' | 'tangent' | 'endpoint' = 'crossing';
            if (tValues.length === 1) {
                type = 'tangent';
            }

            // Calculate shape parameter (normalized angle for circle-based shapes)
            const dx = intersectionPoint.x - circleCenter.x;
            const dy = intersectionPoint.y - circleCenter.y;
            const angle = Math.atan2(dy, dx);
            const normalizedAngle =
                angle < 0 ? angle + FULL_CIRCLE_RADIANS : angle;
            const shapeParameter = normalizedAngle / FULL_CIRCLE_RADIANS;

            intersections.push({
                point: intersectionPoint,
                t,
                shapeParameter,
                type,
            });
        }
    }

    return intersections;
}

/**
 * Optimized horizontal ray intersection setup
 * Common pattern for horizontal ray optimizations
 */
export function setupHorizontalRayIntersection(
    rayOrigin: Point2D,
    circleCenter: Point2D,
    radius: number,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): { discriminant: number; dy: number } | null {
    const y = rayOrigin.y;
    const { epsilon } = config;

    // Quick bounds check
    const dy = y - circleCenter.y;
    if (Math.abs(dy) > radius + epsilon) {
        return null; // No intersection
    }

    // Calculate discriminant for horizontal line intersection
    const discriminant = radius * radius - dy * dy;

    if (discriminant < -epsilon) {
        return null; // No real intersections
    }

    return { discriminant, dy };
}

/**
 * Counts horizontal ray crossings using discriminant
 * Common logic for horizontal ray intersection counting
 */
export function countHorizontalRayCrossings(
    rayOrigin: Point2D,
    circleCenter: Point2D,
    discriminant: number,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    const { epsilon } = config;

    if (Math.abs(discriminant) < epsilon) {
        // Tangent case - single intersection at x = center.x
        const x = circleCenter.x;
        return x > rayOrigin.x + epsilon ? 1 : 0;
    }

    // Two intersections
    const sqrtDisc = Math.sqrt(discriminant);
    const x1 = circleCenter.x - sqrtDisc;
    const x2 = circleCenter.x + sqrtDisc;

    let crossings = 0;

    // Count intersections that are to the right of ray origin
    if (x1 > rayOrigin.x + epsilon) crossings++;
    if (x2 > rayOrigin.x + epsilon) crossings++;

    return crossings;
}
