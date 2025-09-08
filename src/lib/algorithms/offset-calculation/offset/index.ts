// Offset dispatcher function
// Import individual offset functions directly from:
// - ./line/line for offsetLine
// - ./arc/arc for offsetArc
// - ./circle/circle for offsetCircle
// - ./polyline/polyline for offsetPolyline
// - ./spline/spline for offsetSpline, tessellateVerbCurve, splitVerbCurve
// - ./ellipse/ellipse for offsetEllipse
// - ./types for OffsetDirection, OffsetResult types

import type {
    Shape,
    Line,
    Arc,
    Circle,
    Polyline,
    Spline,
    Ellipse,
} from '../../../types/geometry';
import { GeometryType } from '../../../types/geometry';
import { OffsetDirection, type OffsetResult } from './types';
import { offsetLine } from './line/line';
import { offsetArc } from './arc/arc';
import { offsetCircle } from './circle/circle';
import { offsetPolyline } from './polyline/polyline';
import { offsetSpline } from './spline/spline';
import { offsetEllipse } from './ellipse/ellipse';

/**
 * Dispatcher function that offsets any shape type
 */
export function offsetShape(
    shape: Shape,
    distance: number,
    direction: OffsetDirection
): OffsetResult {
    switch (shape.type) {
        case GeometryType.LINE:
            return offsetLine(shape.geometry as Line, distance, direction);
        case GeometryType.ARC:
            return offsetArc(shape.geometry as Arc, distance, direction);
        case GeometryType.CIRCLE:
            return offsetCircle(shape.geometry as Circle, distance, direction);
        case GeometryType.POLYLINE:
            return offsetPolyline(
                shape.geometry as Polyline,
                distance,
                direction
            );
        case GeometryType.SPLINE:
            return offsetSpline(shape.geometry as Spline, distance, direction);
        case GeometryType.ELLIPSE:
            return offsetEllipse(
                shape.geometry as Ellipse,
                distance,
                direction
            );
        default:
            return {
                success: false,
                shapes: [],
                warnings: [],
                errors: [`Unsupported shape type for offset: ${shape.type}`],
            };
    }
}
