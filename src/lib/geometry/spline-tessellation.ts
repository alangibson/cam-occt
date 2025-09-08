import verb, { type VerbCurve } from 'verb-nurbs';
import type { Point2D, Spline } from '../types/geometry';
import { EPSILON } from '../constants/index';

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
    tolerance: 0.01,
    maxSamples: 200,
    minSamples: 10,
    timeoutMs: 5000,
};

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

            if (distance > 0.001) {
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
        const maxIterations: number = 1000; // Prevent infinite loops

        while (sampleQueue.length > 0 && iterations < maxIterations) {
            if (Date.now() - startTime > config.timeoutMs) {
                throw new Error('Adaptive sampling timed out');
            }

            iterations++;

            // Sort by parameter value
            sampleQueue.sort((a, b) => a.t - b.t);

            // Find the largest gap
            let maxGap: number = 0;
            let maxGapIndex: number = -1;

            for (let i: number = 0; i < sampleQueue.length - 1; i++) {
                const gap: number = sampleQueue[i + 1].t - sampleQueue[i].t;
                if (gap > maxGap) {
                    maxGap = gap;
                    maxGapIndex = i;
                }
            }

            if (maxGapIndex === -1 || maxGap < 1e-6) break;

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

        if (distance > 0.001) {
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
    targetTolerance: number = 0.01
): SplineTessellationConfig {
    // Estimate complexity based on spline properties
    const numControlPoints: number = spline.controlPoints.length;
    const degree: number = spline.degree;
    const hasWeights: boolean =
        spline.weights && spline.weights.some((w) => Math.abs(w - 1) > 1e-6);

    // Calculate spline "complexity score"
    let complexityScore: number = numControlPoints * degree;
    if (hasWeights) complexityScore *= 1.5;
    if (spline.closed) complexityScore *= 1.2;

    // Choose method based on complexity
    let method: SplineTessellationConfig['method'] = 'verb-nurbs';
    let numSamples: number = Math.min(200, Math.max(20, complexityScore * 2));

    if (complexityScore < 10) {
        method = 'uniform-sampling';
        numSamples = 20;
    } else if (complexityScore > 100) {
        method = 'adaptive-sampling';
    }

    return {
        method,
        numSamples,
        tolerance: targetTolerance,
        maxSamples: Math.min(500, numSamples * 3),
        minSamples: Math.max(10, Math.floor(numSamples / 3)),
        timeoutMs: complexityScore > 50 ? 10000 : 5000,
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
        numSamples: 100,
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
    tolerance: number = 0.01
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
