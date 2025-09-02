import type { Geometry, Line, Point2D } from '$lib/types/geometry';

export function getLineStartPoint(line: Line): Point2D {
    return line.start;
}

export function getLineEndPoint(line: Line): Point2D {
    return line.end;
}

export function reverseLine(line: Line): Line {
    return {
        start: line.end,
        end: line.start
    };
}

export function getLinePointAt(line: Line, t: number): Point2D {
    return {
        x: line.start.x + t * (line.end.x - line.start.x),
        y: line.start.y + t * (line.end.y - line.start.y)
    };
}

/**
 * Type guard to check if a segment is a Line
 */
export function isLine(segment: Geometry): boolean {
  return segment != null && typeof segment === 'object' && 'start' in segment && 'end' in segment;
}