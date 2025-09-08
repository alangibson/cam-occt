import type { Point2D, Line } from '../../../types/geometry';
import { EPSILON } from '../../../constants';
import { calculateLineParameterForPoint } from '../../intersection-line-utils';

/**
 * Trim-Extend Utilities Library
 *
 * This library consolidates shared utility functions used across trim and extend operations
 * to eliminate code duplication and provide consistent behavior.
 *
 * Consolidates duplicates from:
 * - src/lib/algorithms/offset-calculation/trim/index.ts
 * - src/lib/algorithms/offset-calculation/extend/arc.ts
 * - src/lib/algorithms/offset-calculation/extend/line.ts
 */

/**
 * Calculate parameter t where point lies on line (0 = start, 1 = end)
 * Alias for backward compatibility - uses shared implementation
 */
export const calculateLineParameter = calculateLineParameterForPoint;

/**
 * Calculate distance between two points
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Euclidean distance between the points
 */
export function pointDistance(p1: Point2D, p2: Point2D): number {
    const dx: number = p2.x - p1.x;
    const dy: number = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate perpendicular distance from a point to a line
 *
 * @param point - Point to measure distance from
 * @param line - Line to measure distance to
 * @returns Perpendicular distance from point to line
 */
export function calculatePointToLineDistance(
    point: Point2D,
    line: Line
): number {
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    const lineLength2 = dx * dx + dy * dy;

    if (lineLength2 < EPSILON * EPSILON) {
        // Degenerate line - distance to start point
        return pointDistance(point, line.start);
    }

    // Calculate perpendicular distance using cross product formula
    const numerator = Math.abs(
        (line.end.y - line.start.y) * point.x -
            (line.end.x - line.start.x) * point.y +
            line.end.x * line.start.y -
            line.end.y * line.start.x
    );

    return numerator / Math.sqrt(lineLength2);
}

/**
 * Snap parameter values to endpoints if they're within tolerance
 *
 * @param param - Parameter to potentially snap
 * @param tolerance - Tolerance for snapping to endpoints
 * @returns Snapped parameter value
 */
export function snapParameterToEndpoints(
    param: number,
    tolerance: number = EPSILON
): number {
    if (Math.abs(param) < tolerance) {
        return 0;
    }
    if (Math.abs(param - 1) < tolerance) {
        return 1;
    }
    return param;
}

/**
 * Validation result for trim/extend parameters
 */
export interface TrimExtendValidationResult {
    /** Whether the parameters are valid */
    isValid: boolean;
    /** Error messages if validation failed */
    errors: string[];
    /** Warnings for potential issues */
    warnings: string[];
}

/**
 * Parameters for trim/extend operations
 */
export interface TrimExtendParams {
    /** Point where operation should occur */
    point: Point2D;
    /** Geometric tolerance */
    tolerance: number;
    /** Maximum extension distance (for extend operations) */
    maxExtension?: number;
}

/**
 * Validate trim/extend operation parameters
 *
 * @param params - Parameters to validate
 * @returns Validation result with any errors or warnings
 */
export function validateTrimExtendParameters(
    params: TrimExtendParams
): TrimExtendValidationResult {
    const result: TrimExtendValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
    };

    // Validate point
    if (
        !params.point ||
        typeof params.point.x !== 'number' ||
        typeof params.point.y !== 'number'
    ) {
        result.isValid = false;
        result.errors.push(
            'Invalid point: must have numeric x and y coordinates'
        );
    } else if (isNaN(params.point.x) || isNaN(params.point.y)) {
        result.isValid = false;
        result.errors.push('Invalid point: coordinates cannot be NaN');
    }

    // Validate tolerance
    if (typeof params.tolerance !== 'number' || params.tolerance <= 0) {
        result.isValid = false;
        result.errors.push('Invalid tolerance: must be a positive number');
    }

    if (params.tolerance > 1.0) {
        result.warnings.push(
            'Large tolerance value may lead to unexpected results'
        );
    }

    // Validate max extension if provided
    if (params.maxExtension !== undefined) {
        if (
            typeof params.maxExtension !== 'number' ||
            params.maxExtension <= 0
        ) {
            result.isValid = false;
            result.errors.push(
                'Invalid maxExtension: must be a positive number'
            );
        }

        if (params.maxExtension > 1000) {
            result.warnings.push(
                'Large maxExtension value may lead to unexpected results'
            );
        }
    }

    return result;
}
