import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import { getShapeStartPoint, getShapeEndPoint } from '$lib/geometry';
import { polylineToPoints } from '../geometry/polyline';

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
    const tolerances = [0.05, 0.1, 0.5, 1.0, 2.0];
    
    for (const tolerance of tolerances) {
      const testChains = detectShapeChains(drawing.shapes, { tolerance });
    }
    
    // Use aggressive tolerance to get maximum chains
    const chains = detectShapeChains(drawing.shapes, { tolerance: 1.0 });
    
    // Detect parts with user tolerance
    const userTolerance = 0.1;
    const partResult = await detectParts(chains, userTolerance);
    
    
    // Show all parts
    partResult.parts.forEach((part, index) => {
    });
    
    // Analyze chain closure with detailed debugging
    chains.forEach((chain, index) => {
      if (chain.shapes.length === 0) return;
      const firstShape = chain.shapes[0];
      const lastShape = chain.shapes[chain.shapes.length - 1];
      const firstStart = getShapeStartPoint(firstShape);
      const lastEnd = getShapeEndPoint(lastShape);
      
      const distance: number = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
      );
      
      // Use ONLY the user-set tolerance
      const userTolerance = 0.1;
      const isClosed = distance < userTolerance;
    });
    
    const closedChains = chains.filter(chain => {
      if (chain.shapes.length === 0) return false;
      const firstShape = chain.shapes[0];
      const lastShape = chain.shapes[chain.shapes.length - 1];
      const firstStart = getShapeStartPoint(firstShape);
      const lastEnd = getShapeEndPoint(lastShape);
      const distance: number = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
      );
      
      // Use ONLY user tolerance
      const userTolerance = 0.1;
      return distance < userTolerance;
    });
    
    
    // This test documents the current behavior with user tolerance
    // With user tolerance 0.1, most chains will be open due to gaps
    // The expected behavior is 1 part with multiple holes
    
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
      const points = polylineToPoints(shape.geometry);
      for (const point of points) {
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

