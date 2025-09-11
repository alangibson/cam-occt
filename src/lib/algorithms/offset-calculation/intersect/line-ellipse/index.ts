import type { Shape, Point2D } from '$lib/types/geometry';
import type { Line } from '$lib/geometry/line';
import type { Ellipse } from '$lib/geometry/ellipse';
import type { IntersectionResult } from '../../chain/types';
import {
    EPSILON,
    INTERSECTION_TOLERANCE,
} from '../../../../geometry/math/constants';
import { snapParameter } from '../line-arc/index';
import {
    createVerbCurveFromEllipse,
    createVerbCurveFromLine,
    processVerbIntersectionResults,
} from '../../../../utils/verb-integration-utils';
import { getEllipseParameters } from '$lib/geometry/ellipse/index';
import verb, { type CurveCurveIntersection } from 'verb-nurbs';

/**
 * Transform a local point back to world coordinates using ellipse parameters
 * @param localPoint Point in ellipse local coordinate system
 * @param center Center of the ellipse
 * @param cosRot Cosine of rotation angle
 * @param sinRot Sine of rotation angle
 * @returns Point in world coordinates
 */
function transformToWorldCoordinates(
    localPoint: Point2D,
    center: Point2D,
    cosRot: number,
    sinRot: number
): Point2D {
    return {
        x: center.x + localPoint.x * cosRot - localPoint.y * sinRot,
        y: center.y + localPoint.x * sinRot + localPoint.y * cosRot,
    };
}

/**
 * Create intersection result parameters handling swap if needed
 * @param lineParam Parameter on the line
 * @param ellipseParam Parameter on the ellipse
 * @param swapParams Whether to swap the parameters
 * @returns Object with param1 and param2
 */
function createEllipseLineIntersectionParams(
    lineParam: number,
    ellipseParam: number,
    swapParams: boolean
): { param1: number; param2: number } {
    return swapParams
        ? { param1: snapParameter(lineParam), param2: ellipseParam }
        : { param1: ellipseParam, param2: snapParameter(lineParam) };
}

/**
 * Process ellipse intersection point and create intersection result
 */
function processEllipseIntersectionPoint(
    t: number,
    dx: number,
    dy: number,
    p1: Point2D,
    ellipse: Ellipse,
    center: Point2D,
    cosRot: number,
    sinRot: number,
    swapParams: boolean,
    intersectionType: 'tangent' | 'exact'
): IntersectionResult | null {
    const localPoint: Point2D = { x: p1.x + t * dx, y: p1.y + t * dy };

    // Transform back to world coordinates
    const worldPoint = transformToWorldCoordinates(
        localPoint,
        center,
        cosRot,
        sinRot
    );

    const ellipseParam: number = calculateEllipseParameter(worldPoint, ellipse);

    if (isValidEllipseParameter(ellipseParam, ellipse)) {
        const params = createEllipseLineIntersectionParams(
            t,
            ellipseParam,
            swapParams
        );
        return {
            point: worldPoint,
            param1: params.param1,
            param2: params.param2,
            distance: 0,
            type: intersectionType,
            confidence: 1.0,
        };
    }

    return null;
}

/**
 * Find intersections between an ellipse and a line using parametric approach
 */
export function findEllipseLineIntersections(
    ellipseShape: Shape,
    lineShape: Shape,
    swapParams: boolean
): IntersectionResult[] {
    const ellipse: import('$lib/types/geometry').Ellipse =
        ellipseShape.geometry as Ellipse;
    const line: import('$lib/types/geometry').Line = lineShape.geometry as Line;
    const results: IntersectionResult[] = [];

    // Get ellipse parameters
    const { center } = ellipse;
    const {
        majorAxisLength: a,
        minorAxisLength: b,
        majorAxisAngle: rotAngle,
    } = getEllipseParameters(ellipse);
    const cosRot = Math.cos(rotAngle);
    const sinRot = Math.sin(rotAngle);

    // Transform line to ellipse coordinate system (center at origin, axes aligned)
    const transformPoint = (p: Point2D) => {
        const dx = p.x - center.x;
        const dy = p.y - center.y;
        return {
            x: dx * cosRot + dy * sinRot,
            y: -dx * sinRot + dy * cosRot,
        };
    };

    const p1 = transformPoint(line.start);
    const p2 = transformPoint(line.end);

    const dx: number = p2.x - p1.x;
    const dy: number = p2.y - p1.y;

    // Substitute line parametric equation into ellipse equation
    // Ellipse: (x/a)² + (y/b)² = 1
    // Line: x = p1.x + t*dx, y = p1.y + t*dy

    const A: number = (dx / a) ** 2 + (dy / b) ** 2;
    const B: number = 2 * ((p1.x * dx) / a ** 2 + (p1.y * dy) / b ** 2);
    const C: number = (p1.x / a) ** 2 + (p1.y / b) ** 2 - 1;

    // eslint-disable-next-line no-magic-numbers
    const discriminant: number = B ** 2 - 4 * A * C;

    if (discriminant < -EPSILON) {
        return []; // No intersection
    }

    const sqrtDisc: number = Math.sqrt(Math.max(0, discriminant));

    // Handle tangent case
    if (discriminant < EPSILON) {
        const t: number = -B / (2 * A);
        const result = processEllipseIntersectionPoint(
            t,
            dx,
            dy,
            p1,
            ellipse,
            center,
            cosRot,
            sinRot,
            swapParams,
            'tangent'
        );
        if (result) {
            results.push(result);
        }
    } else {
        // Two intersection points
        const t1: number = (-B - sqrtDisc) / (2 * A);
        const t2: number = (-B + sqrtDisc) / (2 * A);

        [t1, t2].forEach((t) => {
            const result = processEllipseIntersectionPoint(
                t,
                dx,
                dy,
                p1,
                ellipse,
                center,
                cosRot,
                sinRot,
                swapParams,
                'exact'
            );
            if (result) {
                results.push(result);
            }
        });
    }

    return results;
}

/**
 * Calculate parameter on ellipse for a given point
 */
function calculateEllipseParameter(point: Point2D, ellipse: Ellipse): number {
    const { center } = ellipse;

    // Transform point to ellipse local coordinates
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const {
        majorAxisLength: a,
        minorAxisLength: b,
        majorAxisAngle: rotAngle,
    } = getEllipseParameters(ellipse);
    const cosRot = Math.cos(rotAngle);
    const sinRot = Math.sin(rotAngle);

    const localX = dx * cosRot + dy * sinRot;
    const localY = -dx * sinRot + dy * cosRot;

    // Calculate parameter (angle)
    const t = Math.atan2(localY / b, localX / a);
    return t < 0 ? t + 2 * Math.PI : t;
}

/**
 * Check if a parameter is valid for an ellipse (considering arc bounds)
 */
function isValidEllipseParameter(param: number, ellipse: Ellipse): boolean {
    const { startParam, endParam } = ellipse;

    // If not an arc, all parameters are valid
    if (startParam === undefined || endParam === undefined) {
        return true;
    }

    // Handle arc parameter bounds
    let start: number = startParam;
    let end: number = endParam;

    // Normalize to [0, 2π)
    while (start < 0) start += 2 * Math.PI;
    while (end < 0) end += 2 * Math.PI;
    while (param < 0) param += 2 * Math.PI;
    start = start % (2 * Math.PI);
    end = end % (2 * Math.PI);
    param = param % (2 * Math.PI);

    if (start <= end) {
        return param >= start - EPSILON && param <= end + EPSILON;
    } else {
        return param >= start - EPSILON || param <= end + EPSILON;
    }
}

/**
 * Find intersections between an ellipse and a line using verb-nurbs
 * Implements INTERSECTION.md recommendation #39: "Convert line to NURBs and use NURBs-NURBs routine"
 */
export function findEllipseLineIntersectionsVerb(
    ellipseShape: Shape,
    lineShape: Shape,
    swapParams: boolean = false
): IntersectionResult[] {
    const ellipse: Ellipse = ellipseShape.geometry as Ellipse;
    const line: Line = lineShape.geometry as Line;

    // Convert both shapes to verb-nurbs curves
    const ellipseCurve: verb.geom.NurbsCurve =
        createVerbCurveFromEllipse(ellipse);
    const lineCurve: verb.geom.NurbsCurve = createVerbCurveFromLine(line);

    // Use verb.geom.Intersect.curves() for intersection
    const intersections: CurveCurveIntersection[] = verb.geom.Intersect.curves(
        ellipseCurve,
        lineCurve,
        INTERSECTION_TOLERANCE
    );

    return processVerbIntersectionResults(intersections, swapParams);
}
