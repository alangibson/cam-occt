import type { Point2D } from '$lib/types/geometry';

/**
 * Spline geometry interface representing a NURBS curve
 */
export interface Spline {
    controlPoints: Point2D[];
    knots: number[];
    weights: number[];
    degree: number;
    fitPoints: Point2D[];
    closed: boolean;
}

/**
 * Validation result for NURBS operations
 */
export interface ValidationResult {
    isValid: boolean;
    error?: string;
}
export interface SplineValidationResult {
    isValid: boolean;
    repairedSpline?: Spline;
}
/**
 * Repair an invalid knot vector by generating a new uniform knot vector
 * This function should be used when validation fails
 *
 * @param knots Original knot vector (may be invalid)
 * @param numControlPoints Number of control points
 * @param degree Curve degree
 * @returns New valid uniform knot vector
 */
// export function repairKnotVector(
//     knots: number[],
//     numControlPoints: number,
//     degree: number
// ): number[] {
//     // Always generate a fresh uniform knot vector for repairs
//     return generateUniformKnotVector(numControlPoints, degree);
// }
/**
 * Configuration for spline tessellation
 */

export interface SplineTessellationConfig {
    /** Method to use for tessellation */
    method:
        | 'verb-nurbs'
        | 'adaptive-sampling'
        | 'uniform-sampling'
        | 'fallback';
    /** Number of sample points for uniform/adaptive sampling */
    numSamples?: number;
    /** Tolerance for adaptive sampling */
    tolerance?: number;
    /** Maximum number of samples for adaptive methods */
    maxSamples?: number;
    /** Minimum number of samples for adaptive methods */
    minSamples?: number;
    /** Timeout in milliseconds for expensive operations */
    timeoutMs?: number;
}
/**
 * Result of spline tessellation operation
 */

export interface SplineTessellationResult {
    /** Whether the operation succeeded */
    success: boolean;
    /** Tessellated points representing the spline */
    points: Point2D[];
    /** Method that was actually used */
    methodUsed: string;
    /** Warnings generated during tessellation */
    warnings: string[];
    /** Errors encountered */
    errors: string[];
    /** Performance metrics */
    metrics?: {
        duration: number;
        sampleCount: number;
        iterations?: number;
    };
}
