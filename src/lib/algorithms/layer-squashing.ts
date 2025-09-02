/**
 * Layer Squashing Algorithm
 * 
 * Combines all shapes from multiple layers into a single layer for unified processing.
 * This is essential for part detection on multi-layer DXF files where one layer
 * represents the part outline and another represents holes.
 */

import type { Drawing, Shape, Line, Arc, Circle, Polyline, Point2D, PolylineVertex } from '../../lib/types';
import { polylineToVertices, polylineToPoints } from '../geometry/polyline';

export interface LayerSquashingOptions {
  preserveLayerInfo?: boolean; // Keep original layer info as metadata
  tolerance?: number; // Tolerance for duplicate detection (default: 0.1)
}

/**
 * Squashes all layers into a single unified shape collection, eliminating geometric duplicates
 */
export function squashLayers(drawing: Drawing, options: LayerSquashingOptions = {}): Drawing {
  const { preserveLayerInfo = false, tolerance = 0.1 } = options;
  
  // Collect all shapes from all layers with layer information
  const allShapes: Array<Shape & { sourceLayer?: string }> = [];
  
  // Add shapes from the main drawing shapes array
  if (drawing.shapes && drawing.shapes.length > 0) {
    for (const shape of drawing.shapes) {
      const processedShape: Shape = {
        ...shape,
        ...(preserveLayerInfo ? { metadata: { ...shape.metadata, originalLayer: shape.layer } } : {})
      };
      allShapes.push(processedShape);
    }
  }
  
  // Add shapes from individual layers if they exist
  if (drawing.layers) {
    for (const [layerName, layer] of Object.entries(drawing.layers)) {
      if (layer.shapes && layer.shapes.length > 0) {
        for (const shape of layer.shapes) {
          const processedShape: Shape = {
            ...shape,
            layer: layerName,
            ...(preserveLayerInfo ? { metadata: { ...shape.metadata, originalLayer: layerName } } : {})
          };
          allShapes.push(processedShape);
        }
      }
    }
  }
  
  // Remove geometric duplicates using first-come-first-served approach
  const deduplicatedShapes: Shape[] = removeDuplicateShapes(allShapes, tolerance);
  
  // Create new drawing with deduplicated shapes
  return {
    ...drawing,
    shapes: deduplicatedShapes,
    // Optionally preserve layer structure for reference
    layers: preserveLayerInfo ? drawing.layers : undefined
  };
}

/**
 * Removes geometric duplicate shapes using first-come-first-served approach
 */
function removeDuplicateShapes(shapes: Array<Shape & { sourceLayer?: string }>, tolerance: number): Shape[] {
  const uniqueShapes: Shape[] = [];
  
  for (const currentShape of shapes) {
    // Check if this shape is a duplicate of any already added shape
    const isDuplicate: boolean = uniqueShapes.some(existingShape => 
      areShapesGeometricallyEqual(currentShape, existingShape, tolerance)
    );
    
    if (!isDuplicate) {
      // Remove sourceLayer before adding to final collection
      const { sourceLayer: _, ...cleanShape } = currentShape;
      uniqueShapes.push(cleanShape);
    }
  }
  
  return uniqueShapes;
}

/**
 * Checks if two shapes are geometrically equal within tolerance
 */
function areShapesGeometricallyEqual(shape1: Shape, shape2: Shape, tolerance: number): boolean {
  // Must be same shape type
  if (shape1.type !== shape2.type) return false;
  
  switch (shape1.type) {
    case 'circle':
      return areCirclesEqual(shape1.geometry as Circle, shape2.geometry as Circle, tolerance);
    
    case 'line':
      return areLinesEqual(shape1.geometry as Line, shape2.geometry as Line, tolerance);
    
    case 'arc':
      return areArcsEqual(shape1.geometry as Arc, shape2.geometry as Arc, tolerance);
    
    case 'polyline':
      return arePolylinesEqual(shape1.geometry as Polyline, shape2.geometry as Polyline, tolerance);
    
    default:
      return false; // Unknown shape types are not considered equal
  }
}

function areCirclesEqual(circle1: Circle, circle2: Circle, tolerance: number): boolean {
  const centerDistance: number = Math.sqrt(
    Math.pow(circle1.center.x - circle2.center.x, 2) + 
    Math.pow(circle1.center.y - circle2.center.y, 2)
  );
  const radiusDifference: number = Math.abs(circle1.radius - circle2.radius);
  
  return centerDistance < tolerance && radiusDifference < tolerance;
}

function areLinesEqual(line1: Line, line2: Line, tolerance: number): boolean {
  // Check both directions (line can be defined start->end or end->start)
  const startDistance1: number = Math.sqrt(
    Math.pow(line1.start.x - line2.start.x, 2) + 
    Math.pow(line1.start.y - line2.start.y, 2)
  );
  const endDistance1: number = Math.sqrt(
    Math.pow(line1.end.x - line2.end.x, 2) + 
    Math.pow(line1.end.y - line2.end.y, 2)
  );
  
  const startDistance2: number = Math.sqrt(
    Math.pow(line1.start.x - line2.end.x, 2) + 
    Math.pow(line1.start.y - line2.end.y, 2)
  );
  const endDistance2: number = Math.sqrt(
    Math.pow(line1.end.x - line2.start.x, 2) + 
    Math.pow(line1.end.y - line2.start.y, 2)
  );
  
  // Lines are equal if both endpoints match (in either direction)
  return (startDistance1 < tolerance && endDistance1 < tolerance) ||
         (startDistance2 < tolerance && endDistance2 < tolerance);
}

function areArcsEqual(arc1: Arc, arc2: Arc, tolerance: number): boolean {
  const centerDistance: number = Math.sqrt(
    Math.pow(arc1.center.x - arc2.center.x, 2) + 
    Math.pow(arc1.center.y - arc2.center.y, 2)
  );
  const radiusDifference: number = Math.abs(arc1.radius - arc2.radius);
  
  // Normalize angles to [0, 2π]
  const normalizeAngle: (angle: number) => number = (angle: number): number => {
    const normalized: number = angle % (2 * Math.PI);
    return normalized < 0 ? normalized + 2 * Math.PI : normalized;
  };
  
  const start1: number = normalizeAngle(arc1.startAngle);
  const end1: number = normalizeAngle(arc1.endAngle);
  const start2: number = normalizeAngle(arc2.startAngle);
  const end2: number = normalizeAngle(arc2.endAngle);
  
  const startAngleDiff: number = Math.abs(start1 - start2);
  const endAngleDiff: number = Math.abs(end1 - end2);
  const angleToleranceRad: number = tolerance / arc1.radius; // Convert linear tolerance to angular
  
  return centerDistance < tolerance && 
         radiusDifference < tolerance &&
         startAngleDiff < angleToleranceRad && 
         endAngleDiff < angleToleranceRad &&
         arc1.clockwise === arc2.clockwise;
}

function arePolylinesEqual(poly1: Polyline, poly2: Polyline, tolerance: number): boolean {
  const points1: Point2D[] = polylineToPoints(poly1);
  const points2: Point2D[] = polylineToPoints(poly2);
  
  if (points1.length !== points2.length) return false;
  
  // Check if all points match in order
  for (let i: number = 0; i < points1.length; i++) {
    const distance: number = Math.sqrt(
      Math.pow(points1[i].x - points2[i].x, 2) + 
      Math.pow(points1[i].y - points2[i].y, 2)
    );
    if (distance >= tolerance) return false;
  }
  
  // Check vertices if they exist (for bulge data)
  const vertices1: PolylineVertex[] = polylineToVertices(poly1);
  const vertices2: PolylineVertex[] = polylineToVertices(poly2);
  if (vertices1.length > 0 && vertices2.length > 0) {
    if (vertices1.length !== vertices2.length) return false;
    
    for (let i: number = 0; i < vertices1.length; i++) {
      const v1: PolylineVertex = vertices1[i];
      const v2: PolylineVertex = vertices2[i];
      const distance: number = Math.sqrt(
        Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2)
      );
      const bulgeDiff: number = Math.abs((v1.bulge || 0) - (v2.bulge || 0));
      
      if (distance >= tolerance || bulgeDiff >= tolerance) return false;
    }
  }
  
  return true;
}

/**
 * Gets statistics about layer distribution before squashing
 */
export function getLayerStatistics(drawing: Drawing): {
  totalShapes: number;
  mainShapes: number;
  layerCounts: Record<string, number>;
  layerNames: string[];
} {
  const mainShapes: number = drawing.shapes?.length || 0;
  const layerCounts: Record<string, number> = {};
  let totalShapes: number = mainShapes;
  
  if (drawing.layers) {
    for (const [layerName, layer] of Object.entries(drawing.layers)) {
      const shapeCount: number = layer.shapes?.length || 0;
      layerCounts[layerName] = shapeCount;
      totalShapes += shapeCount;
    }
  }
  
  return {
    totalShapes,
    mainShapes,
    layerCounts,
    layerNames: Object.keys(layerCounts)
  };
}

/**
 * Validates that layer squashing was successful
 */
export function validateSquashing(originalDrawing: Drawing, squashedDrawing: Drawing): {
  success: boolean;
  originalShapeCount: number;
  squashedShapeCount: number;
  message: string;
} {
  const originalStats: { totalShapes: number; mainShapes: number; layerCounts: Record<string, number>; layerNames: string[]; } = getLayerStatistics(originalDrawing);
  const squashedShapeCount: number = squashedDrawing.shapes?.length || 0;
  
  const success: boolean = originalStats.totalShapes === squashedShapeCount;
  
  return {
    success,
    originalShapeCount: originalStats.totalShapes,
    squashedShapeCount,
    message: success ? 
      'Layer squashing successful - all shapes preserved' :
      `Shape count mismatch: ${originalStats.totalShapes} original vs ${squashedShapeCount} squashed`
  };
}