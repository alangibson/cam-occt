import { EPSILON, TOLERANCE } from '$lib/constants';
import type { Shape, Point2D, Line } from '$lib/types/geometry';
import { generateId } from '$lib/utils/id';
import { pointDistance } from '..';
import { calculateLineParameter } from '../../shared/trim-extend-utils';
import { type KeepSide, type TrimResult } from '../types';

/**
 * Trim a line shape at a specific point
 */
export function trimLine(
    shape: Shape,
    point: Point2D,
    keepSide: KeepSide,
    tolerance: number
): TrimResult {
    const line: import('$lib/types/geometry').Line = shape.geometry as Line;
    const result: TrimResult = {
        success: false,
        shape: null,
        warnings: [],
        errors: [],
    };

    // Check if point is on the line
    const param: number = calculateLineParameter(point, line);

    // Also check if point is actually on the line (perpendicular distance)
    const lineStart: Point2D = line.start;
    const lineEnd: Point2D = line.end;
    const lineVec: Point2D = {
        x: lineEnd.x - lineStart.x,
        y: lineEnd.y - lineStart.y,
    };
    const pointVec: Point2D = {
        x: point.x - lineStart.x,
        y: point.y - lineStart.y,
    };

    // Calculate perpendicular distance
    const lineLength: number = Math.sqrt(
        lineVec.x * lineVec.x + lineVec.y * lineVec.y
    );
    if (lineLength < EPSILON) {
        result.errors.push('Cannot trim degenerate line');
        return result;
    }

    const perpDistance: number =
        Math.abs(lineVec.x * pointVec.y - lineVec.y * pointVec.x) / lineLength;

    // Use a more forgiving tolerance for parameter bounds to handle offset precision issues
    const paramTolerance: number = Math.max(tolerance, TOLERANCE);

    if (
        perpDistance > tolerance ||
        param < -paramTolerance ||
        param > 1 + paramTolerance
    ) {
        result.errors.push('Trim point is not on the line segment');
        return result;
    }

    let newStart: Point2D = line.start;
    let newEnd: Point2D = line.end;

    // Adjust the line based on which side to keep
    switch (keepSide) {
        case 'start':
        case 'before':
            newEnd = point;
            break;
        case 'end':
        case 'after':
            newStart = point;
            break;
        default:
            result.errors.push(
                `Invalid keepSide value for line trimming: ${keepSide}`
            );
            return result;
    }

    // Create the trimmed line
    const trimmedLine: Line = {
        start: { ...newStart },
        end: { ...newEnd },
    };

    // Validate the trimmed line is not degenerate
    const trimmedLength: number = pointDistance(newStart, newEnd);
    // Use EPSILON for mathematical degeneracy check, not machining tolerance
    if (trimmedLength < EPSILON) {
        result.errors.push('Trimmed line would be degenerate (zero length)');
        return result;
    }

    result.shape = {
        ...shape,
        id: generateId(),
        geometry: trimmedLine,
    };
    result.success = true;

    return result;
}
