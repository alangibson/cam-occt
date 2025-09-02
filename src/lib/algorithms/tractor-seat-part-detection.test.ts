import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import { polylineToPoints } from '$lib/geometry/polyline';
import { getShapeStartPoint, getShapeEndPoint } from '$lib/geometry';

describe('Tractor Seat Mount Part Detection', () => {
  it('should detect 1 part with multiple holes for Tractor Seat Mount - Left.dxf', async () => {
    // Load the DXF file
    const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // Parse DXF with default options
    const drawing = await parseDXF(dxfContent, {
      decomposePolylines: true,
      translateToPositiveQuadrant: true
    });

    console.log(`Total shapes: ${drawing.shapes.length}`);
    console.log('Shapes by type:', {
      circles: drawing.shapes.filter(s => s.type === 'circle').length,
      lines: drawing.shapes.filter(s => s.type === 'line').length,
      arcs: drawing.shapes.filter(s => s.type === 'arc').length,
      polylines: drawing.shapes.filter(s => s.type === 'polyline').length
    });

    // Detect chains with standard tolerance
    const chains = detectShapeChains(drawing.shapes, { tolerance: 0.05 });
    console.log(`Total chains detected: ${chains.length}`);

    // Analyze chain closure for debugging
    for (const chain of chains) {
      const firstShape = chain.shapes[0];
      const lastShape = chain.shapes[chain.shapes.length - 1];
      
      // Get start and end points using same logic as part detection
      const firstStart = getShapeStartPoint(firstShape);
      const lastEnd = getShapeEndPoint(lastShape);
      
      let distance = 0;
      let tolerance = 0.01;
      let isClosed = false;
      distance = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
      );
      tolerance = calculateClosureTolerance(chain, distance);
      isClosed = distance < tolerance;

      console.log(`Chain ${chain.id}: ${chain.shapes.length} shapes, distance: ${distance.toFixed(6)}, tolerance: ${tolerance.toFixed(6)}, closed: ${isClosed}`);
    }

    // Detect parts
    const partResult = await detectParts(chains);
    
    console.log(`Parts detected: ${partResult.parts.length}`);
    console.log(`Warnings: ${partResult.warnings.length}`);
    
    for (const part of partResult.parts) {
      console.log(`Part ${part.id}: ${part.holes.length} holes, shell has ${part.shell.chain.shapes.length} shapes`);
      console.log(`  Shell bounding box:`, part.shell.boundingBox);
    }

    // Find the largest part (should be the main boundary)
    const largestPart = partResult.parts.reduce((largest, current) => 
      current.shell.chain.shapes.length > largest.shell.chain.shapes.length ? current : largest
    );
    console.log(`Largest part: ${largestPart.id} with ${largestPart.shell.chain.shapes.length} shapes`);

    // Check which closed chains should be inside the largest part
    const closedChains = chains.filter(chain => {
      const firstShape = chain.shapes[0];
      const lastShape = chain.shapes[chain.shapes.length - 1];
      const firstStart = getShapeStartPoint(firstShape);
      const lastEnd = getShapeEndPoint(lastShape);
      
      const distance: number = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
      );
      const tolerance = calculateClosureTolerance(chain, distance);
      return distance < tolerance;
    });

    console.log(`Closed chains: ${closedChains.length}`);
    for (const chain of closedChains) {
      const bbox = calculateChainBoundingBox(chain);
      console.log(`  Chain ${chain.id}: ${chain.shapes.length} shapes, bbox: [${bbox.minX.toFixed(1)}, ${bbox.minY.toFixed(1)}, ${bbox.maxX.toFixed(1)}, ${bbox.maxY.toFixed(1)}]`);
    }

    // The expectation: should detect 1 part with multiple holes
    // Currently this will fail, showing us the actual problem
    expect(partResult.parts).toHaveLength(1);
    expect(partResult.parts[0].holes.length).toBeGreaterThan(0);
  });
});

// Helper functions copied from part-detection.ts for testing
function calculateClosureTolerance(chain: any, gapDistance: number): number {
  // Base tolerance for precision errors
  const baseTolerance = 0.01;
  
  // Calculate chain bounding box to understand scale
  const boundingBox = calculateChainBoundingBox(chain);
  const chainWidth = boundingBox.maxX - boundingBox.minX;
  const chainHeight = boundingBox.maxY - boundingBox.minY;
  const chainSize = Math.max(chainWidth, chainHeight);
  
  // For large chains, allow larger gaps (up to 5% of chain size)
  const sizeTolerance = Math.max(chainSize * 0.05, baseTolerance);
  
  // For complex chains (many shapes), be much more lenient
  const complexityFactor = Math.min(chain.shapes.length / 5, 5.0); // Up to 5x for complex chains
  const complexityTolerance = baseTolerance * complexityFactor;
  
  // Use the maximum of all tolerances, but cap at reasonable limit
  const maxTolerance = Math.max(sizeTolerance, complexityTolerance);
  const cappedTolerance = Math.min(maxTolerance, chainSize * 0.1); // Max 10% of chain size
  
  return cappedTolerance;
}

function calculateChainBoundingBox(chain: any): any {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  for (const shape of chain.shapes) {
    const shapeBounds = getShapeBoundingBox(shape);
    minX = Math.min(minX, shapeBounds.minX);
    maxX = Math.max(maxX, shapeBounds.maxX);
    minY = Math.min(minY, shapeBounds.minY);
    maxY = Math.max(maxY, shapeBounds.maxY);
  }
  
  return { minX, maxX, minY, maxY };
}

function getShapeBoundingBox(shape: any): any {
  switch (shape.type) {
    case 'line':
      const line: import("$lib/types/geometry").Line = shape.geometry;
      return {
        minX: Math.min(line.start.x, line.end.x),
        maxX: Math.max(line.start.x, line.end.x),
        minY: Math.min(line.start.y, line.end.y),
        maxY: Math.max(line.start.y, line.end.y)
      };
    
    case 'circle':
      const circle: import("$lib/types/geometry").Circle = shape.geometry;
      return {
        minX: circle.center.x - circle.radius,
        maxX: circle.center.x + circle.radius,
        minY: circle.center.y - circle.radius,
        maxY: circle.center.y + circle.radius
      };
    
    case 'arc':
      const arc: import("$lib/types/geometry").Arc = shape.geometry;
      // Simplified: use circle bounding box
      return {
        minX: arc.center.x - arc.radius,
        maxX: arc.center.x + arc.radius,
        minY: arc.center.y - arc.radius,
        maxY: arc.center.y + arc.radius
      };
    
    case 'polyline':
      const polyline: import("$lib/types/geometry").Polyline = shape.geometry;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const point of polylineToPoints(polyline)) {
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

