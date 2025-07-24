import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { normalizeChain } from './chain-normalization';
import { isChainGeometricallyContained } from '../utils/geometric-operations';

describe('Debug Containment Detection After Normalization', () => {
  it('should debug why containment detection fails for normalized chains', async () => {
    // Load the DXF file
    const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // Parse DXF
    const drawing = await parseDXF(dxfContent, {
      decomposePolylines: true,
      translateToPositiveQuadrant: true,
      squashLayers: true
    });

    // Detect chains with high tolerance to get them connected
    const tolerance = 1.0;
    const chains = detectShapeChains(drawing.shapes, { tolerance });
    
    // Normalize chains
    const normalizedChains = chains.map(chain => normalizeChain(chain));
    
    // Find the main boundary chain (chain-5 with 42 shapes)
    const boundaryChain = normalizedChains.find(chain => chain.shapes.length === 42);
    const smallCircleChains = normalizedChains.filter(chain => chain.shapes.length === 2);
    
    expect(boundaryChain).toBeDefined();
    expect(smallCircleChains.length).toBeGreaterThan(0);
    
    console.log(`\n=== CONTAINMENT DEBUG ===`);
    console.log(`Boundary chain: ${boundaryChain!.id} with ${boundaryChain!.shapes.length} shapes`);
    console.log(`Small circle chains: ${smallCircleChains.length}`);
    
    // Test containment for each small circle
    for (let i = 0; i < Math.min(smallCircleChains.length, 5); i++) {
      const circleChain = smallCircleChains[i];
      console.log(`\nTesting containment: ${circleChain.id} in ${boundaryChain!.id}`);
      
      try {
        const isContained = await isChainGeometricallyContained(circleChain, boundaryChain!);
        console.log(`Result: ${isContained ? 'CONTAINED' : 'NOT CONTAINED'}`);
        
        // If not contained, this should be detected as a hole but isn't
        if (!isContained) {
          console.log(`  -> This explains why ${circleChain.id} is not detected as a hole`);
        }
      } catch (error) {
        console.log(`ERROR: ${error.message}`);
        console.log(`  -> Geometric containment failed, this explains the missing hole`);
      }
    }
    
    // Test a few letter-shaped chains too
    const letterChains = normalizedChains.filter(chain => 
      chain.shapes.length > 4 && chain.shapes.length <= 30 && chain.id !== boundaryChain!.id
    );
    
    console.log(`\nLetter-shaped chains: ${letterChains.length}`);
    
    for (let i = 0; i < Math.min(letterChains.length, 3); i++) {
      const letterChain = letterChains[i];
      console.log(`\nTesting containment: ${letterChain.id} (${letterChain.shapes.length} shapes) in ${boundaryChain!.id}`);
      
      try {
        const isContained = await isChainGeometricallyContained(letterChain, boundaryChain!);
        console.log(`Result: ${isContained ? 'CONTAINED' : 'NOT CONTAINED'}`);
        
        if (!isContained) {
          console.log(`  -> This explains why ${letterChain.id} is not detected as a hole`);
        }
      } catch (error) {
        console.log(`ERROR: ${error.message}`);
        console.log(`  -> Geometric containment failed for ${letterChain.id}`);
      }
    }
    
    // The test should reveal why most chains are not being detected as contained
    // This will help us understand the geometric operation failures
    
  }, 15000);
});