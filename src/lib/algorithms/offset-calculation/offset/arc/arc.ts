import { GeometryType } from '$lib/geometry/shape/enums';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import {
    OffsetDirection,
    type OffsetResult,
} from '$lib/algorithms/offset-calculation/offset/types';

/**
 * Offset an arc by the specified distance
 * Based on reference/cam/offset/arc_offset.md
 *
 * The key insight is that offsetting an arc requires:
 * 1. Adjusting the radius (outset = +distance, inset = -distance)
 * 2. Keeping the center point and angular span identical
 * 3. Recalculating start and end points based on the new radius
 */
export function offsetArc(
    arc: Arc,
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
        // Calculate new radius: outset increases, inset decreases
        const offsetDistance: number =
            direction === 'outset' ? distance : -distance;
        const newRadius: number = arc.radius + offsetDistance;

        if (newRadius <= 0) {
            return {
                success: false,
                shapes: [],
                warnings: [],
                errors: [
                    `Arc offset would result in negative radius: ${newRadius}`,
                ],
            };
        }

        // The center point and angular span remain identical
        // Only the radius changes, which automatically updates the start/end points
        const offsetShape: Shape = {
            // eslint-disable-next-line no-magic-numbers
            id: `offset_${Math.random().toString(36).substr(2, 9)}`,
            type: GeometryType.ARC,
            geometry: {
                center: { ...arc.center },
                radius: newRadius,
                startAngle: arc.startAngle,
                endAngle: arc.endAngle,
                clockwise: arc.clockwise,
            } as Arc,
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
                `Failed to offset arc: ${error instanceof Error ? (error as Error).message : String(error)}`,
            ],
        };
    }
}
