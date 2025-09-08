import type { Point2D, Spline } from '$lib/types/geometry';
import { EPSILON } from '$lib/constants';
import { generateValidKnotVector } from '$lib/utils/nurbs-utils';

export interface SplineValidationResult {
    isValid: boolean;
    repairedSpline?: Spline;
}

/**
 * Validates a spline geometry to ensure it has valid NURBS parameters
 */
export function validateSplineGeometry(spline: Spline): SplineValidationResult {
    if (
        !spline.controlPoints ||
        !Array.isArray(spline.controlPoints) ||
        spline.controlPoints.length < 2
    ) {
        return { isValid: false };
    }

    const degree: number = spline.degree || 3;
    const controlPoints: Point2D[] = spline.controlPoints;
    const expectedKnots: number = controlPoints.length + degree + 1;

    // Check if knot vector exists and has correct length
    if (!spline.knots || spline.knots.length !== expectedKnots) {
        // Generate a valid uniform knot vector
        const validKnots: number[] = generateValidKnotVector(
            controlPoints.length,
            degree
        );

        return {
            isValid: false,
            repairedSpline: {
                ...spline,
                knots: validKnots,
                weights: spline.weights || controlPoints.map(() => 1),
                degree: degree,
            },
        };
    }

    // Check knot vector structure
    const knots: number[] = spline.knots;
    const firstKnot: number = knots[0];
    const lastKnot: number = knots[knots.length - 1];

    let needsRepair: boolean = false;

    // Check if first degree+1 knots are all the same
    for (let i = 0; i <= degree; i++) {
        if (Math.abs(knots[i] - firstKnot) > EPSILON) {
            needsRepair = true;
            break;
        }
    }

    // Check if last degree+1 knots are all the same
    if (!needsRepair) {
        for (let i = knots.length - degree - 1; i < knots.length; i++) {
            if (Math.abs(knots[i] - lastKnot) > EPSILON) {
                needsRepair = true;
                break;
            }
        }
    }

    if (needsRepair) {
        // Generate a valid uniform knot vector
        const validKnots: number[] = generateValidKnotVector(
            controlPoints.length,
            degree
        );

        return {
            isValid: false,
            repairedSpline: {
                ...spline,
                knots: validKnots,
                weights: spline.weights || controlPoints.map(() => 1),
            },
        };
    }

    return { isValid: true };
}

/**
 * Repairs a spline's knot vector by generating a valid uniform knot vector
 */
export function repairSplineKnotVector(spline: Spline): Spline {
    const degree: number = spline.degree || 3;
    const validKnots: number[] = generateValidKnotVector(
        spline.controlPoints.length,
        degree
    );

    return {
        ...spline,
        knots: validKnots,
        weights: spline.weights || spline.controlPoints.map(() => 1),
        degree: degree,
    };
}

/**
 * Validates spline knots according to NURBS requirements
 */
export function validateSplineKnots(
    knots: number[],
    degree: number,
    numControlPoints: number
): boolean {
    const expectedKnots = numControlPoints + degree + 1;

    // Check correct length
    if (knots.length !== expectedKnots) {
        return false;
    }

    // Check that knots are non-decreasing
    for (let i = 1; i < knots.length; i++) {
        if (knots[i] < knots[i - 1]) {
            return false;
        }
    }

    // Check that first and last knots are repeated with multiplicity degree+1
    const firstKnot = knots[0];
    const lastKnot = knots[knots.length - 1];

    // Check first degree+1 knots are all the same
    for (let i = 0; i <= degree; i++) {
        if (Math.abs(knots[i] - firstKnot) > EPSILON) {
            return false;
        }
    }

    // Check last degree+1 knots are all the same
    for (let i = knots.length - degree - 1; i < knots.length; i++) {
        if (Math.abs(knots[i] - lastKnot) > EPSILON) {
            return false;
        }
    }

    return true;
}
