import type { BoundingBoxData } from './interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';

/**
 * BoundingBox class providing overlap detection and other spatial operations
 */
export class BoundingBox {
    #data: BoundingBoxData;

    constructor(data: BoundingBoxData) {
        this.#data = data;
    }

    /**
     * Get the minimum corner of the bounding box
     */
    get min(): Point2D {
        return this.#data.min;
    }

    /**
     * Get the maximum corner of the bounding box
     */
    get max(): Point2D {
        return this.#data.max;
    }

    /**
     * Check if this bounding box overlaps with another bounding box
     * Uses AABB (axis-aligned bounding box) overlap test
     *
     * @param other - The other bounding box to test against
     * @returns true if the bounding boxes overlap, false otherwise
     */
    overlaps(other: BoundingBox): boolean {
        // Boxes overlap if they overlap on BOTH X and Y axes
        // They DON'T overlap if separated on ANY axis

        // Check X axis separation
        if (this.max.x < other.min.x || this.min.x > other.max.x) {
            return false; // Separated on X axis
        }

        // Check Y axis separation
        if (this.max.y < other.min.y || this.min.y > other.max.y) {
            return false; // Separated on Y axis
        }

        // Not separated on either axis = overlap
        return true;
    }

    /**
     * Convert back to plain data object
     */
    toData(): BoundingBoxData {
        return {
            min: { ...this.#data.min },
            max: { ...this.#data.max },
        };
    }
}
