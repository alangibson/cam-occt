import type { Path } from '../stores/paths';
import type { Chain } from './chain-detection';
import type { Shape, Point2D, Line, Arc } from '../../lib/types';
import type { DetectedPart } from './part-detection';
import { calculateLeads } from './lead-calculation';
import { createLeadInConfig, createLeadOutConfig } from '../utils/lead-config-utils';
import { getShapeStartPoint } from '$lib/geometry';
import { calculateSquaredDistance } from '../utils/math-utils';

/**
 * Find the nearest path from a current point
 * Extracted from optimize-cut-order.ts to eliminate duplication
 */
export function findNearestPath(
  currentPoint: Point2D, 
  pathsToSearch: Path[], 
  chains: Map<string, Chain>,
  unvisited: Set<Path>,
  findPartForChain: (chainId: string) => DetectedPart | undefined
): { path: Path | null; distance: number } {
  let nearestPath: Path | null = null;
  let nearestDistance = Infinity;
  
  for (const path of pathsToSearch) {
    if (!unvisited.has(path)) continue;
    
    const chain = chains.get(path.chainId);
    if (!chain) continue;
    
    const part = findPartForChain(path.chainId);
    const startPoint = getPathStartPoint(path, chain, part);
    const dist = calculateDistance(currentPoint, startPoint);
    
    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearestPath = path;
    }
  }
  
  return { path: nearestPath, distance: nearestDistance };
}

/**
 * Calculate Euclidean distance between two points
 * Extracted from optimize-cut-order.ts to eliminate duplication
 */
export function calculateDistance(p1: Point2D, p2: Point2D): number {
  return Math.sqrt(calculateSquaredDistance(p1, p2));
}

/**
 * Split a shape at its midpoint, creating two shapes
 * Extracted from optimize-start-points.ts to eliminate duplication
 */
export function splitShapeAtMidpoint(shape: Shape): [Shape, Shape] | null {
  if (shape.type === 'line') {
    return splitLineAtMidpoint(shape);
  } else if (shape.type === 'arc') {
    return splitArcAtMidpoint(shape);
  }
  
  return null;
}

/**
 * Get the effective start point of a path, accounting for lead-in geometry
 * Extracted from optimize-cut-order.ts to eliminate duplication
 */
export function getPathStartPoint(path: Path, chain: Chain, part?: DetectedPart): Point2D {
  // Check if path has lead-in
  if (path.leadInType && path.leadInType !== 'none' && path.leadInLength && path.leadInLength > 0) {
    try {
      const leadInConfig = createLeadInConfig(path);
      const leadOutConfig = createLeadOutConfig(path);
      
      const leadResult = calculateLeads(chain, leadInConfig, leadOutConfig, path.cutDirection, part);
      
      if (leadResult.leadIn && leadResult.leadIn.points.length > 0) {
        // Return the first point of the lead-in (start of lead-in)
        return leadResult.leadIn.points[0];
      }
    } catch (error) {
      console.warn('Failed to calculate lead-in for path:', path.name, error);
    }
  }
  
  // Fallback to chain start point
  return getChainStartPoint(chain);
}

/**
 * Get the start point of a shape chain
 */
function getChainStartPoint(chain: Chain): Point2D {
  if (chain.shapes.length === 0) {
    throw new Error('Chain has no shapes');
  }
  
  const firstShape = chain.shapes[0];
  return getShapeStartPoint(firstShape);
}

/**
 * Splits a line shape at its midpoint, creating two line shapes
 */
function splitLineAtMidpoint(shape: Shape): [Shape, Shape] | null {
  if (shape.type !== 'line') return null;
  
  const geom = shape.geometry as Line;
  const midpoint = calculateMidpoint(geom.start, geom.end);
  
  // Create two line geometries
  const firstGeometry = {
    start: { ...geom.start },
    end: midpoint
  };
  
  const secondGeometry = {
    start: midpoint,
    end: { ...geom.end }
  };
  
  return [
    createSplitShape(shape, '1', 'line', firstGeometry),
    createSplitShape(shape, '2', 'line', secondGeometry)
  ];
}

/**
 * Splits an arc shape at its midpoint angle, creating two arc shapes
 */
function splitArcAtMidpoint(shape: Shape): [Shape, Shape] | null {
  if (shape.type !== 'arc') return null;
  
  const geom = shape.geometry as Arc;
  const midAngle = calculateArcMidpointAngle(geom.startAngle, geom.endAngle);
  
  // Create two arc geometries
  const firstGeometry = {
    center: { ...geom.center },
    radius: geom.radius,
    startAngle: geom.startAngle,
    endAngle: midAngle
  };
  
  const secondGeometry = {
    center: { ...geom.center },
    radius: geom.radius,
    startAngle: midAngle,
    endAngle: geom.endAngle
  };
  
  return [
    createSplitShape(shape, '1', 'arc', firstGeometry),
    createSplitShape(shape, '2', 'arc', secondGeometry)
  ];
}

/**
 * Calculate the midpoint between two points
 * Exported for use in optimize-start-points.ts
 */
export function calculateMidpoint(start: Point2D, end: Point2D): Point2D {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };
}

/**
 * Calculate the midpoint angle for an arc, handling angle wrapping
 * Exported for use in optimize-start-points.ts
 */
export function calculateArcMidpointAngle(startAngle: number, endAngle: number): number {
  let midAngle = (startAngle + endAngle) / 2;
  
  // Handle arc crossing 0 degrees
  if (endAngle < startAngle) {
    midAngle = (startAngle + endAngle + 2 * Math.PI) / 2;
    if (midAngle > 2 * Math.PI) {
      midAngle -= 2 * Math.PI;
    }
  }
  
  return midAngle;
}


/**
 * Reconstruct a chain from split shapes, reordering to start at the split point
 * Extracted from optimize-start-points.ts to eliminate duplication
 */
export function reconstructChainFromSplit(
  originalShapes: Shape[], 
  splitIndex: number, 
  splitShapes: [Shape, Shape]
): Shape[] {
  const newShapes: Shape[] = [];
  
  // Add the second half of the split shape (this becomes the new start)
  newShapes.push(splitShapes[1]);
  
  // Add all shapes after the split shape
  for (let i = splitIndex + 1; i < originalShapes.length; i++) {
    newShapes.push(originalShapes[i]);
  }
  
  // Add all shapes before the split shape
  for (let i = 0; i < splitIndex; i++) {
    newShapes.push(originalShapes[i]);
  }
  
  // Add the first half of the split shape (this becomes the new end)
  newShapes.push(splitShapes[0]);
  
  return newShapes;
}

/**
 * Create a split shape with consistent property handling
 */
export function createSplitShape(
  originalShape: Shape, 
  splitIndex: string, 
  type: Shape['type'], 
  geometry: Shape['geometry']
): Shape {
  return {
    id: `${originalShape.id}-split-${splitIndex}`,
    type,
    geometry,
    ...(originalShape.layer && { layer: originalShape.layer }),
    ...(originalShape.originalType && { originalType: originalShape.originalType }),
    ...(originalShape.metadata && { metadata: originalShape.metadata })
  };
}