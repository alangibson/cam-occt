import { generateUniformKnotVector } from '$lib/geometry/spline';

/**
 * Generate a uniform knot vector for NURBS curve
 * @deprecated Use generateUniformKnotVector from nurbs-utils instead
 */
export function generateUniformKnots(
    numControlPoints: number,
    degree: number
): number[] {
    return generateUniformKnotVector(numControlPoints, degree);
}
