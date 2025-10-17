/**
 * Common utility functions for renderers
 */

import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import type { Point2D } from '$lib/geometry/point';
import type { Shape } from '$lib/geometry/shape';
import type { Line } from '$lib/geometry/line';
import type { Circle } from '$lib/geometry/circle';
import type { Cut } from '$lib/cam/cut/interfaces';

/**
 * Constants for renderer utilities
 */
const SHADOW_BLUR_PX = 4;
const DEFAULT_HIT_TOLERANCE_PX = 5;

/**
 * Calculate distance from a point to a shape
 * Note: This is a simplified distance calculation. For proper hit detection,
 * use HitTestUtils.isPointNearShape() which handles all shape types correctly.
 */
export function calculatePointToShapeDistance(
    point: Point2D,
    shape: Shape
): number {
    // Enhanced defensive check for undefined or invalid point
    if (!point) {
        console.error(
            'calculatePointToShapeDistance: point is null/undefined',
            { point, shape }
        );
        return Infinity;
    }

    if (typeof point.x !== 'number' || typeof point.y !== 'number') {
        console.error(
            'calculatePointToShapeDistance: point has invalid coordinates',
            { point, shape }
        );
        return Infinity;
    }

    // Also check shape validity
    if (!shape || !shape.type) {
        console.error('calculatePointToShapeDistance: invalid shape', {
            point,
            shape,
        });
        return Infinity;
    }

    if (shape.type === 'circle') {
        const circle = shape.geometry as Circle;
        if (!circle.center) {
            console.error(
                'calculatePointToShapeDistance: circle missing center',
                { point, shape }
            );
            return Infinity;
        }
        const dx = point.x - circle.center.x;
        const dy = point.y - circle.center.y;
        return Math.sqrt(dx * dx + dy * dy);
    } else if (shape.type === 'line') {
        const line = shape.geometry as Line;
        if (!line.start) {
            console.error('calculatePointToShapeDistance: line missing start', {
                point,
                shape,
            });
            return Infinity;
        }
        const dx = point.x - line.start.x;
        const dy = point.y - line.start.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // For other shape types (arc, polyline, spline, ellipse), return Infinity
    // This prevents false hits. Proper distance calculation should use HitTestUtils.
    return Infinity;
}

/**
 * Check if a cut is enabled and should be rendered
 */
export function isCutEnabledForRendering(
    cut: Cut,
    state: RenderState
): boolean {
    const operation = state.operations.find((op) => op.id === cut.operationId);
    return !!(operation && operation.enabled && cut.enabled);
}

/**
 * Apply common cut styling based on selection and hover state
 */
export function applyCutStyling(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
    isSelected: boolean,
    isHighlighted: boolean,
    cutColors: {
        selectedDark: string;
        highlighted: string;
        normal: string;
    },
    lineWidths: {
        selected: number;
        highlighted: number;
        normal: number;
    },
    enableShadow: boolean = true
): void {
    if (isSelected) {
        ctx.strokeStyle = cutColors.selectedDark;
        ctx.lineWidth = state.transform.coordinator.screenToWorldDistance(
            lineWidths.selected
        );
    } else if (isHighlighted) {
        ctx.strokeStyle = cutColors.highlighted;
        ctx.lineWidth = state.transform.coordinator.screenToWorldDistance(
            lineWidths.highlighted
        );
        if (enableShadow) {
            ctx.shadowColor = cutColors.highlighted;
            ctx.shadowBlur =
                state.transform.coordinator.screenToWorldDistance(
                    SHADOW_BLUR_PX
                );
        }
    } else {
        ctx.strokeStyle = cutColors.normal;
        ctx.lineWidth = state.transform.coordinator.screenToWorldDistance(
            lineWidths.normal
        );
    }
}

/**
 * Common hitTest setup and validation
 * Returns null if no cuts to test, otherwise returns the hit tolerance and enabled cuts
 */
export function setupHitTest(
    state: RenderState,
    hitTolerancePx: number = DEFAULT_HIT_TOLERANCE_PX
): { hitTolerance: number; enabledCuts: Cut[] } | null {
    if (!state.cutsState || state.cutsState.cuts.length === 0) return null;

    const hitTolerance =
        state.transform.coordinator.screenToWorldDistance(hitTolerancePx);
    const enabledCuts = state.cutsState.cuts.filter((cut) =>
        isCutEnabledForRendering(cut, state)
    );

    return { hitTolerance, enabledCuts };
}
