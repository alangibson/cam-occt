/**
 * Geometric Operations using Custom Algorithms
 * 
 * This module provides accurate geometric calculations for shape containment
 * and spatial relationships using custom mathematical algorithms.
 */

import type { ShapeChain } from '../algorithms/chain-detection';
import type { Shape, Point2D } from '../../types';

/**
 * Checks if one closed chain is completely contained within another closed chain
 * using proper geometric containment (point-in-polygon testing)
 */
export function isChainGeometricallyContained(
  innerChain: ShapeChain, 
  outerChain: ShapeChain
): boolean {
  try {
    // Extract polygon points from both chains
    const innerPolygon = extractPolygonFromChain(innerChain);
    const outerPolygon = extractPolygonFromChain(outerChain);
    
    if (!innerPolygon || !outerPolygon || innerPolygon.length < 3 || outerPolygon.length < 3) {
      throw new Error(`Failed to extract polygons for containment check: inner chain ${innerChain.id}=${!!innerPolygon}, outer chain ${outerChain.id}=${!!outerPolygon}. Chains may have gaps preventing polygon creation.`);
    }
    
    // Check if all points of inner polygon are inside outer polygon
    return isPolygonContained(innerPolygon, outerPolygon);
  } catch (error) {
    // Re-throw the error so the part detection can handle it appropriately
    throw error;
  }
}

/**
 * Extracts a polygon representation from a chain for geometric operations
 */
function extractPolygonFromChain(chain: ShapeChain): Point2D[] | null {
  if (!chain || !chain.shapes || chain.shapes.length === 0) {
    return null;
  }
  
  const points: Point2D[] = [];
  
  for (const shape of chain.shapes) {
    const shapePoints = getShapePoints(shape);
    if (shapePoints && shapePoints.length > 0) {
      // Add points, but avoid duplicating the last point of previous shape with first point of next
      if (points.length === 0) {
        points.push(...shapePoints);
      } else {
        // Skip first point if it's close to the last added point
        const lastPoint = points[points.length - 1];
        const firstNewPoint = shapePoints[0];
        const distance = Math.sqrt(
          Math.pow(lastPoint.x - firstNewPoint.x, 2) + 
          Math.pow(lastPoint.y - firstNewPoint.y, 2)
        );
        
        if (distance > 0.001) {
          points.push(...shapePoints);
        } else {
          points.push(...shapePoints.slice(1));
        }
      }
    }
  }
  
  // Remove duplicate points and ensure we have enough for a polygon
  const cleanedPoints = removeDuplicatePoints(points);
  return cleanedPoints.length >= 3 ? cleanedPoints : null;
}

/**
 * Gets representative points from a shape
 */
function getShapePoints(shape: Shape): Point2D[] {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return [line.start, line.end];
      
    case 'circle':
      const circle = shape.geometry as any;
      // Create polygon approximation of circle with 32 points
      const points: Point2D[] = [];
      const segments = 32;
      for (let i = 0; i < segments; i++) {
        const angle = (i * 2 * Math.PI) / segments;
        points.push({
          x: circle.center.x + circle.radius * Math.cos(angle),
          y: circle.center.y + circle.radius * Math.sin(angle)
        });
      }
      return points;
      
    case 'arc':
      const arc = shape.geometry as any;
      // Create polygon approximation of arc
      const arcPoints: Point2D[] = [];
      let startAngle = arc.startAngle;
      let endAngle = arc.endAngle;
      
      // Normalize angles and handle clockwise arcs
      if (arc.clockwise) {
        [startAngle, endAngle] = [endAngle, startAngle];
      }
      
      // Calculate arc span
      let span = endAngle - startAngle;
      if (span <= 0) span += 2 * Math.PI;
      
      const arcSegments = Math.max(8, Math.ceil(span / (Math.PI / 8))); // At least 8 segments
      
      for (let i = 0; i <= arcSegments; i++) {
        const angle = startAngle + (span * i) / arcSegments;
        arcPoints.push({
          x: arc.center.x + arc.radius * Math.cos(angle),
          y: arc.center.y + arc.radius * Math.sin(angle)
        });
      }
      return arcPoints;
      
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points || [];
      
    default:
      return [];
  }
}

/**
 * Removes duplicate points from an array
 */
function removeDuplicatePoints(points: Point2D[], tolerance: number = 0.001): Point2D[] {
  if (points.length <= 1) return points;
  
  const result: Point2D[] = [points[0]];
  
  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    const last = result[result.length - 1];
    
    const distance = Math.sqrt(
      Math.pow(current.x - last.x, 2) + 
      Math.pow(current.y - last.y, 2)
    );
    
    if (distance > tolerance) {
      result.push(current);
    }
  }
  
  return result;
}

/**
 * Checks if one polygon is completely contained within another
 */
function isPolygonContained(innerPolygon: Point2D[], outerPolygon: Point2D[]): boolean {
  // Check if all points of inner polygon are inside outer polygon
  for (const point of innerPolygon) {
    if (!isPointInPolygon(point, outerPolygon)) {
      return false;
    }
  }
  
  // Additional check: ensure polygons don't intersect at edges
  // If inner is truly contained, no edges should intersect
  return !doPolygonsIntersect(innerPolygon, outerPolygon);
}

/**
 * Checks if two polygons intersect at their edges
 */
function doPolygonsIntersect(poly1: Point2D[], poly2: Point2D[]): boolean {
  // Check each edge of poly1 against each edge of poly2
  for (let i = 0; i < poly1.length; i++) {
    const p1 = poly1[i];
    const p2 = poly1[(i + 1) % poly1.length];
    
    for (let j = 0; j < poly2.length; j++) {
      const p3 = poly2[j];
      const p4 = poly2[(j + 1) % poly2.length];
      
      if (doLineSegmentsIntersect(p1, p2, p3, p4)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Checks if two line segments intersect
 */
function doLineSegmentsIntersect(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);
  
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  
  // Check for collinear points
  if (d1 === 0 && onSegment(p3, p1, p4)) return true;
  if (d2 === 0 && onSegment(p3, p2, p4)) return true;
  if (d3 === 0 && onSegment(p1, p3, p2)) return true;
  if (d4 === 0 && onSegment(p1, p4, p2)) return true;
  
  return false;
}

/**
 * Calculates the direction of turn from line p1-p2 to point p3
 */
function direction(p1: Point2D, p2: Point2D, p3: Point2D): number {
  return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}

/**
 * Checks if point q lies on line segment pr
 */
function onSegment(p: Point2D, q: Point2D, r: Point2D): boolean {
  return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
         q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}

/**
 * Point-in-polygon test using ray casting algorithm
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  const x = point.x;
  const y = point.y;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Calculates the area of a polygon using the shoelace formula
 */
export function calculatePolygonArea(polygon: Point2D[]): number {
  if (polygon.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  
  return Math.abs(area) / 2;
}

/**
 * Calculates the centroid of a polygon
 */
export function calculatePolygonCentroid(polygon: Point2D[]): Point2D | null {
  if (polygon.length < 3) return null;
  
  const area = calculatePolygonArea(polygon);
  if (area === 0) return null;
  
  let cx = 0;
  let cy = 0;
  
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const factor = polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
    cx += (polygon[i].x + polygon[j].x) * factor;
    cy += (polygon[i].y + polygon[j].y) * factor;
  }
  
  const signedArea = area * (polygon[0].x < polygon[1].x ? 1 : -1);
  cx /= (6 * signedArea);
  cy /= (6 * signedArea);
  
  return { x: cx, y: cy };
}

/**
 * Calculates the bounding box of a polygon
 */
export function calculatePolygonBounds(polygon: Point2D[]): { min: Point2D; max: Point2D } | null {
  if (polygon.length === 0) return null;
  
  let minX = polygon[0].x;
  let maxX = polygon[0].x;
  let minY = polygon[0].y;
  let maxY = polygon[0].y;
  
  for (let i = 1; i < polygon.length; i++) {
    minX = Math.min(minX, polygon[i].x);
    maxX = Math.max(maxX, polygon[i].x);
    minY = Math.min(minY, polygon[i].y);
    maxY = Math.max(maxY, polygon[i].y);
  }
  
  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY }
  };
}