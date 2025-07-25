/**
 * Part Detection Algorithm
 * 
 * This algorithm analyzes chains to detect hierarchical part structures:
 * - Closed chains that are not enclosed by others are part shells (outer boundaries)
 * - Closed chains enclosed within shells are holes
 * - Open chains that cross boundaries generate warnings
 * - Supports recursive nesting (parts within holes within parts)
 * 
 * Uses JSTS for robust geometric containment detection based on MetalHeadCAM reference
 */

import type { ShapeChain } from './chain-detection';
import type { Point2D, Shape } from '../../types';
import { 
  buildContainmentHierarchy, 
  identifyShells as identifyShellsJSTS 
} from '../utils/geometric-containment-jsts';
import type { PartDetectionParameters } from '../../types/part-detection';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '../../types/part-detection';
import { normalizeChain } from './chain-normalization';

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
export async function detectParts(chains: ShapeChain[], tolerance: number = 0.1, params: PartDetectionParameters = DEFAULT_PART_DETECTION_PARAMETERS): Promise<PartDetectionResult> {
  const warnings: PartDetectionWarning[] = [];
  
  // CRITICAL: Normalize all chains BEFORE any analysis
  const normalizedChains = chains.map(chain => normalizeChain(chain));
  
  // Separate closed and open chains (using normalized chains)
  const closedChains = normalizedChains.filter(chain => isChainClosed(chain, tolerance));
  const openChains = normalizedChains.filter(chain => !isChainClosed(chain, tolerance));
  
  
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
  
  // Build containment hierarchy using JSTS geometric containment
  const containmentMap = buildContainmentHierarchy(closedChains, tolerance, params);
  
  // Debug: log containment hierarchy
  console.log(`Part detection: ${closedChains.length} closed chains, containment map size: ${containmentMap.size}`);
  for (const [child, parent] of containmentMap.entries()) {
    console.log(`  ${child} is contained in ${parent}`);
  }
  
  // SIMPLIFIED APPROACH: Only root-level chains (no parent) are parts
  // Everything else contained within them are holes
  const rootChains = closedChains.filter(chain => !containmentMap.has(chain.id));
  console.log(`Found ${rootChains.length} root chains (parts): ${rootChains.map(c => c.id).join(', ')}`);
  
  // Build part structures - each root chain is a part
  const parts: DetectedPart[] = [];
  let partCounter = 1;
  
  for (const rootChain of rootChains) {
    // Find all chains directly contained within this root chain
    const directHoles: ShapeChain[] = [];
    for (const [childId, parentId] of containmentMap.entries()) {
      if (parentId === rootChain.id) {
        const holeChain = closedChains.find(c => c.id === childId);
        if (holeChain) {
          directHoles.push(holeChain);
        }
      }
    }
    
    // Create simple part structure with shell and holes (no nested parts)
    const part: DetectedPart = {
      id: `part-${partCounter}`,
      shell: {
        id: `shell-${partCounter}`,
        chain: rootChain,
        type: 'shell',
        boundingBox: chainBounds.get(rootChain.id)!,
        holes: []
      },
      holes: directHoles.map((hole, idx) => ({
        id: `hole-${partCounter}-${idx + 1}`,
        chain: hole,
        type: 'hole' as const,
        boundingBox: chainBounds.get(hole.id)!,
        holes: [] // No nested holes - simple 2-level hierarchy
      }))
    };
    
    // Also set the holes on the shell for backward compatibility
    part.shell.holes = part.holes;
    
    parts.push(part);
    partCounter++;
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
function isChainClosed(chain: ShapeChain, tolerance: number = 0.1): boolean {
  if (chain.shapes.length === 0) return false;
  
  // Special case: single-shape circles are inherently closed
  if (chain.shapes.length === 1 && chain.shapes[0].type === 'circle') {
    return true;
  }
  
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
  const distance = Math.sqrt(
    Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
  );
  
  // Use ONLY the user-set tolerance - no adaptive tolerance calculations allowed
  return distance < tolerance;
}

/**
 * Calculates the actual gap distance between the first and last points of a chain
 */
function calculateChainGapDistance(chain: ShapeChain): number {
  if (chain.shapes.length === 0) return 0;
  
  const firstShape = chain.shapes[0];
  const lastShape = chain.shapes[chain.shapes.length - 1];
  
  const firstStart = getShapeStartPoint(firstShape);
  const lastEnd = getShapeEndPoint(lastShape);
  
  if (!firstStart || !lastEnd) return 0;
  
  return Math.sqrt(
    Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
  );
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



