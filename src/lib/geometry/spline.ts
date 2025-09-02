import type { Spline, Point2D } from '$lib/types/geometry';
import { evaluateNURBS } from './nurbs';
import { tessellateSpline } from '$lib/geometry/spline-tessellation';

export function getSplineStartPoint(spline: Spline): Point2D {
    // return spline.controlPoints[0];

    // From DrawingCanvas
    // Use proper NURBS evaluation at parameter t=0
    try {
        return evaluateNURBS(0, spline); // Get exact start point at t=0
    } catch {
        // Fallback to first control point if NURBS evaluation fails
        if (spline.fitPoints && spline.fitPoints.length > 0) {
        return spline.fitPoints[0];
        }
        if (spline.controlPoints.length > 0) {
            return spline.controlPoints[0];
        }
        // Final fallback to origin if no control points exist
        return { x: 0, y: 0 };
    }
}

export function getSplineEndPoint(spline: Spline): Point2D {
    // return spline.controlPoints[spline.controlPoints.length - 1];

    // From DrawingCanvas
    // Use proper NURBS evaluation at parameter t=1
    try {
        return evaluateNURBS(1, spline); // Get exact end point at t=1
    } catch {
        // Fallback to last control point if NURBS evaluation fails
        if (spline.fitPoints && spline.fitPoints.length > 0) {
        return spline.fitPoints[spline.fitPoints.length - 1];
        }
        if (spline.controlPoints.length > 0) {
            return spline.controlPoints[spline.controlPoints.length - 1];
        }
        // Final fallback to origin if no control points exist
        return { x: 0, y: 0 };
    }
}

export function reverseSpline(spline: Spline): Spline {
    // Reverse splines by reversing control points and fit points
    const reversedControlPoints = [...spline.controlPoints].reverse();
    const reversedFitPoints = spline.fitPoints ? [...spline.fitPoints].reverse() : [];

    // For NURBS, we also need to reverse the knot vector if present
    let reversedKnots = spline.knots || [];
    if (reversedKnots.length > 0) {
        // Reverse and remap knot vector to [0,1] domain
        const maxKnotValue = reversedKnots[reversedKnots.length - 1];
        reversedKnots = reversedKnots.map((knot: number) => maxKnotValue - knot).reverse();
    }

    return {
        ...spline,
        controlPoints: reversedControlPoints,
        fitPoints: reversedFitPoints,
        knots: reversedKnots,
        // Weights don't need reversal, but need to be reordered with control points
        weights: spline.weights ? [...spline.weights].reverse() : []
    };
}

export function getSplinePointAt(spline: Spline, t: number): Point2D {
    try {
        const tessellationResult = tessellateSpline(spline, { method: 'verb-nurbs', numSamples: 200 });
        if (tessellationResult.success && tessellationResult.points.length > 1) {
            // Use arc-length parameterization for better accuracy
            return getPointAtParameterWithArcLength(tessellationResult.points, t);
        }
    } catch {
        // Fallback to midpoint if tessellation fails
    }
    return { x: 0, y: 0 };
}

function getPointAtParameterWithArcLength(points: Point2D[], t: number): Point2D {
    if (points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return points[0];
    if (t <= 0) return points[0];
    if (t >= 1) return points[points.length - 1];

    // Calculate cumulative arc lengths
    const arcLengths: number[] = [0];
    let totalLength = 0;

    for (let i: number = 1; i < points.length; i++) {
        const dx: number = points[i].x - points[i - 1].x;
        const dy: number = points[i].y - points[i - 1].y;
        const segmentLength = Math.sqrt(dx * dx + dy * dy);
        totalLength += segmentLength;
        arcLengths.push(totalLength);
    }

    if (totalLength === 0) return points[0];

    const targetLength = t * totalLength;

    // Find the segment containing the target arc length
    for (let i: number = 1; i < arcLengths.length; i++) {
        if (arcLengths[i] >= targetLength) {
            const segmentStart = arcLengths[i - 1];
            const segmentEnd = arcLengths[i];
            const segmentT = (targetLength - segmentStart) / (segmentEnd - segmentStart);

            // Interpolate between the two points
            const p1 = points[i - 1];
            const p2 = points[i];

            return {
                x: p1.x + segmentT * (p2.x - p1.x),
                y: p1.y + segmentT * (p2.y - p1.y)
            };
        }
    }

    return points[points.length - 1];
}

export function normalizeSplineWeights(spline: Spline): Spline {
  // Ensure spline has valid weights array matching control points length
  const needsWeights = !spline.weights || spline.weights.length === 0 || 
                      spline.weights.length !== spline.controlPoints.length;
  
  if (needsWeights) {
    return {
      ...spline,
      weights: spline.controlPoints.map(() => 1)
    };
  }
  
  return spline;
}