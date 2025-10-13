import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import { screenToWorldDistance } from '$lib/rendering/canvas/state/render-state';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import {
    HitTestType,
    HitTestUtils,
} from '$lib/rendering/canvas/utils/hit-test';
import type { Point2D, Shape, Line, Arc } from '$lib/types';
import { drawShape } from '$lib/rendering/canvas/shape-drawing';
import type { Cut } from '$lib/stores/cuts/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { LayerId as LayerIdEnum } from '$lib/rendering/canvas/layers/types';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import {
    getShapeStartPoint,
    getShapeEndPoint,
} from '$lib/geometry/shape/functions';
import {
    isCutEnabledForRendering,
    applyCutStyling,
    setupHitTest,
} from '$lib/rendering/canvas/utils/renderer-utils';
import { drawNormalLine } from './normal-renderer-utils';

/**
 * Constants for cut rendering
 */
const OFFSET_LINE_WIDTH = 1;
const SELECTED_OFFSET_LINE_WIDTH = 1;
const SELECTED_CUT_LINE_WIDTH = 1;
const HIGHLIGHTED_CUT_LINE_WIDTH = 1;
const GAP_FILL_LINE_WIDTH = 1;
const ENDPOINT_RADIUS_PX = 3;
const HIT_TOLERANCE_PX = 5;

/**
 * Determines which shapes to use for a cut.
 * Priority: offset shapes > cutChain shapes > original chain shapes
 */
function getShapesForCut(cut: Cut, chains: Chain[]): Shape[] | null {
    if (cut.offset?.offsetShapes && cut.offset.offsetShapes.length > 0) {
        return cut.offset.offsetShapes;
    } else if (cut.cutChain?.shapes && cut.cutChain.shapes.length > 0) {
        return cut.cutChain.shapes;
    } else {
        const chain = chains.find((c) => c.id === cut.chainId);
        if (chain && chain.shapes.length > 0) {
            return chain.shapes;
        }
    }
    return null;
}

/**
 * CutRenderer handles rendering of cuts including:
 * - Offset cut geometry (green lines)
 * - Gap fills
 * - Cut start/end point markers
 */
export class CutRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('cut', LayerIdEnum.OFFSETS, coordinator);
    }

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        if (!state.cutsState || state.cutsState.cuts.length === 0) return;

        // First render cut geometry if enabled
        if (state.visibility.showCutPaths) {
            this.drawCuts(ctx, state);
        }

        // Render cutter path if enabled
        if (state.visibility.showCutter) {
            this.drawCutterPath(ctx, state);
        }

        // Then render endpoints on top if enabled
        if (
            state.visibility.showCutStartPoints ||
            state.visibility.showCutEndPoints
        ) {
            this.drawCutEndpoints(ctx, state);
        }

        // Render cut tangents if enabled
        if (state.visibility.showCutTangentLines) {
            this.drawCutTangents(ctx, state);
        }

        // Render cut normals if enabled
        if (state.visibility.showCutNormals) {
            this.drawCutNormals(ctx, state);
        }
    }

    /**
     * Draw cuts as solid green lines
     * Uses offset shapes if available, otherwise falls back to cutChain or original chain shapes
     */
    private drawCuts(ctx: CanvasRenderingContext2D, state: RenderState): void {
        if (!state.cutsState || state.cutsState.cuts.length === 0) return;

        state.cutsState.cuts.forEach((cut: Cut) => {
            // Only draw cuts for enabled cuts with enabled operations
            if (!isCutEnabledForRendering(cut, state)) {
                return;
            }

            // Determine which shapes to render
            // Priority: offset shapes > cutChain shapes > original chain shapes
            let shapesToDraw: Shape[] | null = null;

            if (
                cut.offset?.offsetShapes &&
                cut.offset.offsetShapes.length > 0
            ) {
                // Use offset shapes if available (kerf compensation applied)
                shapesToDraw = cut.offset.offsetShapes;
            } else if (cut.cutChain?.shapes && cut.cutChain.shapes.length > 0) {
                // Use cutChain if no offset (kerf compensation NONE)
                shapesToDraw = cut.cutChain.shapes;
            } else {
                // Fall back to original chain shapes
                const chain = state.chains.find((c) => c.id === cut.chainId);
                if (chain && chain.shapes.length > 0) {
                    shapesToDraw = chain.shapes;
                }
            }

            if (!shapesToDraw || shapesToDraw.length === 0) {
                return;
            }

            const isCutSelected =
                state.selection.selectedCutId &&
                state.selection.selectedCutId === cut.id;
            const isCutHighlighted =
                state.selection.highlightedCutId &&
                state.selection.highlightedCutId === cut.id;

            ctx.save();

            try {
                // Define color constants for visual consistency
                const cutColors = {
                    offsetGreen: 'rgb(0, 133, 84)', // Green for cuts
                    selectedDark: '#ff9933', // Light orange for selected
                    highlighted: '#ff9933', // Light orange for highlighted
                };

                // Draw cut shapes as solid green lines
                ctx.setLineDash([]); // Solid line pattern
                ctx.shadowColor = 'transparent'; // Reset shadow
                ctx.shadowBlur = 0;

                // Maintain professional line appearance
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                shapesToDraw.forEach((shape, index) => {
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
                            applyCutStyling(
                                ctx,
                                state,
                                !!isCutSelected,
                                !!isCutHighlighted,
                                {
                                    selectedDark: cutColors.selectedDark,
                                    highlighted: cutColors.highlighted,
                                    normal: cutColors.offsetGreen,
                                },
                                {
                                    selected: SELECTED_CUT_LINE_WIDTH,
                                    highlighted: HIGHLIGHTED_CUT_LINE_WIDTH,
                                    normal: OFFSET_LINE_WIDTH,
                                }
                            );
                        }

                        drawShape(ctx, shape);

                        // Reset shadow after each shape if it was applied
                        if (isCutHighlighted && !isOffsetShapeSelected) {
                            ctx.shadowColor = 'transparent';
                            ctx.shadowBlur = 0;
                        }
                    } catch (error) {
                        console.warn(
                            `Error rendering offset shape ${index} for cut ${cut.id}:`,
                            error
                        );
                    }
                });

                // Render gap fills if they exist (only applies to offset cuts)
                if (cut.offset?.gapFills && cut.offset.gapFills.length > 0) {
                    ctx.save();

                    // Use same color logic as offset shapes for consistency
                    applyCutStyling(
                        ctx,
                        state,
                        !!isCutSelected,
                        !!isCutHighlighted,
                        {
                            selectedDark: cutColors.selectedDark,
                            highlighted: cutColors.highlighted,
                            normal: cutColors.offsetGreen,
                        },
                        {
                            selected: SELECTED_CUT_LINE_WIDTH,
                            highlighted: HIGHLIGHTED_CUT_LINE_WIDTH,
                            normal: GAP_FILL_LINE_WIDTH,
                        }
                    );
                    ctx.setLineDash([]); // Solid line

                    for (const gapFill of cut.offset.gapFills) {
                        // Render filler shape if it exists
                        if (gapFill.fillerShape) {
                            try {
                                drawShape(ctx, gapFill.fillerShape);
                            } catch (error) {
                                console.warn(
                                    `Error rendering gap filler shape for cut ${cut.id}:`,
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
                    if (isCutHighlighted) {
                        ctx.shadowColor = 'transparent';
                        ctx.shadowBlur = 0;
                    }

                    ctx.restore();
                }
            } catch (error) {
                console.error(`Error rendering cut ${cut.id}:`, error);
            } finally {
                ctx.restore();
            }
        });
    }

    /**
     * Draw cutter path visualization (translucent yellow stroke matching kerf width)
     */
    private drawCutterPath(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        if (!state.cutsState || state.cutsState.cuts.length === 0) return;

        state.cutsState.cuts.forEach((cut: Cut) => {
            // Only draw cutter for enabled cuts with enabled operations
            if (!isCutEnabledForRendering(cut, state)) {
                return;
            }

            // Get kerf width from offset (if exists) or directly from cut
            const kerfWidth = cut.offset?.kerfWidth || cut.kerfWidth;
            if (!kerfWidth) {
                return;
            }

            // Determine which shapes to render cutter on
            // Priority: offset shapes > cutChain shapes > original chain shapes
            let shapesToDraw: Shape[] | null = null;

            if (
                cut.offset?.offsetShapes &&
                cut.offset.offsetShapes.length > 0
            ) {
                shapesToDraw = cut.offset.offsetShapes;
            } else if (cut.cutChain?.shapes && cut.cutChain.shapes.length > 0) {
                shapesToDraw = cut.cutChain.shapes;
            } else {
                const chain = state.chains.find((c) => c.id === cut.chainId);
                if (chain && chain.shapes.length > 0) {
                    shapesToDraw = chain.shapes;
                }
            }

            if (!shapesToDraw || shapesToDraw.length === 0) {
                return;
            }

            ctx.save();

            try {
                // Set translucent yellow stroke with kerf width
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)'; // Translucent yellow
                ctx.lineWidth = kerfWidth;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.setLineDash([]); // Solid line

                // Draw all shapes with cutter visualization
                shapesToDraw.forEach((shape) => {
                    try {
                        drawShape(ctx, shape);
                    } catch (error) {
                        console.warn(
                            `Error rendering cutter path shape for cut ${cut.id}:`,
                            error
                        );
                    }
                });

                // Also draw gap fills if they exist (only for offset cuts)
                if (cut.offset?.gapFills && cut.offset.gapFills.length > 0) {
                    for (const gapFill of cut.offset.gapFills) {
                        // Render filler shape if it exists
                        if (gapFill.fillerShape) {
                            try {
                                drawShape(ctx, gapFill.fillerShape);
                            } catch (error) {
                                console.warn(
                                    `Error rendering cutter path gap filler for cut ${cut.id}:`,
                                    error
                                );
                            }
                        }

                        // Render modified shapes
                        for (const modifiedShapeEntry of gapFill.modifiedShapes) {
                            drawShape(ctx, modifiedShapeEntry.modified);
                        }
                    }
                }
            } catch (error) {
                console.error(
                    `Error rendering cutter path for cut ${cut.id}:`,
                    error
                );
            } finally {
                ctx.restore();
            }
        });
    }

    /**
     * Draw cut start/end points as colored circles
     */
    private drawCutEndpoints(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        if (!state.cutsState || state.cutsState.cuts.length === 0) return;

        const pointRadius = screenToWorldDistance(state, ENDPOINT_RADIUS_PX); // Fixed size regardless of zoom

        state.cutsState.cuts.forEach((cut: Cut) => {
            // Only draw endpoints for enabled cuts with enabled operations
            if (!isCutEnabledForRendering(cut, state)) return;

            const shapesToUse = getShapesForCut(cut, state.chains);
            if (!shapesToUse || shapesToUse.length === 0) return;

            // Get first and last shape
            const firstShape = shapesToUse[0];
            const lastShape = shapesToUse[shapesToUse.length - 1];

            if (!firstShape || !lastShape) return;

            // Get start point of first shape
            if (state.visibility.showCutStartPoints) {
                const startPoint = getShapeStartPoint(firstShape);
                if (startPoint) {
                    ctx.save();
                    ctx.fillStyle = 'rgb(0, 133, 84)'; // Green for start
                    ctx.beginPath();
                    ctx.arc(
                        startPoint.x,
                        startPoint.y,
                        pointRadius,
                        0,
                        2 * Math.PI
                    );
                    ctx.fill();
                    ctx.restore();
                }
            }

            // Get end point of last shape
            if (state.visibility.showCutEndPoints) {
                const endPoint = getShapeEndPoint(lastShape);
                if (endPoint) {
                    ctx.save();
                    ctx.fillStyle = 'rgb(133, 18, 0)'; // Red for end
                    ctx.beginPath();
                    ctx.arc(
                        endPoint.x,
                        endPoint.y,
                        pointRadius,
                        0,
                        2 * Math.PI
                    );
                    ctx.fill();
                    ctx.restore();
                }
            }
        });
    }

    /**
     * Draw cut tangents (tangent direction lines at cut start point)
     */
    private drawCutTangents(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        if (!state.cutsState || state.cutsState.cuts.length === 0) return;

        const TANGENT_LINE_LENGTH = 50; // Length in screen pixels
        const TANGENT_LINE_WIDTH = 1;
        const ARROW_SIZE = 10; // Arrow head size in screen pixels
        const ARROW_ANGLE_DENOMINATOR = 6; // Divisor for PI to get 30 degrees
        const ARROW_ANGLE = Math.PI / ARROW_ANGLE_DENOMINATOR;

        state.cutsState.cuts.forEach((cut: Cut) => {
            // Only draw tangents for enabled cuts with enabled operations
            if (!isCutEnabledForRendering(cut, state)) return;

            const shapesToUse = getShapesForCut(cut, state.chains);
            if (!shapesToUse || shapesToUse.length === 0) return;

            // Get first shape
            const firstShape = shapesToUse[0];
            if (!firstShape) return;

            const startPoint = getShapeStartPoint(firstShape);
            if (!startPoint) return;

            // Get the tangent at the start of the first shape
            let tangent: Point2D;
            switch (firstShape.type) {
                case 'line': {
                    const lineGeometry = firstShape.geometry as Line;
                    tangent = {
                        x: lineGeometry.end.x - lineGeometry.start.x,
                        y: lineGeometry.end.y - lineGeometry.start.y,
                    };
                    break;
                }
                case 'arc': {
                    // For arc, calculate tangent at start
                    const arc = firstShape.geometry as Arc;
                    // Tangent is perpendicular to radius at start angle
                    if (arc.clockwise) {
                        tangent = {
                            x: -Math.sin(arc.startAngle),
                            y: Math.cos(arc.startAngle),
                        };
                    } else {
                        tangent = {
                            x: Math.sin(arc.startAngle),
                            y: -Math.cos(arc.startAngle),
                        };
                    }
                    break;
                }
                default:
                    // For other shapes, use simple forward difference
                    if (shapesToUse.length > 1) {
                        const secondShape = shapesToUse[1];
                        const secondStart = getShapeStartPoint(secondShape);
                        if (secondStart) {
                            tangent = {
                                x: secondStart.x - startPoint.x,
                                y: secondStart.y - startPoint.y,
                            };
                        } else {
                            return;
                        }
                    } else {
                        return;
                    }
            }

            // Normalize the tangent vector
            const magnitude = Math.sqrt(
                tangent.x * tangent.x + tangent.y * tangent.y
            );
            if (magnitude === 0) return;

            const normalizedTangent = {
                x: tangent.x / magnitude,
                y: tangent.y / magnitude,
            };

            // Calculate the length in world coordinates
            const tangentLength =
                state.transform.coordinator.screenToWorldDistance(
                    TANGENT_LINE_LENGTH
                );
            const lineWidth =
                state.transform.coordinator.screenToWorldDistance(
                    TANGENT_LINE_WIDTH
                );
            const arrowSize =
                state.transform.coordinator.screenToWorldDistance(ARROW_SIZE);

            // Calculate end point of the tangent line (pointing in cut direction)
            const endPoint = {
                x: startPoint.x + normalizedTangent.x * tangentLength,
                y: startPoint.y + normalizedTangent.y * tangentLength,
            };

            ctx.save();

            // Set purple color and line style
            ctx.strokeStyle = '#800080'; // Purple
            ctx.fillStyle = '#800080'; // Purple for arrow
            ctx.lineWidth = lineWidth;
            ctx.setLineDash([]);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Draw the tangent line from start point to end point
            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            ctx.lineTo(endPoint.x, endPoint.y);
            ctx.stroke();

            // Draw arrow head at the end point
            // Calculate arrow points
            const arrowLeft = {
                x:
                    endPoint.x -
                    arrowSize *
                        Math.cos(
                            Math.atan2(
                                normalizedTangent.y,
                                normalizedTangent.x
                            ) - ARROW_ANGLE
                        ),
                y:
                    endPoint.y -
                    arrowSize *
                        Math.sin(
                            Math.atan2(
                                normalizedTangent.y,
                                normalizedTangent.x
                            ) - ARROW_ANGLE
                        ),
            };
            const arrowRight = {
                x:
                    endPoint.x -
                    arrowSize *
                        Math.cos(
                            Math.atan2(
                                normalizedTangent.y,
                                normalizedTangent.x
                            ) + ARROW_ANGLE
                        ),
                y:
                    endPoint.y -
                    arrowSize *
                        Math.sin(
                            Math.atan2(
                                normalizedTangent.y,
                                normalizedTangent.x
                            ) + ARROW_ANGLE
                        ),
            };

            // Fill arrow head
            ctx.beginPath();
            ctx.moveTo(endPoint.x, endPoint.y);
            ctx.lineTo(arrowLeft.x, arrowLeft.y);
            ctx.lineTo(arrowRight.x, arrowRight.y);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        });
    }

    /**
     * Draw cut normals (perpendicular direction lines)
     */
    private drawCutNormals(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        if (!state.cutsState || state.cutsState.cuts.length === 0) return;

        state.cutsState.cuts.forEach((cut: Cut) => {
            // Only draw normals for enabled cuts with enabled operations
            if (!isCutEnabledForRendering(cut, state)) return;

            // Draw the normal using the stored normal and connection point
            if (cut.normal && cut.normalConnectionPoint) {
                drawNormalLine(
                    ctx,
                    state,
                    cut.normalConnectionPoint,
                    cut.normal,
                    'rgba(0, 255, 255, 0.6)' // Cyan color to distinguish from lead normals (orange)
                );
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
            console.error('CutRenderer.hitWorld: invalid point', point);
            return null;
        }

        const hitSetup = setupHitTest(state, HIT_TOLERANCE_PX);
        if (!hitSetup) return null;

        const { hitTolerance, enabledCuts } = hitSetup;

        // First test for cut geometry hits
        for (const cut of enabledCuts) {
            // Determine which shapes to test for hit
            // Priority: offset shapes > cutChain shapes > original chain shapes
            let shapesToTest: Shape[] | null = null;

            if (
                cut.offset?.offsetShapes &&
                cut.offset.offsetShapes.length > 0
            ) {
                shapesToTest = cut.offset.offsetShapes;
            } else if (cut.cutChain?.shapes && cut.cutChain.shapes.length > 0) {
                shapesToTest = cut.cutChain.shapes;
            } else {
                const chain = state.chains.find((c) => c.id === cut.chainId);
                if (chain && chain.shapes.length > 0) {
                    shapesToTest = chain.shapes;
                }
            }

            if (!shapesToTest) continue;

            // Test shapes for cut hit
            for (const shape of shapesToTest) {
                if (HitTestUtils.isPointNearShape(point, shape, hitTolerance)) {
                    return {
                        type: HitTestType.CUT,
                        id: cut.id,
                        distance: hitTolerance,
                        point,
                        metadata: { cutId: cut.id },
                    };
                }
            }
        }

        // Then test for endpoint hits
        for (const cut of enabledCuts) {
            const shapesToUse = getShapesForCut(cut, state.chains);
            if (!shapesToUse || shapesToUse.length === 0) continue;

            // Check if point is near cut endpoint
            const firstShape = shapesToUse[0];
            const lastShape = shapesToUse[shapesToUse.length - 1];

            if (firstShape) {
                const startPoint = getShapeStartPoint(firstShape);
                if (startPoint) {
                    const dx = point.x - startPoint.x;
                    const dy = point.y - startPoint.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance <= hitTolerance) {
                        return {
                            type: HitTestType.CUT,
                            id: cut.id,
                            distance,
                            point: startPoint,
                            metadata: { endpoint: 'start' },
                        };
                    }
                }
            }

            if (lastShape) {
                const endPoint = getShapeEndPoint(lastShape);
                if (endPoint) {
                    const dx = point.x - endPoint.x;
                    const dy = point.y - endPoint.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance <= hitTolerance) {
                        return {
                            type: HitTestType.CUT,
                            id: cut.id,
                            distance,
                            point: endPoint,
                            metadata: { endpoint: 'end' },
                        };
                    }
                }
            }
        }

        return null;
    }
}
