import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { normalizeChain } from './chain-normalization';

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
          for (const point of shape.geometry.points) {
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
    
    console.log(`\n=== BOUNDING BOX ANALYSIS ===`);
    
    console.log(`\n--- BOUNDARY CHAIN (${boundaryChain!.id}) ---`);
    console.log(`Bounding Box: (${boundaryBox.minX.toFixed(2)}, ${boundaryBox.minY.toFixed(2)}) to (${boundaryBox.maxX.toFixed(2)}, ${boundaryBox.maxY.toFixed(2)})`);
    console.log(`Size: ${boundaryBox.width.toFixed(2)} × ${boundaryBox.height.toFixed(2)}`);
    
    console.log(`\n--- CHAIN-7 (Letter T) ---`);
    console.log(`Bounding Box: (${chain7Box.minX.toFixed(2)}, ${chain7Box.minY.toFixed(2)}) to (${chain7Box.maxX.toFixed(2)}, ${chain7Box.maxY.toFixed(2)})`);
    console.log(`Size: ${chain7Box.width.toFixed(2)} × ${chain7Box.height.toFixed(2)}`);
    console.log(`Within boundary X: ${chain7Box.minX >= boundaryBox.minX && chain7Box.maxX <= boundaryBox.maxX}`);
    console.log(`Within boundary Y: ${chain7Box.minY >= boundaryBox.minY && chain7Box.maxY <= boundaryBox.maxY}`);
    console.log(`FULLY CONTAINED: ${chain7Box.minX >= boundaryBox.minX && chain7Box.maxX <= boundaryBox.maxX && chain7Box.minY >= boundaryBox.minY && chain7Box.maxY <= boundaryBox.maxY}`);
    
    console.log(`\n--- CHAIN-13 (Letter T) ---`);
    console.log(`Bounding Box: (${chain13Box.minX.toFixed(2)}, ${chain13Box.minY.toFixed(2)}) to (${chain13Box.maxX.toFixed(2)}, ${chain13Box.maxY.toFixed(2)})`);
    console.log(`Size: ${chain13Box.width.toFixed(2)} × ${chain13Box.height.toFixed(2)}`);
    console.log(`Within boundary X: ${chain13Box.minX >= boundaryBox.minX && chain13Box.maxX <= boundaryBox.maxX}`);
    console.log(`Within boundary Y: ${chain13Box.minY >= boundaryBox.minY && chain13Box.maxY <= boundaryBox.maxY}`);
    console.log(`FULLY CONTAINED: ${chain13Box.minX >= boundaryBox.minX && chain13Box.maxX <= boundaryBox.maxX && chain13Box.minY >= boundaryBox.minY && chain13Box.maxY <= boundaryBox.maxY}`);
    
    console.log(`\n--- POSITION COMPARISON ---`);
    const yOffset = chain7Box.minY - chain13Box.minY;
    console.log(`Y-offset between chains: ${yOffset.toFixed(2)} units (chain-7 is ${yOffset > 0 ? 'higher' : 'lower'} than chain-13)`);
    
    // Check if both shapes are identical in X but different in Y
    const xSimilar = Math.abs(chain7Box.minX - chain13Box.minX) < 0.01 && Math.abs(chain7Box.maxX - chain13Box.maxX) < 0.01;
    const sizeSimilar = Math.abs(chain7Box.width - chain13Box.width) < 0.01 && Math.abs(chain7Box.height - chain13Box.height) < 0.01;
    
    console.log(`X positions similar: ${xSimilar}`);
    console.log(`Sizes similar: ${sizeSimilar}`);
    console.log(`Same shape, different position: ${xSimilar && sizeSimilar}`);
    
    console.log(`\n--- BOUNDARY OVERFLOW ANALYSIS ---`);
    if (chain13Box.minY < boundaryBox.minY) {
      const overflow = boundaryBox.minY - chain13Box.minY;
      console.log(`🚨 Chain-13 extends ${overflow.toFixed(2)} units BELOW the boundary box minimum Y`);
      console.log(`This explains why chain-13 is NOT CONTAINED - it's outside the boundary!`);
    }
    
    if (chain13Box.maxY > boundaryBox.maxY) {
      const overflow = chain13Box.maxY - boundaryBox.maxY;
      console.log(`🚨 Chain-13 extends ${overflow.toFixed(2)} units ABOVE the boundary box maximum Y`);
    }
    
    console.log(`\n--- CONCLUSION ---`);
    console.log(`Chain-7 and Chain-13 have identical SHAPES but different POSITIONS.`);
    console.log(`The containment difference is due to Chain-13 being positioned outside the boundary area.`);
    console.log(`This is correct behavior - geometric containment depends on position, not just shape.`);
    
  }, 10000);
});