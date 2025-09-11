/**
 * Ray-Tracing Type Definitions
 *
 * Core types for exact ray-shape intersection algorithms
 * used in point-in-chain testing for offset side detection
 */

import type { Point2D } from '$lib/types/geometry';

/**
 * Represents a ray in 2D space
 */
export interface Ray {
    /** Starting point of the ray */
    origin: Point2D;
    /** Direction vector (should be normalized) */
    direction: Point2D;
}

/**
 * Result of a ray-shape intersection test
 */
export interface RayIntersection {
    /** The point of intersection */
    point: Point2D;
    /** Parameter t along the ray (intersection = origin + t * direction) */
    t: number;
    /** Parameter along the shape (0-1 for most shapes) */
    shapeParameter?: number;
    /** Type of intersection */
    type: 'crossing' | 'tangent' | 'endpoint';
}

/**
 * Configuration for ray-tracing operations
 */
export interface RayTracingConfig {
    /** Tolerance for numerical comparisons */
    epsilon: number;
    /** How to handle boundary points */
    boundaryRule: 'inclusive' | 'exclusive' | 'lower-inclusive';
    /** Maximum iterations for iterative algorithms */
    maxIterations?: number;
    /** Number of sample points for spline approximation */
    splineSampleCount?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_RAYTRACING_CONFIG: RayTracingConfig = {
    epsilon: 1e-10,
    boundaryRule: 'lower-inclusive', // Standard for ray casting
    maxIterations: 100,
    splineSampleCount: 50,
};

/**
 * Result of counting ray crossings for a shape
 */
export interface CrossingCount {
    /** Number of times the ray crosses the shape boundary */
    count: number;
    /** Actual intersection points if requested */
    intersections?: RayIntersection[];
    /** Any warnings or edge cases detected */
    warnings?: string[];
}
