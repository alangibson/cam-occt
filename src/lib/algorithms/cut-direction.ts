import type { Chain } from './chain-detection/chain-detection';
import type { Shape, Point2D, Line, Arc, Circle, Polyline, Spline, Ellipse } from '../types/geometry';
import { CutDirection } from '../types/direction';
import { getShapeEndPoint } from '$lib/geometry';
import { getShapeStartPoint } from '$lib/geometry';
import { polylineToPoints } from '../geometry/polyline';
import { calculateSquaredDistance } from '../utils/math-utils';

/**
 * Detects the cut direction of a chain using the shoelace formula (signed area calculation).
 * 
 * For closed chains:
 * - Positive signed area = counterclockwise
 * - Negative signed area = clockwise
 * 
 * For open chains:
 * - Returns 'none' as they don't have a natural cut direction
 */
export function detectCutDirection(chain: Chain, tolerance: number = 0.1): CutDirection {
  if (!chain || !chain.shapes || chain.shapes.length === 0) {
    return CutDirection.NONE;
  }

  // Check if chain is closed by comparing first and last points
  const firstPoint: Point2D = getShapeStartPoint(chain.shapes[0]);
  const lastPoint: Point2D = getShapeEndPoint(chain.shapes[chain.shapes.length - 1]);
  
  if (!isPointsClosed(firstPoint, lastPoint, tolerance)) {
    return CutDirection.NONE; // Open paths don't have a natural cut direction
  }

  // Get all points from the chain
  const points: Point2D[] = getChainPoints(chain);
  
  if (points.length < 3) {
    return CutDirection.NONE; // Need at least 3 points to determine direction
  }

  // Calculate signed area using shoelace formula
  const signedArea: number = calculateSignedArea(points);
  
  // Positive area = counterclockwise, negative area = clockwise
  return signedArea > 0 ? CutDirection.COUNTERCLOCKWISE : CutDirection.CLOCKWISE;
}

/**
 * Calculate a point on an ellipse at a given parameter
 */
export function calculateEllipsePoint(ellipse: Ellipse, param: number): Point2D {
  // Calculate major and minor axis lengths
  const majorAxisLength: number = Math.sqrt(
    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
  );
  const minorAxisLength: number = majorAxisLength * ellipse.minorToMajorRatio;
  
  // Calculate major axis angle
  const majorAxisAngle: number = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
  
  // Calculate point on canonical ellipse (axes aligned)
  const canonicalX: number = majorAxisLength * Math.cos(param);
  const canonicalY: number = minorAxisLength * Math.sin(param);
  
  // Rotate by major axis angle and translate to center
  const cos: number = Math.cos(majorAxisAngle);
  const sin: number = Math.sin(majorAxisAngle);
  
  return {
    x: ellipse.center.x + canonicalX * cos - canonicalY * sin,
    y: ellipse.center.y + canonicalX * sin + canonicalY * cos
  };
}

/**
 * Check if two points are within tolerance (chain is closed)
 */
function isPointsClosed(point1: Point2D, point2: Point2D, tolerance: number): boolean {
  const distance: number = Math.sqrt(calculateSquaredDistance(point1, point2));
  return distance <= tolerance;
}

/**
 * Extract all points from a chain for area calculation
 */
function getChainPoints(chain: Chain): Point2D[] {
  const points: Point2D[] = [];
  
  for (const shape of chain.shapes) {
    const shapePoints: Point2D[] = getShapePoints(shape);
    points.push(...shapePoints);
  }
  
  return points;
}

/**
 * Get points from a shape for area calculation
 */
function getShapePoints(shape: Shape): Point2D[] {
  switch (shape.type) {
    case 'line':
      const line: Line = shape.geometry as Line;
      return [line.start, line.end];
    
    case 'circle':
      // For circles, we don't need to sample points to calculate direction
      // Circles are inherently counterclockwise in CAD coordinate systems
      // Return a simple set of points that will give us the correct orientation
      const circle: Circle = shape.geometry as Circle;
      // Create 4 points in counterclockwise order (right, top, left, bottom)
      return [
        { x: circle.center.x + circle.radius, y: circle.center.y },      // right
        { x: circle.center.x, y: circle.center.y + circle.radius },      // top
        { x: circle.center.x - circle.radius, y: circle.center.y },      // left
        { x: circle.center.x, y: circle.center.y - circle.radius }       // bottom
      ];
    
    case 'arc':
      // Sample arc with points based on angle span, respecting clockwise property
      const arc: Arc = shape.geometry as Arc;
      const arcPoints: Point2D[] = [];
      const angleSpan: number = Math.abs(arc.endAngle - arc.startAngle);
      const numArcSamples: number = Math.max(4, Math.ceil(angleSpan / (Math.PI / 8))); // At least 4 points
      
      for (let i: number = 0; i <= numArcSamples; i++) {
        const t: number = i / numArcSamples;
        let angle: number;
        
        if (arc.clockwise) {
          // For clockwise arcs, reverse the direction
          angle = arc.startAngle + t * (arc.endAngle - arc.startAngle);
        } else {
          // For counterclockwise arcs, use normal direction
          angle = arc.startAngle + t * (arc.endAngle - arc.startAngle);
        }
        
        arcPoints.push({
          x: arc.center.x + arc.radius * Math.cos(angle),
          y: arc.center.y + arc.radius * Math.sin(angle)
        });
      }
      return arcPoints;
    
    case 'polyline':
      const polyline: Polyline = shape.geometry as Polyline;
      return [...polylineToPoints(polyline)]; // Copy to avoid mutation
    
    case 'spline':
      // Sample spline with multiple points for accurate area calculation
      const spline: Spline = shape.geometry as Spline;
      const splinePoints: Point2D[] = [];
      const numSplineSamples: number = Math.max(10, spline.controlPoints.length * 3);
      
      for (let i: number = 0; i <= numSplineSamples; i++) {
        const t: number = i / numSplineSamples;
        // Simple linear interpolation for now - could be improved with actual spline evaluation
        const segmentIndex: number = Math.min(Math.floor(t * (spline.controlPoints.length - 1)), spline.controlPoints.length - 2);
        const localT: number = (t * (spline.controlPoints.length - 1)) - segmentIndex;
        
        const p1: Point2D = spline.controlPoints[segmentIndex];
        const p2: Point2D = spline.controlPoints[segmentIndex + 1];
        
        splinePoints.push({
          x: p1.x + localT * (p2.x - p1.x),
          y: p1.y + localT * (p2.y - p1.y)
        });
      }
      return splinePoints;
    
    case 'ellipse':
      // Sample ellipse with multiple points for accurate area calculation
      const ellipse: Ellipse = shape.geometry as Ellipse;
      const ellipsePoints: Point2D[] = [];
      
      // Check if it's a full ellipse or elliptical arc
      if (ellipse.startParam !== undefined && ellipse.endParam !== undefined) {
        // It's an elliptical arc
        const paramSpan: number = ellipse.endParam - ellipse.startParam;
        const numEllipseSamples: number = Math.max(8, Math.ceil(Math.abs(paramSpan) / (Math.PI / 8)));
        
        for (let i: number = 0; i <= numEllipseSamples; i++) {
          const t: number = i / numEllipseSamples;
          const param: number = ellipse.startParam + t * (ellipse.endParam - ellipse.startParam);
          ellipsePoints.push(calculateEllipsePoint(ellipse, param));
        }
      } else {
        // It's a full ellipse - sample points around the complete ellipse
        const numEllipseSamples: number = 16;
        for (let i: number = 0; i < numEllipseSamples; i++) {
          const param: number = (i / numEllipseSamples) * 2 * Math.PI;
          ellipsePoints.push(calculateEllipsePoint(ellipse, param));
        }
      }
      
      return ellipsePoints;
    
    default:
      return [];
  }
}

/**
 * Calculate signed area using the shoelace formula
 * Positive area indicates counterclockwise orientation
 * Negative area indicates clockwise orientation
 */
function calculateSignedArea(points: Point2D[]): number {
  if (points.length < 3) return 0;
  
  let area: number = 0;
  const n: number = points.length;
  
  for (let i: number = 0; i < n; i++) {
    const j: number = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return area / 2;
}