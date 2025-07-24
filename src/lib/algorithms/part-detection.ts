/**
 * Part Detection Algorithm
 * 
 * This algorithm analyzes chains to detect hierarchical part structures:
 * - Closed chains that are not enclosed by others are part shells (outer boundaries)
 * - Closed chains enclosed within shells are holes
 * - Open chains that cross boundaries generate warnings
 * - Supports recursive nesting (parts within holes within parts)
 */

import type { ShapeChain } from './chain-detection';
import type { Point2D, Shape } from '../../types';
import { isChainGeometricallyContained } from '../utils/geometric-operations';

export interface PartHole {
  id: string;
  chain: ShapeChain;
  type: 'hole';
  boundingBox: BoundingBox;
  holes: PartHole[]; // Nested holes within this hole (parts)
}

export interface PartShell {
  id: string;
  chain: ShapeChain;
  type: 'shell';
  boundingBox: BoundingBox;
  holes: PartHole[];
}

export interface DetectedPart {
  id: string;
  shell: PartShell;
  holes: PartHole[];
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PartDetectionWarning {
  type: 'overlapping_boundary';
  chainId: string;
  message: string;
}

export interface PartDetectionResult {
  parts: DetectedPart[];
  warnings: PartDetectionWarning[];
}

/**
 * Detects parts from a collection of chains using geometric containment
 */
export async function detectParts(chains: ShapeChain[]): Promise<PartDetectionResult> {
  const warnings: PartDetectionWarning[] = [];
  
  // Separate closed and open chains
  const closedChains = chains.filter(chain => isChainClosed(chain));
  const openChains = chains.filter(chain => !isChainClosed(chain));
  
  // Calculate bounding boxes for all closed chains
  const chainBounds = new Map<string, BoundingBox>();
  for (const chain of closedChains) {
    chainBounds.set(chain.id, calculateChainBoundingBox(chain));
  }
  
  // Check for open chains that cross boundaries
  for (const openChain of openChains) {
    const crossingIssue = checkOpenChainBoundaryCrossing(openChain, closedChains, chainBounds);
    if (crossingIssue) {
      warnings.push({
        type: 'overlapping_boundary',
        chainId: openChain.id,
        message: crossingIssue
      });
    }
  }
  
  // Build containment hierarchy using geometric containment
  const containmentMap = await buildGeometricContainmentHierarchy(closedChains);
  
  // Identify shells (chains that are not holes in other parts)
  // A chain is a shell if either:
  // 1. It's not contained by any other chain (root shell)
  // 2. It's at an even level in the nesting hierarchy (part within hole within part)
  const shells = identifyShells(closedChains, containmentMap);
  
  // Build part structures
  const parts: DetectedPart[] = [];
  let partCounter = 1;
  
  for (const shellChain of shells) {
    const part = buildPartFromShell(shellChain, closedChains, containmentMap, chainBounds, partCounter++);
    parts.push(part);
  }
  
  // If no parts were detected and there are open chains, warn about potential unclosed geometry
  if (parts.length === 0 && openChains.length > 0) {
    warnings.push({
      type: 'overlapping_boundary',
      chainId: 'all-open-chains',
      message: `No parts detected. Found ${openChains.length} unclosed chain${openChains.length === 1 ? '' : 's'}. Check for gaps in your drawing geometry - chains may not be properly connected to form closed shapes.`
    });
  }
  
  // Also warn if we have closed chains but still no parts (shouldn't happen with geometric containment)
  if (parts.length === 0 && closedChains.length > 0) {
    warnings.push({
      type: 'overlapping_boundary', 
      chainId: 'all-closed-chains',
      message: `No parts detected despite having ${closedChains.length} closed chain${closedChains.length === 1 ? '' : 's'}. This may indicate a problem with geometric containment analysis.`
    });
  }
  
  return { parts, warnings };
}

/**
 * Checks if a chain forms a closed loop
 */
function isChainClosed(chain: ShapeChain): boolean {
  if (chain.shapes.length === 0) return false;
  
  // Get all endpoints from the shapes in the chain
  const endpoints: Point2D[] = [];
  
  for (const shape of chain.shapes) {
    const shapeEndpoints = getShapeEndpoints(shape);
    endpoints.push(...shapeEndpoints);
  }
  
  // A closed chain should have all endpoints paired up (each point appears exactly twice)
  // For a truly closed chain, the start of the first shape should connect to the end of the last shape
  const firstShape = chain.shapes[0];
  const lastShape = chain.shapes[chain.shapes.length - 1];
  
  const firstStart = getShapeStartPoint(firstShape);
  const lastEnd = getShapeEndPoint(lastShape);
  
  if (!firstStart || !lastEnd) return false;
  
  // Check if the chain is closed (end connects to start within tolerance)
  const tolerance = 0.01; // Small tolerance for floating point comparison
  const distance = Math.sqrt(
    Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
  );
  
  return distance < tolerance;
}

/**
 * Gets the start and end points of a shape
 */
function getShapeEndpoints(shape: Shape): Point2D[] {
  const start = getShapeStartPoint(shape);
  const end = getShapeEndPoint(shape);
  
  const points: Point2D[] = [];
  if (start) points.push(start);
  if (end && (start?.x !== end.x || start?.y !== end.y)) {
    points.push(end);
  }
  
  return points;
}

/**
 * Gets the start point of a shape
 */
function getShapeStartPoint(shape: Shape): Point2D | null {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return line.start;
    
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points.length > 0 ? polyline.points[0] : null;
    
    case 'arc':
      const arc = shape.geometry as any;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle)
      };
    
    case 'circle':
      // For circles, start and end are the same (rightmost point)
      const circle = shape.geometry as any;
      return {
        x: circle.center.x + circle.radius,
        y: circle.center.y
      };
    
    default:
      return null;
  }
}

/**
 * Gets the end point of a shape
 */
function getShapeEndPoint(shape: Shape): Point2D | null {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return line.end;
    
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points.length > 0 ? polyline.points[polyline.points.length - 1] : null;
    
    case 'arc':
      const arc = shape.geometry as any;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle)
      };
    
    case 'circle':
      // For circles, start and end are the same (rightmost point)
      const circle = shape.geometry as any;
      return {
        x: circle.center.x + circle.radius,
        y: circle.center.y
      };
    
    default:
      return null;
  }
}

/**
 * Calculates the bounding box of a chain
 */
function calculateChainBoundingBox(chain: ShapeChain): BoundingBox {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const shape of chain.shapes) {
    const shapeBounds = getShapeBoundingBox(shape);
    minX = Math.min(minX, shapeBounds.minX);
    maxX = Math.max(maxX, shapeBounds.maxX);
    minY = Math.min(minY, shapeBounds.minY);
    maxY = Math.max(maxY, shapeBounds.maxY);
  }
  
  return { minX, maxX, minY, maxY };
}

/**
 * Gets the bounding box of a single shape
 */
function getShapeBoundingBox(shape: Shape): BoundingBox {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return {
        minX: Math.min(line.start.x, line.end.x),
        maxX: Math.max(line.start.x, line.end.x),
        minY: Math.min(line.start.y, line.end.y),
        maxY: Math.max(line.start.y, line.end.y)
      };
    
    case 'circle':
      const circle = shape.geometry as any;
      return {
        minX: circle.center.x - circle.radius,
        maxX: circle.center.x + circle.radius,
        minY: circle.center.y - circle.radius,
        maxY: circle.center.y + circle.radius
      };
    
    case 'arc':
      const arc = shape.geometry as any;
      // For simplicity, use circle bounding box (conservative)
      return {
        minX: arc.center.x - arc.radius,
        maxX: arc.center.x + arc.radius,
        minY: arc.center.y - arc.radius,
        maxY: arc.center.y + arc.radius
      };
    
    case 'polyline':
      const polyline = shape.geometry as any;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      
      for (const point of polyline.points) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
      
      return { minX, maxX, minY, maxY };
    
    default:
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
}

/**
 * Checks if an open chain crosses part boundaries
 */
function checkOpenChainBoundaryCrossing(
  openChain: ShapeChain, 
  closedChains: ShapeChain[], 
  chainBounds: Map<string, BoundingBox>
): string | null {
  const openChainBounds = calculateChainBoundingBox(openChain);
  
  for (const closedChain of closedChains) {
    const closedBounds = chainBounds.get(closedChain.id);
    if (!closedBounds) continue;
    
    // Check if open chain crosses the boundary (not just intersects bounding box)
    // An open chain crosses a boundary if:
    // 1. Its start point is inside the closed region AND end point is outside, OR
    // 2. Its start point is outside the closed region AND end point is inside
    
    const startInside = isPointInBoundingBox(getOpenChainStart(openChain), closedBounds);
    const endInside = isPointInBoundingBox(getOpenChainEnd(openChain), closedBounds);
    
    if (startInside !== endInside) {
      // Chain crosses the boundary
      return `Chain may cross the boundary of a closed region (chain ${closedChain.id})`;
    }
  }
  
  return null;
}

/**
 * Gets the starting point of an open chain
 */
function getOpenChainStart(chain: ShapeChain): Point2D | null {
  if (chain.shapes.length === 0) return null;
  return getShapeStartPoint(chain.shapes[0]);
}

/**
 * Gets the ending point of an open chain
 */
function getOpenChainEnd(chain: ShapeChain): Point2D | null {
  if (chain.shapes.length === 0) return null;
  return getShapeEndPoint(chain.shapes[chain.shapes.length - 1]);
}

/**
 * Checks if a point is inside a bounding box
 */
function isPointInBoundingBox(point: Point2D | null, bbox: BoundingBox): boolean {
  if (!point) return false;
  return (
    point.x >= bbox.minX &&
    point.x <= bbox.maxX &&
    point.y >= bbox.minY &&
    point.y <= bbox.maxY
  );
}

/**
 * Builds a containment hierarchy map using geometric containment (child -> parent)
 */
async function buildGeometricContainmentHierarchy(
  closedChains: ShapeChain[]
): Promise<Map<string, string>> {
  const containmentMap = new Map<string, string>();
  
  // For performance, we'll first do a quick bounding box check before expensive geometric checks
  const chainBounds = new Map<string, BoundingBox>();
  for (const chain of closedChains) {
    chainBounds.set(chain.id, calculateChainBoundingBox(chain));
  }
  
  for (let i = 0; i < closedChains.length; i++) {
    const childChain = closedChains[i];
    const childBounds = chainBounds.get(childChain.id);
    if (!childBounds) continue;
    
    let smallestContainer: ShapeChain | null = null;
    let smallestArea = Infinity;
    
    for (let j = 0; j < closedChains.length; j++) {
      if (i === j) continue;
      
      const parentChain = closedChains[j];
      const parentBounds = chainBounds.get(parentChain.id);
      if (!parentBounds) continue;
      
      // Use ONLY geometric containment - no bounding box fallbacks
      // Bounding box containment is mathematically unsound for part detection
      try {
        const isGeometricallyContained = await isChainGeometricallyContained(childChain, parentChain);
        if (isGeometricallyContained) {
          const area = (parentBounds.maxX - parentBounds.minX) * (parentBounds.maxY - parentBounds.minY);
          if (area < smallestArea) {
            smallestArea = area;
            smallestContainer = parentChain;
          }
        }
      } catch (error: any) {
        console.warn(`Geometric containment check failed for chains ${childChain.id} and ${parentChain.id}: ${error.message}`);
        // NO FALLBACK - geometric containment is required for correct part detection
      }
    }
    
    if (smallestContainer) {
      containmentMap.set(childChain.id, smallestContainer.id);
    }
  }
  
  return containmentMap;
}

/**
 * Checks if one bounding box is completely contained within another
 */
function isContainedWithin(inner: BoundingBox, outer: BoundingBox): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY &&
    // Ensure it's not identical (avoid self-containment issues)
    !(inner.minX === outer.minX && inner.maxX === outer.maxX && 
      inner.minY === outer.minY && inner.maxY === outer.maxY)
  );
}

/**
 * Identifies which chains are shells (part boundaries) vs holes
 * Uses nesting level to determine: even levels = shells, odd levels = holes
 */
function identifyShells(
  closedChains: ShapeChain[], 
  containmentMap: Map<string, string>
): ShapeChain[] {
  const shells: ShapeChain[] = [];
  
  for (const chain of closedChains) {
    const nestingLevel = calculateNestingLevel(chain.id, containmentMap);
    
    // Even nesting levels (0, 2, 4...) are shells
    // Odd nesting levels (1, 3, 5...) are holes
    if (nestingLevel % 2 === 0) {
      shells.push(chain);
    }
  }
  
  return shells;
}

/**
 * Calculates the nesting level of a chain (0 = root, 1 = first level hole, etc.)
 */
function calculateNestingLevel(chainId: string, containmentMap: Map<string, string>): number {
  let level = 0;
  let currentId = chainId;
  
  while (containmentMap.has(currentId)) {
    level++;
    currentId = containmentMap.get(currentId)!;
  }
  
  return level;
}

/**
 * Builds a part structure from a shell chain
 */
function buildPartFromShell(
  shellChain: ShapeChain,
  allChains: ShapeChain[],
  containmentMap: Map<string, string>,
  chainBounds: Map<string, BoundingBox>,
  partId: number
): DetectedPart {
  const shellBounds = chainBounds.get(shellChain.id)!;
  
  // Find direct children (holes in this shell)
  const directHoles: ShapeChain[] = [];
  for (const [childId, parentId] of containmentMap.entries()) {
    if (parentId === shellChain.id) {
      const childChain = allChains.find(c => c.id === childId);
      if (childChain) {
        directHoles.push(childChain);
      }
    }
  }
  
  // Build hole structures recursively
  const holes: PartHole[] = [];
  let holeCounter = 1;
  
  for (const holeChain of directHoles) {
    const hole = buildHoleFromChain(holeChain, allChains, containmentMap, chainBounds, holeCounter++);
    holes.push(hole);
  }
  
  const shell: PartShell = {
    id: `shell-${partId}`,
    chain: shellChain,
    type: 'shell',
    boundingBox: shellBounds,
    holes: holes
  };
  
  return {
    id: `part-${partId}`,
    shell,
    holes
  };
}

/**
 * Builds a hole structure from a chain
 */
function buildHoleFromChain(
  holeChain: ShapeChain,
  allChains: ShapeChain[],
  containmentMap: Map<string, string>,
  chainBounds: Map<string, BoundingBox>,
  holeId: number
): PartHole {
  const holeBounds = chainBounds.get(holeChain.id)!;
  
  // Find chains contained within this hole (parts within the hole)
  const nestedParts: ShapeChain[] = [];
  for (const [childId, parentId] of containmentMap.entries()) {
    if (parentId === holeChain.id) {
      const childChain = allChains.find(c => c.id === childId);
      if (childChain) {
        nestedParts.push(childChain);
      }
    }
  }
  
  // Build nested hole structures recursively
  const nestedHoles: PartHole[] = [];
  let nestedCounter = 1;
  
  for (const nestedChain of nestedParts) {
    const nestedHole = buildHoleFromChain(nestedChain, allChains, containmentMap, chainBounds, nestedCounter++);
    nestedHoles.push(nestedHole);
  }
  
  return {
    id: `hole-${holeId}`,
    chain: holeChain,
    type: 'hole',
    boundingBox: holeBounds,
    holes: nestedHoles
  };
}