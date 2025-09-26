import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import { screenToWorldDistance } from '$lib/rendering/canvas/state/render-state';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import { HitTestType } from '$lib/rendering/canvas/utils/hit-test';
import type { Point2D } from '$lib/types';
import type { Path } from '$lib/stores/paths/interfaces';
import { LayerId as LayerIdEnum } from '$lib/rendering/canvas/layers/types';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import {
    getShapeStartPoint,
    getShapeEndPoint,
} from '$lib/geometry/shape/functions';
import {
    isPathEnabledForRendering,
    setupHitTest,
} from '$lib/rendering/canvas/utils/renderer-utils';

/**
 * Constants for path rendering
 */
const ENDPOINT_RADIUS_PX = 3;
const HIT_TOLERANCE_PX = 5;

/**
 * PathRenderer handles rendering of green path highlighting and endpoints
 */
export class PathRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('path', LayerIdEnum.PATHS, coordinator);
    }

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        if (!state.pathsState || state.pathsState.paths.length === 0) return;

        this.drawPathEndpoints(ctx, state);
    }

    /**
     * Draw path start/end points as colored circles
     */
    private drawPathEndpoints(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        if (!state.pathsState || state.pathsState.paths.length === 0) return;

        const pointRadius = screenToWorldDistance(state, ENDPOINT_RADIUS_PX); // Fixed size regardless of zoom

        state.pathsState.paths.forEach((path: Path) => {
            // Only draw endpoints for enabled paths with enabled operations
            if (!isPathEnabledForRendering(path, state)) return;

            // Get the chain for this path to find start/end points
            const chain = state.chains.find((c) => c.id === path.chainId);
            if (!chain || chain.shapes.length === 0) return;

            // Use offset shapes if they exist, otherwise use original chain shapes
            const shapesToUse =
                path.offset && path.offset.offsetShapes.length > 0
                    ? path.offset.offsetShapes
                    : chain.shapes;

            // Get first and last shape
            const firstShape = shapesToUse[0];
            const lastShape = shapesToUse[shapesToUse.length - 1];

            if (!firstShape || !lastShape) return;

            // Get start point of first shape
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

            // Get end point of last shape
            const endPoint = getShapeEndPoint(lastShape);
            if (endPoint) {
                ctx.save();
                ctx.fillStyle = 'rgb(133, 18, 0)'; // Red for end
                ctx.beginPath();
                ctx.arc(endPoint.x, endPoint.y, pointRadius, 0, 2 * Math.PI);
                ctx.fill();
                ctx.restore();
            }
        });
    }

    hitWorld(point: Point2D, state: RenderState): HitTestResult | null {
        const hitSetup = setupHitTest(state, HIT_TOLERANCE_PX);
        if (!hitSetup) return null;

        const { hitTolerance, enabledPaths } = hitSetup;

        for (const path of enabledPaths) {
            // Get the chain for this path
            const chain = state.chains.find((c) => c.id === path.chainId);
            if (!chain || chain.shapes.length === 0) continue;

            // Use offset shapes if they exist, otherwise use original chain shapes
            const shapesToUse =
                path.offset && path.offset.offsetShapes.length > 0
                    ? path.offset.offsetShapes
                    : chain.shapes;

            // Check if point is near path endpoint
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
                            type: HitTestType.PATH,
                            id: path.id,
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
                            type: HitTestType.PATH,
                            id: path.id,
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
