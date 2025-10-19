import type { Point2D } from '$lib/geometry/point/interfaces';

/**
 * Rapids are the non-cutting movements that connect cuts.
 * They represent tool movement without cutting.
 */
export interface Rapid {
    id: string;
    start: Point2D;
    end: Point2D;
    type: 'rapid';
}
