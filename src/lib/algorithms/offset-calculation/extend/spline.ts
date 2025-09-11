import type { Arc } from '../../../geometry/arc';
import type { Point2D } from '../../../types/geometry';
import type { Spline } from '$lib/geometry/spline';
import type { Line } from '$lib/geometry/line';
import type { Circle } from '$lib/geometry/circle';
import type { Ellipse } from '$lib/geometry/ellipse';
import type { Polyline } from '$lib/geometry/polyline';
import { EPSILON } from '$lib/geometry/math';
import { MAX_EXTENSION } from '../../constants';
import { pointDistance } from '../trim';
import verb from 'verb-nurbs';
import { createVerbCurveFromSpline } from '../../../utils/verb-integration-utils';
import { generateUniformKnots } from './common';
import { isLine } from '$lib/geometry/line';
import { isCircle } from '$lib/geometry/circle';
import { MICRO_TOLERANCE } from '$lib/geometry/constants';
import { DEFAULT_SPLINE_DEGREE } from '$lib/geometry/spline';

/**
 * Calculate tangent vector at start of spline
 */
export function calculateSplineStartTangent(spline: Spline): Point2D {
    try {
        const verbCurve: verb.geom.ICurve = createVerbCurveFromSpline(spline);
        const derivatives: number[][] = verb.eval.Eval.rationalCurveDerivatives(
            verbCurve.asNurbs(),
            0,
            1
        );

        // First derivative at parameter 0 gives tangent vector
        const tangent: number[] = derivatives[1];
        const magnitude: number = Math.sqrt(
            tangent[0] * tangent[0] + tangent[1] * tangent[1]
        );

        if (magnitude < EPSILON) {
            // Fallback to simple linear approximation if derivatives are degenerate
            return {
                x: spline.controlPoints[1].x - spline.controlPoints[0].x,
                y: spline.controlPoints[1].y - spline.controlPoints[0].y,
            };
        }

        return {
            x: tangent[0] / magnitude,
            y: tangent[1] / magnitude,
        };
    } catch {
        // Fallback to simple linear approximation
        return {
            x: spline.controlPoints[1].x - spline.controlPoints[0].x,
            y: spline.controlPoints[1].y - spline.controlPoints[0].y,
        };
    }
}

/**
 * Calculate tangent vector at end of spline
 */
export function calculateSplineEndTangent(spline: Spline): Point2D {
    try {
        const verbCurve: verb.geom.ICurve = createVerbCurveFromSpline(spline);
        const derivatives: number[][] = verb.eval.Eval.rationalCurveDerivatives(
            verbCurve.asNurbs(),
            1,
            1
        );

        // First derivative at parameter 1 gives tangent vector
        const tangent: number[] = derivatives[1];
        const magnitude: number = Math.sqrt(
            tangent[0] * tangent[0] + tangent[1] * tangent[1]
        );

        if (magnitude < EPSILON) {
            // Fallback to simple linear approximation if derivatives are degenerate
            const lastIdx: number = spline.controlPoints.length - 1;
            return {
                x:
                    spline.controlPoints[lastIdx].x -
                    spline.controlPoints[lastIdx - 1].x,
                y:
                    spline.controlPoints[lastIdx].y -
                    spline.controlPoints[lastIdx - 1].y,
            };
        }

        return {
            x: tangent[0] / magnitude,
            y: tangent[1] / magnitude,
        };
    } catch {
        // Fallback to simple linear approximation
        const lastIdx: number = spline.controlPoints.length - 1;
        return {
            x:
                spline.controlPoints[lastIdx].x -
                spline.controlPoints[lastIdx - 1].x,
            y:
                spline.controlPoints[lastIdx].y -
                spline.controlPoints[lastIdx - 1].y,
        };
    }
}

/**
 * Calculate appropriate extension length for spline intersection detection
 * This considers the bounding boxes of both shapes to determine a reasonable extension distance
 */
export function calculateSplineExtensionLength(
    spline: Spline,
    otherShape: Line | Arc | Circle | Ellipse | Spline | Polyline
): number {
    // Calculate rough bounding box diagonal of both shapes
    const splineBounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    } = calculateSplineBounds(spline);
    const otherBounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    } = calculateOtherShapeBounds(otherShape);

    // Combine bounding boxes
    const combinedBounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    } = {
        minX: Math.min(splineBounds.minX, otherBounds.minX),
        maxX: Math.max(splineBounds.maxX, otherBounds.maxX),
        minY: Math.min(splineBounds.minY, otherBounds.minY),
        maxY: Math.max(splineBounds.maxY, otherBounds.maxY),
    };

    // Extension length should be proportional to the diagonal
    const diagonal: number = Math.sqrt(
        Math.pow(combinedBounds.maxX - combinedBounds.minX, 2) +
            Math.pow(combinedBounds.maxY - combinedBounds.minY, 2)
    );

    // Use a fraction of the diagonal as extension length (typically 50-100%)
    // Minimum 50 units extension
    // eslint-disable-next-line no-magic-numbers
    return Math.max(diagonal * 0.75, 50);
}

/**
 * Calculate bounding box of spline
 */
function calculateSplineBounds(spline: Spline): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
} {
    let minX: number = Infinity,
        maxX: number = -Infinity;
    let minY: number = Infinity,
        maxY: number = -Infinity;

    for (const point of spline.controlPoints) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }

    return { minX, maxX, minY, maxY };
}

/**
 * Calculate bounding box of other shape (line, circle, etc.)
 */
function calculateOtherShapeBounds(
    shape: Line | Arc | Circle | Ellipse | Spline | Polyline
) {
    if (isLine(shape)) {
        // Line
        shape = shape as Line;
        return {
            minX: Math.min(shape.start.x, shape.end.x),
            maxX: Math.max(shape.start.x, shape.end.x),
            minY: Math.min(shape.start.y, shape.end.y),
            maxY: Math.max(shape.start.y, shape.end.y),
        };
    } else if (isCircle(shape)) {
        // Circle
        shape = shape as Circle;
        return {
            minX: shape.center.x - shape.radius,
            maxX: shape.center.x + shape.radius,
            minY: shape.center.y - shape.radius,
            maxY: shape.center.y + shape.radius,
        };
    } else {
        // Fallback for unknown shapes
        return { minX: -100, maxX: 100, minY: -100, maxY: 100 };
    }
}

/**
 * Create an extended spline by adding linear extensions at start and/or end
 * Extensions are created as tangent lines at the endpoints
 */
export function createExtendedSplineVerb(
    spline: Spline,
    extendStart: boolean,
    extendEnd: boolean,
    extensionLength: number
): verb.geom.ICurve {
    // Get tangents at endpoints
    const startTangent: Point2D = calculateSplineStartTangent(spline);
    const endTangent: Point2D = calculateSplineEndTangent(spline);

    // Get start and end points of original spline
    let startPoint: Point2D;
    let endPoint: Point2D;

    try {
        const verbCurve: verb.geom.ICurve = createVerbCurveFromSpline(spline);
        const startEval: number[] = verb.eval.Eval.rationalCurvePoint(
            verbCurve.asNurbs(),
            0
        );
        const endEval: number[] = verb.eval.Eval.rationalCurvePoint(
            verbCurve.asNurbs(),
            1
        );

        startPoint = { x: startEval[0], y: startEval[1] };
        endPoint = { x: endEval[0], y: endEval[1] };
    } catch {
        // Fallback to control points
        startPoint = spline.controlPoints[0];
        endPoint = spline.controlPoints[spline.controlPoints.length - 1];
    }

    // For simplicity, create a degree-1 (linear) extension that properly connects
    // This ensures the extension maintains tangency at the connection point

    const extendedControlPoints: Point2D[] = [];

    // Add start extension if requested
    if (extendStart) {
        const extensionPoint: Point2D = {
            x: startPoint.x - startTangent.x * extensionLength,
            y: startPoint.y - startTangent.y * extensionLength,
        };
        extendedControlPoints.push(extensionPoint);
        extendedControlPoints.push(startPoint);
    }

    // Add original control points (but skip first/last if we already added them)
    const originalStart: number = extendStart ? 1 : 0;
    const originalEnd: number = extendEnd
        ? spline.controlPoints.length - 1
        : spline.controlPoints.length;

    for (let i: number = originalStart; i < originalEnd; i++) {
        extendedControlPoints.push(spline.controlPoints[i]);
    }

    // Add end extension if requested
    if (extendEnd) {
        extendedControlPoints.push(endPoint);
        const extensionPoint: Point2D = {
            x: endPoint.x + endTangent.x * extensionLength,
            y: endPoint.y + endTangent.y * extensionLength,
        };
        extendedControlPoints.push(extensionPoint);
    }

    // Use degree 1 for extended curve to ensure linearity of extensions
    const extendedDegree: number = 1;
    const extendedKnots: number[] = generateUniformKnots(
        extendedControlPoints.length,
        extendedDegree
    );
    const extendedWeights: number[] = extendedControlPoints.map(() => 1);

    // Convert to 3D control points for verb
    const controlPoints3D: [number, number, number][] =
        extendedControlPoints.map(
            (p) => [p.x, p.y, 0] as [number, number, number]
        );

    return verb.geom.NurbsCurve.byKnotsControlPointsWeights(
        extendedDegree,
        extendedKnots,
        controlPoints3D,
        extendedWeights
    );
}

/**
 * Check if a parameter value falls within the original spline bounds (0-1)
 * or on the extended portions. Returns object indicating which part.
 */
export function analyzeParameterLocation(
    param: number,
    spline: Spline,
    extendStart: boolean,
    extendEnd: boolean,
    _extensionLength: number
): { onOriginal: boolean; onStartExtension: boolean; onEndExtension: boolean } {
    // For extended splines, parameter space is remapped
    // Original spline occupies middle portion of parameter space

    if (!extendStart && !extendEnd) {
        // No extensions - simple case
        return {
            onOriginal: param >= 0 && param <= 1,
            onStartExtension: false,
            onEndExtension: false,
        };
    }

    // Calculate parameter ranges based on control point distribution
    const originalControlPointCount: number = spline.controlPoints.length;
    const startExtensionPoints: number = extendStart ? 2 : 0;
    const endExtensionPoints: number = extendEnd ? 2 : 0;
    const totalPoints: number =
        originalControlPointCount + startExtensionPoints + endExtensionPoints;

    // Approximate parameter boundaries (this is a rough estimate)
    const startBoundary: number = startExtensionPoints / totalPoints;
    const endBoundary: number =
        (startExtensionPoints + originalControlPointCount) / totalPoints;

    return {
        onOriginal: param >= startBoundary && param <= endBoundary,
        onStartExtension: extendStart && param < startBoundary,
        onEndExtension: extendEnd && param > endBoundary,
    };
}

// ===== Additional Extension Functions =====

/**
 * Extension direction options for splines
 */
export type SplineExtensionDirection = 'start' | 'end' | 'auto';

/**
 * Extension method options
 */
export type SplineExtensionMethod = 'parametric' | 'linear';

/**
 * Extension options for spline operations
 */
export interface SplineExtensionOptions {
    /** Maximum distance to extend */
    maxExtension?: number;
    /** Geometric tolerance */
    tolerance?: number;
    /** Which end to extend */
    direction?: SplineExtensionDirection;
    /** Extension method to use */
    method?: SplineExtensionMethod;
}

/**
 * Result of spline extension calculation
 */
export interface SplineExtensionResult {
    /** Whether the extension calculation succeeded */
    success: boolean;
    /** Distance of extension */
    extensionDistance: number;
    /** Extension method used */
    method: SplineExtensionMethod;
    /** Direction of extension */
    direction: 'start' | 'end';
    /** Error message if failed */
    error?: string;
}

/**
 * Extend a spline to reach a specific intersection point
 *
 * @param spline - The spline to extend
 * @param intersectionPoint - Target point to extend to
 * @param options - Extension options
 * @returns Extended spline or null if extension failed
 */
export function extendSplineToPoint(
    spline: Spline,
    intersectionPoint: Point2D,
    options: SplineExtensionOptions = {}
): Spline | null {
    const defaultOptions: SplineExtensionOptions = {
        maxExtension: MAX_EXTENSION,
        tolerance: MICRO_TOLERANCE,
        direction: 'auto' as SplineExtensionDirection,
        method: 'linear' as SplineExtensionMethod,
    };
    const opts: SplineExtensionOptions = { ...defaultOptions, ...options };

    try {
        // Step 1: Validate spline geometry
        if (!spline.controlPoints || spline.controlPoints.length < 2) {
            return null;
        }

        // Step 2: Determine which end to extend
        const extendDirection: 'start' | 'end' | null =
            determineSplineExtensionDirection(spline, intersectionPoint, opts);
        if (!extendDirection) {
            return null;
        }

        // Step 3: Calculate extension parameters
        const extensionInfo: SplineExtensionResult = calculateSplineExtension(
            spline,
            intersectionPoint,
            extendDirection,
            opts
        );
        if (!extensionInfo.success) {
            return null;
        }

        // Step 4: Validate extension distance
        if (extensionInfo.extensionDistance > opts.maxExtension!) {
            return null;
        }

        // Step 5: Create extended spline using the chosen strategy
        return createExtendedSplineToPoint(
            spline,
            intersectionPoint,
            extendDirection,
            extensionInfo
        );
    } catch {
        return null;
    }
}

/**
 * Determine which end of the spline should be extended
 */
export function determineSplineExtensionDirection(
    spline: Spline,
    intersectionPoint: Point2D,
    options: SplineExtensionOptions
): 'start' | 'end' | null {
    if (options.direction === 'start' || options.direction === 'end') {
        return options.direction;
    }

    // Auto mode: extend the end that's closer to the intersection point
    const startPoint: Point2D = getSplinePoint(spline, 0);
    const endPoint: Point2D = getSplinePoint(spline, 1);

    const distToStart: number = pointDistance(startPoint, intersectionPoint);
    const distToEnd: number = pointDistance(endPoint, intersectionPoint);

    return distToStart < distToEnd ? 'start' : 'end';
}

/**
 * Calculate spline extension parameters
 */
export function calculateSplineExtension(
    spline: Spline,
    intersectionPoint: Point2D,
    direction: 'start' | 'end',
    options: SplineExtensionOptions
): SplineExtensionResult {
    const endPoint: Point2D =
        direction === 'start'
            ? getSplinePoint(spline, 0)
            : getSplinePoint(spline, 1);

    const extensionDistance: number = pointDistance(
        endPoint,
        intersectionPoint
    );

    // For now, always use linear extension as parametric extension of NURBS
    // is quite complex and would require specialized NURBS mathematics
    return {
        success: true,
        extensionDistance,
        method: options.method || 'linear',
        direction,
    };
}

/**
 * Create the extended spline geometry to reach a specific point
 */
function createExtendedSplineToPoint(
    originalSpline: Spline,
    intersectionPoint: Point2D,
    direction: 'start' | 'end',
    extensionInfo: SplineExtensionResult
): Spline {
    if (extensionInfo.method === 'linear') {
        // Simple linear extension by adding control points
        return createLinearExtendedSplineToPoint(
            originalSpline,
            intersectionPoint,
            direction
        );
    } else {
        // Parametric extension (more complex, not implemented yet)
        return createLinearExtendedSplineToPoint(
            originalSpline,
            intersectionPoint,
            direction
        );
    }
}

/**
 * Create an extended spline using linear extension from the end tangent
 */
function createLinearExtendedSplineToPoint(
    originalSpline: Spline,
    intersectionPoint: Point2D,
    direction: 'start' | 'end'
): Spline {
    const controlPoints: Point2D[] = [...originalSpline.controlPoints];
    const weights: number[] = originalSpline.weights
        ? [...originalSpline.weights]
        : controlPoints.map(() => 1);

    if (direction === 'start') {
        // Add intersection point at the beginning
        // Insert new control points to maintain smooth curve
        const tangentPoint: Point2D = calculateTangentExtensionPoint(
            controlPoints[0],
            controlPoints[1],
            intersectionPoint
        );

        controlPoints.unshift(intersectionPoint, tangentPoint);
        weights.unshift(1, 1);
    } else {
        // Add intersection point at the end
        const lastIndex: number = controlPoints.length - 1;
        const tangentPoint: Point2D = calculateTangentExtensionPoint(
            controlPoints[lastIndex],
            controlPoints[lastIndex - 1],
            intersectionPoint
        );

        controlPoints.push(tangentPoint, intersectionPoint);
        weights.push(1, 1);
    }

    // Update knot vector for new control points
    const degree: number = originalSpline.degree || DEFAULT_SPLINE_DEGREE;
    const newKnots: number[] = generateKnotVector(controlPoints.length, degree);

    return {
        ...originalSpline,
        controlPoints,
        weights,
        knots: newKnots,
    };
}

/**
 * Calculate an intermediate point for smooth tangent extension
 */
function calculateTangentExtensionPoint(
    endPoint: Point2D,
    previousPoint: Point2D,
    targetPoint: Point2D
): Point2D {
    // Calculate tangent direction from the curve
    const tangentDir: Point2D = {
        x: endPoint.x - previousPoint.x,
        y: endPoint.y - previousPoint.y,
    };

    const tangentLength: number = Math.sqrt(
        tangentDir.x * tangentDir.x + tangentDir.y * tangentDir.y
    );
    if (tangentLength < EPSILON) {
        // Fallback to direct interpolation
        return {
            x: (endPoint.x + targetPoint.x) / 2,
            y: (endPoint.y + targetPoint.y) / 2,
        };
    }

    const unitTangent: Point2D = {
        x: tangentDir.x / tangentLength,
        y: tangentDir.y / tangentLength,
    };

    // Create intermediate point along tangent direction
    // 30% of extension
    // eslint-disable-next-line no-magic-numbers
    const extensionLength: number = pointDistance(endPoint, targetPoint) * 0.3;

    return {
        x: endPoint.x + unitTangent.x * extensionLength,
        y: endPoint.y + unitTangent.y * extensionLength,
    };
}

/**
 * Generate a uniform knot vector for the given number of control points and degree
 */
function generateKnotVector(
    numControlPoints: number,
    degree: number
): number[] {
    const knots: number[] = [];
    const numKnots: number = numControlPoints + degree + 1;

    // Add degree + 1 zeros at the start
    for (let i: number = 0; i <= degree; i++) {
        knots.push(0);
    }

    // Add internal knots uniformly spaced
    const numInternalKnots: number = numKnots - 2 * (degree + 1);
    for (let i: number = 1; i <= numInternalKnots; i++) {
        knots.push(i / (numInternalKnots + 1));
    }

    // Add degree + 1 ones at the end
    for (let i: number = 0; i <= degree; i++) {
        knots.push(1);
    }

    return knots;
}

/**
 * Get a point on the spline at parameter t (0 = start, 1 = end)
 * Simplified implementation - in practice would use proper NURBS evaluation
 */
export function getSplinePoint(spline: Spline, t: number): Point2D {
    if (!spline.controlPoints || spline.controlPoints.length === 0) {
        return { x: 0, y: 0 };
    }

    if (t <= 0) {
        return spline.controlPoints[0];
    }

    if (t >= 1) {
        return spline.controlPoints[spline.controlPoints.length - 1];
    }

    // Simple linear interpolation fallback
    // In practice, this should use proper NURBS evaluation
    const index: number = t * (spline.controlPoints.length - 1);
    const i1: number = Math.floor(index);
    const i2: number = Math.min(i1 + 1, spline.controlPoints.length - 1);
    const fraction: number = index - i1;

    const p1: Point2D = spline.controlPoints[i1];
    const p2: Point2D = spline.controlPoints[i2];

    return {
        x: p1.x + (p2.x - p1.x) * fraction,
        y: p1.y + (p2.y - p1.y) * fraction,
    };
}
