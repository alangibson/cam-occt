import type { Shape, Point2D } from '../../types';

/**
 * Translate all shapes to ensure they are in the positive quadrant
 * 
 * This algorithm calculates the bounding box of all shapes and translates them
 * so that the minimum coordinates are at (0, 0), ensuring all geometry is in
 * the positive quadrant for consistent CAM processing.
 */
export function translateToPositiveQuadrant(shapes: Shape[]): Shape[] {
  if (shapes.length === 0) return shapes;
  
  // Calculate bounding box
  let minX = Infinity;
  let minY = Infinity;
  
  shapes.forEach(shape => {
    const points = getShapePoints(shape);
    points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
    });
  });
  
  // Only translate if there are negative coordinates
  if (minX >= 0 && minY >= 0) return shapes;
  
  const translateX = minX < 0 ? -minX : 0;
  const translateY = minY < 0 ? -minY : 0;
  
  // Translate all shapes
  return shapes.map(shape => {
    return translateShape(shape, translateX, translateY);
  });
}

/**
 * Get all significant points from a shape for bounding box calculation
 */
function getShapePoints(shape: Shape): Point2D[] {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return [line.start, line.end];
    case 'circle':
      const circle = shape.geometry as any;
      return [
        { x: circle.center.x - circle.radius, y: circle.center.y - circle.radius },
        { x: circle.center.x + circle.radius, y: circle.center.y + circle.radius }
      ];
    case 'arc':
      const arc = shape.geometry as any;
      return [
        { x: arc.center.x - arc.radius, y: arc.center.y - arc.radius },
        { x: arc.center.x + arc.radius, y: arc.center.y + arc.radius }
      ];
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points || [];
    case 'ellipse':
      const ellipse = shape.geometry as any;
      // Calculate bounding box points for ellipse
      const majorAxisLength = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
        ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
      );
      const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
      
      // For bounding box calculation, we need the extent of the ellipse
      // This is an approximation - true ellipse bounds calculation is more complex
      const maxExtent = Math.max(majorAxisLength, minorAxisLength);
      
      return [
        { x: ellipse.center.x - maxExtent, y: ellipse.center.y - maxExtent },
        { x: ellipse.center.x + maxExtent, y: ellipse.center.y + maxExtent }
      ];
    default:
      return [];
  }
}

/**
 * Translate a single shape by the given offsets
 */
function translateShape(shape: Shape, dx: number, dy: number): Shape {
  const translated = { ...shape };
  
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      translated.geometry = {
        start: { x: line.start.x + dx, y: line.start.y + dy },
        end: { x: line.end.x + dx, y: line.end.y + dy }
      };
      break;
    case 'circle':
      const circle = shape.geometry as any;
      translated.geometry = {
        center: { x: circle.center.x + dx, y: circle.center.y + dy },
        radius: circle.radius
      };
      break;
    case 'arc':
      const arc = shape.geometry as any;
      translated.geometry = {
        center: { x: arc.center.x + dx, y: arc.center.y + dy },
        radius: arc.radius,
        startAngle: arc.startAngle,
        endAngle: arc.endAngle,
        clockwise: arc.clockwise
      };
      break;
    case 'polyline':
      const polyline = shape.geometry as any;
      translated.geometry = {
        ...polyline,
        points: polyline.points?.map((p: Point2D) => ({ x: p.x + dx, y: p.y + dy })) || [],
        vertices: polyline.vertices?.map((v: any) => ({ ...v, x: v.x + dx, y: v.y + dy })) || undefined
      };
      break;
    case 'ellipse':
      const ellipse = shape.geometry as any;
      translated.geometry = {
        center: { x: ellipse.center.x + dx, y: ellipse.center.y + dy },
        majorAxisEndpoint: ellipse.majorAxisEndpoint, // This is a vector, not translated
        minorToMajorRatio: ellipse.minorToMajorRatio,
        startParam: ellipse.startParam,
        endParam: ellipse.endParam
      };
      break;
    default:
      // No translation needed for unknown types
      break;
  }
  
  return translated;
}