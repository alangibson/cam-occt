/**
 * Ray-Ellipse Intersection Algorithm
 *
 * Exact geometric intersection between rays and ellipses by
 * transforming to standard position and solving algebraically
 */

import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Ray, RayIntersection, RayTracingConfig } from './types';
import { DEFAULT_RAYTRACING_CONFIG } from './types';
import { normalizeAngle } from '$lib/geometry/math/functions';

/**
 * Counts how many times a ray crosses an ellipse
 *
 * @param ray - The ray to test (typically horizontal for point-in-polygon)
 * @param ellipse - The ellipse geometry
 * @param config - Configuration for numerical tolerance
 * @returns Number of crossings (0, 1, or 2 for full ellipse; 0 or 1 for ellipse arc)
 */
export function countRayEllipseCrossings(
    ray: Ray,
    ellipse: Ellipse,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    const intersections: RayIntersection[] = findRayEllipseIntersections(
        ray,
        ellipse,
        config
    );
    return intersections.filter(
        (intersection) => intersection.t >= -config.epsilon
    ).length;
}

/**
 * Finds all intersections between a ray and an ellipse
 *
 * @param ray - The ray to test
 * @param ellipse - The ellipse geometry
 * @param config - Configuration for numerical tolerance
 * @returns Array of intersection points
 */
export function findRayEllipseIntersections(
    ray: Ray,
    ellipse: Ellipse,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): RayIntersection[] {
    const { epsilon } = config;

    // Calculate ellipse axes
    const majorAxisLength: number = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
            ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
    );
    const minorAxisLength: number = majorAxisLength * ellipse.minorToMajorRatio;

    // Handle degenerate cases
    if (majorAxisLength <= epsilon || minorAxisLength <= epsilon) {
        return []; // Degenerate ellipse
    }

    // Get ellipse rotation angle from major axis vector
    const rotation: number = Math.atan2(
        ellipse.majorAxisEndpoint.y,
        ellipse.majorAxisEndpoint.x
    );

    // Transform ray to ellipse's local coordinate system
    const localRay: Ray = transformRayToEllipseSpace(
        ray,
        ellipse.center,
        rotation
    );

    // Solve intersection in standard ellipse form: x²/a² + y²/b² = 1
    const a: number = majorAxisLength;
    const b: number = minorAxisLength;

    const intersections: RayIntersection[] = solveRayEllipseIntersection(
        localRay,
        a,
        b,
        epsilon
    );

    // Transform intersection points back to world coordinates
    const worldIntersections: RayIntersection[] = intersections.map(
        (intersection) => {
            const worldPoint: Point2D = transformPointFromEllipseSpace(
                intersection.point,
                ellipse.center,
                rotation
            );

            return {
                ...intersection,
                point: worldPoint,
            };
        }
    );

    // If this is an ellipse arc, filter by parameter range
    if (ellipse.startParam !== undefined && ellipse.endParam !== undefined) {
        return filterEllipseArcIntersections(
            worldIntersections,
            ellipse,
            epsilon
        );
    }

    return worldIntersections;
}

/**
 * Transforms a ray from world space to ellipse's local coordinate system
 */
function transformRayToEllipseSpace(
    ray: Ray,
    ellipseCenter: Point2D,
    rotation: number
): Ray {
    // Translate ray origin to ellipse center
    const translatedOrigin: Point2D = {
        x: ray.origin.x - ellipseCenter.x,
        y: ray.origin.y - ellipseCenter.y,
    };

    // Rotate by negative angle to align with standard ellipse axes
    const cos: number = Math.cos(-rotation);
    const sin: number = Math.sin(-rotation);

    return {
        origin: {
            x: translatedOrigin.x * cos - translatedOrigin.y * sin,
            y: translatedOrigin.x * sin + translatedOrigin.y * cos,
        },
        direction: {
            x: ray.direction.x * cos - ray.direction.y * sin,
            y: ray.direction.x * sin + ray.direction.y * cos,
        },
    };
}

/**
 * Transforms a point from ellipse's local space back to world coordinates
 */
function transformPointFromEllipseSpace(
    point: Point2D,
    ellipseCenter: Point2D,
    rotation: number
): Point2D {
    // Rotate point
    const cos: number = Math.cos(rotation);
    const sin: number = Math.sin(rotation);

    const rotatedPoint: Point2D = {
        x: point.x * cos - point.y * sin,
        y: point.x * sin + point.y * cos,
    };

    // Translate back to world position
    return {
        x: rotatedPoint.x + ellipseCenter.x,
        y: rotatedPoint.y + ellipseCenter.y,
    };
}

/**
 * Solves ray-ellipse intersection in standard position
 * Ray: P = origin + t * direction
 * Ellipse: x²/a² + y²/b² = 1
 */
function solveRayEllipseIntersection(
    ray: Ray,
    a: number,
    b: number,
    epsilon: number
): RayIntersection[] {
    const { origin, direction } = ray;
    const { x: ox, y: oy } = origin;
    const { x: dx, y: dy } = direction;

    // Substitute ray equation into ellipse equation:
    // (ox + t*dx)²/a² + (oy + t*dy)²/b² = 1
    //
    // Expand and collect terms:
    // (dx²/a² + dy²/b²)t² + 2(ox*dx/a² + oy*dy/b²)t + (ox²/a² + oy²/b² - 1) = 0

    const A: number = (dx * dx) / (a * a) + (dy * dy) / (b * b);

    const B: number = 2 * ((ox * dx) / (a * a) + (oy * dy) / (b * b));
    const C: number = (ox * ox) / (a * a) + (oy * oy) / (b * b) - 1;

    // Handle degenerate ray (direction is essentially zero)
    if (Math.abs(A) < epsilon) {
        if (Math.abs(B) < epsilon) {
            // Ray is a point - check if it's on the ellipse
            return Math.abs(C) < epsilon
                ? [
                      {
                          point: origin,

                          t: 0,

                          shapeParameter: 0,
                          type: 'tangent' as const,
                      },
                  ]
                : [];
        }

        // Linear case: Bt + C = 0
        const t: number = -C / B;
        if (t >= -epsilon) {
            const intersectionPoint: Point2D = {
                x: ox + t * dx,
                y: oy + t * dy,
            };

            return [
                {
                    point: intersectionPoint,
                    t,

                    shapeParameter: 0,
                    type: 'crossing' as const,
                },
            ];
        }

        return [];
    }

    // Quadratic case: solve At² + Bt + C = 0
    // eslint-disable-next-line no-magic-numbers
    const discriminant: number = B * B - 4 * A * C;

    if (discriminant < -epsilon) {
        return []; // No real solutions
    }

    if (Math.abs(discriminant) < epsilon) {
        // One solution (tangent)

        const t: number = -B / (2 * A);
        if (t >= -epsilon) {
            const intersectionPoint: Point2D = {
                x: ox + t * dx,
                y: oy + t * dy,
            };

            return [
                {
                    point: intersectionPoint,
                    t,

                    shapeParameter: 0,
                    type: 'tangent' as const,
                },
            ];
        }

        return [];
    }

    // Two solutions
    const sqrtDiscriminant: number = Math.sqrt(discriminant);

    const t1: number = (-B - sqrtDiscriminant) / (2 * A);

    const t2: number = (-B + sqrtDiscriminant) / (2 * A);

    const intersections: RayIntersection[] = [];

    // Check both solutions
    for (const t of [t1, t2]) {
        if (t >= -epsilon) {
            const intersectionPoint: Point2D = {
                x: ox + t * dx,
                y: oy + t * dy,
            };

            intersections.push({
                point: intersectionPoint,
                t,

                shapeParameter: 0,
                type: 'crossing' as const,
            });
        }
    }

    // Sort by t parameter
    return intersections.sort((a, b) => a.t - b.t);
}

/**
 * Filters intersections for ellipse arcs based on parameter range
 */
function filterEllipseArcIntersections(
    intersections: RayIntersection[],
    ellipse: Ellipse,
    epsilon: number
): RayIntersection[] {
    if (ellipse.startParam === undefined || ellipse.endParam === undefined) {
        return intersections;
    }

    return intersections.filter((intersection) => {
        // Calculate the angle parameter for this intersection point
        const relativePoint: Point2D = {
            x: intersection.point.x - ellipse.center.x,
            y: intersection.point.y - ellipse.center.y,
        };

        // Calculate angle from major axis
        const majorAxisAngle: number = Math.atan2(
            ellipse.majorAxisEndpoint.y,
            ellipse.majorAxisEndpoint.x
        );
        const pointAngle: number = Math.atan2(relativePoint.y, relativePoint.x);
        const relativeAngle: number = normalizeAngle(
            pointAngle - majorAxisAngle
        );

        // Check if the angle is within the arc's parameter range
        const startParam: number = normalizeAngle(ellipse.startParam!);
        const endParam: number = normalizeAngle(ellipse.endParam!);

        // Handle cases where arc crosses 0° angle
        if (startParam <= endParam) {
            return (
                relativeAngle >= startParam - epsilon &&
                relativeAngle <= endParam + epsilon
            );
        } else {
            return (
                relativeAngle >= startParam - epsilon ||
                relativeAngle <= endParam + epsilon
            );
        }
    });
}

/**
 * Specialized function for horizontal ray-ellipse intersection
 * Optimized for the common case in point-in-polygon testing
 *
 * @param rayOrigin - Starting point of horizontal ray
 * @param ellipse - Ellipse to test
 * @param config - Configuration options
 * @returns Number of crossings
 */
export function countHorizontalRayEllipseCrossings(
    rayOrigin: Point2D,
    ellipse: Ellipse,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    // Create horizontal ray for compatibility
    const ray: Ray = {
        origin: rayOrigin,

        direction: { x: 1, y: 0 },
    };

    return countRayEllipseCrossings(ray, ellipse, config);
}
