/**
 * ChainRenderer - Renders chain highlighting and visualization
 *
 * Chains are collections of connected shapes. This renderer handles:
 * - Chain highlighting (when selected or hovered)
 * - Chain endpoint markers
 * - Chain closure indicators
 */
import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import { LayerId } from '$lib/rendering/canvas/layers/types';
import type { Point2D } from '$lib/types';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import {
    HitTestType,
    HitTestUtils,
} from '$lib/rendering/canvas/utils/hit-test';
import { getChainById } from '$lib/stores/chains/functions';
import { drawShape } from '$lib/rendering/canvas/shape-drawing';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import { getChainTangent } from '$lib/geometry/chain/functions';
import type { Chain } from '$lib/geometry/chain/interfaces';
import {
    getShapeStartPoint,
    getShapeEndPoint,
} from '$lib/geometry/shape/functions';

// Constants for rendering
const HIGHLIGHT_LINE_WIDTH = 2.5;
const SELECTION_LINE_WIDTH = 3;
const ENDPOINT_SIZE = 6;
const HIT_TEST_TOLERANCE = 5;
const TANGENT_LINE_LENGTH = 50; // Length of tangent lines in screen pixels
const TANGENT_LINE_WIDTH = 2;

export class ChainRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('chain-renderer', LayerId.CHAINS, coordinator);
    }

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        // Check basic requirements
        if (!state.chains.length || !state.drawing) {
            return;
        }

        // Render chain highlights only if showChains is true
        if (state.visibility.showChains) {
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
        }

        // Always render chain endpoints and tangents if in prepare stage
        // (regardless of showChains setting)
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
                const startPoint = getShapeStartPoint(startShape);
                if (startPoint) {
                    // Draw start point marker if enabled
                    if (state.visibility.showChainStartPoints) {
                        this.drawChainEndpoint(ctx, state, startPoint, 'start');
                    }
                    // Draw tangent line at start point if enabled
                    if (state.visibility.showChainTangentLines) {
                        this.drawChainTangent(
                            ctx,
                            state,
                            chain,
                            startPoint,
                            true
                        );
                    }
                }
            }

            if (endShape) {
                const endPoint = getShapeEndPoint(endShape);
                if (endPoint) {
                    // Draw end point marker for open chains if enabled
                    if (
                        chain.clockwise === null &&
                        state.visibility.showChainEndPoints
                    ) {
                        this.drawChainEndpoint(ctx, state, endPoint, 'end');
                    }
                    // Draw tangent line at end point if enabled
                    if (state.visibility.showChainTangentLines) {
                        this.drawChainTangent(
                            ctx,
                            state,
                            chain,
                            endPoint,
                            false
                        );
                    }
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

    private drawChainTangent(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        chain: Chain,
        point: Point2D,
        isStart: boolean
    ): void {
        // Get the tangent direction at this point
        const tangent = getChainTangent(chain, point, isStart);

        // Normalize the tangent vector
        const magnitude = Math.sqrt(
            tangent.x * tangent.x + tangent.y * tangent.y
        );
        if (magnitude === 0) return; // Skip if zero vector

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

        // Calculate start and end points of the tangent line
        const startPoint = {
            x: point.x - normalizedTangent.x * tangentLength,
            y: point.y - normalizedTangent.y * tangentLength,
        };
        const endPoint = {
            x: point.x + normalizedTangent.x * tangentLength,
            y: point.y + normalizedTangent.y * tangentLength,
        };

        ctx.save();

        // Set yellow color and line style
        ctx.strokeStyle = '#ffff00'; // Yellow
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([]);

        // Draw the tangent line
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        ctx.stroke();

        ctx.restore();
    }

    hitWorld(point: Point2D, state: RenderState): HitTestResult | null {
        if (
            !state.visibility.showChains ||
            !state.chains.length ||
            !state.drawing
        ) {
            return null;
        }

        const tolerance =
            state.transform.coordinator.screenToWorldDistance(
                HIT_TEST_TOLERANCE
            );

        // Test for chain hit by testing if any shape in any chain is hit
        for (const chain of state.chains) {
            for (const chainShape of chain.shapes) {
                const shape = state.drawing.shapes.find(
                    (s) => s.id === chainShape.id
                );
                if (
                    shape &&
                    HitTestUtils.isPointNearShape(point, shape, tolerance)
                ) {
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
}
