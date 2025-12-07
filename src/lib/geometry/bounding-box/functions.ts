import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { BoundingBoxData } from './interfaces';
import { hashObject } from '$lib/geometry/hash/functions';
import { SPLINE_TESSELLATION_TOLERANCE } from '$lib/geometry/spline/constants';
import { getDefaults } from '$lib/config/defaults/defaults-manager';
import { shapesBoundingBox } from '$lib/cam/shape/functions';

export function combineBoundingBoxes(
    boxes: BoundingBoxData[]
): BoundingBoxData {
    if (boxes.length === 0) {
        throw new Error('Cannot combine empty array of bounding boxes');
    }

    let minX: number = Infinity;
    let maxX: number = -Infinity;
    let minY: number = Infinity;
    let maxY: number = -Infinity;

    for (const box of boxes) {
        if (
            !box ||
            !box.min ||
            !box.max ||
            !isFinite(box.min.x) ||
            !isFinite(box.min.y) ||
            !isFinite(box.max.x) ||
            !isFinite(box.max.y)
        ) {
            throw new Error(
                'Invalid bounding box: min and max must be finite numbers'
            );
        }

        minX = Math.min(minX, box.min.x);
        maxX = Math.max(maxX, box.max.x);
        minY = Math.min(minY, box.min.y);
        maxY = Math.max(maxY, box.max.y);
    }

    return {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY },
    };
}

export function calculateDynamicTolerance(
    shapes: ShapeData[],
    fallbackTolerance: number = SPLINE_TESSELLATION_TOLERANCE
): number {
    if (shapes.length === 0) return fallbackTolerance;

    try {
        const boundingBox: BoundingBoxData = shapesBoundingBox(shapes);
        const width: number = boundingBox.max.x - boundingBox.min.x;
        const height: number = boundingBox.max.y - boundingBox.min.y;
        const diagonal: number = Math.sqrt(width * width + height * height);

        // Use 0.1% of diagonal as tolerance, with reasonable min/max bounds
        const precisionTolerance = getDefaults().geometry.precisionTolerance;
        const dynamicTolerance: number = Math.max(
            precisionTolerance,
            Math.min(1.0, diagonal * precisionTolerance)
        );
        return dynamicTolerance;
    } catch {
        return fallbackTolerance;
    }
}

/**
 * Generate a content hash for a BoundingBox
 * @param boundingBox - The bounding box to hash
 * @returns A SHA-256 hash as a hex string
 */
export async function hashBoundingBox(
    boundingBox: BoundingBoxData
): Promise<string> {
    return hashObject(boundingBox);
}
