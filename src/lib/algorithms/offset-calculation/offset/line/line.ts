import {
    GeometryType,
    type Line,
    type Point2D,
    type Shape,
} from '../../../../types/geometry';
import { OffsetDirection, type OffsetResult } from '../types';

/**
 * Offset a line by the specified distance
 * For lines, we create two parallel offset lines and return both endpoints
 */
export function offsetLine(
    line: Line,
    distance: number,
    direction: OffsetDirection
): OffsetResult {
    if (direction === 'none' || distance === 0) {
        return {
            success: true,
            shapes: [],
            warnings: [],
            errors: [],
        };
    }

    try {
        // Calculate the perpendicular vector to the line
        const dx: number = line.end.x - line.start.x;
        const dy: number = line.end.y - line.start.y;
        const length: number = Math.sqrt(dx * dx + dy * dy);

        if (length === 0) {
            return {
                success: false,
                shapes: [],
                warnings: [],
                errors: ['Cannot offset zero-length line'],
            };
        }

        // Unit vector perpendicular to the line (rotated 90 degrees clockwise)
        // This ensures outset moves the line to the "right" side when walking along it
        const perpX: number = dy / length;
        const perpY: number = -dx / length;

        // Apply direction: outset = positive offset, inset = negative offset
        const offsetDistance: number =
            direction === 'outset' ? distance : -distance;

        // Calculate offset points
        const offsetStart: Point2D = {
            x: line.start.x + perpX * offsetDistance,
            y: line.start.y + perpY * offsetDistance,
        };

        const offsetEnd: Point2D = {
            x: line.end.x + perpX * offsetDistance,
            y: line.end.y + perpY * offsetDistance,
        };

        const offsetShape: Shape = {
            id: `offset_${Math.random().toString(36).substr(2, 9)}`,
            type: GeometryType.LINE,
            geometry: {
                start: offsetStart,
                end: offsetEnd,
            } as Line,
        };

        return {
            success: true,
            shapes: [offsetShape],
            warnings: [],
            errors: [],
        };
    } catch (error) {
        return {
            success: false,
            shapes: [],
            warnings: [],
            errors: [
                `Failed to offset line: ${error instanceof Error ? (error as Error).message : String(error)}`,
            ],
        };
    }
}
