import type { Point2D, Spline } from '../../lib/types';
import { generateUniformKnotVector } from '../utils/nurbs-utils';
import { SPLINE_SAMPLE_COUNT } from './constants';

/**
 * Evaluates a NURBS curve at a given parameter value
 * Based on the Cox-de Boor recursion formula
 */

/**
 * Find the knot span index for a given parameter value
 * @param n Number of control points - 1
 * @param p Degree of the curve
 * @param u Parameter value
 * @param knots Knot vector
 * @returns Knot span index
 */
function findKnotSpan(
    n: number,
    p: number,
    u: number,
    knots: number[]
): number {
    // Special case: if u equals the last knot value
    if (u >= knots[n + 1]) {
        return n;
    }

    // Binary search
    let low: number = p;
    let high: number = n + 1;
    let mid: number = Math.floor((low + high) / 2);

    while (u < knots[mid] || u >= knots[mid + 1]) {
        if (u < knots[mid]) {
            high = mid;
        } else {
            low = mid;
        }
        mid = Math.floor((low + high) / 2);
    }

    return mid;
}

/**
 * Compute the non-vanishing basis functions
 * @param i Knot span index
 * @param u Parameter value
 * @param p Degree
 * @param knots Knot vector
 * @returns Array of basis function values
 */
function basisFunctions(
    i: number,
    u: number,
    p: number,
    knots: number[]
): number[] {
    const N: number[] = new Array(p + 1);
    const left: number[] = new Array(p + 1);
    const right: number[] = new Array(p + 1);

    N[0] = 1.0;

    for (let j: number = 1; j <= p; j++) {
        left[j] = u - knots[i + 1 - j];
        right[j] = knots[i + j] - u;
        let saved: number = 0.0;

        for (let r: number = 0; r < j; r++) {
            const temp: number = N[r] / (right[r + 1] + left[j - r]);
            N[r] = saved + right[r + 1] * temp;
            saved = left[j - r] * temp;
        }

        N[j] = saved;
    }

    return N;
}

/**
 * Evaluate a point on a NURBS curve
 * @param u Parameter value (0 to 1)
 * @param spline Spline geometry
 * @returns Point on the curve
 */
export function evaluateNURBS(u: number, spline: Spline): Point2D {
    const n: number = spline.controlPoints.length - 1;
    const p: number = spline.degree;

    // Get or generate knot vector
    let knots: number[] = spline.knots;
    if (!knots || knots.length === 0) {
        // Generate uniform knot vector if not provided
        knots = generateUniformKnotVector_deprecated(n, p);
    }

    // Map u from [0,1] to knot range
    const uMin: number = knots[p];
    const uMax: number = knots[n + 1];
    const mappedU: number = uMin + u * (uMax - uMin);

    // Find knot span
    const span: number = findKnotSpan(n, p, mappedU, knots);

    // Compute basis functions
    const N: number[] = basisFunctions(span, mappedU, p, knots);

    // Get weights or use default
    const weights: number[] =
        spline.weights && spline.weights.length > 0
            ? spline.weights
            : new Array(spline.controlPoints.length).fill(1.0);

    // Compute curve point
    let x: number = 0;
    let y: number = 0;
    let w: number = 0;

    for (let j: number = 0; j <= p; j++) {
        const index: number = span - p + j;
        const weight: number = weights[index];
        const basis: number = N[j] * weight;

        x += spline.controlPoints[index].x * basis;
        y += spline.controlPoints[index].y * basis;
        w += basis;
    }

    // Divide by weight sum for rational curves
    if (w !== 0) {
        x /= w;
        y /= w;
    }

    return { x, y };
}

/**
 * Generate a uniform knot vector
 * @deprecated Use generateUniformKnotVector from nurbs-utils instead
 * @param n Number of control points - 1
 * @param p Degree
 * @returns Knot vector
 */
function generateUniformKnotVector_deprecated(n: number, p: number): number[] {
    // Note: This function has different parameter semantics than the new one
    // n = numControlPoints - 1, whereas new function takes numControlPoints directly
    return generateUniformKnotVector(n + 1, p);
}

/**
 * Sample points along a NURBS curve
 * @param spline Spline geometry
 * @param numSamples Number of points to sample
 * @returns Array of sampled points
 */
export function sampleNURBS(
    spline: Spline,
    numSamples: number = SPLINE_SAMPLE_COUNT
): Point2D[] {
    const points: Point2D[] = [];

    // If we have fit points and they're dense enough, use them
    if (spline.fitPoints && spline.fitPoints.length >= numSamples) {
        return spline.fitPoints;
    }

    // Otherwise, evaluate the NURBS curve
    for (let i: number = 0; i <= numSamples; i++) {
        const u: number = i / numSamples;
        points.push(evaluateNURBS(u, spline));
    }

    return points;
}

/**
 * Evaluate NURBS curve derivative at a parameter value
 * @param u Parameter value (0 to 1)
 * @param spline Spline geometry
 * @param order Derivative order (1 for first derivative, 2 for second, etc.)
 * @returns Derivative vector
 */
export function evaluateNURBSDerivative(
    u: number,
    spline: Spline,
    order: number = 1
): Point2D {
    // Simple finite difference approximation for now
    const h: number = 0.0001;

    if (order === 1) {
        const p1: Point2D = evaluateNURBS(Math.max(0, u - h), spline);
        const p2: Point2D = evaluateNURBS(Math.min(1, u + h), spline);

        return {
            x: (p2.x - p1.x) / (2 * h),
            y: (p2.y - p1.y) / (2 * h),
        };
    }

    // Higher order derivatives can be implemented if needed
    throw new Error(`Derivative order ${order} not implemented`);
}

/**
 * Get the parameter range for a NURBS curve
 * @param spline Spline geometry
 * @returns [start, end] parameter values
 */
export function getNURBSParameterRange(spline: Spline): [number, number] {
    const n: number = spline.controlPoints.length - 1;
    const p: number = spline.degree;

    let knots: number[] = spline.knots;
    if (!knots || knots.length === 0) {
        knots = generateUniformKnotVector_deprecated(n, p);
    }

    return [knots[p], knots[n + 1]];
}
