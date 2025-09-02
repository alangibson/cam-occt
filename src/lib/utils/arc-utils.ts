import type { Point2D, Arc } from '../types/geometry';
import { EPSILON } from '../constants';

/**
 * Calculate a point on a circle/arc given center, radius and angle
 */
export function calculateArcPoint(center: Point2D, radius: number, angle: number): Point2D {
  const x: number = center.x + radius * Math.cos(angle);
  const y: number = center.y + radius * Math.sin(angle);
  
  const roundCoord = (val: number): number => Math.abs(val) < EPSILON ? 0 : val;
  return { x: roundCoord(x), y: roundCoord(y) };
}

/**
 * Calculate the start point of an arc
 */
export function calculateArcStartPoint(arc: Arc): Point2D {
  return calculateArcPoint(arc.center, arc.radius, arc.startAngle);
}

/**
 * Calculate the end point of an arc
 */
export function calculateArcEndPoint(arc: Arc): Point2D {
  return calculateArcPoint(arc.center, arc.radius, arc.endAngle);
}

/**
 * Convert a bulged polyline segment to an arc
 * 
 * @param bulge Bulge factor (tan(θ/4) where θ is the included angle)
 * @param start Start point
 * @param end End point
 * @returns Arc geometry or null if conversion fails
 */
export function convertBulgeToArc(bulge: number, start: Point2D, end: Point2D): Arc | null {
  try {
    // DXF bulge-to-arc conversion algorithm
    // Reference: AutoCAD DXF documentation - bulge = tan(θ/4) where θ is the included angle
    
    const dx: number = end.x - start.x;
    const dy: number = end.y - start.y;
    const chordLength: number = Math.sqrt(dx * dx + dy * dy);
    
    if (chordLength < EPSILON) {
      return null; // Degenerate segment
    }
    
    // Calculate included angle from bulge: θ = 4 * arctan(|bulge|)
    const includedAngle: number = 4 * Math.atan(Math.abs(bulge));
    
    // Calculate radius: R = chord / (2 * sin(θ/2))
    const radius: number = chordLength / (2 * Math.sin(includedAngle / 2));
    
    // Calculate chord midpoint
    const chordMidX: number = (start.x + end.x) / 2;
    const chordMidY: number = (start.y + end.y) / 2;
    
    // Calculate unit vector perpendicular to chord (rotated 90° CCW)
    const perpX: number = -dy / chordLength;
    const perpY: number = dx / chordLength;
    
    // Distance from chord midpoint to arc center
    // Using the relationship: d = sqrt(R² - (chord/2)²)
    const halfChord: number = chordLength / 2;
    const centerDistance: number = Math.sqrt(radius * radius - halfChord * halfChord);
    
    // Determine center position based on bulge sign  
    // Positive bulge = counterclockwise = center is on the left side of the chord
    // Negative bulge = clockwise = center is on the right side of the chord
    const direction: number = bulge > 0 ? 1 : -1;
    const centerX: number = chordMidX + direction * centerDistance * perpX;
    const centerY: number = chordMidY + direction * centerDistance * perpY;
    
    // Validate the calculation by checking distances from center to endpoints
    const distToStart: number = Math.sqrt((start.x - centerX) ** 2 + (start.y - centerY) ** 2);
    const distToEnd: number = Math.sqrt((end.x - centerX) ** 2 + (end.y - centerY) ** 2);
    
    const tolerance: number = Math.max(0.001, radius * 0.001);
    if (Math.abs(distToStart - radius) > tolerance || Math.abs(distToEnd - radius) > tolerance) {
      // Validation failed - this indicates a mathematical error
      console.warn(`Bulge conversion validation failed: bulge=${bulge}, chord=${chordLength.toFixed(3)}, radius=${radius.toFixed(3)}`);
      console.warn(`Distance errors: start=${Math.abs(distToStart - radius).toFixed(6)}, end=${Math.abs(distToEnd - radius).toFixed(6)}, tolerance=${tolerance.toFixed(6)}`);
      return null;
    }
    
    // Calculate start and end angles
    const startAngle: number = Math.atan2(start.y - centerY, start.x - centerX);
    const endAngle: number = Math.atan2(end.y - centerY, end.x - centerX);
    
    // Normalize angles to [0, 2π) range
    const normalizeAngle: (angle: number) => number = (angle: number): number => {
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