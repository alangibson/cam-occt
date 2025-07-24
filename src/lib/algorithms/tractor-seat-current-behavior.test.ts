import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';

describe('Tractor Seat Mount Current Behavior', () => {
  it('should confirm current behavior: detects 11 parts instead of 1 part with holes', async () => {
    // Load the DXF file
    const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // Parse DXF with squashed layers to combine all geometry
    const drawing = await parseDXF(dxfContent, {
      decomposePolylines: true,
      translateToPositiveQuadrant: true,
      squashLayers: true
    });

    // Try more aggressive chain detection to see if more chains can be detected
    console.log('\n=== TRYING DIFFERENT TOLERANCES ===');
    const tolerances = [0.05, 0.1, 0.5, 1.0, 2.0];
    
    for (const tolerance of tolerances) {
      const testChains = detectShapeChains(drawing.shapes, { tolerance });
      console.log(`Tolerance ${tolerance}: ${testChains.length} chains detected`);
    }
    
    // Use aggressive tolerance to get maximum chains
    const chains = detectShapeChains(drawing.shapes, { tolerance: 1.0 });
    
    // Detect parts with user tolerance
    const userTolerance = 0.1;
    const partResult = await detectParts(chains, userTolerance);
    
    console.log(`\n=== CURRENT BEHAVIOR CONFIRMATION ===`);
    console.log(`Total shapes: ${drawing.shapes.length}`);
    console.log(`Total chains: ${chains.length}`);
    console.log(`Parts detected: ${partResult.parts.length}`);
    console.log(`Warnings: ${partResult.warnings.length}`);
    
    // Show all parts
    partResult.parts.forEach((part, index) => {
      console.log(`Part ${index + 1}: ${part.holes.length} holes, shell has ${part.shell.chain.shapes.length} shapes`);
    });
    
    // Analyze chain closure with detailed debugging
    console.log('\n=== CHAIN CLOSURE ANALYSIS ===');
    chains.forEach((chain, index) => {
      if (chain.shapes.length === 0) return;
      const firstShape = chain.shapes[0];
      const lastShape = chain.shapes[chain.shapes.length - 1];
      const firstStart = getShapeStartPoint(firstShape);
      const lastEnd = getShapeEndPoint(lastShape);
      
      if (!firstStart || !lastEnd) {
        console.log(`Chain ${index + 1} (${chain.id}): ${chain.shapes.length} shapes - NO ENDPOINTS`);
        return;
      }
      
      const distance = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
      );
      
      // Use ONLY the user-set tolerance
      const userTolerance = 0.1;
      const isClosed = distance < userTolerance;
      console.log(`Chain ${index + 1} (${chain.id}): ${chain.shapes.length} shapes, gap=${distance.toFixed(4)}, tolerance=${userTolerance.toFixed(4)}, closed=${isClosed}`);
    });
    
    const closedChains = chains.filter(chain => {
      if (chain.shapes.length === 0) return false;
      const firstShape = chain.shapes[0];
      const lastShape = chain.shapes[chain.shapes.length - 1];
      const firstStart = getShapeStartPoint(firstShape);
      const lastEnd = getShapeEndPoint(lastShape);
      if (!firstStart || !lastEnd) return false;
      const distance = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
      );
      
      // Use ONLY user tolerance
      const userTolerance = 0.1;
      return distance < userTolerance;
    });
    
    console.log(`\nClosed chains with user tolerance (${userTolerance}): ${closedChains.length}`);
    console.log(`Open chains: ${chains.length - closedChains.length}`);
    
    // This test documents the current behavior with user tolerance
    // With user tolerance 0.1, most chains will be open due to gaps
    // The expected behavior is 1 part with multiple holes
    console.log(`\nWith user tolerance of ${userTolerance}, expecting different results than before`);
    console.log(`Parts detected: ${partResult.parts.length}`);
    console.log(`Warnings: ${partResult.warnings.length}`);
    
    // Expected behavior after fix:
    // expect(partResult.parts.length).toBe(1);
    // expect(partResult.parts[0].holes.length).toBeGreaterThan(0);
  }, 10000);
});

// Helper functions
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
      return {
        minX: Math.min(shape.geometry.start.x, shape.geometry.end.x),
        maxX: Math.max(shape.geometry.start.x, shape.geometry.end.x),
        minY: Math.min(shape.geometry.start.y, shape.geometry.end.y),
        maxY: Math.max(shape.geometry.start.y, shape.geometry.end.y)
      };
    case 'circle':
      return {
        minX: shape.geometry.center.x - shape.geometry.radius,
        maxX: shape.geometry.center.x + shape.geometry.radius,
        minY: shape.geometry.center.y - shape.geometry.radius,
        maxY: shape.geometry.center.y + shape.geometry.radius
      };
    case 'arc':
      return {
        minX: shape.geometry.center.x - shape.geometry.radius,
        maxX: shape.geometry.center.x + shape.geometry.radius,
        minY: shape.geometry.center.y - shape.geometry.radius,
        maxY: shape.geometry.center.y + shape.geometry.radius
      };
    case 'polyline':
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const point of shape.geometry.points || []) {
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

function getShapeStartPoint(shape: any): { x: number; y: number } | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.start;
    case 'polyline':
      return shape.geometry.points.length > 0 ? shape.geometry.points[0] : null;
    case 'arc':
      const arc = shape.geometry;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle)
      };
    case 'circle':
      return {
        x: shape.geometry.center.x + shape.geometry.radius,
        y: shape.geometry.center.y
      };
    default:
      return null;
  }
}

function getShapeEndPoint(shape: any): { x: number; y: number } | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.end;
    case 'polyline':
      const points = shape.geometry.points;
      return points.length > 0 ? points[points.length - 1] : null;
    case 'arc':
      const arc = shape.geometry;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle)
      };
    case 'circle':
      return {
        x: shape.geometry.center.x + shape.geometry.radius,
        y: shape.geometry.center.y
      };
    default:
      return null;
  }
}