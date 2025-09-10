/**
 * Ellipse Utilities Library
 *
 * Consolidates ellipse calculation functions from:
 * - src/lib/utils/ellipse-utils.ts
 * - src/lib/geometry/ellipse.ts
 * - src/lib/geometry/ellipse-tessellation.ts
 */

import type { Point2D } from '../../types/geometry';
import type { Ellipse, EllipseTessellationConfig } from './interfaces';
import { EPSILON, GEOMETRIC_PRECISION_TOLERANCE } from '../../constants';
import { MIN_TESSELLATION_POINTS, MAX_TESSELLATION_POINTS } from './constants';

/**
 * Calculate a point on an ellipse at a given parameter value
 * Consolidates calculateEllipsePoint from tessellation.ts
 */
export function calculateEllipsePoint(
    ellipse: Ellipse,
    param: number,
    majorAxisLength: number,
    minorAxisLength: number,
    majorAxisAngle: number
): Point2D {
    const x: number = majorAxisLength * Math.cos(param);
    const y: number = minorAxisLength * Math.sin(param);

    const rotatedX: number =
        x * Math.cos(majorAxisAngle) - y * Math.sin(majorAxisAngle);
    const rotatedY: number =
        x * Math.sin(majorAxisAngle) + y * Math.cos(majorAxisAngle);

    return {
        x: ellipse.center.x + rotatedX,
        y: ellipse.center.y + rotatedY,
    };
}

/**
 * Calculate an ellipse point with rotation - convenience function
 * Consolidates similar logic from geometric-operations.ts
 */
export function calculateEllipsePointWithRotation(
    center: Point2D,
    majorAxis: number,
    minorAxis: number,
    angle: number,
    param: number
): Point2D {
    const x: number = majorAxis * Math.cos(param);
    const y: number = minorAxis * Math.sin(param);

    const rotatedX: number = x * Math.cos(angle) - y * Math.sin(angle);
    const rotatedY: number = x * Math.sin(angle) + y * Math.cos(angle);

    return {
        x: center.x + rotatedX,
        y: center.y + rotatedY,
    };
}

/**
 * Generate multiple points along an ellipse
 * Consolidates generateEllipsePoints from geometric-operations.ts
 */
export function generateEllipsePoints(
    ellipse: Ellipse,
    startParam: number,
    endParam: number,
    numPoints: number
): Point2D[] {
    const points: Point2D[] = [];
    const majorAxisLength: number = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
            ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
    );
    const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
    const majorAxisAngle = Math.atan2(
        ellipse.majorAxisEndpoint.y,
        ellipse.majorAxisEndpoint.x
    );

    for (let i = 0; i < numPoints; i++) {
        const param =
            startParam + ((endParam - startParam) * i) / (numPoints - 1);
        points.push(
            calculateEllipsePoint(
                ellipse,
                param,
                majorAxisLength,
                minorAxisLength,
                majorAxisAngle
            )
        );
    }

    return points;
}

/**
 * Tessellate ellipse with specified number of points
 * Provides a simpler interface to ellipse tessellation
 */
export function tessellateEllipse(
    ellipse: Ellipse,
    numPoints: number
): Point2D[] {
    const majorAxisLength = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
            ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
    );
    const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
    const majorAxisAngle = Math.atan2(
        ellipse.majorAxisEndpoint.y,
        ellipse.majorAxisEndpoint.x
    );

    const isArc =
        typeof ellipse.startParam === 'number' &&
        typeof ellipse.endParam === 'number';

    if (
        isArc &&
        ellipse.startParam !== undefined &&
        ellipse.endParam !== undefined
    ) {
        // Ellipse arc - use parameter range
        let deltaParam = ellipse.endParam - ellipse.startParam;
        if (deltaParam < 0) {
            deltaParam += 2 * Math.PI;
        }

        const points: Point2D[] = [];
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const param = ellipse.startParam + t * deltaParam;
            points.push(
                calculateEllipsePoint(
                    ellipse,
                    param,
                    majorAxisLength,
                    minorAxisLength,
                    majorAxisAngle
                )
            );
        }
        return points;
    } else {
        // Full ellipse
        return generateEllipsePoints(ellipse, 0, 2 * Math.PI, numPoints);
    }
}

/**
 * Generate points along an ellipse or ellipse arc using parametric tessellation
 * with configuration options
 *
 * This function converts ellipses into polyline approximations by sampling points
 * along the ellipse curve. It handles both full ellipses and ellipse arcs.
 *
 * @param ellipse The ellipse geometry to tessellate
 * @param config Tessellation configuration
 * @returns Array of points representing the tessellated ellipse
 */
export function tessellateEllipseWithConfig(
    ellipse: Ellipse,
    config: EllipseTessellationConfig
): Point2D[] {
    const points: Point2D[] = [];

    // Calculate major and minor axis lengths from the ellipse definition
    const majorAxisLength: number = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
            ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
    );
    const minorAxisLength: number = majorAxisLength * ellipse.minorToMajorRatio;

    // Calculate rotation angle from the major axis vector
    const rotationAngle: number = Math.atan2(
        ellipse.majorAxisEndpoint.y,
        ellipse.majorAxisEndpoint.x
    );

    // Determine if this is an ellipse arc (has parameter range)
    const isArc: boolean =
        typeof ellipse.startParam === 'number' &&
        typeof ellipse.endParam === 'number';

    if (isArc) {
        // Generate points for ellipse arc
        const startParam: number = ellipse.startParam!;
        const endParam: number = ellipse.endParam!;

        // Handle counter-clockwise wrapping when endParam < startParam
        // Ellipse arcs are always counter-clockwise, so when endParam < startParam,
        // we need to wrap around by adding 2π to endParam
        let effectiveEndParam: number = endParam;
        if (endParam < startParam) {
            effectiveEndParam = endParam + 2 * Math.PI;
        }

        // Generate points along the parametric curve from startParam to effectiveEndParam
        for (let i: number = 0; i <= config.numPoints; i++) {
            const t: number =
                startParam +
                (i / config.numPoints) * (effectiveEndParam - startParam);
            const point: Point2D = evaluateEllipseAtParameter(
                ellipse.center,
                majorAxisLength,
                minorAxisLength,
                rotationAngle,
                t
            );
            points.push(point);
        }
    } else {
        // Generate points for full ellipse
        // Generate points for the ellipse, with optional closure
        for (let i: number = 0; i < config.numPoints; i++) {
            const t: number = (2 * Math.PI * i) / config.numPoints;
            const point: Point2D = evaluateEllipseAtParameter(
                ellipse.center,
                majorAxisLength,
                minorAxisLength,
                rotationAngle,
                t
            );
            points.push(point);
        }

        // Add the first point again at the end if closing the path
        if (config.closePath && points.length > 0) {
            points.push({ ...points[0] });
        }
    }

    return points;
}

/**
 * Evaluate a point on an ellipse at a given parameter value
 *
 * Uses the parametric ellipse equation:
 * x = center.x + a*cos(t)*cos(rot) - b*sin(t)*sin(rot)
 * y = center.y + a*cos(t)*sin(rot) + b*sin(t)*cos(rot)
 *
 * Where:
 * - a = majorAxisLength
 * - b = minorAxisLength
 * - rot = rotationAngle
 * - t = parameter value
 *
 * @param center Center point of the ellipse
 * @param majorAxisLength Length of the major axis
 * @param minorAxisLength Length of the minor axis
 * @param rotationAngle Rotation angle of the ellipse in radians
 * @param t Parameter value (0 to 2π for full ellipse)
 * @returns Point on the ellipse at parameter t
 */
export function evaluateEllipseAtParameter(
    center: Point2D,
    majorAxisLength: number,
    minorAxisLength: number,
    rotationAngle: number,
    t: number
): Point2D {
    // Calculate point on axis-aligned ellipse
    const x: number = majorAxisLength * Math.cos(t);
    const y: number = minorAxisLength * Math.sin(t);

    // Apply rotation transformation
    const cosRot: number = Math.cos(rotationAngle);
    const sinRot: number = Math.sin(rotationAngle);

    const rotatedX: number = x * cosRot - y * sinRot;
    const rotatedY: number = x * sinRot + y * cosRot;

    // Translate to ellipse center
    return {
        x: center.x + rotatedX,
        y: center.y + rotatedY,
    };
}

/**
 * Get start and end points of an ellipse
 * Consolidates logic from ellipse.ts
 */
export function getEllipseStartEndPoints(ellipse: Ellipse): {
    start: Point2D;
    end: Point2D;
} {
    const majorAxisLength = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
            ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
    );
    const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
    const majorAxisAngle = Math.atan2(
        ellipse.majorAxisEndpoint.y,
        ellipse.majorAxisEndpoint.x
    );

    if (
        typeof ellipse.startParam === 'number' &&
        typeof ellipse.endParam === 'number'
    ) {
        // For ellipse arcs, use parameter values
        const start = calculateEllipsePoint(
            ellipse,
            ellipse.startParam,
            majorAxisLength,
            minorAxisLength,
            majorAxisAngle
        );
        const end = calculateEllipsePoint(
            ellipse,
            ellipse.endParam,
            majorAxisLength,
            minorAxisLength,
            majorAxisAngle
        );
        return { start, end };
    } else {
        // For full ellipses, start and end are the same (rightmost point)
        const point = {
            x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
            y: ellipse.center.y + ellipse.majorAxisEndpoint.y,
        };
        return { start: point, end: point };
    }
}

/**
 * Calculate ellipse axis lengths and angle
 * Helper function used by many ellipse operations
 */
export function getEllipseParameters(ellipse: Ellipse): {
    majorAxisLength: number;
    minorAxisLength: number;
    majorAxisAngle: number;
} {
    const majorAxisLength = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
            ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
    );
    const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
    const majorAxisAngle = Math.atan2(
        ellipse.majorAxisEndpoint.y,
        ellipse.majorAxisEndpoint.x
    );

    return { majorAxisLength, minorAxisLength, majorAxisAngle };
}

/**
 * Determine if an ellipse represents a full ellipse (closed) or an arc
 * A full ellipse has either no start/end parameters or spans approximately 2π
 */
export function isFullEllipse(ellipse: Ellipse): boolean {
    // If no start/end parameters, it's a full ellipse
    if (
        typeof ellipse.startParam !== 'number' ||
        typeof ellipse.endParam !== 'number'
    ) {
        return true;
    }

    // Calculate parameter span
    let paramSpan = ellipse.endParam - ellipse.startParam;
    if (paramSpan < 0) {
        paramSpan += 2 * Math.PI;
    }

    // Consider it a full ellipse if span is approximately 2π (within small tolerance)
    const fullCircle = 2 * Math.PI;
    const tolerance = EPSILON;
    return Math.abs(paramSpan - fullCircle) < tolerance;
}

/**
 * Determine if an ellipse is closed (represents a full ellipse) or open (ellipse arc)
 *
 * This function consolidates the ellipse closed detection logic used across the application:
 * - If no start/end parameters exist, assume it's a full closed ellipse
 * - If start parameter is near 0 and end parameter is near 2π, it's a full closed ellipse
 * - Otherwise, it's an open ellipse arc
 *
 * @param ellipse - The ellipse geometry to check
 * @param tolerance - Numeric tolerance for comparing parameter values (default: 0.001)
 * @returns true if ellipse is closed (full ellipse), false if open (ellipse arc)
 */
export function isEllipseClosed(
    ellipse: Ellipse,
    tolerance: number = GEOMETRIC_PRECISION_TOLERANCE
): boolean {
    // If no start/end parameters, assume it's a full closed ellipse
    if (
        typeof ellipse.startParam !== 'number' ||
        typeof ellipse.endParam !== 'number'
    ) {
        return true;
    }

    // Check if it's a full ellipse (start ≈ 0, end ≈ 2π)
    const startParam = ellipse.startParam;
    const endParam = ellipse.endParam;
    const fullCircle = 2 * Math.PI;

    // Consider it a full ellipse if start is near 0 and end is near 2π
    const isFullEllipse =
        Math.abs(startParam) < tolerance &&
        Math.abs(endParam - fullCircle) < tolerance;

    return isFullEllipse;
}

/**
 * Calculate distance from a point to an ellipse perimeter
 * Returns the minimum distance from the point to the ellipse outline
 */
export function distanceFromEllipsePerimeter(
    point: Point2D,
    ellipse: Ellipse
): number {
    const { majorAxisLength, minorAxisLength, majorAxisAngle } =
        getEllipseParameters(ellipse);

    // Transform point to ellipse coordinate system (centered at origin, aligned with axes)
    const dx = point.x - ellipse.center.x;
    const dy = point.y - ellipse.center.y;
    const rotatedX =
        dx * Math.cos(-majorAxisAngle) - dy * Math.sin(-majorAxisAngle);
    const rotatedY =
        dx * Math.sin(-majorAxisAngle) + dy * Math.cos(-majorAxisAngle);

    // Normalize coordinates by axis lengths
    const normalizedX = rotatedX / majorAxisLength;
    const normalizedY = rotatedY / minorAxisLength;

    // Calculate distance from unit ellipse (where both axes = 1)
    const distanceFromUnit = Math.sqrt(
        normalizedX * normalizedX + normalizedY * normalizedY
    );

    // Convert back to actual distance
    // For points on the ellipse perimeter, distanceFromUnit = 1
    // Distance from perimeter = |distanceFromUnit - 1| * minimum axis length
    return (
        Math.abs(distanceFromUnit - 1) *
        Math.min(majorAxisLength, minorAxisLength)
    );
}

// Functions from ellipse.ts

export function getEllipseStartPoint(ellipse: Ellipse): Point2D {
    if (typeof ellipse.startParam === 'number') {
        // For ellipse arcs, calculate start point from start parameter
        const { majorAxisLength, minorAxisLength, majorAxisAngle } =
            getEllipseParameters(ellipse);
        return calculateEllipsePoint(
            ellipse,
            ellipse.startParam,
            majorAxisLength,
            minorAxisLength,
            majorAxisAngle
        );
    } else {
        // For full ellipses, use rightmost point (parameter 0)
        return {
            x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
            y: ellipse.center.y + ellipse.majorAxisEndpoint.y,
        };
    }
}

export function getEllipseEndPoint(ellipse: Ellipse): Point2D {
    if (typeof ellipse.endParam === 'number') {
        // For ellipse arcs, calculate end point from end parameter
        const { majorAxisLength, minorAxisLength, majorAxisAngle } =
            getEllipseParameters(ellipse);
        return calculateEllipsePoint(
            ellipse,
            ellipse.endParam,
            majorAxisLength,
            minorAxisLength,
            majorAxisAngle
        );
    } else {
        // For full ellipses, start and end points are the same (rightmost point at parameter 0)
        return {
            x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
            y: ellipse.center.y + ellipse.majorAxisEndpoint.y,
        };
    }
}

export function reverseEllipse(ellipse: Ellipse): Ellipse {
    // For ellipses, swap start and end parameters to reverse direction
    const startParam: number = ellipse.startParam ?? 0;
    const endParam: number = ellipse.endParam ?? 2 * Math.PI;
    return {
        ...ellipse,
        startParam: endParam,
        endParam: startParam,
    };
}

export function getEllipsePointAt(
    ellipse: Ellipse,
    t: number,
    tessellationFn?: (
        ellipse: Ellipse,
        config: EllipseTessellationConfig
    ) => Point2D[]
): Point2D {
    try {
        const tessellator = tessellationFn || tessellateEllipseWithConfig;
        const points: Point2D[] = tessellator(ellipse, {
            numPoints: 32,
        });
        if (points.length > 0) {
            const index: number = Math.min(
                Math.floor(t * (points.length - 1)),
                points.length - 1
            );
            return points[index];
        }
    } catch {
        // Fallback to midpoint if tessellation fails
    }
    return { x: 0, y: 0 };
}

/**
 * Get the major axis radius (radiusX) from the new ellipse format
 */
export function getEllipseRadiusX(ellipse: Ellipse): number {
    const { majorAxisLength } = getEllipseParameters(ellipse);
    return majorAxisLength;
}

/**
 * Get the minor axis radius (radiusY) from the new ellipse format
 */
export function getEllipseRadiusY(ellipse: Ellipse): number {
    const { minorAxisLength } = getEllipseParameters(ellipse);
    return minorAxisLength;
}

/**
 * Get the rotation angle of the ellipse from the major axis endpoint
 */
export function getEllipseRotation(ellipse: Ellipse): number {
    const { majorAxisAngle } = getEllipseParameters(ellipse);
    return majorAxisAngle;
}

/**
 * Calculate the approximate arc length of an ellipse or ellipse arc
 *
 * Uses Ramanujan's approximation for ellipse arc length, which is accurate
 * for most practical applications.
 *
 * @param ellipse The ellipse geometry
 * @returns Approximate arc length
 */
export function calculateEllipseArcLength(ellipse: Ellipse): number {
    const majorAxisLength: number = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
            ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
    );
    const minorAxisLength: number = majorAxisLength * ellipse.minorToMajorRatio;

    const a: number = Math.max(majorAxisLength, minorAxisLength);
    const b: number = Math.min(majorAxisLength, minorAxisLength);

    // Ramanujan's approximation for ellipse circumference
    const h: number = Math.pow((a - b) / (a + b), 2);
    const fullCircumference: number =
        // eslint-disable-next-line no-magic-numbers
        Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));

    // If this is an arc, calculate the fraction of the full circumference
    const isArc: boolean =
        typeof ellipse.startParam === 'number' &&
        typeof ellipse.endParam === 'number';
    if (isArc) {
        const startParam: number = ellipse.startParam!;
        const endParam: number = ellipse.endParam!;
        const parameterRange: number = Math.abs(endParam - startParam);
        const fractionOfFullEllipse: number = parameterRange / (2 * Math.PI);
        return fullCircumference * fractionOfFullEllipse;
    }

    return fullCircumference;
}

/**
 * Create adaptive tessellation configuration based on ellipse size and curvature
 *
 * Automatically determines appropriate number of points based on:
 * - Ellipse size (larger ellipses need more points)
 * - Aspect ratio (more eccentric ellipses need more points)
 * - Target chord tolerance (maximum distance from chord to curve)
 *
 * @param ellipse The ellipse to tessellate
 * @param chordTolerance Maximum allowed distance from tessellation chords to true curve
 * @param minPoints Minimum number of points (default: 8)
 * @param maxPoints Maximum number of points (default: 200)
 * @returns Adaptive tessellation configuration
 */
export function createAdaptiveTessellationConfig(
    ellipse: Ellipse,
    chordTolerance: number,
    minPoints: number = MIN_TESSELLATION_POINTS,
    maxPoints: number = MAX_TESSELLATION_POINTS
): EllipseTessellationConfig {
    const majorAxisLength: number = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
            ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
    );
    const minorAxisLength: number = majorAxisLength * ellipse.minorToMajorRatio;

    // Estimate required points based on curvature and tolerance
    // For an ellipse, the maximum curvature occurs at the end of the minor axis
    // Use minimum radius for most conservative point calculation
    const minRadius: number = Math.min(majorAxisLength, minorAxisLength);

    // Approximate chord error for a circular arc: error ≈ r * (1 - cos(θ/2))
    // For small angles: error ≈ r * θ²/8
    // Solving for θ: θ ≈ sqrt(8 * error / r)
    const maxCurvatureRadius: number = minRadius; // Most curved part of ellipse

    const maxAnglePerSegment: number = Math.sqrt(
        // eslint-disable-next-line no-magic-numbers
        (8 * chordTolerance) / maxCurvatureRadius
    );

    // Calculate required number of points
    const isArc: boolean =
        typeof ellipse.startParam === 'number' &&
        typeof ellipse.endParam === 'number';
    const totalAngle: number = isArc
        ? Math.abs(ellipse.endParam! - ellipse.startParam!)
        : 2 * Math.PI;

    let requiredPoints: number = Math.ceil(totalAngle / maxAnglePerSegment);

    // Apply bounds
    requiredPoints = Math.max(minPoints, Math.min(maxPoints, requiredPoints));

    // For arcs, we need points along the curve, not including endpoints
    // For full ellipses, we want the specified number of points around the perimeter
    return {
        numPoints: requiredPoints,
        closePath: !isArc, // Only close path for full ellipses
    };
}

/**
 * Validate ellipse geometry for tessellation
 *
 * @param ellipse The ellipse to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateEllipseGeometry(ellipse: Ellipse): string[] {
    const errors: string[] = [];

    // Check for degenerate major axis
    const majorAxisLength: number = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
            ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
    );

    if (majorAxisLength <= Number.EPSILON) {
        errors.push('Major axis length is zero or negative');
    }

    // Check minor to major ratio
    if (ellipse.minorToMajorRatio <= 0) {
        errors.push('Minor to major ratio must be positive');
    }

    if (ellipse.minorToMajorRatio > 1) {
        errors.push(
            'Minor to major ratio cannot exceed 1 (minor axis cannot be larger than major axis)'
        );
    }

    // Check arc parameters if present
    const hasStartParam: boolean = typeof ellipse.startParam === 'number';
    const hasEndParam: boolean = typeof ellipse.endParam === 'number';

    if (hasStartParam !== hasEndParam) {
        errors.push(
            'Both startParam and endParam must be specified for ellipse arcs, or neither for full ellipses'
        );
    }

    if (hasStartParam && hasEndParam) {
        const startParam: number = ellipse.startParam!;
        const endParam: number = ellipse.endParam!;

        if (!isFinite(startParam) || !isFinite(endParam)) {
            errors.push('Arc parameters must be finite numbers');
        }

        if (Math.abs(endParam - startParam) < Number.EPSILON) {
            errors.push(
                'Arc parameter range is too small (start and end parameters are too close)'
            );
        }
    }

    return errors;
}
