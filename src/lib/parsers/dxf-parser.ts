// Dynamic import to avoid SSR issues
let parseString: any;
import type { Drawing, Shape, Point2D } from '../../types';
import { generateId } from '../utils/id';

export async function parseDXF(content: string): Promise<Drawing> {
  // Dynamically import DXF parser only on client side
  if (!parseString) {
    const dxfModule = await import('dxf');
    parseString = dxfModule.parseString;
  }
  
  const parsed = parseString(content);
  const shapes: Shape[] = [];
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  };

  // Process entities
  if (parsed && parsed.entities) {
    parsed.entities.forEach((entity: any) => {
      const shape = convertDXFEntity(entity);
      if (shape) {
        shapes.push(shape);
        updateBounds(shape, bounds);
      }
    });
  }

  // Ensure bounds are valid - if no shapes were processed, set to zero bounds
  const finalBounds = {
    min: { 
      x: isFinite(bounds.minX) ? bounds.minX : 0, 
      y: isFinite(bounds.minY) ? bounds.minY : 0 
    },
    max: { 
      x: isFinite(bounds.maxX) ? bounds.maxX : 0, 
      y: isFinite(bounds.maxY) ? bounds.maxY : 0 
    }
  };

  return {
    shapes,
    bounds: finalBounds, 
    units: 'mm' // Default to mm, can be detected from DXF header
  };
}

function convertDXFEntity(entity: any): Shape | null {
  try {
    switch (entity.type) {
      case 'LINE':
        // Handle LINE entities - can have vertices array or direct start/end points
        if (entity.vertices && entity.vertices.length >= 2) {
          return {
            id: generateId(),
            type: 'line',
            geometry: {
              start: { x: entity.vertices[0].x, y: entity.vertices[0].y },
              end: { x: entity.vertices[1].x, y: entity.vertices[1].y }
            },
            layer: entity.layer
          };
        } else if (entity.start && entity.end) {
          // Alternative LINE format
          return {
            id: generateId(),
            type: 'line',
            geometry: {
              start: { x: entity.start.x, y: entity.start.y },
              end: { x: entity.end.x, y: entity.end.y }
            },
            layer: entity.layer
          };
        }
        return null;

      case 'CIRCLE':
        // CIRCLE entities have x, y, r properties (similar to ARCs)
        if (typeof entity.x === 'number' && typeof entity.y === 'number' && typeof entity.r === 'number') {
          return {
            id: generateId(),
            type: 'circle',
            geometry: {
              center: { x: entity.x, y: entity.y },
              radius: entity.r
            },
            layer: entity.layer
          };
        }
        return null;

      case 'ARC':
        // ARC entities have x, y, r properties (not center/radius)
        if (typeof entity.x === 'number' && typeof entity.y === 'number' && 
            typeof entity.r === 'number' && typeof entity.startAngle === 'number' && 
            typeof entity.endAngle === 'number') {
          return {
            id: generateId(),
            type: 'arc',
            geometry: {
              center: { x: entity.x, y: entity.y },
              radius: entity.r,
              startAngle: entity.startAngle, // Already in radians from DXF library
              endAngle: entity.endAngle,     // Already in radians from DXF library
              clockwise: false
            },
            layer: entity.layer
          };
        }
        return null;

      case 'SPLINE':
        // SPLINE entities are NURBS curves - convert to polyline by sampling points
        if (entity.controlPoints && Array.isArray(entity.controlPoints) && entity.controlPoints.length >= 2) {
          try {
            const sampledPoints = sampleSplinePoints(entity);
            if (sampledPoints.length >= 2) {
              return {
                id: generateId(),
                type: 'polyline',
                geometry: {
                  points: sampledPoints,
                  closed: entity.closed || false
                },
                layer: entity.layer,
                originalType: 'spline' // Keep track of original entity type
              };
            }
          } catch (error) {
            console.warn('Error sampling SPLINE entity:', error);
            return null;
          }
        }
        return null;

      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (entity.vertices && Array.isArray(entity.vertices) && entity.vertices.length > 0) {
          const points: Point2D[] = entity.vertices
            .filter((v: any) => v && typeof v.x === 'number' && typeof v.y === 'number')
            .map((v: any) => ({
              x: v.x,
              y: v.y
            }));
          
          if (points.length > 0) {
            return {
              id: generateId(),
              type: 'polyline',
              geometry: {
                points,
                closed: entity.shape || entity.closed || false
              },
              layer: entity.layer
            };
          }
        }
        return null;

      default:
        // Silently ignore unknown entity types
        return null;
    }
  } catch (error) {
    // Log the error for debugging but don't crash the parsing
    console.warn(`Error converting DXF entity of type ${entity.type}:`, error);
    return null;
  }
}

function updateBounds(shape: Shape, bounds: any): void {
  const points = getShapePoints(shape);
  points.forEach(p => {
    // Only update bounds with finite values
    if (p && isFinite(p.x) && isFinite(p.y)) {
      bounds.minX = Math.min(bounds.minX, p.x);
      bounds.minY = Math.min(bounds.minY, p.y);
      bounds.maxX = Math.max(bounds.maxX, p.x);
      bounds.maxY = Math.max(bounds.maxY, p.y);
    }
  });
}

// Sample points along a SPLINE (NURBS) curve to convert to polyline
function sampleSplinePoints(splineEntity: any): Point2D[] {
  const controlPoints = splineEntity.controlPoints;
  const degree = splineEntity.degree || 3;
  const knots = splineEntity.knots;
  
  // Simple approach: if we have fit points, use them
  if (splineEntity.fitPoints && splineEntity.fitPoints.length >= 2) {
    return splineEntity.fitPoints.map((p: any) => ({ x: p.x, y: p.y }));
  }
  
  // For now, implement a simple approach using control points
  // For production use, we'd want proper NURBS evaluation
  const sampledPoints: Point2D[] = [];
  const numSamples = Math.max(16, controlPoints.length * 4); // Adaptive sampling
  
  if (degree === 1 || controlPoints.length <= 2) {
    // Linear interpolation for degree 1 or simple cases
    for (let i = 0; i < controlPoints.length; i++) {
      sampledPoints.push({ x: controlPoints[i].x, y: controlPoints[i].y });
    }
  } else {
    // Simple approximation: sample along the control polygon with smoothing
    // This is not a true NURBS evaluation but provides a reasonable approximation
    
    // Start with first control point
    sampledPoints.push({ x: controlPoints[0].x, y: controlPoints[0].y });
    
    // Sample intermediate points using a simple curve approximation
    for (let i = 0; i < numSamples - 1; i++) {
      const t = (i + 1) / numSamples;
      const point = evaluateSimpleBSpline(controlPoints, degree, t);
      if (point) {
        sampledPoints.push(point);
      }
    }
    
    // End with last control point
    const lastPoint = controlPoints[controlPoints.length - 1];
    sampledPoints.push({ x: lastPoint.x, y: lastPoint.y });
  }
  
  return sampledPoints;
}

// Simple B-spline evaluation (approximation)
function evaluateSimpleBSpline(controlPoints: any[], degree: number, t: number): Point2D | null {
  if (controlPoints.length === 0) return null;
  
  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t));
  
  if (degree === 1 || controlPoints.length <= 2) {
    // Linear interpolation
    const index = t * (controlPoints.length - 1);
    const i = Math.floor(index);
    const j = Math.min(i + 1, controlPoints.length - 1);
    const alpha = index - i;
    
    return {
      x: controlPoints[i].x * (1 - alpha) + controlPoints[j].x * alpha,
      y: controlPoints[i].y * (1 - alpha) + controlPoints[j].y * alpha
    };
  }
  
  // For higher degrees, use a simple approximation
  // This is not true NURBS evaluation but works for basic cases
  const n = controlPoints.length - 1;
  let x = 0, y = 0;
  
  for (let i = 0; i <= n; i++) {
    const basis = bernsteinBasis(n, i, t);
    x += basis * controlPoints[i].x;
    y += basis * controlPoints[i].y;
  }
  
  return { x, y };
}

// Bernstein basis function (for Bezier curve approximation)
function bernsteinBasis(n: number, i: number, t: number): number {
  return binomialCoefficient(n, i) * Math.pow(t, i) * Math.pow(1 - t, n - i);
}

// Binomial coefficient calculation
function binomialCoefficient(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return result;
}

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
      return polyline.points;
    
    default:
      return [];
  }
}