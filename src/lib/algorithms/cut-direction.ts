import type { ShapeChain } from './chain-detection';
import type { Shape, Point2D, Line, Arc, Circle, Polyline, Spline, Ellipse } from '../../types/geometry';

export type CutDirection = 'clockwise' | 'counterclockwise' | 'none';

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
export function detectCutDirection(chain: ShapeChain, tolerance: number = 0.1): CutDirection {
  if (!chain || !chain.shapes || chain.shapes.length === 0) {
    return 'none';
  }

  // Check if chain is closed by comparing first and last points
  const firstPoint = getShapeStartPoint(chain.shapes[0]);
  const lastPoint = getShapeEndPoint(chain.shapes[chain.shapes.length - 1]);
  
  if (!isPointsClosed(firstPoint, lastPoint, tolerance)) {
    return 'none'; // Open paths don't have a natural cut direction
  }

  // Get all points from the chain
  const points = getChainPoints(chain);
  
  if (points.length < 3) {
    return 'none'; // Need at least 3 points to determine direction
  }

  // Calculate signed area using shoelace formula
  const signedArea = calculateSignedArea(points);
  
  // Positive area = counterclockwise, negative area = clockwise
  return signedArea > 0 ? 'counterclockwise' : 'clockwise';
}

/**
 * Get the starting point of a shape
 */
function getShapeStartPoint(shape: Shape): Point2D {
  switch (shape.type) {
    case 'line':
      return (shape.geometry as Line).start;
    case 'circle':
      // For circles, we could start at any point, using rightmost point
      const circle = shape.geometry as Circle;
      return { x: circle.center.x + circle.radius, y: circle.center.y };
    case 'arc':
      // Arc doesn't have start/end in geometry, need to calculate from angles
      const arc = shape.geometry as Arc;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle)
      };
    case 'polyline':
      const polyline = shape.geometry as Polyline;
      return polyline.points[0];
    case 'spline':
      const spline = shape.geometry as Spline;
      return spline.controlPoints[0];
    case 'ellipse':
      const ellipse = shape.geometry as Ellipse;
      // For ellipses, start at the end of the major axis
      return {
        x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
        y: ellipse.center.y + ellipse.majorAxisEndpoint.y
      };
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Get the ending point of a shape
 */
function getShapeEndPoint(shape: Shape): Point2D {
  switch (shape.type) {
    case 'line':
      return (shape.geometry as Line).end;
    case 'circle':
      // For circles, end point is same as start point (closed shape)
      const circle = shape.geometry as Circle;
      return { x: circle.center.x + circle.radius, y: circle.center.y };
    case 'arc':
      // Arc doesn't have start/end in geometry, need to calculate from angles
      const arc = shape.geometry as Arc;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle)
      };
    case 'polyline':
      const polyline = shape.geometry as Polyline;
      return polyline.points[polyline.points.length - 1];
    case 'spline':
      const spline = shape.geometry as Spline;
      return spline.controlPoints[spline.controlPoints.length - 1];
    case 'ellipse':
      const ellipse = shape.geometry as Ellipse;
      // Check if it's a full ellipse or elliptical arc
      if (ellipse.startParam !== undefined && ellipse.endParam !== undefined) {
        // It's an elliptical arc - calculate end point
        return calculateEllipsePoint(ellipse, ellipse.endParam);
      } else {
        // It's a full ellipse - end point is same as start point
        return {
          x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
          y: ellipse.center.y + ellipse.majorAxisEndpoint.y
        };
      }
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Calculate a point on an ellipse at a given parameter
 */
function calculateEllipsePoint(ellipse: Ellipse, param: number): Point2D {
  // Calculate major and minor axis lengths
  const majorAxisLength = Math.sqrt(
    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
  );
  const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
  
  // Calculate major axis angle
  const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
  
  // Calculate point on canonical ellipse (axes aligned)
  const canonicalX = majorAxisLength * Math.cos(param);
  const canonicalY = minorAxisLength * Math.sin(param);
  
  // Rotate by major axis angle and translate to center
  const cos = Math.cos(majorAxisAngle);
  const sin = Math.sin(majorAxisAngle);
  
  return {
    x: ellipse.center.x + canonicalX * cos - canonicalY * sin,
    y: ellipse.center.y + canonicalX * sin + canonicalY * cos
  };
}

/**
 * Check if two points are within tolerance (chain is closed)
 */
function isPointsClosed(point1: Point2D, point2: Point2D, tolerance: number): boolean {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= tolerance;
}

/**
 * Extract all points from a chain for area calculation
 */
function getChainPoints(chain: ShapeChain): Point2D[] {
  const points: Point2D[] = [];
  
  for (const shape of chain.shapes) {
    const shapePoints = getShapePoints(shape);
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
      const line = shape.geometry as Line;
      return [line.start, line.end];
    
    case 'circle':
      // For circles, we don't need to sample points to calculate direction
      // Circles are inherently counterclockwise in CAD coordinate systems
      // Return a simple set of points that will give us the correct orientation
      const circle = shape.geometry as Circle;
      // Create 4 points in counterclockwise order (right, top, left, bottom)
      return [
        { x: circle.center.x + circle.radius, y: circle.center.y },      // right
        { x: circle.center.x, y: circle.center.y + circle.radius },      // top
        { x: circle.center.x - circle.radius, y: circle.center.y },      // left
        { x: circle.center.x, y: circle.center.y - circle.radius }       // bottom
      ];
    
    case 'arc':
      // Sample arc with points based on angle span, respecting clockwise property
      const arc = shape.geometry as Arc;
      const arcPoints: Point2D[] = [];
      const angleSpan = Math.abs(arc.endAngle - arc.startAngle);
      const numArcSamples = Math.max(4, Math.ceil(angleSpan / (Math.PI / 8))); // At least 4 points
      
      for (let i = 0; i <= numArcSamples; i++) {
        const t = i / numArcSamples;
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
      const polyline = shape.geometry as Polyline;
      return [...polyline.points]; // Copy to avoid mutation
    
    case 'spline':
      // Sample spline with multiple points for accurate area calculation
      const spline = shape.geometry as Spline;
      const splinePoints: Point2D[] = [];
      const numSplineSamples = Math.max(10, spline.controlPoints.length * 3);
      
      for (let i = 0; i <= numSplineSamples; i++) {
        const t = i / numSplineSamples;
        // Simple linear interpolation for now - could be improved with actual spline evaluation
        const segmentIndex = Math.min(Math.floor(t * (spline.controlPoints.length - 1)), spline.controlPoints.length - 2);
        const localT = (t * (spline.controlPoints.length - 1)) - segmentIndex;
        
        const p1 = spline.controlPoints[segmentIndex];
        const p2 = spline.controlPoints[segmentIndex + 1];
        
        splinePoints.push({
          x: p1.x + localT * (p2.x - p1.x),
          y: p1.y + localT * (p2.y - p1.y)
        });
      }
      return splinePoints;
    
    case 'ellipse':
      // Sample ellipse with multiple points for accurate area calculation
      const ellipse = shape.geometry as Ellipse;
      const ellipsePoints: Point2D[] = [];
      
      // Check if it's a full ellipse or elliptical arc
      if (ellipse.startParam !== undefined && ellipse.endParam !== undefined) {
        // It's an elliptical arc
        const paramSpan = ellipse.endParam - ellipse.startParam;
        const numEllipseSamples = Math.max(8, Math.ceil(Math.abs(paramSpan) / (Math.PI / 8)));
        
        for (let i = 0; i <= numEllipseSamples; i++) {
          const t = i / numEllipseSamples;
          const param = ellipse.startParam + t * (ellipse.endParam - ellipse.startParam);
          ellipsePoints.push(calculateEllipsePoint(ellipse, param));
        }
      } else {
        // It's a full ellipse - sample points around the complete ellipse
        const numEllipseSamples = 16;
        for (let i = 0; i < numEllipseSamples; i++) {
          const param = (i / numEllipseSamples) * 2 * Math.PI;
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
  
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return area / 2;
}