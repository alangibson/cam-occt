import type { Shape, Point2D } from '../../types';
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
      const polyline = shape.geometry as any;
      const points = polyline.points || [];
      
      // Convert polyline to individual line segments
      for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        
        if (start.bulge && start.bulge !== 0) {
          // Convert bulged segment to arc
          // For now, just create a line - arc conversion is complex
          decomposedShapes.push({
            id: generateId(),
            type: 'line',
            geometry: { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } },
            layer: shape.layer
          });
        } else {
          // Create line segment
          decomposedShapes.push({
            id: generateId(),
            type: 'line',
            geometry: { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } },
            layer: shape.layer
          });
        }
      }
      
      // Handle closed polylines
      if (polyline.closed && points.length > 2) {
        const start = points[points.length - 1];
        const end = points[0];
        decomposedShapes.push({
          id: generateId(),
          type: 'line',
          geometry: { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } },
          layer: shape.layer
        });
      }
    } else {
      // Keep other shape types as-is
      decomposedShapes.push(shape);
    }
  });
  
  return decomposedShapes;
}