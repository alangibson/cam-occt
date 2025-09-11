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
}
