import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import { HitTestType } from '$lib/rendering/canvas/utils/hit-test';
import type { Point2D, Shape } from '$lib/types';
import { drawShape } from '$lib/rendering/canvas/shape-drawing';
import type { Path } from '$lib/stores/paths/interfaces';
import { LayerId as LayerIdEnum } from '$lib/rendering/canvas/layers/types';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import {
    calculatePointToShapeDistance,
    isPathEnabledForRendering,
    applyPathStyling,
    setupHitTest,
} from '$lib/rendering/canvas/utils/renderer-utils';

/**
 * Constants for offset rendering
 */
const OFFSET_LINE_WIDTH = 2;
const SELECTED_OFFSET_LINE_WIDTH = 2;
const SELECTED_PATH_LINE_WIDTH = 3;
const HIGHLIGHTED_PATH_LINE_WIDTH = 2.5;
const GAP_FILL_LINE_WIDTH = 2;
const HIT_TOLERANCE_PX = 5;

/**
 * OffsetRenderer handles rendering of offset paths (original dashed + offset solid)
 */
export class OffsetRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('offset', LayerIdEnum.OFFSETS, coordinator);
    }

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        if (!state.pathsState || state.pathsState.paths.length === 0) {
            return;
        }

        this.drawOffsetPaths(ctx, state);
    }

    /**
     * Draw offset paths with original shapes as dashed lines and offset shapes as solid lines
     */
    private drawOffsetPaths(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        if (!state.pathsState || state.pathsState.paths.length === 0) return;

        state.pathsState.paths.forEach((path: Path) => {
            // Only draw offset paths for enabled paths with enabled operations
            if (!isPathEnabledForRendering(path, state)) {
                return;
            }

            // Only draw if path has calculated offset
            if (!path.offset) {
                return;
            }

            // Validate offset geometry before rendering
            if (!path.offset.offsetShapes) {
                console.warn(
                    `Invalid offset geometry for path ${path.id}: missing offsetShapes`
                );
                return;
            }

            if (!Array.isArray(path.offset.offsetShapes)) {
                console.warn(
                    `Invalid offset geometry for path ${path.id}: offsetShapes is not an array`
                );
                return;
            }

            if (path.offset.offsetShapes.length === 0) {
                console.warn(
                    `Invalid offset geometry for path ${path.id}: empty offsetShapes array`
                );
                return;
            }

            const isPathSelected =
                state.selection.selectedPathId &&
                state.selection.selectedPathId === path.id;
            const isPathHighlighted =
                state.selection.highlightedPathId &&
                state.selection.highlightedPathId === path.id;

            ctx.save();

            try {
                // Define color constants for visual consistency
                const pathColors = {
                    offsetGreen: 'rgb(0, 133, 84)', // Green for offset paths
                    selectedDark: 'rgb(0, 133, 84)', // Dark green for selected
                    highlighted: 'rgb(0, 133, 84)', // Dark green for highlighted
                };

                // Draw offset shapes as solid green lines
                ctx.setLineDash([]); // Solid line pattern
                ctx.shadowColor = 'transparent'; // Reset shadow
                ctx.shadowBlur = 0;

                // Maintain professional line appearance
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                path.offset.offsetShapes.forEach((shape, index) => {
                    try {
                        // Check if this specific offset shape is selected
                        const isOffsetShapeSelected =
                            state.selection.selectedOffsetShape &&
                            state.selection.selectedOffsetShape.id === shape.id;

                        // Set styling based on selection state with proper hierarchy
                        if (isOffsetShapeSelected) {
                            ctx.strokeStyle = '#ff6600'; // Orange for selected offset shape
                            ctx.lineWidth =
                                state.transform.coordinator.screenToWorldDistance(
                                    SELECTED_OFFSET_LINE_WIDTH
                                ); // 2px selected offset shape
                        } else {
                            applyPathStyling(
                                ctx,
                                state,
                                !!isPathSelected,
                                !!isPathHighlighted,
                                {
                                    selectedDark: pathColors.selectedDark,
                                    highlighted: pathColors.highlighted,
                                    normal: pathColors.offsetGreen,
                                },
                                {
                                    selected: SELECTED_PATH_LINE_WIDTH,
                                    highlighted: HIGHLIGHTED_PATH_LINE_WIDTH,
                                    normal: OFFSET_LINE_WIDTH,
                                }
                            );
                        }

                        drawShape(ctx, shape);

                        // Reset shadow after each shape if it was applied
                        if (isPathHighlighted && !isOffsetShapeSelected) {
                            ctx.shadowColor = 'transparent';
                            ctx.shadowBlur = 0;
                        }
                    } catch (error) {
                        console.warn(
                            `Error rendering offset shape ${index} for path ${path.id}:`,
                            error
                        );
                    }
                });

                // Render gap fills if they exist (filler shapes and modified shapes)
                if (path.offset.gapFills && path.offset.gapFills.length > 0) {
                    ctx.save();

                    // Use same color logic as offset shapes for consistency
                    applyPathStyling(
                        ctx,
                        state,
                        !!isPathSelected,
                        !!isPathHighlighted,
                        {
                            selectedDark: pathColors.selectedDark,
                            highlighted: pathColors.highlighted,
                            normal: pathColors.offsetGreen,
                        },
                        {
                            selected: SELECTED_PATH_LINE_WIDTH,
                            highlighted: HIGHLIGHTED_PATH_LINE_WIDTH,
                            normal: GAP_FILL_LINE_WIDTH,
                        }
                    );
                    ctx.setLineDash([]); // Solid line

                    for (const gapFill of path.offset.gapFills) {
                        // Render filler shape if it exists
                        if (gapFill.fillerShape) {
                            try {
                                drawShape(ctx, gapFill.fillerShape);
                            } catch (error) {
                                console.warn(
                                    `Error rendering gap filler shape for path ${path.id}:`,
                                    error
                                );
                            }
                        }

                        // Render modified shapes (these replace the original offset shapes in gap areas)
                        for (const modifiedShapeEntry of gapFill.modifiedShapes) {
                            drawShape(ctx, modifiedShapeEntry.modified);
                        }
                    }

                    // Reset shadow after gap fills if it was applied
                    if (isPathHighlighted) {
                        ctx.shadowColor = 'transparent';
                        ctx.shadowBlur = 0;
                    }

                    ctx.restore();
                }
            } catch (error) {
                console.error(`Error rendering offset path ${path.id}:`, error);
            } finally {
                ctx.restore();
            }
        });
    }

    hitWorld(point: Point2D, state: RenderState): HitTestResult | null {
        // Defensive check for point validity
        if (
            !point ||
            typeof point.x !== 'number' ||
            typeof point.y !== 'number'
        ) {
            console.error('OffsetRenderer.hitTest: invalid point', point);
            return null;
        }

        const hitSetup = setupHitTest(state, HIT_TOLERANCE_PX);
        if (!hitSetup) return null;

        const { hitTolerance, enabledPaths } = hitSetup;

        for (const path of enabledPaths) {
            // Only test if path has offset geometry
            if (!path.offset || !path.offset.offsetShapes) continue;

            // Test offset shapes
            for (const shape of path.offset.offsetShapes) {
                if (this.isPointNearShape(point, shape, hitTolerance)) {
                    const distance = calculatePointToShapeDistance(
                        point,
                        shape
                    );

                    return {
                        type: HitTestType.OFFSET,
                        id: shape.id,
                        distance,
                        point,
                        metadata: { pathId: path.id, shapeType: 'offset' },
                    };
                }
            }
        }

        return null;
    }

    /**
     * Check if a point is near a shape within tolerance using proper shape hit testing
     */
    private isPointNearShape(
        point: Point2D,
        shape: Shape,
        tolerance: number
    ): boolean {
        // Use the same comprehensive hit testing logic as ShapeRenderer
        return this.testShapeHit(point, shape, tolerance);
    }

    /**
     * Test if a point hits a shape using the same logic as ShapeRenderer
     */
    private testShapeHit(
        point: Point2D,
        shape: Shape,
        tolerance: number
    ): boolean {
        return calculatePointToShapeDistance(point, shape) <= tolerance;
    }
}
