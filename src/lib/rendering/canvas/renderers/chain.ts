/**
 * ChainRenderer - Renders chain highlighting and visualization
 *
 * Chains are collections of connected shapes. This renderer handles:
 * - Chain highlighting (when selected or hovered)
 * - Chain endpoint markers
 * - Chain closure indicators
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import { LayerId } from '$lib/rendering/canvas/layers/types';
import type { Point2D, Shape } from '$lib/types';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import {
    HitTestType,
    HitTestUtils,
} from '$lib/rendering/canvas/utils/hit-test';
import { getChainById } from '$lib/stores/chains/functions';
import { drawShape } from '$lib/rendering/canvas/shape-drawing';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';

// Constants for rendering
const HIGHLIGHT_LINE_WIDTH = 2.5;
const SELECTION_LINE_WIDTH = 3;
const ENDPOINT_SIZE = 6;
const HIT_TEST_TOLERANCE = 5;

export class ChainRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('chain-renderer', LayerId.CHAINS, coordinator);
    }

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        if (
            !state.visibility.showChains ||
            !state.chains.length ||
            !state.drawing
        ) {
            return;
        }

        // Render highlighted chain
        if (state.selection.highlightedChainId) {
            this.renderHighlightedChain(
                ctx,
                state,
                state.selection.highlightedChainId
            );
        }

        // Render selected chain (if different from highlighted)
        if (
            state.selection.selectedChainId &&
            state.selection.selectedChainId !==
                state.selection.highlightedChainId
        ) {
            this.renderSelectedChain(
                ctx,
                state,
                state.selection.selectedChainId
            );
        }

        // Render chain endpoints if in prepare stage
        if (state.stage === 'prepare') {
            this.renderChainEndpoints(ctx, state);
        }
    }

    private renderHighlightedChain(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        chainId: string
    ): void {
        const chain = getChainById(chainId, state.chains);
        if (!chain) return;

        ctx.save();

        // Use orange highlighting for highlighted chains
        ctx.strokeStyle = '#ff6600'; // Orange
        ctx.lineWidth =
            state.transform.coordinator.screenToWorldDistance(
                HIGHLIGHT_LINE_WIDTH
            );
        ctx.setLineDash([]);

        // Draw all shapes in the chain with highlight style
        for (const chainShape of chain.shapes) {
            const shape = state.drawing?.shapes.find(
                (s) => s.id === chainShape.id
            );
            if (shape) {
                drawShape(ctx, shape);
            }
        }

        ctx.restore();
    }

    private renderSelectedChain(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        chainId: string
    ): void {
        const chain = getChainById(chainId, state.chains);
        if (!chain) return;

        ctx.save();

        // Use thicker orange for selected chains
        ctx.strokeStyle = '#ff6600'; // Orange
        ctx.lineWidth =
            state.transform.coordinator.screenToWorldDistance(
                SELECTION_LINE_WIDTH
            );
        ctx.setLineDash([]);

        // Draw all shapes in the chain with selection style
        for (const chainShape of chain.shapes) {
            const shape = state.drawing?.shapes.find(
                (s) => s.id === chainShape.id
            );
            if (shape) {
                drawShape(ctx, shape);
            }
        }

        ctx.restore();
    }

    private renderChainEndpoints(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        for (const chain of state.chains) {
            if (chain.shapes.length === 0) continue;

            // Get start and end points of the chain
            const startShape = state.drawing?.shapes.find(
                (s) => s.id === chain.shapes[0].id
            );
            const endShape = state.drawing?.shapes.find(
                (s) => s.id === chain.shapes[chain.shapes.length - 1].id
            );

            if (startShape) {
                const startPoint = this.getShapeStartPoint(startShape);
                if (startPoint) {
                    this.drawChainEndpoint(ctx, state, startPoint, 'start');
                }
            }

            if (endShape && chain.clockwise === null) {
                // Only draw end point for open chains (clockwise === null)
                const endPoint = this.getShapeEndPoint(endShape);
                if (endPoint) {
                    this.drawChainEndpoint(ctx, state, endPoint, 'end');
                }
            }
        }
    }

    private drawChainEndpoint(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        point: Point2D,
        type: 'start' | 'end'
    ): void {
        const size =
            state.transform.coordinator.screenToWorldDistance(ENDPOINT_SIZE);

        ctx.save();

        // Draw white border
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(
            point.x,
            point.y,
            size + state.transform.coordinator.screenToWorldDistance(1),
            0,
            2 * Math.PI
        );
        ctx.fill();

        // Draw colored center
        if (type === 'start') {
            ctx.fillStyle = 'rgb(0, 133, 84)'; // Emerald green
        } else {
            ctx.fillStyle = 'rgb(133, 18, 0)'; // Red
        }

        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, 2 * Math.PI);
        ctx.fill();

        ctx.restore();
    }

    private getShapeStartPoint(shape: Shape): Point2D | null {
        switch (shape.type) {
            case 'line':
                return {
                    x: (shape.geometry as any).start.x,
                    y: (shape.geometry as any).start.y,
                };
            case 'polyline':
                const polyline = shape.geometry as any;
                return polyline.points && polyline.points.length > 0
                    ? { x: polyline.points[0].x, y: polyline.points[0].y }
                    : null;
            case 'spline':
                const spline = shape.geometry as any;
                return spline.points && spline.points.length > 0
                    ? { x: spline.points[0].x, y: spline.points[0].y }
                    : null;
            case 'circle':
            case 'arc':
            case 'ellipse':
                return {
                    x: (shape.geometry as any).center.x,
                    y: (shape.geometry as any).center.y,
                };
            default:
                return null;
        }
    }

    private getShapeEndPoint(shape: Shape): Point2D | null {
        switch (shape.type) {
            case 'line':
                return {
                    x: (shape.geometry as any).end.x,
                    y: (shape.geometry as any).end.y,
                };
            case 'polyline':
                const polyline = shape.geometry as any;
                if (!polyline.points || polyline.points.length === 0)
                    return null;
                const lastIndex = polyline.points.length - 1;
                return {
                    x: polyline.points[lastIndex].x,
                    y: polyline.points[lastIndex].y,
                };
            case 'spline':
                const spline = shape.geometry as any;
                if (!spline.points || spline.points.length === 0) return null;
                const lastSplineIndex = spline.points.length - 1;
                return lastSplineIndex >= 0
                    ? {
                          x: spline.points[lastSplineIndex].x,
                          y: spline.points[lastSplineIndex].y,
                      }
                    : null;
            case 'circle':
            case 'arc':
            case 'ellipse':
                return {
                    x: (shape.geometry as any).center.x,
                    y: (shape.geometry as any).center.y,
                };
            default:
                return null;
        }
    }

    hitWorld(point: Point2D, state: RenderState): HitTestResult | null {
        if (
            !state.visibility.showChains ||
            !state.chains.length ||
            !state.drawing
        ) {
            return null;
        }

        // Test for chain hit by testing if any shape in any chain is hit
        for (const chain of state.chains) {
            for (const chainShape of chain.shapes) {
                const shape = state.drawing.shapes.find(
                    (s) => s.id === chainShape.id
                );
                if (shape && this.isPointNearShape(point, shape, state)) {
                    return {
                        type: HitTestType.CHAIN,
                        id: chain.id,
                        distance: 0, // Could calculate actual distance if needed
                        point: point,
                        metadata: {
                            chainId: chain.id,
                            shapeId: shape.id,
                        },
                    };
                }
            }
        }

        return null;
    }

    private isPointNearShape(
        point: Point2D,
        shape: Shape,
        state: RenderState
    ): boolean {
        const tolerance =
            state.transform.coordinator.screenToWorldDistance(
                HIT_TEST_TOLERANCE
            );

        switch (shape.type) {
            case 'line':
                const line = shape.geometry as any;
                return (
                    HitTestUtils.distanceToLineSegment(
                        point,
                        line.start,
                        line.end
                    ) <= tolerance
                );
            case 'circle':
                const circle = shape.geometry as any;
                const distToCenter = HitTestUtils.distance(
                    point,
                    circle.center
                );
                return Math.abs(distToCenter - circle.radius) <= tolerance;
            case 'arc':
                const arc = shape.geometry as any;
                const distToCenterArc = HitTestUtils.distance(
                    point,
                    arc.center
                );
                if (Math.abs(distToCenterArc - arc.radius) > tolerance)
                    return false;

                const angle = Math.atan2(
                    point.y - arc.center.y,
                    point.x - arc.center.x
                );
                return this.isAngleInArcRange(
                    angle,
                    arc.startAngle,
                    arc.endAngle,
                    arc.clockwise
                );
            case 'polyline':
                const polyline = shape.geometry as any;
                for (let i = 0; i < polyline.points.length - 1; i++) {
                    if (
                        HitTestUtils.distanceToLineSegment(
                            point,
                            polyline.points[i],
                            polyline.points[i + 1]
                        ) <= tolerance
                    ) {
                        return true;
                    }
                }
                return false;
            default:
                return false;
        }
    }

    private isAngleInArcRange(
        angle: number,
        startAngle: number,
        endAngle: number,
        clockwise: boolean
    ): boolean {
        // Normalize angles to [0, 2π]
        const normalizeAngle = (a: number) => {
            while (a < 0) a += 2 * Math.PI;
            while (a >= 2 * Math.PI) a -= 2 * Math.PI;
            return a;
        };

        angle = normalizeAngle(angle);
        startAngle = normalizeAngle(startAngle);
        endAngle = normalizeAngle(endAngle);

        if (clockwise) {
            if (startAngle > endAngle) {
                return angle >= startAngle || angle <= endAngle;
            } else {
                return angle >= startAngle && angle <= endAngle;
            }
        } else {
            if (startAngle < endAngle) {
                return angle >= startAngle && angle <= endAngle;
            } else {
                return angle >= startAngle || angle <= endAngle;
            }
        }
    }
}
