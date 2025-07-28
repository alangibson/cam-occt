import type { Path } from '../stores/paths';
import type { ShapeChain } from './chain-detection';
import type { Shape, Point2D, Line, Arc, Circle, Polyline } from '../../types';
import type { DetectedPart } from './part-detection';

/**
 * Rapids are the non-cutting paths that connect cut paths.
 * They represent tool movement without cutting.
 */
export interface Rapid {
  id: string;
  start: Point2D;
  end: Point2D;
  type: 'rapid';
}

/**
 * Result of the cut order optimization
 */
export interface OptimizationResult {
  orderedPaths: Path[];
  rapids: Rapid[];
  totalDistance: number;
}

/**
 * Get the start point of a shape chain
 */
function getChainStartPoint(chain: ShapeChain): Point2D {
  if (chain.shapes.length === 0) {
    throw new Error('Chain has no shapes');
  }
  
  const firstShape = chain.shapes[0];
  return getShapeStartPoint(firstShape);
}

/**
 * Get the end point of a shape chain
 */
function getChainEndPoint(chain: ShapeChain): Point2D {
  if (chain.shapes.length === 0) {
    throw new Error('Chain has no shapes');
  }
  
  const lastShape = chain.shapes[chain.shapes.length - 1];
  return getShapeEndPoint(lastShape);
}

/**
 * Get the start point of a shape
 */
function getShapeStartPoint(shape: Shape): Point2D {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as Line;
      return line.start;
    case 'arc':
      const arc = shape.geometry as Arc;
      // Arc start point calculation
      const startAngle = arc.startAngle * Math.PI / 180;
      return {
        x: arc.center.x + arc.radius * Math.cos(startAngle),
        y: arc.center.y + arc.radius * Math.sin(startAngle)
      };
    case 'circle':
      const circle = shape.geometry as Circle;
      // For circles, start at the rightmost point
      return { x: circle.center.x + circle.radius, y: circle.center.y };
    case 'polyline':
      const polyline = shape.geometry as Polyline;
      return polyline.points[0];
    default:
      throw new Error(`Unsupported shape type: ${(shape as any).type}`);
  }
}

/**
 * Get the end point of a shape
 */
function getShapeEndPoint(shape: Shape): Point2D {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as Line;
      return line.end;
    case 'arc':
      const arc = shape.geometry as Arc;
      // Arc end point calculation
      const endAngle = arc.endAngle * Math.PI / 180;
      return {
        x: arc.center.x + arc.radius * Math.cos(endAngle),
        y: arc.center.y + arc.radius * Math.sin(endAngle)
      };
    case 'circle':
      const circle = shape.geometry as Circle;
      // For closed circles, end where we started
      return { x: circle.center.x + circle.radius, y: circle.center.y };
    case 'polyline':
      const polyline = shape.geometry as Polyline;
      return polyline.points[polyline.points.length - 1];
    default:
      throw new Error(`Unsupported shape type: ${(shape as any).type}`);
  }
}

/**
 * Calculate Euclidean distance between two points
 */
function distance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Simple nearest neighbor algorithm for TSP
 * This is a greedy approximation that works well for many practical cases
 */
function nearestNeighborTSP(
  paths: Path[],
  chains: Map<string, ShapeChain>,
  parts: DetectedPart[],
  startPoint: Point2D
): OptimizationResult {
  const orderedPaths: Path[] = [];
  const rapids: Rapid[] = [];
  const unvisited = new Set(paths);
  let currentPoint = startPoint;
  let totalDistance = 0;

  // Group paths by part
  const pathsByPart = new Map<string, Path[]>();
  const pathsWithoutPart: Path[] = [];
  
  // Find which part each path belongs to
  for (const path of paths) {
    const chain = chains.get(path.chainId);
    if (!chain) continue;
    
    let belongsToPart = false;
    for (const part of parts) {
      // Check if chain is shell
      if (part.shell.chain.id === chain.id) {
        if (!pathsByPart.has(part.id)) {
          pathsByPart.set(part.id, []);
        }
        pathsByPart.get(part.id)!.push(path);
        belongsToPart = true;
        break;
      }
      
      // Check if chain is a hole
      for (const hole of part.holes) {
        if (hole.chain.id === chain.id) {
          if (!pathsByPart.has(part.id)) {
            pathsByPart.set(part.id, []);
          }
          pathsByPart.get(part.id)!.push(path);
          belongsToPart = true;
          break;
        }
      }
      
      if (belongsToPart) break;
    }
    
    if (!belongsToPart) {
      pathsWithoutPart.push(path);
    }
  }

  // Process paths not belonging to any part first
  while (pathsWithoutPart.length > 0 && unvisited.size > 0) {
    let nearestPath: Path | null = null;
    let nearestDistance = Infinity;
    
    for (const path of pathsWithoutPart) {
      if (!unvisited.has(path)) continue;
      
      const chain = chains.get(path.chainId);
      if (!chain) continue;
      
      const startPoint = getChainStartPoint(chain);
      const dist = distance(currentPoint, startPoint);
      
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestPath = path;
      }
    }
    
    if (!nearestPath) break;
    
    // Add rapid from current point to path start
    const chain = chains.get(nearestPath.chainId)!;
    const pathStart = getChainStartPoint(chain);
    
    rapids.push({
      id: crypto.randomUUID(),
      start: currentPoint,
      end: pathStart,
      type: 'rapid'
    });
    
    totalDistance += nearestDistance;
    
    // Add path to ordered list
    orderedPaths.push(nearestPath);
    unvisited.delete(nearestPath);
    
    // Update current point to path end
    currentPoint = getChainEndPoint(chain);
    
    // Remove from unprocessed list
    const index = pathsWithoutPart.indexOf(nearestPath);
    if (index > -1) {
      pathsWithoutPart.splice(index, 1);
    }
  }

  // Process parts - shell must be last within each part
  for (const [partId, partPaths] of pathsByPart) {
    const part = parts.find(p => p.id === partId);
    if (!part) continue;
    
    // Separate shell path and hole paths
    let shellPath: Path | null = null;
    const holePaths: Path[] = [];
    
    for (const path of partPaths) {
      if (!unvisited.has(path)) continue;
      
      const chain = chains.get(path.chainId);
      if (!chain) continue;
      
      if (chain.id === part.shell.chain.id) {
        shellPath = path;
      } else {
        holePaths.push(path);
      }
    }
    
    // Process holes first
    while (holePaths.length > 0 && unvisited.size > 0) {
      let nearestPath: Path | null = null;
      let nearestDistance = Infinity;
      
      for (const path of holePaths) {
        if (!unvisited.has(path)) continue;
        
        const chain = chains.get(path.chainId);
        if (!chain) continue;
        
        const startPoint = getChainStartPoint(chain);
        const dist = distance(currentPoint, startPoint);
        
        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestPath = path;
        }
      }
      
      if (!nearestPath) break;
      
      // Add rapid and path
      const chain = chains.get(nearestPath.chainId)!;
      const pathStart = getChainStartPoint(chain);
      
      rapids.push({
        id: crypto.randomUUID(),
        start: currentPoint,
        end: pathStart,
        type: 'rapid'
      });
      
      totalDistance += nearestDistance;
      orderedPaths.push(nearestPath);
      unvisited.delete(nearestPath);
      currentPoint = getChainEndPoint(chain);
      
      // Remove from holes list
      const index = holePaths.indexOf(nearestPath);
      if (index > -1) {
        holePaths.splice(index, 1);
      }
    }
    
    // Process shell last
    if (shellPath && unvisited.has(shellPath)) {
      const chain = chains.get(shellPath.chainId)!;
      const pathStart = getChainStartPoint(chain);
      const dist = distance(currentPoint, pathStart);
      
      rapids.push({
        id: crypto.randomUUID(),
        start: currentPoint,
        end: pathStart,
        type: 'rapid'
      });
      
      totalDistance += dist;
      orderedPaths.push(shellPath);
      unvisited.delete(shellPath);
      currentPoint = getChainEndPoint(chain);
    }
  }

  return {
    orderedPaths,
    rapids,
    totalDistance
  };
}

/**
 * Optimize the cutting order of paths using a traveling salesman algorithm
 * 
 * @param paths - Array of paths to optimize
 * @param chains - Map of chain IDs to chains
 * @param parts - Array of detected parts (for shell/hole ordering)
 * @param origin - Starting point (usually drawing origin 0,0)
 * @returns Optimized path order with rapids
 */
export function optimizeCutOrder(
  paths: Path[],
  chains: Map<string, ShapeChain>,
  parts: DetectedPart[],
  origin: Point2D = { x: 0, y: 0 }
): OptimizationResult {
  if (paths.length === 0) {
    return {
      orderedPaths: [],
      rapids: [],
      totalDistance: 0
    };
  }

  // Filter out paths that don't have corresponding chains
  const validPaths = paths.filter(path => chains.has(path.chainId));
  
  if (validPaths.length === 0) {
    return {
      orderedPaths: [],
      rapids: [],
      totalDistance: 0
    };
  }

  // Use nearest neighbor algorithm for now
  // This can be replaced with more sophisticated algorithms if needed
  return nearestNeighborTSP(validPaths, chains, parts, origin);
}