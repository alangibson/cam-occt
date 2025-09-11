import type { Geometry, Point2D } from '$lib/types/geometry';
import type { Line } from './interfaces';
import { EPSILON } from '$lib/geometry/math';

export function getLineStartPoint(line: Line): Point2D {
    return line.start;
}

export function getLineEndPoint(line: Line): Point2D {
    return line.end;
}

export function reverseLine(line: Line): Line {
    return {
        start: line.end,
        end: line.start,
    };
}

export function getLinePointAt(line: Line, t: number): Point2D {
    return {
        x: line.start.x + t * (line.end.x - line.start.x),
        y: line.start.y + t * (line.end.y - line.start.y),
    };
}

/**
 * Type guard to check if a segment is a Line
 */
export function isLine(segment: Geometry): boolean {
    return (
        segment != null &&
        typeof segment === 'object' &&
        'start' in segment &&
        'end' in segment
    );
}

/**
 * Calculate normalized direction vector and length of a line
 * @param line Line to process
 * @returns Object with direction vector, unit vector, and length, or null if degenerate
 */
export function calculateLineDirectionAndLength(line: Line): {
    direction: Point2D;
    unitDirection: Point2D;
    length: number;
} | null {
    const direction: Point2D = {
        x: line.end.x - line.start.x,
        y: line.end.y - line.start.y,
    };

    const length: number = Math.sqrt(
        direction.x * direction.x + direction.y * direction.y
    );

    if (length < EPSILON) {
        return null; // Degenerate line
    }

    const unitDirection: Point2D = {
        x: direction.x / length,
        y: direction.y / length,
    };

    return { direction, unitDirection, length };
} /**
 * Calculates the direction of turn from line p1-p2 to point p3
 */
export function direction(p1: Point2D, p2: Point2D, p3: Point2D): number {
    return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}
/**
 * Checks if point q lies on line segment pr
 */
export function onSegment(p: Point2D, q: Point2D, r: Point2D): boolean {
    return (
        q.x <= Math.max(p.x, r.x) &&
        q.x >= Math.min(p.x, r.x) &&
        q.y <= Math.max(p.y, r.y) &&
        q.y >= Math.min(p.y, r.y)
    );
}
/**
 * Checks if two line segments intersect
 */

export function doLineSegmentsIntersect(
    p1: Point2D,
    p2: Point2D,
    p3: Point2D,
    p4: Point2D
): boolean {
    const d1: number = direction(p3, p4, p1);
    const d2: number = direction(p3, p4, p2);
    const d3: number = direction(p1, p2, p3);
    const d4: number = direction(p1, p2, p4);

    if (
        ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
    ) {
        return true;
    }

    // Check for collinear points
    if (d1 === 0 && onSegment(p3, p1, p4)) return true;
    if (d2 === 0 && onSegment(p3, p2, p4)) return true;
    if (d3 === 0 && onSegment(p1, p3, p2)) return true;
    if (d4 === 0 && onSegment(p1, p4, p2)) return true;

    return false;
}
