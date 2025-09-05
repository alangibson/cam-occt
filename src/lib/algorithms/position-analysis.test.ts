import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains, type Chain } from './chain-detection/chain-detection';
import { normalizeChain } from './chain-normalization/chain-normalization';
import { polylineToPoints } from '../geometry/polyline';

describe('Position Analysis - Chain-7 vs Chain-13 Location', () => {
  it('should analyze the position difference between chain-7 and chain-13 relative to boundary', async () => {
    // Load the DXF file
    const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // Parse DXF
    const drawing = await parseDXF(dxfContent, {
      decomposePolylines: true,
      translateToPositiveQuadrant: true,
      squashLayers: true
    });

    // Detect chains
    const tolerance = 1.0;
    const chains = detectShapeChains(drawing.shapes, { tolerance });
    
    // Normalize chains
    const normalizedChains = chains.map(chain => normalizeChain(chain));
    
    // Find the specific chains
    const boundaryChain = normalizedChains.find(chain => chain.shapes.length === 42);
    const chain7 = normalizedChains.find(chain => chain.id === 'chain-7');
    const chain13 = normalizedChains.find(chain => chain.id === 'chain-13');
    
    expect(boundaryChain).toBeDefined();
    expect(chain7).toBeDefined();
    expect(chain13).toBeDefined();
    
    // Calculate bounding boxes
    const calculateBoundingBox = (chain: Chain) => {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      
      for (const shape of chain.shapes) {
        if (shape.type === 'line') {
          const lineGeom = shape.geometry as import('../types/geometry').Line;
          minX = Math.min(minX, lineGeom.start.x, lineGeom.end.x);
          maxX = Math.max(maxX, lineGeom.start.x, lineGeom.end.x);
          minY = Math.min(minY, lineGeom.start.y, lineGeom.end.y);
          maxY = Math.max(maxY, lineGeom.start.y, lineGeom.end.y);
        } else if (shape.type === 'polyline') {
          const polylineGeom = shape.geometry as import('../types/geometry').Polyline;
          for (const point of polylineToPoints(polylineGeom)) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
          }
        }
      }
      
      return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
    };
    
    const boundaryBox = calculateBoundingBox(boundaryChain!);
    const chain13Box = calculateBoundingBox(chain13!);
    
    
    
    
    
    
    // Check if both shapes are identical in X but different in Y
    
    
    if (chain13Box.minY < boundaryBox.minY) {
      // Chain 13 extends below boundary
    }
    
    if (chain13Box.maxY > boundaryBox.maxY) {
      // Chain 13 extends above boundary
    }
    
    
  }, 10000);
});