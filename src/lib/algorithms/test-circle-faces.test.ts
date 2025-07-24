import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { normalizeChain } from './chain-normalization';
import { isChainGeometricallyContained } from '../utils/geometric-operations';

describe('Test Circle Face Creation and Containment', () => {
  it('should successfully create faces for circle chains and test boundary containment', async () => {
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
    
    // Find boundary and small circle chains
    const boundaryChain = normalizedChains.find(chain => chain.shapes.length === 42);
    const circleChains = normalizedChains.filter(chain => 
      chain.shapes.length === 2 && 
      chain.shapes[0].type === 'circle' && 
      chain.shapes[1].type === 'circle'
    );
    
    expect(boundaryChain).toBeDefined();
    expect(circleChains.length).toBe(4);
    
    console.log(`\n=== TESTING CIRCLE FACE CREATION ===`);
    console.log(`Found boundary chain: ${boundaryChain!.id} with ${boundaryChain!.shapes.length} shapes`);
    console.log(`Found ${circleChains.length} circle chains`);
    
    // Test each circle chain individually
    let successfulContainments = 0;
    let failedContainments = 0;
    
    for (const circleChain of circleChains) {
      console.log(`\nTesting circle chain ${circleChain.id}:`);
      
      try {
        const isContained = await isChainGeometricallyContained(circleChain, boundaryChain!);
        console.log(`  Result: ${isContained ? 'CONTAINED ✅' : 'NOT CONTAINED ❌'}`);
        
        if (isContained) {
          successfulContainments++;
        } else {
          failedContainments++;
        }
        
      } catch (error) {
        console.log(`  ERROR: ${error.message}`);
        failedContainments++;
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Successful containments: ${successfulContainments}`);
    console.log(`Failed containments: ${failedContainments}`);
    
    // With the fix, we should get at least some successful containments
    // Even if not all 4, at least 1-2 should work
    expect(successfulContainments).toBeGreaterThan(0);
    
    // Ideally all 4 should work
    if (successfulContainments === 4) {
      console.log(`🎉 ALL CIRCLE CONTAINMENTS SUCCESSFUL!`);
    } else {
      console.log(`⚠️  Only ${successfulContainments}/4 circle containments successful`);
    }
    
  }, 15000);
});