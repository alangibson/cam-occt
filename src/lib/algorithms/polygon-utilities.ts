import type { Point2D } from '../types/geometry.ts';
import {
    calculateSignedArea,
    getWindingDirection,
    type WindingDirection,
} from '../utils/geometry-utils';
import { calculatePerimeter } from '../utils/math-utils';
import {
    calculateDistanceBetweenPoints,
    isPointInPolygon,
} from '../utils/polygon-geometry-shared';

/**
 * Advanced polygon analysis and manipulation utilities
 *
 * This module provides higher-level polygon operations that build on the
 * basic geometry utilities, focusing on practical CAD/CAM applications.
 */

/**
 * Configuration for polygon analysis operations
 */
export interface PolygonAnalysisConfig {
    /** Tolerance for geometric comparisons */
    tolerance: number;
    /** Whether to treat nearly-closed polygons as closed */
    treatNearlyClosedAsClosed?: boolean;
}

/**
 * Result of polygon analysis
 */
export interface PolygonAnalysisResult {
    /** Whether the polygon is topologically closed */
    isClosed: boolean;
    /** Winding direction of the polygon */
    winding: WindingDirection;
    /** Signed area of the polygon */
    area: number;
    /** Perimeter length */
    perimeter: number;
    /** Bounding box of the polygon */
    boundingBox: {
        min: Point2D;
        max: Point2D;
    };
    /** Whether the polygon is simple (non-self-intersecting) */
    isSimple: boolean;
}

/**
 * Analyze a polygon for various geometric properties
 *
 * @param points Array of polygon vertices
 * @param config Analysis configuration
 * @returns Comprehensive analysis of the polygon
 */
export function analyzePolygon(
    points: Point2D[],
    config: PolygonAnalysisConfig
): PolygonAnalysisResult {
    if (points.length < 3) {
        throw new Error('Polygon must have at least 3 points');
    }

    // Check if polygon is closed
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const distanceToFirst = calculateDistanceBetweenPoints(
        firstPoint,
        lastPoint
    );
    const isClosed =
        distanceToFirst < config.tolerance ||
        (config.treatNearlyClosedAsClosed === true &&
            distanceToFirst < config.tolerance * 10);

    // Calculate area and winding
    const signedArea: number = calculateSignedArea(points);
    const area: number = Math.abs(signedArea);
    const winding: WindingDirection = getWindingDirection(points);

    // Calculate perimeter
    const perimeter = calculatePerimeter(points);

    // Calculate bounding box
    let minX: number = points[0].x,
        maxX: number = points[0].x;
    let minY: number = points[0].y,
        maxY: number = points[0].y;

    for (const point of points) {
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
    }

    // Simple self-intersection check (basic)
    const isSimple: boolean = checkSimplePolygon(points, config.tolerance);

    return {
        isClosed,
        winding,
        area,
        perimeter,
        boundingBox: {
            min: { x: minX, y: minY },
            max: { x: maxX, y: maxY },
        },
        isSimple,
    };
}

/**
 * Detect and classify polygon holes in a set of polygons
 *
 * Uses point-in-polygon testing to determine which polygons are inside others.
 * Follows the CAD convention where outer boundaries are clockwise and holes are counter-clockwise.
 *
 * @param polygons Array of polygon point arrays
 * @param config Analysis configuration
 * @returns Classification of polygons as shells or holes
 */
export interface PolygonClassification {
    shells: {
        points: Point2D[];
        holes: Point2D[][];
        analysis: PolygonAnalysisResult;
    }[];
    orphanedHoles: Point2D[][];
}

export function classifyPolygonsAsShellsAndHoles(
    polygons: Point2D[][],
    config: PolygonAnalysisConfig
): PolygonClassification {
    const shells: PolygonClassification['shells'] = [];
    const orphanedHoles: Point2D[][] = [];

    // Analyze each polygon
    const analyses: Array<{
        points: Point2D[];
        analysis: PolygonAnalysisResult;
    }> = polygons.map((points) => ({
        points,
        analysis: analyzePolygon(points, config),
    }));

    // Separate by winding direction
    const clockwisePolygons: Array<{
        points: Point2D[];
        analysis: PolygonAnalysisResult;
    }> = analyses.filter((p) => p.analysis.winding === 'CW');
    const counterClockwisePolygons: Array<{
        points: Point2D[];
        analysis: PolygonAnalysisResult;
    }> = analyses.filter((p) => p.analysis.winding === 'CCW');

    // Process clockwise polygons as potential shells
    for (const shell of clockwisePolygons) {
        const shellHoles: Point2D[][] = [];

        // Find CCW polygons that are inside this shell
        for (const hole of counterClockwisePolygons) {
            if (
                isPolygonInsidePolygon(
                    hole.points,
                    shell.points,
                    config.tolerance
                )
            ) {
                shellHoles.push(hole.points);
            }
        }

        shells.push({
            points: shell.points,
            holes: shellHoles,
            analysis: shell.analysis,
        });
    }

    // Find orphaned holes (CCW polygons not inside any shell)
    for (const hole of counterClockwisePolygons) {
        let isOrphaned: boolean = true;
        for (const shell of shells) {
            if (shell.holes.includes(hole.points)) {
                isOrphaned = false;
                break;
            }
        }
        if (isOrphaned) {
            orphanedHoles.push(hole.points);
        }
    }

    return { shells, orphanedHoles };
}

/**
 * Check if one polygon is completely inside another using point-in-polygon testing
 *
 * @param innerPolygon Points of the potentially inner polygon
 * @param outerPolygon Points of the potentially outer polygon
 * @param tolerance Tolerance for geometric comparisons
 * @returns True if inner polygon is completely inside outer polygon
 */
export function isPolygonInsidePolygon(
    innerPolygon: Point2D[],
    outerPolygon: Point2D[],
    tolerance: number
): boolean {
    // Test several points of the inner polygon
    const testPoints: Point2D[] = [
        innerPolygon[0], // First point
        innerPolygon[Math.floor(innerPolygon.length / 2)], // Middle point
        innerPolygon[innerPolygon.length - 1], // Last point
    ];

    // If any test point is outside, the polygon is not inside
    for (const point of testPoints) {
        if (!isPointInsidePolygon(point, outerPolygon)) {
            return false;
        }
    }

    // Additional check: ensure no edges of inner polygon intersect outer polygon
    // This is a more thorough test but computationally expensive
    return !doPolygonsIntersect(innerPolygon, outerPolygon, tolerance);
}

/**
 * Point-in-polygon test using ray casting algorithm
 * Alias for backward compatibility - uses shared implementation
 */
export const isPointInsidePolygon = isPointInPolygon;

/**
 * Check if two polygons intersect (edges cross each other)
 *
 * This is a simplified intersection test that checks for edge crossings.
 * A more complete implementation would handle edge overlaps and vertex-on-edge cases.
 *
 * @param polygon1 First polygon vertices
 * @param polygon2 Second polygon vertices
 * @param tolerance Tolerance for geometric comparisons
 * @returns True if polygons intersect
 */
export function doPolygonsIntersect(
    polygon1: Point2D[],
    polygon2: Point2D[],
    tolerance: number
): boolean {
    // Check if any edge from polygon1 intersects any edge from polygon2
    for (let i: number = 0; i < polygon1.length; i++) {
        const p1: Point2D = polygon1[i];
        const p2: Point2D = polygon1[(i + 1) % polygon1.length];

        for (let j: number = 0; j < polygon2.length; j++) {
            const p3: Point2D = polygon2[j];
            const p4: Point2D = polygon2[(j + 1) % polygon2.length];

            if (doLineSegmentsIntersect(p1, p2, p3, p4, tolerance)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Check if two line segments intersect
 *
 * @param p1 Start of first segment
 * @param p2 End of first segment
 * @param p3 Start of second segment
 * @param p4 End of second segment
 * @param tolerance Tolerance for geometric comparisons
 * @returns True if segments intersect
 */
export function doLineSegmentsIntersect(
    p1: Point2D,
    p2: Point2D,
    p3: Point2D,
    p4: Point2D,
    tolerance: number
): boolean {
    const denom: number =
        (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);

    // Lines are parallel
    if (Math.abs(denom) < tolerance) {
        return false;
    }

    const ua: number =
        ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    const ub: number =
        ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

    // Intersection occurs if both parameters are between 0 and 1
    return (
        ua >= -tolerance &&
        ua <= 1 + tolerance &&
        ub >= -tolerance &&
        ub <= 1 + tolerance
    );
}

/**
 * Basic check for self-intersecting polygon
 *
 * This performs a simplified self-intersection check by looking for
 * non-adjacent edges that intersect.
 *
 * @param points Polygon vertices
 * @param tolerance Tolerance for geometric comparisons
 * @returns True if polygon appears to be simple (non-self-intersecting)
 */
function checkSimplePolygon(points: Point2D[], tolerance: number): boolean {
    if (points.length < 4) {
        return true; // Triangle cannot self-intersect
    }

    // Check for intersections between non-adjacent edges
    for (let i: number = 0; i < points.length; i++) {
        const p1: Point2D = points[i];
        const p2: Point2D = points[(i + 1) % points.length];

        // Check against non-adjacent edges
        for (let j: number = i + 2; j < points.length; j++) {
            // Skip the edge that shares a vertex
            if (j === points.length - 1 && i === 0) continue;

            const p3: Point2D = points[j];
            const p4: Point2D = points[(j + 1) % points.length];

            if (doLineSegmentsIntersect(p1, p2, p3, p4, tolerance)) {
                return false; // Self-intersection found
            }
        }
    }

    return true;
}

/**
 * Normalize polygon orientation to ensure consistent winding direction
 *
 * @param points Polygon vertices
 * @param targetWinding Desired winding direction
 * @returns Polygon with consistent winding direction
 */
export function normalizePolygonWinding(
    points: Point2D[],
    targetWinding: 'CW' | 'CCW'
): Point2D[] {
    const currentWinding: WindingDirection = getWindingDirection(points);

    if (currentWinding === 'degenerate') {
        return points; // Cannot normalize degenerate polygon
    }

    if (currentWinding === targetWinding) {
        return points; // Already correct winding
    }

    // Reverse the point order to flip winding
    return [...points].reverse();
}

/**
 * Create a regular polygon with specified number of sides
 *
 * @param center Center point of the polygon
 * @param radius Distance from center to vertices
 * @param sides Number of sides (must be >= 3)
 * @param rotation Rotation angle in radians (default: 0)
 * @returns Regular polygon vertices
 */
export function createRegularPolygon(
    center: Point2D,
    radius: number,
    sides: number,
    rotation: number = 0
): Point2D[] {
    if (sides < 3) {
        throw new Error('Regular polygon must have at least 3 sides');
    }

    if (radius <= 0) {
        throw new Error('Regular polygon radius must be positive');
    }

    const points: Point2D[] = [];
    const angleStep: number = (2 * Math.PI) / sides;

    for (let i: number = 0; i < sides; i++) {
        const angle: number = rotation + i * angleStep;
        points.push({
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle),
        });
    }

    return points;
}

/**
 * Simplify polygon by removing collinear points and points that are too close
 *
 * @param points Original polygon vertices
 * @param config Simplification configuration
 * @returns Simplified polygon
 */
export interface PolygonSimplificationConfig {
    /** Minimum distance between consecutive points */
    minDistance: number;
    /** Tolerance for collinearity detection */
    collinearityTolerance: number;
    /** Whether to preserve the polygon's closure */
    preserveClosure: boolean;
}

export function simplifyPolygon(
    points: Point2D[],
    config: PolygonSimplificationConfig
): Point2D[] {
    if (points.length < 3) {
        return points;
    }

    const simplified: Point2D[] = [];

    for (let i: number = 0; i < points.length; i++) {
        const current: Point2D = points[i];
        const next: Point2D = points[(i + 1) % points.length];
        const prev: Point2D =
            simplified[simplified.length - 1] || points[points.length - 1];

        // Skip if too close to previous point
        if (simplified.length > 0) {
            const distance = calculateDistanceBetweenPoints(current, prev);
            if (distance < config.minDistance) {
                continue;
            }
        }

        // Skip if collinear with previous and next points
        if (simplified.length > 0 && i < points.length - 1) {
            if (
                arePointsCollinear(
                    prev,
                    current,
                    next,
                    config.collinearityTolerance
                )
            ) {
                continue;
            }
        }

        simplified.push(current);
    }

    // Ensure minimum polygon size
    if (simplified.length < 3) {
        return points; // Cannot simplify further
    }

    return simplified;
}

/**
 * Check if three points are collinear within tolerance
 *
 * @param p1 First point
 * @param p2 Second point
 * @param p3 Third point
 * @param tolerance Collinearity tolerance
 * @returns True if points are collinear
 */
function arePointsCollinear(
    p1: Point2D,
    p2: Point2D,
    p3: Point2D,
    tolerance: number
): boolean {
    // Calculate cross product to measure deviation from collinearity
    const crossProduct: number = Math.abs(
        (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x)
    );

    return crossProduct < tolerance;
}

/**
 * Calculate the convex hull of a set of points using Graham scan algorithm
 *
 * @param points Input points
 * @returns Convex hull vertices in counter-clockwise order
 */
export function calculateConvexHull(points: Point2D[]): Point2D[] {
    if (points.length < 3) {
        return [...points];
    }

    // Find the bottom-most point (and leftmost in case of tie)
    let bottom: Point2D = points[0];
    for (const point of points) {
        if (
            point.y < bottom.y ||
            (point.y === bottom.y && point.x < bottom.x)
        ) {
            bottom = point;
        }
    }

    // Sort points by polar angle with respect to bottom point
    const sorted: Point2D[] = points
        .filter((p) => p !== bottom)
        .sort((a, b) => {
            const angleA: number = Math.atan2(a.y - bottom.y, a.x - bottom.x);
            const angleB: number = Math.atan2(b.y - bottom.y, b.x - bottom.x);
            return angleA - angleB;
        });

    const hull: Point2D[] = [bottom];

    for (const point of sorted) {
        // Remove points that create right turns
        while (hull.length > 1) {
            const p1: Point2D = hull[hull.length - 2];
            const p2: Point2D = hull[hull.length - 1];

            // Calculate cross product to determine turn direction
            const cross: number =
                (p2.x - p1.x) * (point.y - p1.y) -
                (p2.y - p1.y) * (point.x - p1.x);

            if (cross <= 0) {
                hull.pop(); // Remove point that creates right turn
            } else {
                break;
            }
        }

        hull.push(point);
    }

    return hull;
}
