import type { Point2D } from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import type { Line } from '$lib/geometry/line';
import type { Ellipse } from '$lib/geometry/ellipse';
import type { Circle } from '$lib/geometry/circle';
import type { Arc } from '$lib/geometry/arc';
import type { IntersectionResult } from '../algorithms/offset-calculation/chain/types';
import verb from 'verb-nurbs';
import type { CurveCurveIntersection } from 'verb-nurbs';
import { generateUniformKnotVector } from '$lib/geometry/spline';

/**
 * Verb-NURBS Integration Utilities
 *
 * Centralizes verb-nurbs curve creation and intersection processing to eliminate
 * code duplication across intersection algorithms. Provides consistent conversion
 * from MetalHead CAM geometry types to verb-nurbs curves and standardized processing
 * of intersection results.
 *
 * This library consolidates duplicate code from:
 * - src/lib/algorithms/offset-calculation/intersect/arc-ellipse/index.ts
 * - src/lib/algorithms/offset-calculation/intersect/spline-arc/index.ts
 * - src/lib/algorithms/offset-calculation/extend/common.ts
 * - src/lib/algorithms/offset-calculation/intersect/spline.ts
 * - Various other intersection modules
 */

// INTERSECTION_TOLERANCE is now imported from constants

// Type definitions for alternative intersection structures used in tests
type AlternativeIntersectionWithPoints = {
    point0: [number, number, number];
    point1: [number, number, number];
    u0: number;
    u1: number;
};

type AlternativeIntersectionWithPoint = {
    point: [number, number, number];
    u?: number;
    v?: number;
    u0?: number;
    u1?: number;
};

type ArrayIntersection = [[number, number, number], number, number];

/**
 * Convert Ellipse geometry to verb-nurbs curve
 * Handles both full ellipses and ellipse arcs
 * Following INTERSECTION.md recommendation for Ellipse-NURBS intersections
 */
export function createVerbCurveFromEllipse(ellipse: Ellipse): verb.geom.ICurve {
    const {
        center,
        majorAxisEndpoint,
        minorToMajorRatio,
        startParam,
        endParam,
    } = ellipse;

    // Calculate semi-major and semi-minor axis lengths
    const a = Math.sqrt(majorAxisEndpoint.x ** 2 + majorAxisEndpoint.y ** 2); // Semi-major axis
    const b = a * minorToMajorRatio; // Semi-minor axis

    // Get the rotation angle of the ellipse from the major axis endpoint
    const rotAngle = Math.atan2(majorAxisEndpoint.y, majorAxisEndpoint.x);
    const cosRot = Math.cos(rotAngle);
    const sinRot = Math.sin(rotAngle);

    // Create scaled and rotated axis vectors for verb-nurbs
    // verb.geom.Ellipse expects the axis vectors to encode the ellipse size
    const xAxis = [a * cosRot, a * sinRot, 0] as [number, number, number];
    const yAxis = [b * -sinRot, b * cosRot, 0] as [number, number, number];

    // Check if this is an ellipse arc or full ellipse
    if (startParam !== undefined && endParam !== undefined) {
        // This is an ellipse arc - use verb.geom.EllipseArc
        // EllipseArc constructor expects unit axis vectors and separate scale factors
        const unitXAxis = [cosRot, sinRot, 0] as [number, number, number];
        const unitYAxis = [-sinRot, cosRot, 0] as [number, number, number];

        return new verb.geom.EllipseArc(
            [center.x, center.y, 0], // center point
            unitXAxis, // unit x-axis (major axis direction)
            unitYAxis, // unit y-axis (minor axis direction)
            a, // semi-major axis length
            b, // semi-minor axis length
            startParam, // start parameter (angle in radians)
            endParam // end parameter (angle in radians)
        );
    } else {
        // This is a full ellipse - use verb.geom.Ellipse
        // Ellipse constructor expects scaled axis vectors
        return new verb.geom.Ellipse(
            [center.x, center.y, 0], // center point
            xAxis, // x-axis (scaled major axis direction)
            yAxis, // y-axis (scaled minor axis direction)
            1, // normalized scale factor for major axis
            1 // normalized scale factor for minor axis
        );
    }
}

/**
 * Convert Arc geometry to verb-nurbs curve
 * Following INTERSECTION.md recommendation for Arc-NURBS intersections
 */
export function createVerbCurveFromArc(arc: Arc): verb.geom.ICurve {
    // Use verb-nurbs built-in arc constructor
    // verb.geom.Arc expects angles in radians and creates the arc in the XY plane
    return new verb.geom.Arc(
        [arc.center.x, arc.center.y, 0], // center point
        [1, 0, 0], // x-axis
        [0, 1, 0], // y-axis
        arc.radius,
        arc.startAngle,
        arc.endAngle
    );
}

/**
 * Convert Spline geometry to verb-nurbs curve
 * Handles cases where knot vectors might be empty or invalid
 */
export function createVerbCurveFromSpline(spline: Spline): verb.geom.ICurve {
    const controlPoints3D = spline.controlPoints.map(
        (p) => [p.x, p.y, 0] as [number, number, number]
    );
    const weights = spline.weights || spline.controlPoints.map(() => 1);

    // Check if we need to generate a proper knot vector
    const expectedKnotLength = controlPoints3D.length + spline.degree + 1;
    let knots = spline.knots;

    if (!knots || knots.length === 0 || knots.length !== expectedKnotLength) {
        // Generate uniform knot vector for the given degree and control points
        knots = generateUniformKnotVector(
            controlPoints3D.length,
            spline.degree
        );
    }

    const curve = verb.geom.NurbsCurve.byKnotsControlPointsWeights(
        spline.degree,
        knots,
        controlPoints3D,
        weights
    );

    return curve;
}

/**
 * Convert Line geometry to verb-nurbs curve (degree-1 NURBS)
 * Following INTERSECTION.md recommendation for Line-NURBS intersections
 */
export function createVerbCurveFromLine(line: Line): verb.geom.ICurve {
    const controlPoints3D = [
        [line.start.x, line.start.y, 0] as [number, number, number],
        [line.end.x, line.end.y, 0] as [number, number, number],
    ];

    return verb.geom.NurbsCurve.byKnotsControlPointsWeights(
        1, // degree 1 for line
        [0, 0, 1, 1], // knot vector for degree-1 curve with 2 control points
        controlPoints3D,
        [1, 1] // uniform weights
    );
}

/**
 * Convert Circle geometry to verb-nurbs curve
 * Following INTERSECTION.md recommendation for Circle-NURBS intersections
 */
export function createVerbCurveFromCircle(circle: Circle): verb.geom.ICurve {
    // Use verb-nurbs built-in circle constructor
    return new verb.geom.Circle(
        [circle.center.x, circle.center.y, 0], // center point
        [1, 0, 0], // x-axis
        [0, 1, 0], // y-axis
        circle.radius
    );
}

/**
 * Process verb-nurbs intersection results into our IntersectionResult format
 * CRITICAL: Returns only the single best intersection to ensure mathematical correctness
 * for consecutive offset shapes in chain operations
 */
export function processVerbIntersectionResults(
    intersections: CurveCurveIntersection[],
    swapParams: boolean = false,
    onExtension: boolean = false
): IntersectionResult[] {
    const results: IntersectionResult[] = [];

    if (!intersections || !Array.isArray(intersections)) {
        return results;
    }

    // Convert all intersections to our format first
    const candidates: IntersectionResult[] = [];

    for (const intersection of intersections) {
        // Try different possible structures from verb-nurbs
        let point: Point2D;
        let param1: number;
        let param2: number;

        // Primary structure: CurveCurveIntersection has u0, u1, and pt properties
        if (intersection.pt && Array.isArray(intersection.pt)) {
            // Standard structure: { u0: number, u1: number, pt: [x, y, z] }
            point = {
                x: intersection.pt[0],
                y: intersection.pt[1],
            };
            param1 = swapParams ? intersection.u1 : intersection.u0;
            param2 = swapParams ? intersection.u0 : intersection.u1;
        } else if (
            'point0' in intersection &&
            Array.isArray(
                (intersection as unknown as AlternativeIntersectionWithPoints)
                    .point0
            )
        ) {
            // TODO this is only used by tests. remove it

            // Alternative structure: { point0: [x, y, z], point1: [x, y, z], u0: param, u1: param }
            const altIntersection =
                intersection as unknown as AlternativeIntersectionWithPoints;
            point = {
                x: altIntersection.point0[0],
                y: altIntersection.point0[1],
            };
            param1 = swapParams ? altIntersection.u1 : altIntersection.u0;
            param2 = swapParams ? altIntersection.u0 : altIntersection.u1;
        } else if (
            'point' in intersection &&
            Array.isArray(
                (intersection as unknown as AlternativeIntersectionWithPoint)
                    .point
            )
        ) {
            // TODO this is only used by tests. remove it

            // Another structure: { point: [x, y, z], u: number, v: number }
            const altIntersection =
                intersection as unknown as AlternativeIntersectionWithPoint;
            point = {
                x: altIntersection.point[0],
                y: altIntersection.point[1],
            };
            param1 = swapParams
                ? (altIntersection.v ?? altIntersection.u1 ?? 0)
                : (altIntersection.u ?? altIntersection.u0 ?? 0);
            param2 = swapParams
                ? (altIntersection.u ?? altIntersection.u0 ?? 0)
                : (altIntersection.v ?? altIntersection.u1 ?? 0);
        } else if (Array.isArray(intersection) && intersection.length >= 2) {
            // TODO this is only used by tests. remove it

            // Array structure: [[x, y, z], u, v] or similar array format
            const arrIntersection =
                intersection as unknown as ArrayIntersection;
            point = {
                x: arrIntersection[0][0],
                y: arrIntersection[0][1],
            };
            param1 = swapParams ? arrIntersection[2] : arrIntersection[1];
            param2 = swapParams ? arrIntersection[1] : arrIntersection[2];
        } else {
            continue;
        }

        candidates.push({
            point,
            param1: param1 || 0,
            param2: param2 || 0,
            distance: 0,
            type: 'exact',
            confidence: 1.0,
            onExtension: onExtension,
        });
    }

    if (candidates.length === 0) {
        return results;
    }

    // If only one intersection, return it
    if (candidates.length === 1) {
        return candidates;
    }

    // Multiple intersections detected - select the one closest to shape endpoints
    // For consecutive offset shapes in chains, the best intersection should be near
    // the connection points between shapes

    // NOTE: This function now requires shape endpoint information to work properly
    // For now, return the first intersection as a fallback
    // TODO: Update callers to provide shape endpoint information
    const bestIntersection = candidates[0];

    // Return only the single best intersection
    return [bestIntersection];
}
