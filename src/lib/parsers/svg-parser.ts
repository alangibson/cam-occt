import type { Drawing, Shape, Point2D } from '../../types';
import { generateId } from '../utils/id';

export function parseSVG(content: string): Drawing {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'image/svg+xml');
  const svg = doc.documentElement;
  
  const shapes: Shape[] = [];
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  // Get SVG viewBox or dimensions
  const viewBox = svg.getAttribute('viewBox');
  const width = svg.getAttribute('width');
  const height = svg.getAttribute('height');

  // Process all path elements
  const paths = svg.querySelectorAll('path, line, circle, rect, polyline, polygon');
  paths.forEach(element => {
    const shape = convertSVGElement(element);
    if (shape) {
      shapes.push(shape);
      updateBounds(shape, { minX, minY, maxX, maxY });
    }
  });

  return {
    shapes,
    bounds: {
      min: { x: minX, y: minY },
      max: { x: maxX, y: maxY }
    },
    units: 'mm' // Default to mm, can be parsed from SVG
  };
}

function convertSVGElement(element: Element): Shape | null {
  switch (element.tagName.toLowerCase()) {
    case 'line':
      return {
        id: generateId(),
        type: 'line',
        geometry: {
          start: {
            x: parseFloat(element.getAttribute('x1') || '0'),
            y: parseFloat(element.getAttribute('y1') || '0')
          },
          end: {
            x: parseFloat(element.getAttribute('x2') || '0'),
            y: parseFloat(element.getAttribute('y2') || '0')
          }
        }
      };

    case 'circle':
      return {
        id: generateId(),
        type: 'circle',
        geometry: {
          center: {
            x: parseFloat(element.getAttribute('cx') || '0'),
            y: parseFloat(element.getAttribute('cy') || '0')
          },
          radius: parseFloat(element.getAttribute('r') || '0')
        }
      };

    case 'path':
      const d = element.getAttribute('d');
      if (d) {
        return parsePathData(d);
      }
      return null;

    case 'polyline':
    case 'polygon':
      const pointsStr = element.getAttribute('points');
      if (pointsStr) {
        const points = parsePoints(pointsStr);
        return {
          id: generateId(),
          type: 'polyline',
          geometry: {
            points,
            closed: element.tagName.toLowerCase() === 'polygon'
          }
        };
      }
      return null;

    default:
      return null;
  }
}

function parsePoints(pointsStr: string): Point2D[] {
  const points: Point2D[] = [];
  const pairs = pointsStr.trim().split(/\s+/);
  
  pairs.forEach(pair => {
    const [x, y] = pair.split(',').map(parseFloat);
    if (!isNaN(x) && !isNaN(y)) {
      points.push({ x, y });
    }
  });
  
  return points;
}

function parsePathData(d: string): Shape | null {
  // Simplified path parsing - in production, use a proper SVG path parser
  // For MVP, we'll handle simple cases
  const commands = d.match(/[MLHVCSQTAZmlhvcsqtaz][^MLHVCSQTAZmlhvcsqtaz]*/g);
  if (!commands) return null;

  const points: Point2D[] = [];
  let currentPoint = { x: 0, y: 0 };

  commands.forEach(cmd => {
    const type = cmd[0];
    const coords = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);

    switch (type.toUpperCase()) {
      case 'M':
        currentPoint = { x: coords[0], y: coords[1] };
        points.push({ ...currentPoint });
        break;
      case 'L':
        currentPoint = { x: coords[0], y: coords[1] };
        points.push({ ...currentPoint });
        break;
      case 'H':
        currentPoint.x = coords[0];
        points.push({ ...currentPoint });
        break;
      case 'V':
        currentPoint.y = coords[0];
        points.push({ ...currentPoint });
        break;
      case 'Z':
        if (points.length > 0) {
          points.push({ ...points[0] });
        }
        break;
    }
  });

  if (points.length < 2) return null;

  return {
    id: generateId(),
    type: 'polyline',
    geometry: {
      points,
      closed: d.includes('Z') || d.includes('z')
    }
  };
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
    
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points;
    
    default:
      return [];
  }
}