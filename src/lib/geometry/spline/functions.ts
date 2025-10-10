import verb, { type VerbCurve, type VerbVector } from 'verb-nurbs';
import type { Point2D } from '$lib/types/geometry';
import type {
    Spline,
    SplineTessellationConfig,
    SplineTessellationResult,
    SplineValidationResult,
    ValidationResult,
} from './interfaces';
import {
    EPSILON,
    GEOMETRIC_PRECISION_TOLERANCE,
    INTERSECTION_TOLERANCE,
    STANDARD_TESSELLATION_COUNT,
} from '$lib/geometry/math';
import { MAX_ITERATIONS, STANDARD_GRID_SPACING } from '$lib/constants/index';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain';
import {
    CLOSED_SPLINE_COMPLEXITY_MULTIPLIER,
    DEFAULT_CONFIG,
    DEFAULT_SPLINE_DEGREE,
    HIGH_COMPLEXITY_TIMEOUT_MS,
    MAX_ADAPTIVE_TESSELLATION_SAMPLES,
    MAX_SPLINE_TESSELLATION_SAMPLES,
    SPLINE_COMPLEXITY_WEIGHT_MULTIPLIER,
    SPLINE_SAMPLE_COUNT,
    STANDARD_TESSELLATION_TIMEOUT_MS,
    TESSELLATION_SAMPLE_MULTIPLIER,
} from './constants';

export function getSplineStartPoint(spline: Spline): Point2D {
    return getSplinePointAt(spline, 0);
}

export function getSplineEndPoint(spline: Spline): Point2D {
    return getSplinePointAt(spline, 1);
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
    const nurbs: VerbCurve = createNurbsCurve(spline);
    const vec: VerbVector = nurbs.point(t);
    return {
        x: vec[0],
        y: vec[1],
    };
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
export function convertToClampedKnotVector(
    knots: number[],
    degree: number,
    numControlPoints: number
): number[] {
    // Check if already clamped AND normalized to [0,1]
    if (
        isClampedKnotVector(knots, degree) &&
        knots[0] === 0 &&
        knots[knots.length - 1] === 1
    ) {
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
    for (let i = 1; i <= interiorCount; i++) {
        clampedKnots.push(i / (interiorCount + 1));
    }

    // Add degree+1 ones at end
    for (let i = 0; i <= degree; i++) {
        clampedKnots.push(1);
    }

    return clampedKnots;
}

function createNurbsCurve(spline: Spline): VerbCurve {
    // Check for null or undefined control points
    if (!spline.controlPoints || spline.controlPoints.length === 0) {
        throw new Error(
            'Spline control points cannot be null, undefined, or empty'
        );
    }
    // Convert control points to 3D format for verb
    const controlPoints3D: number[][] = spline.controlPoints.map((p) => [
        p.x,
        p.y,
        0,
    ]);

    // Ensure weights array is valid
    const weights =
        !spline.weights || spline.weights.length === 0
            ? spline.controlPoints.map(() => 1)
            : spline.weights;

    // Handle missing or empty knot vector by generating uniform knot vector
    if (!spline.knots || spline.knots.length === 0) {
        const validKnots = generateUniformKnotVector(
            spline.controlPoints.length,
            spline.degree
        );
        return verb.geom.NurbsCurve.byKnotsControlPointsWeights(
            spline.degree,
            validKnots,
            controlPoints3D,
            weights
        );
    }

    // Validate knot vector before attempting to use it
    const knotValidation = validateKnotVector(
        spline.knots,
        spline.controlPoints.length,
        spline.degree
    );

    // If knot vector is invalid, convert to proper clamped format
    if (!knotValidation.isValid) {
        const clampedKnots = convertToClampedKnotVector(
            spline.knots,
            spline.degree,
            spline.controlPoints.length
        );

        return verb.geom.NurbsCurve.byKnotsControlPointsWeights(
            spline.degree,
            clampedKnots,
            controlPoints3D,
            weights
        );
    }

    // Try with validated knots (should work without warning now)
    try {
        return verb.geom.NurbsCurve.byKnotsControlPointsWeights(
            spline.degree,
            spline.knots,
            controlPoints3D,
            weights
        );
    } catch {
        // If still fails, convert to clamped format as final fallback
        const clampedKnots = convertToClampedKnotVector(
            spline.knots,
            spline.degree,
            spline.controlPoints.length
        );
        try {
            return verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                spline.degree,
                clampedKnots,
                controlPoints3D,
                weights
            );
        } catch {
            // Final fallback to simplified verb constructor
            return verb.geom.NurbsCurve.byPoints(
                controlPoints3D,
                spline.degree
            );
        }
    }
}

/**
 * Tessellate using verb-nurbs library (primary method)
 */
export function tessellateSpline(
    spline: Spline,
    config: Partial<SplineTessellationConfig> = DEFAULT_CONFIG
): SplineTessellationResult {
    const warnings: string[] = [];

    // Check if we should prefer fit points when available
    if (spline.fitPoints && spline.fitPoints.length > 0) {
        const requestedSamples = config.numSamples || DEFAULT_CONFIG.numSamples;
        // Use fit points if they provide enough density
        if (spline.fitPoints.length >= requestedSamples) {
            return {
                success: true,
                points: [...spline.fitPoints],
                methodUsed: 'fit-points',
                warnings,
                errors: [],
                metrics: {
                    duration: 0,
                    sampleCount: spline.fitPoints.length,
                },
            };
        }
    }

    // Validate spline for fundamental issues that cannot be fixed
    const errors: string[] = [];

    // Check control points (only if fit points are not available as fallback)
    if (!spline.controlPoints || spline.controlPoints.length < 2) {
        // If we have fit points, they can be used as fallback
        if (!spline.fitPoints || spline.fitPoints.length < 2) {
            errors.push(
                'Spline must have at least 2 control points or fit points'
            );
        }
    }

    // Check degree
    if (spline.degree < 1) {
        errors.push('Spline degree must be at least 1');
    }

    if (
        spline.controlPoints &&
        spline.controlPoints.length > 0 &&
        spline.degree >= spline.controlPoints.length
    ) {
        errors.push(
            `Spline degree (${spline.degree}) must be less than number of control points (${spline.controlPoints.length})`
        );
    }

    // Return early for fundamental errors that cannot be repaired
    if (errors.length > 0) {
        return {
            success: false,
            points: [],
            methodUsed: 'none',
            warnings: [],
            errors,
            metrics: {
                duration: 0,
                sampleCount: 0,
            },
        };
    }

    // Create verb NURBS curve
    let curve: VerbCurve;
    try {
        curve = createNurbsCurve(spline);
    } catch (error) {
        // Fallback to fit points or control points when NURBS creation fails
        const errorMessage =
            error instanceof Error ? error.message : String(error);
        warnings.push(
            `NURBS creation failed: ${errorMessage}, falling back to fit points`
        );

        if (spline.fitPoints && spline.fitPoints.length > 0) {
            return {
                success: true,
                points: [...spline.fitPoints],
                methodUsed: 'fit-points-fallback',
                warnings,
                errors: [],
                metrics: {
                    duration: 0,
                    sampleCount: spline.fitPoints.length,
                },
            };
        } else if (spline.controlPoints && spline.controlPoints.length > 0) {
            return {
                success: true,
                points: [...spline.controlPoints],
                methodUsed: 'control-points-fallback',
                warnings,
                errors: [],
                metrics: {
                    duration: 0,
                    sampleCount: spline.controlPoints.length,
                },
            };
        } else {
            return {
                success: false,
                points: [],
                methodUsed: 'none',
                warnings,
                errors: [errorMessage],
                metrics: {
                    duration: 0,
                    sampleCount: 0,
                },
            };
        }
    }

    // Sample points uniformly along the spline
    const numSamples = config.numSamples || DEFAULT_CONFIG.numSamples;
    const tessellatedPoints: number[][] = [];

    // numSamples represents the number of segments, so we need numSamples + 1 points
    const numPoints = numSamples + 1;

    // Handle edge cases
    if (numPoints <= 1) {
        // For single point, just return the start point
        const point = curve.point(0);
        tessellatedPoints.push(point);
    } else {
        // Normal case: sample numPoints points including endpoints
        for (let i = 0; i < numPoints; i++) {
            const u = i / (numPoints - 1); // This ensures u includes 0 and 1
            const point = curve.point(u);
            tessellatedPoints.push(point);
        }
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
        methodUsed: 'uniform-sampling',
        warnings,
        errors: [],
        metrics: {
            duration: 0,
            sampleCount: points2D.length,
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

    // Check knots (only validate if knots array is not empty)
    if (spline.knots && spline.knots.length > 0) {
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

    // Check weights (only validate if weights array is not empty)
    if (
        spline.weights &&
        spline.weights.length > 0 &&
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
} /**
 * Validates a spline geometry to ensure it has valid NURBS parameters
 */

export function validateSplineGeometry2(
    spline: Spline
): SplineValidationResult {
    if (
        !spline.controlPoints ||
        !Array.isArray(spline.controlPoints) ||
        spline.controlPoints.length < 2
    ) {
        return { isValid: false };
    }

    const degree: number = spline.degree || DEFAULT_SPLINE_DEGREE;
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
    const degree: number = spline.degree || DEFAULT_SPLINE_DEGREE;
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

/**
 * Get tangent direction for a spline geometry at start or end.
 * Uses NURBS derivative evaluation to compute the exact tangent vector.
 */
export function getSplineTangent(spline: Spline, isStart: boolean): Point2D {
    const curve: VerbCurve = createNurbsCurve(spline);
    const u: number = isStart ? 0 : 1;
    const tangentVector: VerbVector = curve.tangent(u);

    // Normalize the tangent vector to unit length
    // Verb.js returns raw derivative vectors, but lead calculations expect unit vectors
    const magnitude = Math.sqrt(
        tangentVector[0] * tangentVector[0] +
            tangentVector[1] * tangentVector[1]
    );

    if (magnitude === 0) {
        throw new Error('Cannot normalize zero-length tangent vector');
    }

    return {
        x: tangentVector[0] / magnitude,
        y: tangentVector[1] / magnitude,
    };
}
