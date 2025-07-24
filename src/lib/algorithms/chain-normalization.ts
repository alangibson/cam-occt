/**
 * Chain Normalization Algorithm
 * 
 * Analyzes chains to detect cases where shapes have coincident points but
 * are not properly connected for chain traversal (end-to-start connectivity).
 * 
 * Issues detected:
 * - Two lines with coincident end points (should be end-to-start)
 * - Two lines with coincident start points (should be end-to-start)
 * - Shapes with coincident points that break traversal order
 */

import type { ShapeChain } from './chain-detection';
import type { Shape, Point2D } from '../../types';

export interface ChainTraversalIssue {
  type: 'coincident_endpoints' | 'coincident_startpoints' | 'broken_traversal';
  chainId: string;
  shapeIndex1: number;
  shapeIndex2: number;
  point1: Point2D;
  point2: Point2D;
  description: string;
}

export interface ChainNormalizationResult {
  chainId: string;
  issues: ChainTraversalIssue[];
  canTraverse: boolean;
  description: string;
}

/**
 * Analyzes all chains for traversal issues
 */
export function analyzeChainTraversal(chains: ShapeChain[]): ChainNormalizationResult[] {
  return chains.map(chain => analyzeChainTraversalIssues(chain));
}

/**
 * Analyzes a single chain for traversal issues
 */
function analyzeChainTraversalIssues(chain: ShapeChain): ChainNormalizationResult {
  const issues: ChainTraversalIssue[] = [];
  
  if (chain.shapes.length < 2) {
    return {
      chainId: chain.id,
      issues: [],
      canTraverse: true,
      description: 'Chain has fewer than 2 shapes - no traversal issues possible'
    };
  }

  // Check if we can traverse the chain properly (end-to-start connectivity)
  const traversalPath = attemptChainTraversal(chain);
  
  if (!traversalPath.canTraverse) {
    // Find specific issues that prevent traversal
    const detectedIssues = detectSpecificTraversalIssues(chain);
    issues.push(...detectedIssues);
  }

  // Also check for coincident points that might indicate improper connections
  const coincidentIssues = detectCoincidentPointIssues(chain);
  issues.push(...coincidentIssues);

  return {
    chainId: chain.id,
    issues,
    canTraverse: traversalPath.canTraverse,
    description: generateChainDescription(chain, issues, traversalPath.canTraverse)
  };
}

/**
 * Attempts to traverse a chain following end-to-start connectivity
 */
function attemptChainTraversal(chain: ShapeChain): { canTraverse: boolean; path: number[] } {
  if (chain.shapes.length === 0) return { canTraverse: true, path: [] };
  if (chain.shapes.length === 1) return { canTraverse: true, path: [0] };

  const tolerance = 0.01; // Small tolerance for floating point comparison

  // Try starting from each shape to find a valid traversal path
  for (let startIndex = 0; startIndex < chain.shapes.length; startIndex++) {
    const result = attemptTraversalFromStart(chain, startIndex, tolerance);
    if (result.canTraverse) {
      return result;
    }
  }

  // If no starting point works, return failure
  return { canTraverse: false, path: [] };
}

/**
 * Attempts traversal starting from a specific shape index
 */
function attemptTraversalFromStart(chain: ShapeChain, startIndex: number, tolerance: number): { canTraverse: boolean; path: number[] } {
  const path: number[] = [startIndex];
  let currentShapeIndex = startIndex;
  const usedShapes = new Set<number>([startIndex]);

  while (path.length < chain.shapes.length) {
    const currentShape = chain.shapes[currentShapeIndex];
    const currentEndPoint = getShapeEndPoint(currentShape);
    
    if (!currentEndPoint) {
      // Can't get end point, traversal fails
      return { canTraverse: false, path };
    }

    // Find next shape whose start point connects to current end point
    let nextShapeIndex = -1;
    for (let i = 0; i < chain.shapes.length; i++) {
      if (usedShapes.has(i)) continue;
      
      const candidateShape = chain.shapes[i];
      const candidateStartPoint = getShapeStartPoint(candidateShape);
      
      if (candidateStartPoint && pointsAreClose(currentEndPoint, candidateStartPoint, tolerance)) {
        nextShapeIndex = i;
        break;
      }
    }

    if (nextShapeIndex === -1) {
      // No connecting shape found, traversal fails
      return { canTraverse: false, path };
    }

    path.push(nextShapeIndex);
    usedShapes.add(nextShapeIndex);
    currentShapeIndex = nextShapeIndex;
  }

  return { canTraverse: true, path };
}

/**
 * Detects specific issues that prevent proper traversal
 */
function detectSpecificTraversalIssues(chain: ShapeChain): ChainTraversalIssue[] {
  const issues: ChainTraversalIssue[] = [];
  const tolerance = 0.01;

  for (let i = 0; i < chain.shapes.length; i++) {
    for (let j = i + 1; j < chain.shapes.length; j++) {
      const shape1 = chain.shapes[i];
      const shape2 = chain.shapes[j];

      const shape1Start = getShapeStartPoint(shape1);
      const shape1End = getShapeEndPoint(shape1);
      const shape2Start = getShapeStartPoint(shape2);
      const shape2End = getShapeEndPoint(shape2);

      // Check for coincident end points (both shapes end at same point)
      if (shape1End && shape2End && pointsAreClose(shape1End, shape2End, tolerance)) {
        issues.push({
          type: 'coincident_endpoints',
          chainId: chain.id,
          shapeIndex1: i,
          shapeIndex2: j,
          point1: shape1End,
          point2: shape2End,
          description: `Shapes ${i + 1} and ${j + 1} both end at the same point (${shape1End.x.toFixed(3)}, ${shape1End.y.toFixed(3)}). One should connect end-to-start with the other.`
        });
      }

      // Check for coincident start points (both shapes start at same point)
      if (shape1Start && shape2Start && pointsAreClose(shape1Start, shape2Start, tolerance)) {
        issues.push({
          type: 'coincident_startpoints',
          chainId: chain.id,
          shapeIndex1: i,
          shapeIndex2: j,
          point1: shape1Start,
          point2: shape2Start,
          description: `Shapes ${i + 1} and ${j + 1} both start at the same point (${shape1Start.x.toFixed(3)}, ${shape1Start.y.toFixed(3)}). One should connect end-to-start with the other.`
        });
      }
    }
  }

  return issues;
}

/**
 * Detects coincident point issues that might indicate connection problems
 */
function detectCoincidentPointIssues(chain: ShapeChain): ChainTraversalIssue[] {
  const issues: ChainTraversalIssue[] = [];
  const tolerance = 0.01;

  // Look for shapes that have coincident points but are not in proper traversal order
  for (let i = 0; i < chain.shapes.length; i++) {
    const shape1 = chain.shapes[i];
    
    for (let j = i + 1; j < chain.shapes.length; j++) {
      const shape2 = chain.shapes[j];
      
      // Skip adjacent shapes (they should connect)
      if (Math.abs(i - j) === 1) continue;

      const shape1Points = getAllShapePoints(shape1);
      const shape2Points = getAllShapePoints(shape2);

      // Check for any coincident points between non-adjacent shapes
      for (const point1 of shape1Points) {
        for (const point2 of shape2Points) {
          if (pointsAreClose(point1, point2, tolerance)) {
            issues.push({
              type: 'broken_traversal',
              chainId: chain.id,
              shapeIndex1: i,
              shapeIndex2: j,
              point1,
              point2,
              description: `Non-adjacent shapes ${i + 1} and ${j + 1} have coincident points at (${point1.x.toFixed(3)}, ${point1.y.toFixed(3)}). This may indicate improper chain ordering.`
            });
          }
        }
      }
    }
  }

  return issues;
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
 * Gets all significant points from a shape (start, end, center for arcs/circles)
 */
function getAllShapePoints(shape: Shape): Point2D[] {
  const points: Point2D[] = [];
  
  const start = getShapeStartPoint(shape);
  const end = getShapeEndPoint(shape);
  
  if (start) points.push(start);
  if (end && (!start || start.x !== end.x || start.y !== end.y)) {
    points.push(end);
  }

  // Add center points for arcs and circles
  if (shape.type === 'arc' || shape.type === 'circle') {
    const geometry = shape.geometry as any;
    if (geometry.center) {
      points.push(geometry.center);
    }
  }

  return points;
}

/**
 * Checks if two points are close within tolerance
 */
function pointsAreClose(p1: Point2D, p2: Point2D, tolerance: number): boolean {
  const distance = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  return distance < tolerance;
}

/**
 * Generates a human-readable description of chain analysis results
 */
function generateChainDescription(chain: ShapeChain, issues: ChainTraversalIssue[], canTraverse: boolean): string {
  if (issues.length === 0) {
    return `Chain ${chain.id} (${chain.shapes.length} shapes): No traversal issues detected. Chain can be traversed properly.`;
  }

  const issueCount = issues.length;
  const traversalStatus = canTraverse ? 'can be traversed' : 'cannot be traversed properly';
  
  return `Chain ${chain.id} (${chain.shapes.length} shapes): ${issueCount} issue${issueCount === 1 ? '' : 's'} detected. Chain ${traversalStatus}.`;
}

/**
 * Normalizes a chain by reordering and reversing shapes for proper traversal
 */
export function normalizeChain(chain: ShapeChain): ShapeChain {
  if (chain.shapes.length <= 1) {
    return chain;
  }

  const tolerance = 0.01;
  
  // First, try to find a valid traversal order by building the chain step by step
  const normalizedShapes = buildOptimalTraversalOrder(chain.shapes, tolerance);
  
  return {
    ...chain,
    shapes: normalizedShapes
  };
}

/**
 * Builds an optimal traversal order by trying different starting points and connections
 */
function buildOptimalTraversalOrder(shapes: Shape[], tolerance: number): Shape[] {
  if (shapes.length <= 1) return shapes;
  
  // Try each shape as a potential starting point
  for (let startIdx = 0; startIdx < shapes.length; startIdx++) {
    const result = buildChainFromStartingShape(shapes, startIdx, tolerance);
    if (result.length === shapes.length) {
      // Successfully connected all shapes
      return result;
    }
  }
  
  // If no perfect traversal found, return shapes as-is
  console.warn('Could not find perfect traversal order for all shapes');
  return shapes;
}

/**
 * Builds a chain starting from a specific shape index
 */
function buildChainFromStartingShape(shapes: Shape[], startIdx: number, tolerance: number): Shape[] {
  const result: Shape[] = [];
  const usedIndices = new Set<number>();
  
  // Add the starting shape
  result.push(shapes[startIdx]);
  usedIndices.add(startIdx);
  
  // Build the rest of the chain
  while (result.length < shapes.length) {
    const lastShape = result[result.length - 1];
    const lastEndPoint = getShapeEndPoint(lastShape);
    
    if (!lastEndPoint) break;
    
    let foundConnection = false;
    
    // Look for a shape that can connect to the end of our current chain
    for (let i = 0; i < shapes.length; i++) {
      if (usedIndices.has(i)) continue;
      
      const candidateShape = shapes[i];
      const candidateStart = getShapeStartPoint(candidateShape);
      const candidateEnd = getShapeEndPoint(candidateShape);
      
      // Check if candidate connects at its start point (normal connection)
      if (candidateStart && pointsAreClose(lastEndPoint, candidateStart, tolerance)) {
        result.push(candidateShape);
        usedIndices.add(i);
        foundConnection = true;
        break;
      }
      
      // Check if candidate connects at its end point (needs reversal)
      if (candidateEnd && pointsAreClose(lastEndPoint, candidateEnd, tolerance)) {
        const reversedShape = reverseShape(candidateShape);
        result.push(reversedShape);
        usedIndices.add(i);
        foundConnection = true;
        break;
      }
    }
    
    if (!foundConnection) {
      // Can't continue the chain from this point
      break;
    }
  }
  
  return result;
}

/**
 * Finds the best starting shape (one with a free start point)
 */
function findBestStartingShape(shapes: Shape[], tolerance: number): number {
  for (let i = 0; i < shapes.length; i++) {
    const shapeStart = getShapeStartPoint(shapes[i]);
    if (!shapeStart) continue;
    
    // Check if any other shape ends at this start point
    let hasIncomingConnection = false;
    for (let j = 0; j < shapes.length; j++) {
      if (i === j) continue;
      const otherEnd = getShapeEndPoint(shapes[j]);
      if (otherEnd && pointsAreClose(shapeStart, otherEnd, tolerance)) {
        hasIncomingConnection = true;
        break;
      }
    }
    
    if (!hasIncomingConnection) {
      return i; // This shape has a free start point
    }
  }
  
  return -1; // No shape with free start point found
}

/**
 * Reverses a shape (swaps start and end points)
 */
function reverseShape(shape: Shape): Shape {
  const reversed = { ...shape };
  
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      reversed.geometry = {
        start: line.end,
        end: line.start
      };
      break;
      
    case 'arc':
      const arc = shape.geometry as any;
      // For arcs, we swap start and end angles and flip the clockwise flag 
      // to maintain the same sweep direction while reversing traversal
      reversed.geometry = {
        ...arc,
        startAngle: arc.endAngle,
        endAngle: arc.startAngle,
        clockwise: !arc.clockwise
      };
      break;
      
    case 'polyline':
      const polyline = shape.geometry as any;
      const reversedPoints = [...polyline.points].reverse();
      
      let reversedVertices;
      if (polyline.vertices && polyline.vertices.length > 0) {
        // Reverse vertices array and negate bulge values to maintain arc directions
        reversedVertices = [...polyline.vertices].reverse().map((vertex: any, index: number) => {
          // When reversing, we need to negate the bulge value to maintain the arc direction
          return {
            x: vertex.x,
            y: vertex.y,
            bulge: -(vertex.bulge || 0)
          };
        });
        
        // For closed polylines, adjust the bulge handling at the connection point
        if (reversedVertices.length > 1) {
          // Shift bulges because in a reversed polyline, the bulge applies to the previous segment
          const lastBulge = reversedVertices[0].bulge;
          for (let i = 0; i < reversedVertices.length - 1; i++) {
            reversedVertices[i].bulge = reversedVertices[i + 1].bulge;
          }
          reversedVertices[reversedVertices.length - 1].bulge = lastBulge;
        }
      }
      
      reversed.geometry = {
        ...polyline,
        points: reversedPoints,
        vertices: reversedVertices
      };
      break;
      
    case 'circle':
      // Circles don't need reversal
      break;
  }
  
  return reversed;
}