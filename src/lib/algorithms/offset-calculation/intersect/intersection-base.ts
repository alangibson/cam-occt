import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import { EPSILON } from '$lib/geometry/math';
import { TOLERANCE_RELAXATION_MULTIPLIER } from '$lib/geometry/constants';

/**
 * Removes duplicate intersection points that are very close to each other
 * Used to clean up intersection results from multiple algorithms
 *
 * @param intersections Array of intersection results
 * @param tolerance Distance tolerance for considering points duplicates
 * @returns Array with duplicates removed
 */
export function removeDuplicateIntersections(
    intersections: IntersectionResult[],
    tolerance: number = EPSILON * TOLERANCE_RELAXATION_MULTIPLIER
): IntersectionResult[] {
    if (intersections.length <= 1) return intersections;

    const result: IntersectionResult[] = [];

    for (const current of intersections) {
        let isDuplicate: boolean = false;

        for (const existing of result) {
            const dx: number = current.point.x - existing.point.x;
            const dy: number = current.point.y - existing.point.y;
            const distance: number = Math.sqrt(dx * dx + dy * dy);

            if (distance < tolerance) {
                isDuplicate = true;
                break;
            }
        }

        if (!isDuplicate) {
            result.push(current);
        }
    }

    return result;
}
