import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { DxfPolyline } from '$lib/geometry/dxf-polyline/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { generateId } from '$lib/domain/id';
import { Shape } from '$lib/cam/shape/classes';

/**
 * Decompose polylines into individual line and arc segments
 *
 * This algorithm converts polyline shapes into their constituent line and arc segments,
 * making them easier to process for CAM operations. Each segment becomes an independent shape.
 */
export function decomposePolylines(shapes: Shape[]): Shape[] {
    const decomposedShapes: Shape[] = [];

    shapes.forEach((shape) => {
        if (shape.type === GeometryType.POLYLINE) {
            const polyline: DxfPolyline = shape.geometry as DxfPolyline;

            // Polylines now only have shapes - extract each shape's geometry as an individual shape
            if (polyline.shapes) {
                polyline.shapes.forEach((polylineShape) => {
                    const segment: Line | Arc = polylineShape.geometry as
                        | Line
                        | Arc;
                    if ('start' in segment && 'end' in segment) {
                        // Line segment
                        decomposedShapes.push(
                            new Shape({
                                id: generateId(),
                                type: GeometryType.LINE,
                                geometry: segment,
                                layer: shape.layer,
                            })
                        );
                    } else if ('center' in segment && 'radius' in segment) {
                        // Arc segment
                        decomposedShapes.push(
                            new Shape({
                                id: generateId(),
                                type: GeometryType.ARC,
                                geometry: segment,
                                layer: shape.layer,
                            })
                        );
                    }
                });
            } else {
                // Polyline missing segments array - cannot decompose polyline without segments
            }
        } else {
            // Keep other shape types as-is
            decomposedShapes.push(shape);
        }
    });

    return decomposedShapes;
}
