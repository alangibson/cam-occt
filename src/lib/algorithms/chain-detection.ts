import type { Shape, Point2D } from '../../types';

export interface ChainDetectionOptions {
  tolerance: number;
}

export interface ShapeChain {
  id: string;
  shapes: Shape[];
}

/**
 * Core algorithm to detect chains of shapes based on point overlap within tolerance.
 * 
 * A chain is defined as a connected sequence of shapes where:
 * - Some point in shape A overlaps with some point in shape B within the tolerance
 * - The overlap relationship is transitive (A connects to B, B connects to C → A, B, C form a chain)
 * 
 * Algorithm uses Union-Find (Disjoint Set) data structure for efficient chain detection.
 */
export function detectShapeChains(shapes: Shape[], options: ChainDetectionOptions = { tolerance: 0.05 }): ShapeChain[] {
  if (shapes.length === 0) return [];

  const { tolerance } = options;
  const unionFind = new UnionFind(shapes.length);

  // Compare each pair of shapes for connectivity
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      if (areShapesConnected(shapes[i], shapes[j], tolerance)) {
        unionFind.union(i, j);
      }
    }
  }

  // Group shapes by their root component
  const chainGroups = new Map<number, number[]>();
  for (let i = 0; i < shapes.length; i++) {
    const root = unionFind.find(i);
    if (!chainGroups.has(root)) {
      chainGroups.set(root, []);
    }
    chainGroups.get(root)!.push(i);
  }

  // Convert to ShapeChain objects
  const chains: ShapeChain[] = [];
  let chainId = 1;
  
  for (const [, shapeIndices] of chainGroups) {
    if (shapeIndices.length > 1) { // Only create chains with multiple shapes
      chains.push({
        id: `chain-${chainId++}`,
        shapes: shapeIndices.map(index => shapes[index])
      });
    }
  }

  return chains;
}

/**
 * Check if two shapes are connected (any point from shape A overlaps with any point from shape B within tolerance)
 */
function areShapesConnected(shapeA: Shape, shapeB: Shape, tolerance: number): boolean {
  const pointsA = getShapePoints(shapeA);
  const pointsB = getShapePoints(shapeB);

  // Check if any point from shape A is within tolerance of any point from shape B
  for (const pointA of pointsA) {
    for (const pointB of pointsB) {
      if (arePointsWithinTolerance(pointA, pointB, tolerance)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if two points are within the specified tolerance distance
 */
function arePointsWithinTolerance(pointA: Point2D, pointB: Point2D, tolerance: number): boolean {
  const dx = pointA.x - pointB.x;
  const dy = pointA.y - pointB.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= tolerance;
}

/**
 * Extract key points from a shape for connectivity analysis
 */
function getShapePoints(shape: Shape): Point2D[] {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return [line.start, line.end];
    
    case 'circle':
      const circle = shape.geometry as any;
      // For circles, use key points around the circumference
      return [
        { x: circle.center.x + circle.radius, y: circle.center.y }, // Right
        { x: circle.center.x - circle.radius, y: circle.center.y }, // Left
        { x: circle.center.x, y: circle.center.y + circle.radius }, // Top
        { x: circle.center.x, y: circle.center.y - circle.radius }, // Bottom
        circle.center // Center
      ];
    
    case 'arc':
      const arc = shape.geometry as any;
      const startX = arc.center.x + arc.radius * Math.cos(arc.startAngle);
      const startY = arc.center.y + arc.radius * Math.sin(arc.startAngle);
      const endX = arc.center.x + arc.radius * Math.cos(arc.endAngle);
      const endY = arc.center.y + arc.radius * Math.sin(arc.endAngle);
      
      return [
        { x: startX, y: startY }, // Start point
        { x: endX, y: endY },     // End point
        arc.center                // Center
      ];
    
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points || [];
    
    default:
      return [];
  }
}

/**
 * Union-Find (Disjoint Set) data structure for efficient connected component detection
 */
class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // Path compression
    }
    return this.parent[x];
  }

  union(x: number, y: number): boolean {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return false; // Already in same set

    // Union by rank for optimal performance
    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }

    return true;
  }
}