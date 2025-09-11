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
