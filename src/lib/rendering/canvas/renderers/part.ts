/**
 * Part renderer for part detection and visualization
 */

import { BaseRenderer } from './base';
import { LayerId } from '$lib/rendering/canvas/layers/types';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import { HitTestType } from '$lib/rendering/canvas/utils/hit-test';
import type { Point2D } from '$lib/geometry/point';
import { isPointInsidePart } from '$lib/geometry/chain/point-in-chain';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';

/**
 * Part renderer that handles part visualization and hit detection
 * Parts are represented as filled areas (shells with holes)
 */
export class PartRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('part-renderer', LayerId.PARTS, coordinator);
    }

    /**
     * Render all parts (currently minimal rendering - parts are mainly visualized through ShapeRenderer styling)
     * Parts themselves don't need specific visual representation beyond the colored shell/hole shapes
     */
    render(_ctx: CanvasRenderingContext2D, _state: RenderState): void {
        // Parts are primarily visualized through the ShapeRenderer's styling of shell/hole shapes
        // This renderer focuses on hit detection for part selection
        // If additional part visualization is needed (like fill areas), it can be added here
    }

    /**
     * Test if a point hits any part using point-in-polygon testing
     */
    hitWorld(point: Point2D, state: RenderState): HitTestResult | null {
        if (!state.parts || state.parts.length === 0) return null;

        // Check each part to see if the point is inside it (shell but outside holes)
        for (const part of state.parts) {
            if (isPointInsidePart(point, part)) {
                // For parts, the distance is 0 since it's a fill area hit
                return {
                    type: HitTestType.PART,
                    id: part.id,
                    distance: 0,
                    point,
                    metadata: { part },
                };
            }
        }

        return null;
    }
}
