/**
 * Common utility functions for renderers
 */

import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import type { Point2D, Shape, Line, Circle } from '$lib/types';
import type { Path } from '$lib/stores/paths/interfaces';

/**
 * Constants for renderer utilities
 */
const SHADOW_BLUR_PX = 4;
const DEFAULT_HIT_TOLERANCE_PX = 5;

/**
 * Calculate distance from a point to a shape
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
    return 0;
}

/**
 * Check if a path is enabled and should be rendered
 */
export function isPathEnabledForRendering(
    path: Path,
    state: RenderState
): boolean {
    const operation = state.operations.find((op) => op.id === path.operationId);
    return !!(operation && operation.enabled && path.enabled);
}

/**
 * Apply common path styling based on selection and hover state
 */
export function applyPathStyling(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
    isSelected: boolean,
    isHighlighted: boolean,
    pathColors: {
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
        ctx.strokeStyle = pathColors.selectedDark;
        ctx.lineWidth = state.transform.coordinator.screenToWorldDistance(
            lineWidths.selected
        );
    } else if (isHighlighted) {
        ctx.strokeStyle = pathColors.highlighted;
        ctx.lineWidth = state.transform.coordinator.screenToWorldDistance(
            lineWidths.highlighted
        );
        if (enableShadow) {
            ctx.shadowColor = pathColors.highlighted;
            ctx.shadowBlur =
                state.transform.coordinator.screenToWorldDistance(
                    SHADOW_BLUR_PX
                );
        }
    } else {
        ctx.strokeStyle = pathColors.normal;
        ctx.lineWidth = state.transform.coordinator.screenToWorldDistance(
            lineWidths.normal
        );
    }
}

/**
 * Common hitTest setup and validation
 * Returns null if no paths to test, otherwise returns the hit tolerance and enabled paths
 */
export function setupHitTest(
    state: RenderState,
    hitTolerancePx: number = DEFAULT_HIT_TOLERANCE_PX
): { hitTolerance: number; enabledPaths: Path[] } | null {
    if (!state.pathsState || state.pathsState.paths.length === 0) return null;

    const hitTolerance =
        state.transform.coordinator.screenToWorldDistance(hitTolerancePx);
    const enabledPaths = state.pathsState.paths.filter((path) =>
        isPathEnabledForRendering(path, state)
    );

    return { hitTolerance, enabledPaths };
}
