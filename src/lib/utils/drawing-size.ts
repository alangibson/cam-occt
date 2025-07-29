import type { Drawing, Shape } from '../../types';
import { sampleNURBS } from '../geometry/nurbs';

export interface DrawingSize {
  width: number;
  height: number;
  units: string;
  source: 'dxf' | 'calculated';
}

export function calculateDrawingSize(drawing: Drawing | null): DrawingSize | null {
  if (!drawing || drawing.shapes.length === 0) {
    return null;
  }

  // First, check if DXF has explicit size information
  // TODO: Parse DXF header for explicit dimensions in future
  
  // Check if the bounds from DXF parser are valid
  const bounds = drawing.bounds;
  const isValidBounds = bounds && 
    isFinite(bounds.min.x) && isFinite(bounds.min.y) && 
    isFinite(bounds.max.x) && isFinite(bounds.max.y) &&
    bounds.min.x !== bounds.max.x && bounds.min.y !== bounds.max.y;
  
  if (isValidBounds) {
    // Use the bounding box that was already calculated by the DXF parser
    return {
      width: Math.abs(bounds.max.x - bounds.min.x),
      height: Math.abs(bounds.max.y - bounds.min.y),
      units: drawing.units,
      source: 'calculated'
    };
  }
  
  // If DXF bounds are invalid, calculate using custom algorithms
  console.warn('DXF bounds are invalid, falling back to custom bounding box calculation');
  
  const customBounds = calculateBoundingBoxFromShapes(drawing.shapes);
  if (!customBounds) {
    throw new Error('Failed to calculate bounding box from shapes');
  }

  return {
    width: customBounds.width,
    height: customBounds.height,
    units: drawing.units,
    source: 'calculated'
  };
}

function calculateBoundingBoxFromShapes(shapes: Shape[]): { width: number; height: number } | null {
  if (shapes.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const shape of shapes) {
    const shapeBounds = getShapeBounds(shape);
    if (shapeBounds) {
      minX = Math.min(minX, shapeBounds.min.x);
      maxX = Math.max(maxX, shapeBounds.max.x);
      minY = Math.min(minY, shapeBounds.min.y);
      maxY = Math.max(maxY, shapeBounds.max.y);
    }
  }

  if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
    return null;
  }

  return {
    width: Math.abs(maxX - minX),
    height: Math.abs(maxY - minY)
  };
}

function getShapeBounds(shape: Shape): { min: { x: number; y: number }; max: { x: number; y: number } } | null {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      if (!line.start || !line.end || !isFinite(line.start.x) || !isFinite(line.start.y) || 
          !isFinite(line.end.x) || !isFinite(line.end.y)) {
        return null;
      }
      
      return {
        min: {
          x: Math.min(line.start.x, line.end.x),
          y: Math.min(line.start.y, line.end.y)
        },
        max: {
          x: Math.max(line.start.x, line.end.x),
          y: Math.max(line.start.y, line.end.y)
        }
      };

    case 'circle':
      const circle = shape.geometry as any;
      if (!circle.center || !isFinite(circle.center.x) || !isFinite(circle.center.y) || 
          !isFinite(circle.radius) || circle.radius <= 0) {
        return null;
      }
      
      return {
        min: {
          x: circle.center.x - circle.radius,
          y: circle.center.y - circle.radius
        },
        max: {
          x: circle.center.x + circle.radius,
          y: circle.center.y + circle.radius
        }
      };

    case 'arc':
      const arc = shape.geometry as any;
      if (!arc.center || !isFinite(arc.center.x) || !isFinite(arc.center.y) || 
          !isFinite(arc.radius) || arc.radius <= 0 ||
          !isFinite(arc.startAngle) || !isFinite(arc.endAngle)) {
        return null;
      }
      
      // For arcs, we need to check the arc endpoints and any quadrant crossings
      const startAngle = arc.startAngle;
      const endAngle = arc.endAngle;
      
      // Calculate start and end points
      const startX = arc.center.x + arc.radius * Math.cos(startAngle);
      const startY = arc.center.y + arc.radius * Math.sin(startAngle);
      const endX = arc.center.x + arc.radius * Math.cos(endAngle);
      const endY = arc.center.y + arc.radius * Math.sin(endAngle);
      
      let minX = Math.min(startX, endX);
      let maxX = Math.max(startX, endX);
      let minY = Math.min(startY, endY);
      let maxY = Math.max(startY, endY);
      
      // Check if arc crosses major axes (0°, 90°, 180°, 270°)
      const normalizeAngle = (angle: number) => {
        while (angle < 0) angle += 2 * Math.PI;
        while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
        return angle;
      };
      
      const normStart = normalizeAngle(startAngle);
      const normEnd = normalizeAngle(endAngle);
      
      const checkAngle = (testAngle: number, pointX: number, pointY: number) => {
        if (arc.clockwise) {
          // For clockwise arcs, check if testAngle is between start and end going clockwise
          if (normStart > normEnd) {
            if (testAngle <= normStart && testAngle >= normEnd) {
              minX = Math.min(minX, pointX);
              maxX = Math.max(maxX, pointX);
              minY = Math.min(minY, pointY);
              maxY = Math.max(maxY, pointY);
            }
          } else {
            if (testAngle <= normStart || testAngle >= normEnd) {
              minX = Math.min(minX, pointX);
              maxX = Math.max(maxX, pointX);
              minY = Math.min(minY, pointY);
              maxY = Math.max(maxY, pointY);
            }
          }
        } else {
          // For counter-clockwise arcs
          if (normStart < normEnd) {
            if (testAngle >= normStart && testAngle <= normEnd) {
              minX = Math.min(minX, pointX);
              maxX = Math.max(maxX, pointX);
              minY = Math.min(minY, pointY);
              maxY = Math.max(maxY, pointY);
            }
          } else {
            if (testAngle >= normStart || testAngle <= normEnd) {
              minX = Math.min(minX, pointX);
              maxX = Math.max(maxX, pointX);
              minY = Math.min(minY, pointY);
              maxY = Math.max(maxY, pointY);
            }
          }
        }
      };
      
      // Check 0° (right)
      checkAngle(0, arc.center.x + arc.radius, arc.center.y);
      // Check 90° (top)
      checkAngle(Math.PI / 2, arc.center.x, arc.center.y + arc.radius);
      // Check 180° (left)
      checkAngle(Math.PI, arc.center.x - arc.radius, arc.center.y);
      // Check 270° (bottom)
      checkAngle(3 * Math.PI / 2, arc.center.x, arc.center.y - arc.radius);
      
      return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };

    case 'polyline':
      const polyline = shape.geometry as any;
      if (!polyline.points || polyline.points.length === 0) return null;

      let polyMinX = Infinity;
      let polyMaxX = -Infinity;
      let polyMinY = Infinity;
      let polyMaxY = -Infinity;

      for (const point of polyline.points) {
        if (point && isFinite(point.x) && isFinite(point.y)) {
          polyMinX = Math.min(polyMinX, point.x);
          polyMaxX = Math.max(polyMaxX, point.x);
          polyMinY = Math.min(polyMinY, point.y);
          polyMaxY = Math.max(polyMaxY, point.y);
        }
      }

      if (!isFinite(polyMinX) || !isFinite(polyMaxX) || !isFinite(polyMinY) || !isFinite(polyMaxY)) {
        return null;
      }

      return {
        min: { x: polyMinX, y: polyMinY },
        max: { x: polyMaxX, y: polyMaxY }
      };

    case 'ellipse':
      const ellipse = shape.geometry as any;
      if (!ellipse.center || !isFinite(ellipse.center.x) || !isFinite(ellipse.center.y) ||
          !ellipse.majorAxisEndpoint || !isFinite(ellipse.majorAxisEndpoint.x) || 
          !isFinite(ellipse.majorAxisEndpoint.y) || !isFinite(ellipse.minorToMajorRatio)) {
        return null;
      }

      // Calculate major and minor axis lengths
      const majorAxisLength = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
        ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
      );
      const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;

      // For a rotated ellipse, we need to find the actual bounding box
      const angle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      // Calculate the bounding box of the rotated ellipse
      const halfWidth = Math.sqrt(majorAxisLength * majorAxisLength * cos * cos + 
                                 minorAxisLength * minorAxisLength * sin * sin);
      const halfHeight = Math.sqrt(majorAxisLength * majorAxisLength * sin * sin + 
                                  minorAxisLength * minorAxisLength * cos * cos);

      return {
        min: { 
          x: ellipse.center.x - halfWidth, 
          y: ellipse.center.y - halfHeight 
        },
        max: { 
          x: ellipse.center.x + halfWidth, 
          y: ellipse.center.y + halfHeight 
        }
      };

    case 'spline':
      const spline = shape.geometry as any;
      // Use NURBS evaluation for accurate bounds, fallback to control points
      let points;
      try {
        points = sampleNURBS(spline, 50); // Sample enough points for good bounds
      } catch (error) {
        // Fallback to fit points or control points
        points = spline.fitPoints && spline.fitPoints.length > 0 ? spline.fitPoints : spline.controlPoints;
      }
      
      if (!points || points.length === 0) return null;

      let splineMinX = Infinity;
      let splineMaxX = -Infinity;
      let splineMinY = Infinity;
      let splineMaxY = -Infinity;

      for (const point of points) {
        if (point && isFinite(point.x) && isFinite(point.y)) {
          splineMinX = Math.min(splineMinX, point.x);
          splineMaxX = Math.max(splineMaxX, point.x);
          splineMinY = Math.min(splineMinY, point.y);
          splineMaxY = Math.max(splineMaxY, point.y);
        }
      }

      if (!isFinite(splineMinX) || !isFinite(splineMaxX) || !isFinite(splineMinY) || !isFinite(splineMaxY)) {
        return null;
      }

      return {
        min: { x: splineMinX, y: splineMinY },
        max: { x: splineMaxX, y: splineMaxY }
      };

    default:
      return null;
  }
}