import type { Drawing } from '$lib/cam/drawing/classes.svelte';
import type { Plan } from '$lib/cam/plan/classes.svelte';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';

/**
 * Translate drawing and plan to ensure they are in the positive quadrant
 *
 * This algorithm calculates the combined bounding box of the drawing and plan (if provided)
 * and translates them so that the minimum coordinates are at (0, 0), ensuring all geometry
 * is in the positive quadrant for consistent CAM processing.
 */
export function translateToPositiveQuadrant(
    drawing: Drawing,
    plan?: Plan
): void {
    // Calculate combined bounds from drawing and plan
    let bounds: BoundingBoxData = drawing.bounds;

    // If plan is provided, combine its bounds with drawing bounds
    if (plan) {
        const planBounds = plan.bounds;
        bounds = {
            min: {
                x: Math.min(bounds.min.x, planBounds.min.x),
                y: Math.min(bounds.min.y, planBounds.min.y),
            },
            max: {
                x: Math.max(bounds.max.x, planBounds.max.x),
                y: Math.max(bounds.max.y, planBounds.max.y),
            },
        };
    }

    // Only translate if there are negative coordinates
    if (bounds.min.x >= 0 && bounds.min.y >= 0) return;

    const dx: number = bounds.min.x < 0 ? -bounds.min.x : 0;
    const dy: number = bounds.min.y < 0 ? -bounds.min.y : 0;

    drawing.translate(dx, dy);
    if (plan) {
        plan.translate(dx, dy);
    }
}
