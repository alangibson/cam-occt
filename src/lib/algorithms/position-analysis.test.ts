import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection/chain-detection';
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
    const calculateBoundingBox = (chain: any) => {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      
      for (const shape of chain.shapes) {
        if (shape.type === 'line') {
          minX = Math.min(minX, shape.geometry.start.x, shape.geometry.end.x);
          maxX = Math.max(maxX, shape.geometry.start.x, shape.geometry.end.x);
          minY = Math.min(minY, shape.geometry.start.y, shape.geometry.end.y);
          maxY = Math.max(maxY, shape.geometry.start.y, shape.geometry.end.y);
        } else if (shape.type === 'polyline') {
          for (const point of polylineToPoints(shape.geometry)) {
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
    const chain7Box = calculateBoundingBox(chain7!);
    const chain13Box = calculateBoundingBox(chain13!);
    
    
    
    
    
    const yOffset = chain7Box.minY - chain13Box.minY;
    
    // Check if both shapes are identical in X but different in Y
    const xSimilar = Math.abs(chain7Box.minX - chain13Box.minX) < 0.01 && Math.abs(chain7Box.maxX - chain13Box.maxX) < 0.01;
    const sizeSimilar = Math.abs(chain7Box.width - chain13Box.width) < 0.01 && Math.abs(chain7Box.height - chain13Box.height) < 0.01;
    
    
    if (chain13Box.minY < boundaryBox.minY) {
      const overflow = boundaryBox.minY - chain13Box.minY;
    }
    
    if (chain13Box.maxY > boundaryBox.maxY) {
      const overflow = chain13Box.maxY - boundaryBox.maxY;
    }
    
    
  }, 10000);
});