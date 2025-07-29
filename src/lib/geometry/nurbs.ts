import type { Point2D, Spline } from '../../types';

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
function findKnotSpan(n: number, p: number, u: number, knots: number[]): number {
  // Special case: if u equals the last knot value
  if (u >= knots[n + 1]) {
    return n;
  }
  
  // Binary search
  let low = p;
  let high = n + 1;
  let mid = Math.floor((low + high) / 2);
  
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
function basisFunctions(i: number, u: number, p: number, knots: number[]): number[] {
  const N = new Array(p + 1);
  const left = new Array(p + 1);
  const right = new Array(p + 1);
  
  N[0] = 1.0;
  
  for (let j = 1; j <= p; j++) {
    left[j] = u - knots[i + 1 - j];
    right[j] = knots[i + j] - u;
    let saved = 0.0;
    
    for (let r = 0; r < j; r++) {
      const temp = N[r] / (right[r + 1] + left[j - r]);
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
  const n = spline.controlPoints.length - 1;
  const p = spline.degree;
  
  // Get or generate knot vector
  let knots = spline.knots;
  if (!knots || knots.length === 0) {
    // Generate uniform knot vector if not provided
    knots = generateUniformKnotVector(n, p);
  }
  
  // Map u from [0,1] to knot range
  const uMin = knots[p];
  const uMax = knots[n + 1];
  const mappedU = uMin + u * (uMax - uMin);
  
  // Find knot span
  const span = findKnotSpan(n, p, mappedU, knots);
  
  // Compute basis functions
  const N = basisFunctions(span, mappedU, p, knots);
  
  // Get weights or use default
  const weights = spline.weights && spline.weights.length > 0 ? spline.weights : 
    new Array(spline.controlPoints.length).fill(1.0);
  
  // Compute curve point
  let x = 0;
  let y = 0;
  let w = 0;
  
  for (let j = 0; j <= p; j++) {
    const index = span - p + j;
    const weight = weights[index];
    const basis = N[j] * weight;
    
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
 * @param n Number of control points - 1
 * @param p Degree
 * @returns Knot vector
 */
function generateUniformKnotVector(n: number, p: number): number[] {
  const m = n + p + 1;
  const knots = new Array(m + 1);
  
  // Clamped knot vector
  for (let i = 0; i <= p; i++) {
    knots[i] = 0;
  }
  
  for (let i = p + 1; i <= n; i++) {
    knots[i] = (i - p) / (n - p + 1);
  }
  
  for (let i = n + 1; i <= m; i++) {
    knots[i] = 1;
  }
  
  return knots;
}

/**
 * Sample points along a NURBS curve
 * @param spline Spline geometry
 * @param numSamples Number of points to sample
 * @returns Array of sampled points
 */
export function sampleNURBS(spline: Spline, numSamples: number = 100): Point2D[] {
  const points: Point2D[] = [];
  
  // If we have fit points and they're dense enough, use them
  if (spline.fitPoints && spline.fitPoints.length >= numSamples) {
    return spline.fitPoints;
  }
  
  // Otherwise, evaluate the NURBS curve
  for (let i = 0; i <= numSamples; i++) {
    const u = i / numSamples;
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
export function evaluateNURBSDerivative(u: number, spline: Spline, order: number = 1): Point2D {
  // Simple finite difference approximation for now
  const h = 0.0001;
  
  if (order === 1) {
    const p1 = evaluateNURBS(Math.max(0, u - h), spline);
    const p2 = evaluateNURBS(Math.min(1, u + h), spline);
    
    return {
      x: (p2.x - p1.x) / (2 * h),
      y: (p2.y - p1.y) / (2 * h)
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
  const n = spline.controlPoints.length - 1;
  const p = spline.degree;
  
  let knots = spline.knots;
  if (!knots || knots.length === 0) {
    knots = generateUniformKnotVector(n, p);
  }
  
  return [knots[p], knots[n + 1]];
}