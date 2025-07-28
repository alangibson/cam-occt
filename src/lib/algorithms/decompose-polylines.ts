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
      // Use vertices array if available (contains bulge data), otherwise use points
      const points = polyline.vertices || polyline.points || [];
      
      // Convert polyline to individual line segments
      for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        
        if (start.bulge && start.bulge !== 0) {
          // Convert bulged segment to arc
          const arc = convertBulgeToArc(start, end, start.bulge);
          if (arc) {
            decomposedShapes.push({
              id: generateId(),
              type: 'arc',
              geometry: arc,
              layer: shape.layer
            });
          } else {
            // Fallback to line if arc conversion fails
            decomposedShapes.push({
              id: generateId(),
              type: 'line',
              geometry: { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } },
              layer: shape.layer
            });
          }
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
        
        if (start.bulge && start.bulge !== 0) {
          // Convert bulged closing segment to arc
          const arc = convertBulgeToArc(start, end, start.bulge);
          if (arc) {
            decomposedShapes.push({
              id: generateId(),
              type: 'arc',
              geometry: arc,
              layer: shape.layer
            });
          } else {
            // Fallback to line if arc conversion fails
            decomposedShapes.push({
              id: generateId(),
              type: 'line',
              geometry: { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } },
              layer: shape.layer
            });
          }
        } else {
          decomposedShapes.push({
            id: generateId(),
            type: 'line',
            geometry: { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } },
            layer: shape.layer
          });
        }
      }
    } else {
      // Keep other shape types as-is
      decomposedShapes.push(shape);
    }
  });
  
  return decomposedShapes;
}

/**
 * Convert a bulged polyline segment to an arc
 * 
 * @param start Start point with bulge value
 * @param end End point
 * @param bulge Bulge factor (tan(θ/4) where θ is the included angle)
 * @returns Arc geometry or null if conversion fails
 */
function convertBulgeToArc(start: any, end: any, bulge: number): any | null {
  try {
    // DXF bulge-to-arc conversion algorithm
    // Reference: AutoCAD DXF documentation - bulge = tan(θ/4) where θ is the included angle
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const chordLength = Math.sqrt(dx * dx + dy * dy);
    
    if (chordLength < 1e-10) {
      return null; // Degenerate segment
    }
    
    // Calculate included angle from bulge: θ = 4 * arctan(|bulge|)
    const includedAngle = 4 * Math.atan(Math.abs(bulge));
    
    // Calculate radius: R = chord / (2 * sin(θ/2))
    const radius = chordLength / (2 * Math.sin(includedAngle / 2));
    
    // Calculate chord midpoint
    const chordMidX = (start.x + end.x) / 2;
    const chordMidY = (start.y + end.y) / 2;
    
    // Calculate unit vector perpendicular to chord (rotated 90° CCW)
    const perpX = -dy / chordLength;
    const perpY = dx / chordLength;
    
    // Distance from chord midpoint to arc center
    // Using the relationship: d = sqrt(R² - (chord/2)²)
    const halfChord = chordLength / 2;
    const centerDistance = Math.sqrt(radius * radius - halfChord * halfChord);
    
    // Determine center position based on bulge sign  
    // Positive bulge = counterclockwise = center is on the left side of the chord
    // Negative bulge = clockwise = center is on the right side of the chord
    const direction = bulge > 0 ? 1 : -1;
    const centerX = chordMidX + direction * centerDistance * perpX;
    const centerY = chordMidY + direction * centerDistance * perpY;
    
    // Validate the calculation by checking distances from center to endpoints
    const distToStart = Math.sqrt((start.x - centerX) ** 2 + (start.y - centerY) ** 2);
    const distToEnd = Math.sqrt((end.x - centerX) ** 2 + (end.y - centerY) ** 2);
    
    const tolerance = Math.max(0.001, radius * 0.001);
    if (Math.abs(distToStart - radius) > tolerance || Math.abs(distToEnd - radius) > tolerance) {
      // Validation failed - this indicates a mathematical error
      console.warn(`Bulge conversion validation failed: bulge=${bulge}, chord=${chordLength.toFixed(3)}, sagitta=${sagitta.toFixed(3)}, radius=${radius.toFixed(3)}`);
      console.warn(`Distance errors: start=${Math.abs(distToStart - radius).toFixed(6)}, end=${Math.abs(distToEnd - radius).toFixed(6)}, tolerance=${tolerance.toFixed(6)}`);
      return null;
    }
    
    // Calculate start and end angles
    const startAngle = Math.atan2(start.y - centerY, start.x - centerX);
    const endAngle = Math.atan2(end.y - centerY, end.x - centerX);
    
    // Normalize angles to [0, 2π) range
    const normalizeAngle = (angle: number) => {
      while (angle < 0) angle += 2 * Math.PI;
      while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
      return angle;
    };
    
    return {
      center: { x: centerX, y: centerY },
      radius: Math.abs(radius),
      startAngle: normalizeAngle(startAngle),
      endAngle: normalizeAngle(endAngle),
      clockwise: bulge < 0 // Negative bulge indicates clockwise direction
    };
    
  } catch (error) {
    console.warn('Error in bulge-to-arc conversion:', error);
    return null;
  }
}