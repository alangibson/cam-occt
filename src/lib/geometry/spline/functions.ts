import verb, { type VerbCurve } from 'verb-nurbs';
import type { Point2D } from '$lib/types/geometry';
import type { Spline, ValidationResult } from './interfaces';
import {
    EPSILON,
    INTERSECTION_TOLERANCE,
    GEOMETRIC_PRECISION_TOLERANCE,
    STANDARD_TESSELLATION_COUNT,
    STANDARD_GRID_SPACING,
    MAX_ITERATIONS,
} from '$lib/constants/index';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain';
import {
    SPLINE_COMPLEXITY_WEIGHT_MULTIPLIER,
    CLOSED_SPLINE_COMPLEXITY_MULTIPLIER,
    MAX_SPLINE_TESSELLATION_SAMPLES,
    MAX_ADAPTIVE_TESSELLATION_SAMPLES,
    STANDARD_TESSELLATION_TIMEOUT_MS,
    HIGH_COMPLEXITY_TIMEOUT_MS,
    TESSELLATION_SAMPLE_MULTIPLIER,
    SPLINE_SAMPLE_COUNT,
} from './constants';

/**
 * Maximum iterations for intensive algorithms (tessellation, sampling)
 */
const MAX_INTENSIVE_ITERATIONS: number = 1000;

/**
 * Default index for array operations when not found
 */
const DEFAULT_ARRAY_NOT_FOUND_INDEX = -1;

// ===== SPLINE BASIC OPERATIONS =====

export function getSplineStartPoint(spline: Spline): Point2D {
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
    const reversedFitPoints = spline.fitPoints
        ? [...spline.fitPoints].reverse()
        : [];

    // For NURBS, we also need to reverse the knot vector if present
    let reversedKnots = spline.knots || [];
    if (reversedKnots.length > 0) {
        // Reverse and remap knot vector to [0,1] domain
        const maxKnotValue = reversedKnots[reversedKnots.length - 1];
        reversedKnots = reversedKnots
            .map((knot: number) => maxKnotValue - knot)
            .reverse();
    }

    return {
        ...spline,
        controlPoints: reversedControlPoints,
        fitPoints: reversedFitPoints,
        knots: reversedKnots,
        // Weights don't need reversal, but need to be reordered with control points
        weights: spline.weights ? [...spline.weights].reverse() : [],
    };
}

export function getSplinePointAt(spline: Spline, t: number): Point2D {
    try {
        const tessellationResult = tessellateSpline(spline, {
            method: 'verb-nurbs',
            numSamples: 200,
        });
        if (
            tessellationResult.success &&
            tessellationResult.points.length > 1
        ) {
            // Use arc-length parameterization for better accuracy
            return getPointAtParameterWithArcLength(
                tessellationResult.points,
                t
            );
        }
    } catch {
        // Fallback to midpoint if tessellation fails
    }
    return { x: 0, y: 0 };
}

function getPointAtParameterWithArcLength(
    points: Point2D[],
    t: number
): Point2D {
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
            const segmentT =
                (targetLength - segmentStart) / (segmentEnd - segmentStart);

            // Interpolate between the two points
            const p1 = points[i - 1];
            const p2 = points[i];

            return {
                x: p1.x + segmentT * (p2.x - p1.x),
                y: p1.y + segmentT * (p2.y - p1.y),
            };
        }
    }

    return points[points.length - 1];
}

export function normalizeSplineWeights(spline: Spline): Spline {
    // Ensure spline has valid weights array matching control points length
    const needsWeights =
        !spline.weights ||
        spline.weights.length === 0 ||
        spline.weights.length !== spline.controlPoints.length;

    if (needsWeights) {
        return {
            ...spline,
            weights: spline.controlPoints.map(() => 1),
        };
    }

    return spline;
}

// ===== NURBS EVALUATION FUNCTIONS =====

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

// ===== NURBS UTILITIES FUNCTIONS =====

/**
 * Generate a uniform knot vector for NURBS curve
 * This is the standard implementation that consolidates all duplicates across the codebase
 *
 * @param numControlPoints Number of control points
 * @param degree Degree of the curve
 * @returns Array of knot values forming a uniform clamped knot vector
 */
export function generateUniformKnotVector(
    numControlPoints: number,
    degree: number
): number[] {
    const validKnots: number[] = [];

    // Add degree + 1 zeros at the start (clamping)
    for (let i = 0; i <= degree; i++) {
        validKnots.push(0);
    }

    // Add internal knots uniformly spaced
    const numInternalKnots = numControlPoints - degree - 1;
    for (let i = 1; i <= numInternalKnots; i++) {
        validKnots.push(i / (numInternalKnots + 1));
    }

    // Add degree + 1 ones at the end (clamping)
    for (let i = 0; i <= degree; i++) {
        validKnots.push(1);
    }

    return validKnots;
}

/**
 * Generate a valid knot vector for NURBS curve - alias for backward compatibility
 * @param controlPointsLength Number of control points
 * @param degree Degree of the curve
 * @returns Array of knot values
 */
export function generateValidKnotVector(
    controlPointsLength: number,
    degree: number
): number[] {
    return generateUniformKnotVector(controlPointsLength, degree);
}

/**
 * Validate a knot vector for NURBS curve
 * Checks if the knot vector has the correct length and is properly formed
 *
 * @param knots Knot vector to validate
 * @param numControlPoints Number of control points
 * @param degree Curve degree
 * @returns Validation result
 */
export function validateKnotVector(
    knots: number[],
    numControlPoints: number,
    degree: number
): ValidationResult {
    const expectedLength = numControlPoints + degree + 1;

    if (!knots || !Array.isArray(knots)) {
        return { isValid: false, error: 'Knot vector must be an array' };
    }

    if (knots.length !== expectedLength) {
        return {
            isValid: false,
            error: `Knot vector length ${knots.length} does not match expected length ${expectedLength}`,
        };
    }

    // Check if knots are non-decreasing
    for (let i = 1; i < knots.length; i++) {
        if (knots[i] < knots[i - 1]) {
            return {
                isValid: false,
                error: 'Knot vector must be non-decreasing',
            };
        }
    }

    // Check for proper clamping (first and last knots should have multiplicity degree + 1)
    const firstKnot = knots[0];
    const lastKnot = knots[knots.length - 1];

    let firstMultiplicity = 0;
    let lastMultiplicity = 0;

    for (let i = 0; i < knots.length && knots[i] === firstKnot; i++) {
        firstMultiplicity++;
    }

    for (let i = knots.length - 1; i >= 0 && knots[i] === lastKnot; i--) {
        lastMultiplicity++;
    }

    if (firstMultiplicity < degree + 1) {
        return {
            isValid: false,
            error: `First knot multiplicity ${firstMultiplicity} is less than degree + 1 (${degree + 1})`,
        };
    }

    if (lastMultiplicity < degree + 1) {
        return {
            isValid: false,
            error: `Last knot multiplicity ${lastMultiplicity} is less than degree + 1 (${degree + 1})`,
        };
    }

    return { isValid: true };
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
export function repairKnotVector(
    knots: number[],
    numControlPoints: number,
    degree: number
): number[] {
    // Always generate a fresh uniform knot vector for repairs
    return generateUniformKnotVector(numControlPoints, degree);
}

// ===== TESSELLATION FUNCTIONS =====

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

/**
 * Default tessellation configuration
 */
const DEFAULT_CONFIG: Required<SplineTessellationConfig> = {
    method: 'verb-nurbs',
    numSamples: 50,
    tolerance: CHAIN_CLOSURE_TOLERANCE,
    maxSamples: MAX_SPLINE_TESSELLATION_SAMPLES,
    minSamples: STANDARD_GRID_SPACING,
    timeoutMs: STANDARD_TESSELLATION_TIMEOUT_MS,
};

/**
 * Create verb curve for sampling and return it with domain
 */
function createVerbCurveForSampling(spline: Spline): {
    curve: VerbCurve;
    domain: { min: number; max: number };
} {
    const controlPoints3D: number[][] = spline.controlPoints.map((p) => [
        p.x,
        p.y,
        0,
    ]);
    const curve: VerbCurve = verb.geom.NurbsCurve.byControlPoints(
        controlPoints3D,
        spline.degree
    );
    const domain: { min: number; max: number } = curve.domain();

    return { curve, domain };
}

/**
 * Tessellate a spline into a polyline approximation with multiple fallback strategies
 *
 * @param spline The spline to tessellate
 * @param config Tessellation configuration
 * @returns Tessellation result with points and metadata
 */
export function tessellateSpline(
    spline: Spline,
    config: Partial<SplineTessellationConfig> = {}
): SplineTessellationResult {
    const fullConfig: Required<SplineTessellationConfig> = {
        ...DEFAULT_CONFIG,
        ...config,
    };
    const startTime: number = Date.now();

    // Validate spline
    const validation: string[] = validateSplineGeometry(spline);
    if (validation.length > 0) {
        return {
            success: false,
            points: [],
            methodUsed: 'none',
            warnings: [],
            errors: validation,
        };
    }

    // Try the requested method first, then fall back
    const methods: SplineTessellationConfig['method'][] = [
        fullConfig.method,
        'verb-nurbs',
        'adaptive-sampling',
        'uniform-sampling',
        'fallback',
    ];

    // Remove duplicates while preserving order
    const uniqueMethods: SplineTessellationConfig['method'][] = [
        ...new Set(methods),
    ];

    for (const method of uniqueMethods) {
        try {
            const result: SplineTessellationResult = tessellateWithMethod(
                spline,
                fullConfig,
                method,
                startTime
            );
            if (result.success) {
                return result;
            }
        } catch {
            // Continue to next method
            continue;
        }
    }

    // All methods failed - return control points as fallback
    return {
        success: true,
        points: [...spline.controlPoints],
        methodUsed: 'control-points-fallback',
        warnings: ['All tessellation methods failed, returning control points'],
        errors: [],
        metrics: {
            duration: Date.now() - startTime,
            sampleCount: spline.controlPoints.length,
        },
    };
}

/**
 * Tessellate using a specific method
 */
function tessellateWithMethod(
    spline: Spline,
    config: Required<SplineTessellationConfig>,
    method: SplineTessellationConfig['method'],
    startTime: number
): SplineTessellationResult {
    switch (method) {
        case 'verb-nurbs':
            return tessellateWithVerbNurbs(spline, config, startTime);
        case 'adaptive-sampling':
            return tessellateWithAdaptiveSampling(spline, config, startTime);
        case 'uniform-sampling':
            return tessellateWithUniformSampling(spline, config, startTime);
        case 'fallback':
            return tessellateWithFallback(spline, config, startTime);
        default:
            throw new Error(`Unknown tessellation method: ${method}`);
    }
}

/**
 * Check if a knot vector has proper clamped NURBS format
 */
function isClampedKnotVector(knots: number[], degree: number): boolean {
    if (knots.length < 2 * (degree + 1)) return false;

    // Check start repeats
    const startVal = knots[0];
    for (let i = 0; i <= degree; i++) {
        if (knots[i] !== startVal) return false;
    }

    // Check end repeats
    const endVal = knots[knots.length - 1];
    for (let i = knots.length - degree - 1; i < knots.length; i++) {
        if (knots[i] !== endVal) return false;
    }

    return true;
}

/**
 * Convert uniform or invalid knot vectors to proper clamped NURBS format
 *
 * @param knots Original knot vector
 * @param degree Spline degree
 * @param numControlPoints Number of control points
 * @returns Properly formatted clamped knot vector
 */
function convertToClampedKnotVector(
    knots: number[],
    degree: number,
    numControlPoints: number
): number[] {
    // Check if already clamped
    if (isClampedKnotVector(knots, degree)) {
        return knots;
    }

    // Generate proper clamped knot vector: [0,0,0,0, interior_knots, 1,1,1,1]
    const clampedKnots: number[] = [];

    // Add degree+1 zeros at start
    for (let i = 0; i <= degree; i++) {
        clampedKnots.push(0);
    }

    // Add interior knots (normalized to [0,1] range)
    const interiorCount = numControlPoints - degree - 1;
    for (let i = 1; i < interiorCount; i++) {
        clampedKnots.push(i / interiorCount);
    }

    // Add degree+1 ones at end
    for (let i = 0; i <= degree; i++) {
        clampedKnots.push(1);
    }

    return clampedKnots;
}

/**
 * Tessellate using verb-nurbs library (primary method)
 */
function tessellateWithVerbNurbs(
    spline: Spline,
    config: Required<SplineTessellationConfig>,
    startTime: number
): SplineTessellationResult {
    const warnings: string[] = [];

    try {
        // Convert control points to 3D format for verb
        const controlPoints3D: number[][] = spline.controlPoints.map((p) => [
            p.x,
            p.y,
            0,
        ]);

        // Create verb NURBS curve
        let curve: VerbCurve;
        try {
            // First try with original knots
            curve = verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                spline.degree,
                spline.knots,
                controlPoints3D,
                spline.weights || spline.controlPoints.map(() => 1)
            );
        } catch {
            // Try with converted clamped knot vector
            try {
                const clampedKnots = convertToClampedKnotVector(
                    spline.knots,
                    spline.degree,
                    spline.controlPoints.length
                );
                curve = verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                    spline.degree,
                    clampedKnots,
                    controlPoints3D,
                    spline.weights || spline.controlPoints.map(() => 1)
                );
                warnings.push('Converted knot vector to clamped format');
            } catch {
                // Final fallback to simplified verb constructor
                curve = verb.geom.NurbsCurve.byControlPoints(
                    controlPoints3D,
                    spline.degree
                );
                warnings.push(
                    'Fell back to simplified verb NURBS construction'
                );
            }
        }

        // Check timeout
        if (Date.now() - startTime > config.timeoutMs) {
            throw new Error(
                'Verb NURBS tessellation timed out during curve creation'
            );
        }

        // Tessellate using verb's native tessellation
        const tessellatedPoints: number[][] = curve.tessellate();

        if (!tessellatedPoints || tessellatedPoints.length === 0) {
            throw new Error('Verb tessellation produced no points');
        }

        // Convert back to 2D points
        const points2D: Point2D[] = tessellatedPoints.map((p) => ({
            x: p[0],
            y: p[1],
        }));

        // Ensure closure for closed splines
        if (spline.closed && points2D.length > 2) {
            const firstPoint: Point2D = points2D[0];
            const lastPoint: Point2D = points2D[points2D.length - 1];
            const distance: number = Math.sqrt(
                Math.pow(lastPoint.x - firstPoint.x, 2) +
                    Math.pow(lastPoint.y - firstPoint.y, 2)
            );

            if (distance > GEOMETRIC_PRECISION_TOLERANCE) {
                points2D[points2D.length - 1] = { ...firstPoint };
                warnings.push('Adjusted last point to ensure spline closure');
            }
        }

        return {
            success: true,
            points: points2D,
            methodUsed: 'verb-nurbs',
            warnings,
            errors: [],
            metrics: {
                duration: Date.now() - startTime,
                sampleCount: points2D.length,
            },
        };
    } catch (error) {
        throw new Error(`Verb NURBS tessellation failed: ${error}`);
    }
}

/**
 * Tessellate using adaptive sampling based on curvature
 */
function tessellateWithAdaptiveSampling(
    spline: Spline,
    config: Required<SplineTessellationConfig>,
    startTime: number
): SplineTessellationResult {
    const warnings: string[] = [];

    try {
        const { curve, domain } = createVerbCurveForSampling(spline);
        const points: Point2D[] = [];

        // Adaptive sampling algorithm
        const sampleQueue: { t: number; level: number }[] = [
            { t: domain.min, level: 0 },
            { t: domain.max, level: 0 },
        ];

        let iterations: number = 0;
        const maxIterations: number = MAX_INTENSIVE_ITERATIONS; // Prevent infinite loops

        while (sampleQueue.length > 0 && iterations < maxIterations) {
            if (Date.now() - startTime > config.timeoutMs) {
                throw new Error('Adaptive sampling timed out');
            }

            iterations++;

            // Sort by parameter value
            sampleQueue.sort((a, b) => a.t - b.t);

            // Find the largest gap
            let maxGap: number = 0;
            let maxGapIndex: number = DEFAULT_ARRAY_NOT_FOUND_INDEX;

            for (let i: number = 0; i < sampleQueue.length - 1; i++) {
                const gap: number = sampleQueue[i + 1].t - sampleQueue[i].t;
                if (gap > maxGap) {
                    maxGap = gap;
                    maxGapIndex = i;
                }
            }

            if (
                maxGapIndex === DEFAULT_ARRAY_NOT_FOUND_INDEX ||
                maxGap < INTERSECTION_TOLERANCE
            )
                break;

            const t1: number = sampleQueue[maxGapIndex].t;
            const t2: number = sampleQueue[maxGapIndex + 1].t;
            const tMid: number = (t1 + t2) / 2;

            // Check if we need to subdivide based on curvature
            const p1: number[] = curve.point(t1);
            const p2: number[] = curve.point(t2);
            const pMid: number[] = curve.point(tMid);

            // Calculate chord deviation
            const chordMid: number[] = [
                (p1[0] + p2[0]) / 2,
                (p1[1] + p2[1]) / 2,
            ];

            const deviation: number = Math.sqrt(
                Math.pow(pMid[0] - chordMid[0], 2) +
                    Math.pow(pMid[1] - chordMid[1], 2)
            );

            // Subdivide if deviation exceeds tolerance
            if (
                deviation > config.tolerance &&
                sampleQueue.length < config.maxSamples
            ) {
                sampleQueue.splice(maxGapIndex + 1, 0, {
                    t: tMid,
                    level:
                        Math.max(
                            sampleQueue[maxGapIndex].level,
                            sampleQueue[maxGapIndex + 1].level
                        ) + 1,
                });
            } else {
                break; // Stop subdividing
            }
        }

        // Generate final points
        sampleQueue.sort((a, b) => a.t - b.t);
        for (const sample of sampleQueue) {
            const point: number[] = curve.point(sample.t);
            points.push({ x: point[0], y: point[1] });
        }

        if (iterations >= maxIterations) {
            warnings.push('Adaptive sampling hit iteration limit');
        }

        return {
            success: true,
            points,
            methodUsed: 'adaptive-sampling',
            warnings,
            errors: [],
            metrics: {
                duration: Date.now() - startTime,
                sampleCount: points.length,
                iterations,
            },
        };
    } catch (error) {
        throw new Error(`Adaptive sampling failed: ${error}`);
    }
}

/**
 * Tessellate using uniform parameter sampling
 */
function tessellateWithUniformSampling(
    spline: Spline,
    config: Required<SplineTessellationConfig>,
    startTime: number
): SplineTessellationResult {
    try {
        const { curve, domain } = createVerbCurveForSampling(spline);
        const points: Point2D[] = [];

        // Uniform sampling
        for (let i: number = 0; i <= config.numSamples; i++) {
            if (Date.now() - startTime > config.timeoutMs) {
                throw new Error('Uniform sampling timed out');
            }

            const t: number =
                domain.min +
                (i / config.numSamples) * (domain.max - domain.min);
            const point = curve.point(t);
            points.push({ x: point[0], y: point[1] });
        }

        return {
            success: true,
            points,
            methodUsed: 'uniform-sampling',
            warnings: [],
            errors: [],
            metrics: {
                duration: Date.now() - startTime,
                sampleCount: points.length,
            },
        };
    } catch (error) {
        throw new Error(`Uniform sampling failed: ${error}`);
    }
}

/**
 * Fallback tessellation using control points and fit points
 */
function tessellateWithFallback(
    spline: Spline,
    config: Required<SplineTessellationConfig>,
    startTime: number
): SplineTessellationResult {
    const warnings: string[] = [];
    const points: Point2D[] = [];

    // Use fit points if available and reasonable
    if (spline.fitPoints && spline.fitPoints.length >= 2) {
        points.push(...spline.fitPoints);
        warnings.push('Used fit points for tessellation');
    } else {
        // Fall back to control points
        points.push(...spline.controlPoints);
        warnings.push('Used control points for tessellation');
    }

    // For closed splines, ensure closure
    if (spline.closed && points.length > 2) {
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        const distance: number = Math.sqrt(
            Math.pow(lastPoint.x - firstPoint.x, 2) +
                Math.pow(lastPoint.y - firstPoint.y, 2)
        );

        if (distance > GEOMETRIC_PRECISION_TOLERANCE) {
            points.push({ ...firstPoint });
            warnings.push('Added closure point for closed spline');
        }
    }

    return {
        success: true,
        points,
        methodUsed: 'fallback',
        warnings,
        errors: [],
        metrics: {
            duration: Date.now() - startTime,
            sampleCount: points.length,
        },
    };
}

/**
 * Validate spline geometry for tessellation
 *
 * @param spline Spline to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateSplineGeometry(spline: Spline): string[] {
    const errors: string[] = [];

    // Check control points
    if (!spline.controlPoints || spline.controlPoints.length < 2) {
        errors.push('Spline must have at least 2 control points');
        return errors; // Early return to prevent further null access
    }

    // Check degree
    if (spline.degree < 1) {
        errors.push('Spline degree must be at least 1');
    }

    if (spline.controlPoints && spline.degree >= spline.controlPoints.length) {
        errors.push(
            `Spline degree (${spline.degree}) must be less than number of control points (${spline.controlPoints.length})`
        );
    }

    // Check knots
    if (spline.knots) {
        const expectedKnots: number =
            spline.controlPoints.length + spline.degree + 1;
        if (spline.knots.length !== expectedKnots) {
            errors.push(
                `Expected ${expectedKnots} knots but got ${spline.knots.length}`
            );
        }

        // Check knot sequence (should be non-decreasing)
        for (let i: number = 1; i < spline.knots.length; i++) {
            if (spline.knots[i] < spline.knots[i - 1]) {
                errors.push('Knot sequence must be non-decreasing');
                break;
            }
        }
    }

    // Check weights
    if (
        spline.weights &&
        spline.weights.length !== spline.controlPoints.length
    ) {
        errors.push('Number of weights must match number of control points');
    }

    if (spline.weights) {
        for (let i: number = 0; i < spline.weights.length; i++) {
            if (spline.weights[i] <= 0) {
                errors.push('All weights must be positive');
                break;
            }
        }
    }

    // Check for duplicate control points
    if (spline.controlPoints) {
        for (let i: number = 1; i < spline.controlPoints.length; i++) {
            const prev: Point2D = spline.controlPoints[i - 1];
            const curr: Point2D = spline.controlPoints[i];
            const distance: number = Math.sqrt(
                Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
            );
            if (distance < EPSILON) {
                errors.push('Control points should not be duplicated');
                break;
            }
        }
    }

    return errors;
}

/**
 * Create adaptive tessellation configuration based on spline complexity
 *
 * @param spline The spline to analyze
 * @param targetTolerance Desired tessellation accuracy
 * @returns Optimized configuration for the spline
 */
export function createAdaptiveTessellationConfig(
    spline: Spline,
    targetTolerance: number = CHAIN_CLOSURE_TOLERANCE
): SplineTessellationConfig {
    // Estimate complexity based on spline properties
    const numControlPoints: number = spline.controlPoints.length;
    const degree: number = spline.degree;
    const hasWeights: boolean =
        spline.weights &&
        spline.weights.some((w) => Math.abs(w - 1) > INTERSECTION_TOLERANCE);

    // Calculate spline "complexity score"
    let complexityScore: number = numControlPoints * degree;
    if (hasWeights) complexityScore *= SPLINE_COMPLEXITY_WEIGHT_MULTIPLIER;
    if (spline.closed) complexityScore *= CLOSED_SPLINE_COMPLEXITY_MULTIPLIER;

    // Choose method based on complexity
    let method: SplineTessellationConfig['method'] = 'verb-nurbs';
    let numSamples: number = Math.min(
        MAX_SPLINE_TESSELLATION_SAMPLES,
        Math.max(STANDARD_TESSELLATION_COUNT, complexityScore * 2)
    );

    if (complexityScore < STANDARD_GRID_SPACING) {
        method = 'uniform-sampling';
        numSamples = STANDARD_TESSELLATION_COUNT;
    } else if (complexityScore > SPLINE_SAMPLE_COUNT) {
        method = 'adaptive-sampling';
    }

    return {
        method,
        numSamples,
        tolerance: targetTolerance,
        maxSamples: Math.min(
            MAX_ADAPTIVE_TESSELLATION_SAMPLES,
            numSamples * TESSELLATION_SAMPLE_MULTIPLIER
        ),
        minSamples: Math.max(
            STANDARD_GRID_SPACING,
            Math.floor(numSamples / TESSELLATION_SAMPLE_MULTIPLIER)
        ),
        timeoutMs:
            complexityScore > MAX_ITERATIONS
                ? HIGH_COMPLEXITY_TIMEOUT_MS
                : STANDARD_TESSELLATION_TIMEOUT_MS,
    };
}

/**
 * Estimate the arc length of a spline using tessellation
 *
 * @param spline The spline to measure
 * @param config Tessellation configuration
 * @returns Estimated arc length
 */
export function estimateSplineArcLength(
    spline: Spline,
    config?: Partial<SplineTessellationConfig>
): number {
    const result: SplineTessellationResult = tessellateSpline(spline, {
        ...config,
        method: 'uniform-sampling',
        numSamples: SPLINE_SAMPLE_COUNT,
    });

    if (!result.success || result.points.length < 2) {
        return 0;
    }

    let length: number = 0;
    for (let i: number = 1; i < result.points.length; i++) {
        const p1: Point2D = result.points[i - 1];
        const p2: Point2D = result.points[i];
        length += Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
        );
    }

    return length;
}

/**
 * Simplify a tessellated spline by removing redundant points
 *
 * @param points Tessellated points
 * @param tolerance Maximum allowed deviation from original curve
 * @returns Simplified point array
 */
export function simplifyTessellatedSpline(
    points: Point2D[],
    tolerance: number = CHAIN_CLOSURE_TOLERANCE
): Point2D[] {
    if (points.length <= 2) {
        return [...points];
    }

    const simplified: Point2D[] = [points[0]]; // Always keep first point

    for (let i: number = 1; i < points.length - 1; i++) {
        const prev: Point2D = simplified[simplified.length - 1];
        const current: Point2D = points[i];
        const next: Point2D = points[i + 1];

        // Calculate distance from current point to line between prev and next
        const A: number = next.y - prev.y;
        const B: number = prev.x - next.x;
        const C: number = next.x * prev.y - prev.x * next.y;

        const distance: number =
            Math.abs(A * current.x + B * current.y + C) /
            Math.sqrt(A * A + B * B);

        // Keep point if it's significant
        if (distance > tolerance) {
            simplified.push(current);
        }
    }

    simplified.push(points[points.length - 1]); // Always keep last point

    return simplified;
}
