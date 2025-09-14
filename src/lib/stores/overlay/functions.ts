import type { Circle, Ellipse, Line, Polyline } from '$lib/types/geometry';
import type { Point2D, Shape } from '$lib/types';
import type { Arc } from '$lib/geometry/arc';
import type { Chain } from '$lib/geometry/chain/interfaces';
import {
    getShapeEndPoint,
    getShapeStartPoint,
} from '$lib/geometry/shape/functions';
import { polylineToPoints } from '$lib/geometry/polyline';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain';
import type { ShapePoint, ChainEndpoint } from './interfaces';

// Helper functions to generate overlay data
export function generateShapePoints(
    shapes: Shape[],
    selectedShapeIds: Set<string>
): ShapePoint[] {
    const points: ShapePoint[] = [];

    shapes.forEach((shape) => {
        if (selectedShapeIds.has(shape.id)) {
            // Generate origin, start, and end points for selected shapes
            const origin: Point2D | null = getShapeOrigin(shape);
            const start: Point2D = getShapeStartPoint(shape);
            const end: Point2D = getShapeEndPoint(shape);

            if (origin) {
                points.push({ ...origin, type: 'origin', shapeId: shape.id });
            }
            points.push({ ...start, type: 'start', shapeId: shape.id });
            points.push({ ...end, type: 'end', shapeId: shape.id });
        }
    });

    return points;
}

export function generateChainEndpoints(chains: Chain[]): ChainEndpoint[] {
    const endpoints: ChainEndpoint[] = [];

    chains.forEach((chain) => {
        if (chain.shapes.length === 0) return;

        const firstShape: Shape = chain.shapes[0];
        const lastShape: Shape = chain.shapes[chain.shapes.length - 1];

        const start: Point2D = getShapeStartPoint(firstShape);
        const end: Point2D = getShapeEndPoint(lastShape);

        endpoints.push({ ...start, type: 'start', chainId: chain.id });

        if (
            Math.abs(end.x - start.x) > CHAIN_CLOSURE_TOLERANCE ||
            Math.abs(end.y - start.y) > CHAIN_CLOSURE_TOLERANCE
        ) {
            endpoints.push({ ...end, type: 'end', chainId: chain.id });
        }
    });

    return endpoints;
}

// Temporary helper functions - these should be moved to a shared utilities file
function getShapeOrigin(shape: Shape): Point2D | null {
    switch (shape.type) {
        case 'line':
            const line: Line = shape.geometry as Line;
            return line.start;
        case 'circle':
        case 'arc':
            const circle: Circle = shape.geometry as Circle | Arc;
            return circle.center;
        case 'polyline':
            const polyline: Polyline = shape.geometry as Polyline;
            const points: Point2D[] = polylineToPoints(polyline);
            return points.length > 0 ? points[0] : null;
        case 'ellipse':
            const ellipse: Ellipse = shape.geometry as Ellipse;
            return ellipse.center;
        default:
            return null;
    }
}
