import type { Shape, Polyline, Line, Arc } from '../../lib/types';
import { generateId } from '../utils/id';

/**
 * Decompose polylines into individual line and arc segments
 * 
 * This algorithm converts polyline shapes into their constituent line and arc segments,
 * making them easier to process for CAM operations. Each segment becomes an independent shape.
 */
export function decomposePolylines(shapes: Shape[]): Shape[] {
  const decomposedShapes: Shape[] = [];
  
  shapes.forEach(shape => {
    if (shape.type === 'polyline') {
      const polyline: Polyline = shape.geometry as Polyline;
      
      // Polylines now only have shapes - extract each shape's geometry as an individual shape
      if (polyline.shapes) {
        polyline.shapes.forEach((polylineShape) => {
          const segment: Line | Arc = polylineShape.geometry as Line | Arc;
          if ('start' in segment && 'end' in segment) {
            // Line segment
            decomposedShapes.push({
              id: generateId(),
              type: 'line',
              geometry: segment,
              layer: shape.layer
            });
          } else if ('center' in segment && 'radius' in segment) {
            // Arc segment
            decomposedShapes.push({
              id: generateId(),
              type: 'arc',
              geometry: segment,
              layer: shape.layer
            });
          }
        });
      } else {
        console.warn('Polyline missing segments array:', polyline);
      }
    } else {
      // Keep other shape types as-is
      decomposedShapes.push(shape);
    }
  });
  
  return decomposedShapes;
}
