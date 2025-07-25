/**
 * Layer Squashing Algorithm
 * 
 * Combines all shapes from multiple layers into a single layer for unified processing.
 * This is essential for part detection on multi-layer DXF files where one layer
 * represents the part outline and another represents holes.
 */

import type { Drawing, Shape } from '../../types';

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
      const processedShape = {
        ...shape,
        sourceLayer: shape.layer || 'main',
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
          const processedShape = {
            ...shape,
            sourceLayer: layerName,
            layer: layerName,
            ...(preserveLayerInfo ? { metadata: { ...shape.metadata, originalLayer: layerName } } : {})
          };
          allShapes.push(processedShape);
        }
      }
    }
  }
  
  // Remove geometric duplicates using first-come-first-served approach
  const deduplicatedShapes = removeDuplicateShapes(allShapes, tolerance);
  
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
    const isDuplicate = uniqueShapes.some(existingShape => 
      areShapesGeometricallyEqual(currentShape, existingShape, tolerance)
    );
    
    if (!isDuplicate) {
      // Remove sourceLayer before adding to final collection
      const { sourceLayer, ...cleanShape } = currentShape;
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
      return areCirclesEqual(shape1.geometry as any, shape2.geometry as any, tolerance);
    
    case 'line':
      return areLinesEqual(shape1.geometry as any, shape2.geometry as any, tolerance);
    
    case 'arc':
      return areArcsEqual(shape1.geometry as any, shape2.geometry as any, tolerance);
    
    case 'polyline':
      return arePolylinesEqual(shape1.geometry as any, shape2.geometry as any, tolerance);
    
    default:
      return false; // Unknown shape types are not considered equal
  }
}

function areCirclesEqual(circle1: any, circle2: any, tolerance: number): boolean {
  const centerDistance = Math.sqrt(
    Math.pow(circle1.center.x - circle2.center.x, 2) + 
    Math.pow(circle1.center.y - circle2.center.y, 2)
  );
  const radiusDifference = Math.abs(circle1.radius - circle2.radius);
  
  return centerDistance < tolerance && radiusDifference < tolerance;
}

function areLinesEqual(line1: any, line2: any, tolerance: number): boolean {
  // Check both directions (line can be defined start->end or end->start)
  const startDistance1 = Math.sqrt(
    Math.pow(line1.start.x - line2.start.x, 2) + 
    Math.pow(line1.start.y - line2.start.y, 2)
  );
  const endDistance1 = Math.sqrt(
    Math.pow(line1.end.x - line2.end.x, 2) + 
    Math.pow(line1.end.y - line2.end.y, 2)
  );
  
  const startDistance2 = Math.sqrt(
    Math.pow(line1.start.x - line2.end.x, 2) + 
    Math.pow(line1.start.y - line2.end.y, 2)
  );
  const endDistance2 = Math.sqrt(
    Math.pow(line1.end.x - line2.start.x, 2) + 
    Math.pow(line1.end.y - line2.start.y, 2)
  );
  
  // Lines are equal if both endpoints match (in either direction)
  return (startDistance1 < tolerance && endDistance1 < tolerance) ||
         (startDistance2 < tolerance && endDistance2 < tolerance);
}

function areArcsEqual(arc1: any, arc2: any, tolerance: number): boolean {
  const centerDistance = Math.sqrt(
    Math.pow(arc1.center.x - arc2.center.x, 2) + 
    Math.pow(arc1.center.y - arc2.center.y, 2)
  );
  const radiusDifference = Math.abs(arc1.radius - arc2.radius);
  
  // Normalize angles to [0, 2π]
  const normalizeAngle = (angle: number) => {
    let normalized = angle % (2 * Math.PI);
    return normalized < 0 ? normalized + 2 * Math.PI : normalized;
  };
  
  const start1 = normalizeAngle(arc1.startAngle);
  const end1 = normalizeAngle(arc1.endAngle);
  const start2 = normalizeAngle(arc2.startAngle);
  const end2 = normalizeAngle(arc2.endAngle);
  
  const startAngleDiff = Math.abs(start1 - start2);
  const endAngleDiff = Math.abs(end1 - end2);
  const angleToleranceRad = tolerance / arc1.radius; // Convert linear tolerance to angular
  
  return centerDistance < tolerance && 
         radiusDifference < tolerance &&
         startAngleDiff < angleToleranceRad && 
         endAngleDiff < angleToleranceRad &&
         arc1.clockwise === arc2.clockwise;
}

function arePolylinesEqual(poly1: any, poly2: any, tolerance: number): boolean {
  if (!poly1.points || !poly2.points) return false;
  if (poly1.points.length !== poly2.points.length) return false;
  
  // Check if all points match in order
  for (let i = 0; i < poly1.points.length; i++) {
    const distance = Math.sqrt(
      Math.pow(poly1.points[i].x - poly2.points[i].x, 2) + 
      Math.pow(poly1.points[i].y - poly2.points[i].y, 2)
    );
    if (distance >= tolerance) return false;
  }
  
  // Check vertices if they exist (for bulge data)
  if (poly1.vertices && poly2.vertices) {
    if (poly1.vertices.length !== poly2.vertices.length) return false;
    
    for (let i = 0; i < poly1.vertices.length; i++) {
      const v1 = poly1.vertices[i];
      const v2 = poly2.vertices[i];
      const distance = Math.sqrt(
        Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2)
      );
      const bulgeDiff = Math.abs((v1.bulge || 0) - (v2.bulge || 0));
      
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
  const mainShapes = drawing.shapes?.length || 0;
  const layerCounts: Record<string, number> = {};
  let totalShapes = mainShapes;
  
  if (drawing.layers) {
    for (const [layerName, layer] of Object.entries(drawing.layers)) {
      const shapeCount = layer.shapes?.length || 0;
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
  const originalStats = getLayerStatistics(originalDrawing);
  const squashedShapeCount = squashedDrawing.shapes?.length || 0;
  
  const success = originalStats.totalShapes === squashedShapeCount;
  
  return {
    success,
    originalShapeCount: originalStats.totalShapes,
    squashedShapeCount,
    message: success ? 
      'Layer squashing successful - all shapes preserved' :
      `Shape count mismatch: ${originalStats.totalShapes} original vs ${squashedShapeCount} squashed`
  };
}