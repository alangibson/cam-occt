import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Point2D } from '$lib/types/geometry';
import { CutDirection } from '$lib/types/direction';
import {
    getShapeEndPoint,
    getShapeStartPoint,
} from '$lib/geometry/shape/functions';
import {
    CHAIN_CLOSURE_TOLERANCE,
    POLYGON_POINTS_MIN,
} from '$lib/geometry/chain';
import { getChainPoints } from '$lib/geometry/chain/functions';
import { isPointsClosed } from '$lib/geometry/point/functions';
import { calculateSignedArea } from '$lib/geometry/polygon/functions';

/**
 * Detects the cut direction of a chain using the shoelace formula (signed area calculation).
 *
 * For closed chains:
 * - Positive signed area = counterclockwise
 * - Negative signed area = clockwise
 *
 * For open chains:
 * - Returns 'none' as they don't have a natural cut direction
 */
export function detectCutDirection(
    chain: Chain,
    tolerance: number = CHAIN_CLOSURE_TOLERANCE
): CutDirection {
    if (!chain || !chain.shapes || chain.shapes.length === 0) {
        return CutDirection.NONE;
    }

    // Check if chain is closed by comparing first and last points
    const firstPoint: Point2D = getShapeStartPoint(chain.shapes[0]);
    const lastPoint: Point2D = getShapeEndPoint(
        chain.shapes[chain.shapes.length - 1]
    );

    if (!isPointsClosed(firstPoint, lastPoint, tolerance)) {
        return CutDirection.NONE; // Open chains don't have a natural cut direction
    }

    // Get all points from the chain
    const points: Point2D[] = getChainPoints(chain);

    if (points.length < POLYGON_POINTS_MIN) {
        return CutDirection.NONE; // Need at least 3 points to determine direction
    }

    // Calculate signed area using shoelace formula
    const signedArea: number = calculateSignedArea(points);

    // Positive area = counterclockwise, negative area = clockwise
    return signedArea > 0
        ? CutDirection.COUNTERCLOCKWISE
        : CutDirection.CLOCKWISE;
}
