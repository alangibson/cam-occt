/**
 * OverlayRenderer - Renders stage-specific overlays
 *
 * Overlays provide additional visual information for different workflow stages:
 * - Shape endpoints (Edit stage)
 * - Chain endpoints (Prepare stage)
 * - Tessellation points (Program stage)
 * - Tool head (Simulate stage)
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
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';

// Constants for overlay rendering
const SHAPE_POINT_SIZE = 4;
const CHAIN_ENDPOINT_SIZE = 6;
const TOOL_HEAD_SIZE = 8;
const HIT_TEST_TOLERANCE = 8;

export class OverlayRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('overlay-renderer', LayerId.OVERLAYS, coordinator);
    }

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        if (!state.visibility.showOverlays || !state.currentOverlay) {
            return;
        }

        const overlay = state.currentOverlay;

        // Draw shape points (Edit stage)
        if (overlay.shapePoints && overlay.shapePoints.length > 0) {
            overlay.shapePoints.forEach(
                (point: Point2D & { type?: string }) => {
                    this.drawOverlayPoint(
                        ctx,
                        state,
                        point.x,
                        point.y,
                        point.type || 'default',
                        state.transform.coordinator.screenToWorldDistance(
                            SHAPE_POINT_SIZE
                        )
                    );
                }
            );
        }

        // Draw chain endpoints (Prepare stage)
        if (overlay.chainEndpoints && overlay.chainEndpoints.length > 0) {
            overlay.chainEndpoints.forEach(
                (endpoint: Point2D & { type?: string }) => {
                    this.drawChainEndpoint(
                        ctx,
                        state,
                        endpoint.x,
                        endpoint.y,
                        endpoint.type || 'default',
                        state.transform.coordinator.screenToWorldDistance(
                            CHAIN_ENDPOINT_SIZE
                        )
                    );
                }
            );
        }

        // Draw tessellation points (Program stage)
        if (
            overlay.tessellationPoints &&
            overlay.tessellationPoints.length > 0
        ) {
            overlay.tessellationPoints.forEach((point: Point2D) => {
                this.drawTessellationPoint(
                    ctx,
                    state,
                    point.x,
                    point.y,
                    state.transform.coordinator.screenToWorldDistance(2)
                );
            });
        }

        // Draw tool head (Simulate stage)
        if (overlay.toolHead && overlay.toolHead.visible) {
            this.drawToolHead(
                ctx,
                state,
                overlay.toolHead.x,
                overlay.toolHead.y,
                state.transform.coordinator.screenToWorldDistance(
                    TOOL_HEAD_SIZE
                )
            );
        }
    }

    private drawOverlayPoint(
        ctx: CanvasRenderingContext2D,
        _state: RenderState,
        x: number,
        y: number,
        type: string,
        size: number
    ): void {
        ctx.save();

        switch (type) {
            case 'origin':
                ctx.fillStyle = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue
                break;
            case 'start':
                ctx.fillStyle = 'rgb(0, 133, 84)'; // Green
                break;
            case 'end':
                ctx.fillStyle = 'rgb(133, 18, 0)'; // Red
                break;
            default:
                ctx.fillStyle = '#888888'; // Gray
        }

        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }

    private drawChainEndpoint(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        x: number,
        y: number,
        type: string,
        size: number
    ): void {
        ctx.save();

        // Draw white border
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(
            x,
            y,
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
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }

    private drawTessellationPoint(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        x: number,
        y: number,
        size: number
    ): void {
        ctx.save();
        ctx.fillStyle = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }

    private drawToolHead(
        ctx: CanvasRenderingContext2D,
        _state: RenderState,
        x: number,
        y: number,
        size: number
    ): void {
        ctx.save();
        ctx.strokeStyle = 'rgb(133, 18, 0)'; // Red
        ctx.lineWidth = _state.transform.coordinator.screenToWorldDistance(2);

        // Draw cross
        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size, y);
        ctx.moveTo(x, y - size);
        ctx.lineTo(x, y + size);
        ctx.stroke();

        ctx.restore();
    }

    hitWorld(point: Point2D, state: RenderState): HitTestResult | null {
        if (!state.visibility.showOverlays || !state.currentOverlay) {
            return null;
        }

        const overlay = state.currentOverlay;
        const tolerance =
            state.transform.coordinator.screenToWorldDistance(
                HIT_TEST_TOLERANCE
            );

        // Test shape points
        if (overlay.shapePoints && overlay.shapePoints.length > 0) {
            for (let i = 0; i < overlay.shapePoints.length; i++) {
                const shapePoint = overlay.shapePoints[i];
                if (HitTestUtils.distance(point, shapePoint) <= tolerance) {
                    return {
                        type: HitTestType.SHAPE, // Could add OVERLAY type if needed
                        id: `shape-point-${i}`,
                        distance: HitTestUtils.distance(point, shapePoint),
                        point: shapePoint,
                        metadata: {
                            overlayType: 'shapePoint',
                            pointType: shapePoint.type || 'default',
                        },
                    };
                }
            }
        }

        // Test chain endpoints
        if (overlay.chainEndpoints && overlay.chainEndpoints.length > 0) {
            for (let i = 0; i < overlay.chainEndpoints.length; i++) {
                const chainEndpoint = overlay.chainEndpoints[i];
                if (HitTestUtils.distance(point, chainEndpoint) <= tolerance) {
                    return {
                        type: HitTestType.CHAIN,
                        id: `chain-endpoint-${i}`,
                        distance: HitTestUtils.distance(point, chainEndpoint),
                        point: chainEndpoint,
                        metadata: {
                            overlayType: 'chainEndpoint',
                            endpointType: chainEndpoint.type || 'default',
                        },
                    };
                }
            }
        }

        // Test tessellation points
        if (
            overlay.tessellationPoints &&
            overlay.tessellationPoints.length > 0
        ) {
            for (let i = 0; i < overlay.tessellationPoints.length; i++) {
                const tessPoint = overlay.tessellationPoints[i];
                if (HitTestUtils.distance(point, tessPoint) <= tolerance) {
                    return {
                        type: HitTestType.SHAPE, // Could add TESSELLATION type if needed
                        id: `tessellation-point-${i}`,
                        distance: HitTestUtils.distance(point, tessPoint),
                        point: tessPoint,
                        metadata: {
                            overlayType: 'tessellationPoint',
                        },
                    };
                }
            }
        }

        // Test tool head
        if (overlay.toolHead && overlay.toolHead.visible) {
            const toolHeadPoint = {
                x: overlay.toolHead.x,
                y: overlay.toolHead.y,
            };
            if (HitTestUtils.distance(point, toolHeadPoint) <= tolerance) {
                return {
                    type: HitTestType.SHAPE, // Could add TOOLHEAD type if needed
                    id: 'tool-head',
                    distance: HitTestUtils.distance(point, toolHeadPoint),
                    point: toolHeadPoint,
                    metadata: {
                        overlayType: 'toolHead',
                    },
                };
            }
        }

        return null;
    }
}
