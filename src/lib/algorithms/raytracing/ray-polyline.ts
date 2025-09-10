/**
 * Ray-Polyline Intersection Algorithm
 *
 * Exact geometric intersection between rays and polylines by
 * iterating through constituent shapes and aggregating crossings
 */

import type { Arc } from '../../geometry/arc';
import type { Polyline, Point2D, Line } from '../../types/geometry';
import { GeometryType } from '../../types/geometry';
import type { Ray, RayIntersection, RayTracingConfig } from './types';
import { DEFAULT_RAYTRACING_CONFIG } from './types';
import { countRayLineCrossings, findRayLineIntersections } from './ray-line';
import { countRayArcCrossings, findRayArcIntersections } from './ray-arc';

/**
 * Counts how many times a ray crosses a polyline
 *
 * @param ray - The ray to test (typically horizontal for point-in-polygon)
 * @param polyline - The polyline geometry containing multiple connected shapes
 * @param config - Configuration for numerical tolerance
 * @returns Number of crossings
 */
export function countRayPolylineCrossings(
    ray: Ray,
    polyline: Polyline,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    let totalCrossings: number = 0;

    // Iterate through all shapes in the polyline
    for (const shape of polyline.shapes) {
        switch (shape.type) {
            case GeometryType.LINE:
                totalCrossings += countRayLineCrossings(
                    ray,
                    shape.geometry as Line,
                    config
                );
                break;
            case GeometryType.ARC:
                totalCrossings += countRayArcCrossings(
                    ray,
                    shape.geometry as Arc,
                    config
                );
                break;
            default:
                console.warn(
                    `Unsupported shape type in polyline: ${shape.type}`
                );
        }
    }

    return totalCrossings;
}

/**
 * Finds all intersections between a ray and a polyline
 *
 * @param ray - The ray to test
 * @param polyline - The polyline geometry
 * @param config - Configuration for numerical tolerance
 * @returns Array of intersection points from all constituent shapes
 */
export function findRayPolylineIntersections(
    ray: Ray,
    polyline: Polyline,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): RayIntersection[] {
    const intersections: RayIntersection[] = [];

    // Collect intersections from all shapes in the polyline
    for (const shape of polyline.shapes) {
        switch (shape.type) {
            case GeometryType.LINE:
                intersections.push(
                    ...findRayLineIntersections(
                        ray,
                        shape.geometry as Line,
                        config
                    )
                );
                break;
            case GeometryType.ARC:
                intersections.push(
                    ...findRayArcIntersections(
                        ray,
                        shape.geometry as Arc,
                        config
                    )
                );
                break;
            default:
                console.warn(
                    `Unsupported shape type in polyline: ${shape.type}`
                );
        }
    }

    // Sort intersections by parameter t (distance along ray)
    return intersections.sort((a, b) => a.t - b.t);
}

/**
 * Specialized function for horizontal ray-polyline intersection
 * Optimized for the common case in point-in-polygon testing
 *
 * @param rayOrigin - Starting point of horizontal ray
 * @param polyline - Polyline to test
 * @param config - Configuration options
 * @returns Number of crossings
 */
export function countHorizontalRayPolylineCrossings(
    rayOrigin: Point2D,
    polyline: Polyline,
    config: RayTracingConfig = DEFAULT_RAYTRACING_CONFIG
): number {
    // Create horizontal ray for compatibility with existing functions
    const ray: Ray = {
        origin: rayOrigin,
        direction: { x: 1, y: 0 },
    };

    return countRayPolylineCrossings(ray, polyline, config);
}
