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
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  // Process entities
  if (parsed && parsed.entities) {
    parsed.entities.forEach((entity: any) => {
      const shape = convertDXFEntity(entity);
      if (shape) {
        shapes.push(shape);
        updateBounds(shape, { minX, minY, maxX, maxY });
      }
    });
  }

  return {
    shapes,
    bounds: {
      min: { x: minX, y: minY },
      max: { x: maxX, y: maxY }
    },
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
        if (entity.center && typeof entity.radius === 'number') {
          return {
            id: generateId(),
            type: 'circle',
            geometry: {
              center: { x: entity.center.x, y: entity.center.y },
              radius: entity.radius
            },
            layer: entity.layer
          };
        }
        return null;

      case 'ARC':
        if (entity.center && typeof entity.radius === 'number' && 
            typeof entity.startAngle === 'number' && typeof entity.endAngle === 'number') {
          return {
            id: generateId(),
            type: 'arc',
            geometry: {
              center: { x: entity.center.x, y: entity.center.y },
              radius: entity.radius,
              startAngle: entity.startAngle * Math.PI / 180,
              endAngle: entity.endAngle * Math.PI / 180,
              clockwise: false
            },
            layer: entity.layer
          };
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
    bounds.minX = Math.min(bounds.minX, p.x);
    bounds.minY = Math.min(bounds.minY, p.y);
    bounds.maxX = Math.max(bounds.maxX, p.x);
    bounds.maxY = Math.max(bounds.maxY, p.y);
  });
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