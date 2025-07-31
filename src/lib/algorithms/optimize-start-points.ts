import type { Shape } from '../../types';
import type { ShapeChain } from './chain-detection';
import { isChainClosed } from './part-detection';

/**
 * Result of optimizing a single chain's start point
 */
interface OptimizeResult {
  originalChain: ShapeChain;
  optimizedChain: ShapeChain | null;
  modified: boolean;
  reason?: string;
}

/**
 * Splits a line shape at its midpoint, creating two line shapes
 */
function splitLineAtMidpoint(line: Shape): [Shape, Shape] | null {
  if (line.type !== 'line') return null;
  
  const geom = line.geometry as any;
  const midX = (geom.start.x + geom.end.x) / 2;
  const midY = (geom.start.y + geom.end.y) / 2;
  
  // First half: original start to midpoint
  const firstHalf: Shape = {
    id: `${line.id}-split-1`,
    type: 'line',
    geometry: {
      start: { ...geom.start },
      end: { x: midX, y: midY }
    },
    layer: line.layer,
    color: line.color,
    originalType: line.originalType,
    metadata: line.metadata
  };
  
  // Second half: midpoint to original end
  const secondHalf: Shape = {
    id: `${line.id}-split-2`,
    type: 'line',
    geometry: {
      start: { x: midX, y: midY },
      end: { ...geom.end }
    },
    layer: line.layer,
    color: line.color,
    originalType: line.originalType,
    metadata: line.metadata
  };
  
  return [firstHalf, secondHalf];
}

/**
 * Splits an arc shape at its midpoint angle, creating two arc shapes
 */
function splitArcAtMidpoint(arc: Shape): [Shape, Shape] | null {
  if (arc.type !== 'arc') return null;
  
  const geom = arc.geometry as any;
  let midAngle = (geom.startAngle + geom.endAngle) / 2;
  
  // Handle arc crossing 0 degrees
  if (geom.endAngle < geom.startAngle) {
    midAngle = (geom.startAngle + geom.endAngle + 2 * Math.PI) / 2;
    if (midAngle > 2 * Math.PI) {
      midAngle -= 2 * Math.PI;
    }
  }
  
  // First half: original start to midpoint
  const firstHalf: Shape = {
    id: `${arc.id}-split-1`,
    type: 'arc',
    geometry: {
      center: { ...geom.center },
      radius: geom.radius,
      startAngle: geom.startAngle,
      endAngle: midAngle
    },
    layer: arc.layer,
    color: arc.color,
    originalType: arc.originalType,
    metadata: arc.metadata
  };
  
  // Second half: midpoint to original end
  const secondHalf: Shape = {
    id: `${arc.id}-split-2`,
    type: 'arc',
    geometry: {
      center: { ...geom.center },
      radius: geom.radius,
      startAngle: midAngle,
      endAngle: geom.endAngle
    },
    layer: arc.layer,
    color: arc.color,
    originalType: arc.originalType,
    metadata: arc.metadata
  };
  
  return [firstHalf, secondHalf];
}

/**
 * Splits a polyline at its midpoint, creating two polyline shapes
 */
function splitPolylineAtMidpoint(polyline: Shape): [Shape, Shape] | null {
  if (polyline.type !== 'polyline') return null;
  
  const geom = polyline.geometry as any;
  const points = geom.points;
  
  if (points.length < 2) return null;
  
  // For a two-point polyline, split it like a line
  if (points.length === 2) {
    const midX = (points[0].x + points[1].x) / 2;
    const midY = (points[0].y + points[1].y) / 2;
    
    const firstHalf: Shape = {
      id: `${polyline.id}-split-1`,
      type: 'polyline',
      geometry: {
        points: [
          { ...points[0] },
          { x: midX, y: midY }
        ],
        closed: false
      },
      layer: polyline.layer,
      color: polyline.color,
      originalType: polyline.originalType,
      metadata: polyline.metadata
    };
    
    const secondHalf: Shape = {
      id: `${polyline.id}-split-2`,
      type: 'polyline',
      geometry: {
        points: [
          { x: midX, y: midY },
          { ...points[1] }
        ],
        closed: false
      },
      layer: polyline.layer,
      color: polyline.color,
      originalType: polyline.originalType,
      metadata: polyline.metadata
    };
    
    return [firstHalf, secondHalf];
  }
  
  // For multi-point polylines, find the midpoint along the path
  // Calculate total length
  let totalLength = 0;
  const segmentLengths: number[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const length = Math.sqrt(dx * dx + dy * dy);
    segmentLengths.push(length);
    totalLength += length;
  }
  
  // Find the segment containing the midpoint
  const halfLength = totalLength / 2;
  let accumulatedLength = 0;
  let splitSegmentIndex = 0;
  let splitRatio = 0;
  
  for (let i = 0; i < segmentLengths.length; i++) {
    if (accumulatedLength + segmentLengths[i] >= halfLength) {
      splitSegmentIndex = i;
      splitRatio = (halfLength - accumulatedLength) / segmentLengths[i];
      break;
    }
    accumulatedLength += segmentLengths[i];
  }
  
  // Calculate the split point
  const p1 = points[splitSegmentIndex];
  const p2 = points[splitSegmentIndex + 1];
  const splitX = p1.x + (p2.x - p1.x) * splitRatio;
  const splitY = p1.y + (p2.y - p1.y) * splitRatio;
  
  // Create first half: from start to split point
  const firstPoints = points.slice(0, splitSegmentIndex + 1).map((p: any) => ({ ...p }));
  firstPoints.push({ x: splitX, y: splitY });
  
  // Create second half: from split point to end
  const secondPoints = [{ x: splitX, y: splitY }];
  secondPoints.push(...points.slice(splitSegmentIndex + 1).map((p: any) => ({ ...p })));
  
  const firstHalf: Shape = {
    id: `${polyline.id}-split-1`,
    type: 'polyline',
    geometry: {
      points: firstPoints,
      closed: false
    },
    layer: polyline.layer,
    color: polyline.color,
    originalType: polyline.originalType,
    metadata: polyline.metadata
  };
  
  const secondHalf: Shape = {
    id: `${polyline.id}-split-2`,
    type: 'polyline',
    geometry: {
      points: secondPoints,
      closed: false
    },
    layer: polyline.layer,
    color: polyline.color,
    originalType: polyline.originalType,
    metadata: polyline.metadata
  };
  
  return [firstHalf, secondHalf];
}

/**
 * Checks if a shape is simple enough to split safely
 */
function isSimpleShape(shape: Shape): boolean {
  // Lines and arcs are simple
  if (shape.type === 'line' || shape.type === 'arc') {
    return true;
  }
  
  // Polylines with 2 points are essentially lines
  if (shape.type === 'polyline') {
    const geom = shape.geometry as any;
    return geom.points && geom.points.length === 2;
  }
  
  return false;
}

/**
 * Finds the best shape to split in a chain, preferring simple shapes like lines and arcs
 */
function findBestShapeToSplit(shapes: Shape[]): number {
  // First pass: look for lines
  for (let i = 0; i < shapes.length; i++) {
    if (shapes[i].type === 'line') {
      return i;
    }
  }
  
  // Second pass: look for 2-point polylines (essentially lines)
  for (let i = 0; i < shapes.length; i++) {
    if (shapes[i].type === 'polyline') {
      const geom = shapes[i].geometry as any;
      if (geom.points && geom.points.length === 2) {
        return i;
      }
    }
  }
  
  // Third pass: look for arcs
  for (let i = 0; i < shapes.length; i++) {
    if (shapes[i].type === 'arc') {
      return i;
    }
  }
  
  // Fourth pass: if no simple shapes, look for any polyline
  for (let i = 0; i < shapes.length; i++) {
    if (shapes[i].type === 'polyline') {
      return i;
    }
  }
  
  // No splittable shapes found
  return -1;
}

/**
 * Optimizes the start point of a single chain
 */
function optimizeChainStartPoint(chain: ShapeChain, tolerance: number): OptimizeResult {
  // Only process closed chains with multiple shapes
  if (!isChainClosed(chain, tolerance)) {
    return {
      originalChain: chain,
      optimizedChain: null,
      modified: false,
      reason: 'Chain is not closed'
    };
  }
  
  // Special handling for single-shape chains
  if (chain.shapes.length === 1) {
    const singleShape = chain.shapes[0];
    
    // Only certain single shapes can be optimized (polylines, not circles)
    if (singleShape.type === 'circle') {
      return {
        originalChain: chain,
        optimizedChain: null,
        modified: false,
        reason: 'Single circle cannot be optimized (no meaningful start point)'
      };
    }
    
    // Single closed polylines CAN be optimized by splitting them
    if (singleShape.type === 'polyline') {
      const polylineGeom = singleShape.geometry as any;
      
      // Check if polyline has enough points
      if (polylineGeom.points && polylineGeom.points.length > 3) {
        // Check if it's closed (either explicit flag or geometric closure)
        const hasClosedFlag = polylineGeom.closed === true;
        const isGeometricallyClosed = isChainClosed(chain, tolerance);
        
        if (hasClosedFlag || isGeometricallyClosed) {
          // Split the polyline and create a new chain
          const splitShapes = splitPolylineAtMidpoint(singleShape);
          if (splitShapes) {
            const optimizedChain: ShapeChain = {
              id: chain.id,
              shapes: [splitShapes[1], splitShapes[0]] // Start with second half
            };
            
            return {
              originalChain: chain,
              optimizedChain: optimizedChain,
              modified: true,
              reason: `Split single closed polyline at midpoint`
            };
          }
        }
      }
    }
    
    // For other single shapes or if optimization failed
    return {
      originalChain: chain,
      optimizedChain: null,
      modified: false,
      reason: 'Single-shape chain cannot be optimized'
    };
  }
  
  // Find the best shape to split (prefer lines and arcs over complex shapes)
  const shapeIndexToSplit = findBestShapeToSplit(chain.shapes);
  
  if (shapeIndexToSplit === -1) {
    return {
      originalChain: chain,
      optimizedChain: null,
      modified: false,
      reason: 'No splittable shapes found'
    };
  }
  
  const shapeToSplit = chain.shapes[shapeIndexToSplit];
  let splitShapes: [Shape, Shape] | null = null;
  
  // Split the shape based on its type
  if (shapeToSplit.type === 'line') {
    splitShapes = splitLineAtMidpoint(shapeToSplit);
  } else if (shapeToSplit.type === 'arc') {
    splitShapes = splitArcAtMidpoint(shapeToSplit);
  } else if (shapeToSplit.type === 'polyline') {
    splitShapes = splitPolylineAtMidpoint(shapeToSplit);
  }
  
  if (!splitShapes) {
    return {
      originalChain: chain,
      optimizedChain: null,
      modified: false,
      reason: `Failed to split ${shapeToSplit.type} shape`
    };
  }
  
  // Reconstruct the chain with the split shape
  // The new order starts from the second half of the split shape
  const newShapes: Shape[] = [];
  
  // Add the second half of the split shape (this becomes the new start)
  newShapes.push(splitShapes[1]);
  
  // Add all shapes after the split shape
  for (let i = shapeIndexToSplit + 1; i < chain.shapes.length; i++) {
    newShapes.push(chain.shapes[i]);
  }
  
  // Add all shapes before the split shape
  for (let i = 0; i < shapeIndexToSplit; i++) {
    newShapes.push(chain.shapes[i]);
  }
  
  // Add the first half of the split shape (this becomes the new end)
  newShapes.push(splitShapes[0]);
  
  // Create the optimized chain
  const optimizedChain: ShapeChain = {
    id: chain.id,
    shapes: newShapes
  };
  
  return {
    originalChain: chain,
    optimizedChain: optimizedChain,
    modified: true,
    reason: `Split ${shapeToSplit.type} at index ${shapeIndexToSplit}`
  };
}

/**
 * Optimizes start points for all chains in the drawing
 * For plasma cutting, it's desirable to start at the midpoint of the first shape
 * in multi-shape closed chains to avoid piercing in narrow corners.
 * 
 * @param chains - Array of shape chains to optimize
 * @param tolerance - Tolerance for chain closure detection
 * @returns Array of all shapes with optimized chains replacing original ones
 */
export function optimizeStartPoints(chains: ShapeChain[], tolerance: number): Shape[] {
  const results: OptimizeResult[] = [];
  const allShapes: Shape[] = [];
  
  // Process each chain
  for (const chain of chains) {
    const result = optimizeChainStartPoint(chain, tolerance);
    results.push(result);
    
    // Use optimized chain if available, otherwise use original
    const chainToUse = result.optimizedChain || result.originalChain;
    allShapes.push(...chainToUse.shapes);
  }
  
  // Log summary
  const modifiedCount = results.filter(r => r.modified).length;
  console.log(`Optimized start points: ${modifiedCount} of ${chains.length} chains modified`);
  
  results.forEach(result => {
    if (result.modified) {
      console.log(`  Chain ${result.originalChain.id}: ${result.reason}`);
    }
  });
  
  return allShapes;
}