import type { Shape, Point2D, Drawing, ToolPath, CuttingParameters } from '../../types';
import { generateId } from '../utils/id';
import { sampleNURBS } from '../geometry/nurbs';

export function generateToolPaths(
  drawing: Drawing,
  parameters: CuttingParameters
): ToolPath[] {
  const paths: ToolPath[] = [];
  
  // Generate tool paths for each shape
  drawing.shapes.forEach(shape => {
    const path = generateShapeToolPath(shape, parameters);
    if (path) {
      paths.push(path);
    }
  });
  
  // Optimize cut sequence
  return optimizeCutSequence(paths);
}

function generateShapeToolPath(
  shape: Shape,
  parameters: CuttingParameters
): ToolPath | null {
  const points = getShapePoints(shape);
  if (points.length < 2) return null;
  
  // Apply kerf compensation
  const compensatedPoints = applyKerfCompensation(points, parameters.kerf);
  
  // Generate lead-in and lead-out
  const leadIn = generateLeadIn(compensatedPoints[0], parameters.leadInLength);
  const leadOut = generateLeadOut(
    compensatedPoints[compensatedPoints.length - 1],
    parameters.leadOutLength
  );
  
  return {
    id: generateId(),
    shapeId: shape.id,
    points: compensatedPoints,
    leadIn,
    leadOut,
    isRapid: false,
    parameters,
    originalShape: shape // Preserve original shape for native G-code generation
  };
}

function getShapePoints(shape: Shape): Point2D[] {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return [line.start, line.end];
      
    case 'circle':
      const circle = shape.geometry as any;
      return generateCirclePoints(circle.center, circle.radius);
      
    case 'arc':
      const arc = shape.geometry as any;
      return generateArcPoints(arc);
      
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points;
      
    case 'ellipse':
      const ellipse = shape.geometry as any;
      return generateEllipsePoints(ellipse);
      
    case 'spline':
      const spline = shape.geometry as any;
      try {
        // Use NURBS sampling for tool path generation
        return sampleNURBS(spline, 64); // Use good resolution for tool paths
      } catch (error) {
        // Fallback to fit points or control points if NURBS evaluation fails
        if (spline.fitPoints && spline.fitPoints.length > 0) {
          return spline.fitPoints;
        } else if (spline.controlPoints && spline.controlPoints.length > 0) {
          return spline.controlPoints;
        }
        return [];
      }
      
    default:
      return [];
  }
}

function generateCirclePoints(center: Point2D, radius: number): Point2D[] {
  const points: Point2D[] = [];
  const segments = Math.max(32, Math.ceil(radius * 2 * Math.PI / 5)); // ~5mm segments
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    });
  }
  
  return points;
}

function generateArcPoints(arc: any): Point2D[] {
  const points: Point2D[] = [];
  const totalAngle = arc.endAngle - arc.startAngle;
  const segments = Math.max(16, Math.ceil(Math.abs(totalAngle) * arc.radius / 5));
  
  for (let i = 0; i <= segments; i++) {
    const angle = arc.startAngle + (i / segments) * totalAngle;
    points.push({
      x: arc.center.x + arc.radius * Math.cos(angle),
      y: arc.center.y + arc.radius * Math.sin(angle)
    });
  }
  
  return points;
}

function generateEllipsePoints(ellipse: any): Point2D[] {
  const points: Point2D[] = [];
  
  // Calculate major and minor axis lengths
  const majorAxisLength = Math.sqrt(
    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
  );
  const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
  
  // Calculate rotation angle of major axis
  const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
  
  // Determine if this is an ellipse arc or full ellipse
  const isArc = typeof ellipse.startParam === 'number' && typeof ellipse.endParam === 'number';
  
  if (isArc) {
    // Ellipse arc
    const startParam = ellipse.startParam!;
    const endParam = ellipse.endParam!;
    let paramSpan = endParam - startParam;
    
    // Handle parameter wrapping
    if (paramSpan <= 0) paramSpan += 2 * Math.PI;
    
    const segments = Math.max(16, Math.ceil(64 * paramSpan / (2 * Math.PI)));
    
    for (let i = 0; i <= segments; i++) {
      const param = startParam + (paramSpan * i) / segments;
      
      // Parametric ellipse equations
      const x = majorAxisLength * Math.cos(param);
      const y = minorAxisLength * Math.sin(param);
      
      // Rotate by major axis angle and translate to center
      const rotatedX = x * Math.cos(majorAxisAngle) - y * Math.sin(majorAxisAngle);
      const rotatedY = x * Math.sin(majorAxisAngle) + y * Math.cos(majorAxisAngle);
      
      points.push({
        x: ellipse.center.x + rotatedX,
        y: ellipse.center.y + rotatedY
      });
    }
  } else {
    // Full ellipse
    const segments = 64; // Good resolution for tool paths
    for (let i = 0; i < segments; i++) {
      const param = (i * 2 * Math.PI) / segments;
      
      // Parametric ellipse equations
      const x = majorAxisLength * Math.cos(param);
      const y = minorAxisLength * Math.sin(param);
      
      // Rotate by major axis angle and translate to center
      const rotatedX = x * Math.cos(majorAxisAngle) - y * Math.sin(majorAxisAngle);
      const rotatedY = x * Math.sin(majorAxisAngle) + y * Math.cos(majorAxisAngle);
      
      points.push({
        x: ellipse.center.x + rotatedX,
        y: ellipse.center.y + rotatedY
      });
    }
  }
  
  return points;
}

function applyKerfCompensation(points: Point2D[], kerf: number): Point2D[] {
  // Simplified kerf compensation - offset perpendicular to path
  // In production, use proper offset algorithms
  if (kerf === 0 || points.length < 2) return points;
  
  const compensated: Point2D[] = [];
  const offset = kerf / 2;
  
  for (let i = 0; i < points.length; i++) {
    const prev = points[i - 1] || points[points.length - 2];
    const curr = points[i];
    const next = points[i + 1] || points[1];
    
    // Calculate normal vector
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    
    if (len1 > 0 && len2 > 0) {
      // Average normal
      const nx = (-dy1 / len1 - dy2 / len2) / 2;
      const ny = (dx1 / len1 + dx2 / len2) / 2;
      
      compensated.push({
        x: curr.x + nx * offset,
        y: curr.y + ny * offset
      });
    } else {
      compensated.push(curr);
    }
  }
  
  return compensated;
}

function generateLeadIn(startPoint: Point2D, length: number): Point2D[] {
  // Simple perpendicular lead-in
  const leadInPoint = {
    x: startPoint.x - length,
    y: startPoint.y
  };
  
  return [leadInPoint, startPoint];
}

function generateLeadOut(endPoint: Point2D, length: number): Point2D[] {
  // Simple perpendicular lead-out
  const leadOutPoint = {
    x: endPoint.x + length,
    y: endPoint.y
  };
  
  return [endPoint, leadOutPoint];
}

function optimizeCutSequence(paths: ToolPath[]): ToolPath[] {
  if (paths.length <= 1) return paths;
  
  // Simple nearest neighbor optimization
  const optimized: ToolPath[] = [];
  const remaining = [...paths];
  
  // Start with the first path
  let current = remaining.shift()!;
  optimized.push(current);
  
  while (remaining.length > 0) {
    // Find nearest path
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    
    const currentEnd = current.points[current.points.length - 1];
    
    remaining.forEach((path, index) => {
      const pathStart = path.points[0];
      const distance = Math.sqrt(
        Math.pow(pathStart.x - currentEnd.x, 2) +
        Math.pow(pathStart.y - currentEnd.y, 2)
      );
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    
    current = remaining.splice(nearestIndex, 1)[0];
    optimized.push(current);
  }
  
  return optimized;
}