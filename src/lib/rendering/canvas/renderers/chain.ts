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
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import {
    HitTestType,
    HitTestUtils,
} from '$lib/rendering/canvas/utils/hit-test';
import { getChainById } from '$lib/stores/chains/functions';
import { drawShape } from '$lib/rendering/canvas/shape-drawing';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import { Shape } from '$lib/geometry/shape/classes';
import {
    getChainTangent,
    tessellateChain,
} from '$lib/geometry/chain/functions';
import type { ChainData } from '$lib/geometry/chain/interfaces';
import type { PartVoid, PartSlot } from '$lib/cam/part/interfaces';
import {
    getShapeStartPoint,
    getShapeEndPoint,
    getShapeNormal,
} from '$lib/geometry/shape/functions';
import {
    drawNormalLine,
    drawTessellationPoint,
    getTessellationPointSize,
    getTessellationBorderWidth,
} from './normal-renderer-utils';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';

// Constants for rendering
const CHAIN_LINE_WIDTH = 1;
const HIGHLIGHT_LINE_WIDTH = 1;
const SELECTION_LINE_WIDTH = 1;
const ENDPOINT_SIZE = 6;
const HIT_TEST_TOLERANCE = 5;
const TANGENT_LINE_LENGTH = 50; // Length of tangent lines in screen pixels
const TANGENT_LINE_WIDTH = 1;

export class ChainRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('chain-renderer', LayerId.CHAINS, coordinator);
    }

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        // Check basic requirements
        if (!state.chains.length || !state.drawing) {
            return;
        }

        // Render chain shapes if showChainPaths is true
        if (state.visibility.showChainPaths) {
            this.renderChainShapes(ctx, state);
        }

        // Render chain highlights only if showChains and showChainPaths are true
        if (state.visibility.showChains && state.visibility.showChainPaths) {
            // Render highlighted part (if any)
            if (state.selection.highlightedPartId) {
                this.renderHighlightedPart(
                    ctx,
                    state,
                    state.selection.highlightedPartId
                );
            }

            // Render hovered part (if any and different from highlighted)
            if (
                state.selection.hoveredPartId &&
                state.selection.hoveredPartId !==
                    state.selection.highlightedPartId
            ) {
                this.renderHighlightedPart(
                    ctx,
                    state,
                    state.selection.hoveredPartId
                );
            }

            // Render selected parts (if any and different from highlighted/hovered)
            state.selection.selectedPartIds.forEach((partId) => {
                if (
                    partId !== state.selection.highlightedPartId &&
                    partId !== state.selection.hoveredPartId
                ) {
                    this.renderSelectedPart(ctx, state, partId);
                }
            });

            // Render highlighted chain
            if (state.selection.highlightedChainId) {
                this.renderHighlightedChain(
                    ctx,
                    state,
                    state.selection.highlightedChainId
                );
            }

            // Render selected chains (if different from highlighted)
            state.selection.selectedChainIds.forEach((chainId) => {
                if (chainId !== state.selection.highlightedChainId) {
                    this.renderSelectedChain(ctx, state, chainId);
                }
            });
        }

        // Render chain endpoints and tangents based on visibility settings (all stages)
        if (
            state.visibility.showChainStartPoints ||
            state.visibility.showChainEndPoints ||
            state.visibility.showChainTangentLines
        ) {
            this.renderChainEndpoints(ctx, state);
        }

        // Render chain normals if enabled
        if (state.visibility.showChainNormals) {
            this.drawChainNormals(ctx, state);
        }

        // Render chain tessellation if enabled
        if (state.visibility.showChainTessellation) {
            this.renderChainTessellation(ctx, state);
        }
    }

    /**
     * Render all chain shapes in blue
     */
    private renderChainShapes(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        ctx.save();

        ctx.lineWidth =
            state.transform.coordinator.screenToWorldDistance(CHAIN_LINE_WIDTH);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);

        // Build a set of chain IDs that are voids or slots in parts
        const containedChainIds = new Set<string>();
        for (const part of state.parts) {
            // Add all voids (holes)
            if (part.voids && Array.isArray(part.voids)) {
                for (const hole of part.voids) {
                    containedChainIds.add(hole.chain.id);
                }
            }
            // Add all slots
            if (part.slots && Array.isArray(part.slots)) {
                for (const slot of part.slots) {
                    containedChainIds.add(slot.chain.id);
                }
            }
        }

        // Render all chains
        for (const chain of state.chains) {
            // Use lighter blue for voids and slots, darker blue for shells
            if (containedChainIds.has(chain.id)) {
                ctx.strokeStyle = 'rgb(102, 153, 204)'; // Light blue for voids and slots
            } else {
                ctx.strokeStyle = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue for shells
            }

            // Draw all shapes in the chain
            for (const chainShape of chain.shapes) {
                const shape = state.drawing?.shapes.find(
                    (s: ShapeData) => s.id === chainShape.id
                );
                if (shape) {
                    drawShape(ctx, shape);
                }
            }
        }

        ctx.restore();
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

    /**
     * Helper method to draw a part (shell, voids, and slots)
     */
    private drawPartShapes(
        ctx: CanvasRenderingContext2D,
        part: { shell: ChainData; voids: PartVoid[]; slots: PartSlot[] },
        state: RenderState
    ): void {
        // Draw shell chain
        for (const chainShape of part.shell.shapes) {
            const shape = state.drawing?.shapes.find(
                (s) => s.id === chainShape.id
            );
            if (shape) {
                drawShape(ctx, shape);
            }
        }

        // Draw all void chains
        if (part.voids && Array.isArray(part.voids)) {
            const drawVoids = (voids: PartVoid[]) => {
                for (const voidItem of voids) {
                    for (const chainShape of voidItem.chain.shapes) {
                        const shape = state.drawing?.shapes.find(
                            (s) => s.id === chainShape.id
                        );
                        if (shape) {
                            drawShape(ctx, shape);
                        }
                    }
                }
            };
            drawVoids(part.voids);
        }

        // Draw all slot chains
        if (part.slots && Array.isArray(part.slots)) {
            for (const slot of part.slots) {
                for (const chainShape of slot.chain.shapes) {
                    const shape = state.drawing?.shapes.find(
                        (s) => s.id === chainShape.id
                    );
                    if (shape) {
                        drawShape(ctx, shape);
                    }
                }
            }
        }
    }

    private renderHighlightedPart(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        partId: string
    ): void {
        const part = state.parts.find((p) => p.id === partId);
        if (!part) return;

        ctx.save();

        // Use orange highlighting for highlighted parts
        ctx.strokeStyle = '#ff6600'; // Orange
        ctx.lineWidth =
            state.transform.coordinator.screenToWorldDistance(
                HIGHLIGHT_LINE_WIDTH
            );
        ctx.setLineDash([]);

        this.drawPartShapes(ctx, part, state);

        ctx.restore();
    }

    private renderSelectedPart(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        partId: string
    ): void {
        const part = state.parts.find((p) => p.id === partId);
        if (!part) return;

        ctx.save();

        // Use thicker orange for selected parts
        ctx.strokeStyle = '#ff6600'; // Orange
        ctx.lineWidth =
            state.transform.coordinator.screenToWorldDistance(
                SELECTION_LINE_WIDTH
            );
        ctx.setLineDash([]);

        this.drawPartShapes(ctx, part, state);

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
                    // Draw end point marker if enabled
                    if (state.visibility.showChainEndPoints) {
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
        chain: ChainData,
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

    private drawChainNormals(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        for (const chain of state.chains) {
            if (chain.shapes.length === 0) continue;

            // Get the first shape of the chain to draw normal at start point
            const startShape = state.drawing?.shapes.find(
                (s) => s.id === chain.shapes[0].id
            );

            if (startShape) {
                const startPoint = getShapeStartPoint(startShape);
                if (startPoint) {
                    // Calculate normal at start point (t = 0)
                    const normal = getShapeNormal(startShape, 0);
                    drawNormalLine(
                        ctx,
                        state,
                        startPoint,
                        normal,
                        'rgba(255, 165, 0, 0.6)' // Light orange
                    );
                }
            }
        }
    }

    private renderChainTessellation(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        ctx.save();

        const pointSize = getTessellationPointSize(state);
        const borderWidth = getTessellationBorderWidth();

        for (const chain of state.chains) {
            if (chain.shapes.length === 0) continue;

            // Tessellate the chain to get all points
            const tessellationPoints = tessellateChain(
                chain,
                DEFAULT_PART_DETECTION_PARAMETERS
            );

            // Draw each tessellation point as a small circle
            for (const point of tessellationPoints) {
                drawTessellationPoint(
                    ctx,
                    state,
                    point,
                    pointSize,
                    borderWidth
                );
            }
        }

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
                    HitTestUtils.isPointNearShape(
                        point,
                        new Shape(shape),
                        tolerance
                    )
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
