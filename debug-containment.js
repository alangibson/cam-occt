#!/usr/bin/env node

/**
 * Debug script to understand why JSTS containment detection is failing
 * for chain-2 and chain-4 not being detected as contained in chain-3
 */

import { readFileSync } from 'fs';
import { parseDXF } from './src/lib/parsers/dxf-parser.js';
import { detectChains } from './src/lib/algorithms/chain-detection.js';
import { normalizeChain } from './src/lib/algorithms/chain-normalization.js';
import { isChainContainedInChain } from './src/lib/utils/geometric-containment-jsts.js';

const TOLERANCE = 0.1;

async function debugContainment() {
  console.log('Loading DXF file...');
  const dxfContent = readFileSync('./tests/dxf/Tractor Light Mount - Left.dxf', 'utf8');
  
  console.log('Parsing DXF...');
  const { shapes } = parseDXF(dxfContent, { 
    decomposePolylines: true, 
    translateToPositive: true 
  });
  console.log(`Parsed ${shapes.length} shapes`);
  
  console.log('Detecting chains...');
  const detectedChains = detectChains(shapes, TOLERANCE);
  console.log(`Detected ${detectedChains.length} chains`);
  
  console.log('Normalizing chains...');
  const normalizedChains = detectedChains.map(chain => normalizeChain(chain));
  
  // Find our problem chains
  const chain2 = normalizedChains.find(c => c.id === 'chain-2');
  const chain3 = normalizedChains.find(c => c.id === 'chain-3');  
  const chain4 = normalizedChains.find(c => c.id === 'chain-4');
  
  if (!chain2 || !chain3 || !chain4) {
    console.log('Could not find required chains');
    return;
  }
  
  console.log('\nChain details:');
  console.log(`chain-2: ${chain2.shapes.length} shapes`);
  console.log(`chain-3: ${chain3.shapes.length} shapes`);
  console.log(`chain-4: ${chain4.shapes.length} shapes`);
  
  // Test containment directly
  console.log('\nTesting containment:');
  
  const chain2InChain3 = isChainContainedInChain(chain2, chain3, TOLERANCE);
  console.log(`chain-2 contained in chain-3: ${chain2InChain3}`);
  
  const chain4InChain3 = isChainContainedInChain(chain4, chain3, TOLERANCE);
  console.log(`chain-4 contained in chain-3: ${chain4InChain3}`);
  
  // Let's examine the tessellated points
  console.log('\nExamining tessellated points:');
  
  // Import tessellation function directly
  const { tessellateChain } = await import('./src/lib/utils/geometric-containment-jsts.js');
  
  const chain2Points = tessellateChain(chain2);
  const chain3Points = tessellateChain(chain3);
  const chain4Points = tessellateChain(chain4);
  
  console.log(`chain-2 tessellated to ${chain2Points.length} points`);
  console.log(`chain-3 tessellated to ${chain3Points.length} points`);
  console.log(`chain-4 tessellated to ${chain4Points.length} points`);
  
  // Sample some points
  console.log('\nSample points from chain-2:');
  for (let i = 0; i < Math.min(5, chain2Points.length); i++) {
    console.log(`  Point ${i}: (${chain2Points[i].x.toFixed(3)}, ${chain2Points[i].y.toFixed(3)})`);
  }
  
  console.log('\nSample points from chain-3:');
  for (let i = 0; i < Math.min(5, chain3Points.length); i++) {
    console.log(`  Point ${i}: (${chain3Points[i].x.toFixed(3)}, ${chain3Points[i].y.toFixed(3)})`);
  }
  
  // Check if chain-3 forms a proper closed polygon
  const first3 = chain3Points[0];
  const last3 = chain3Points[chain3Points.length - 1];
  const distance3 = Math.sqrt(Math.pow(first3.x - last3.x, 2) + Math.pow(first3.y - last3.y, 2));
  console.log(`\nchain-3 closure distance: ${distance3.toFixed(6)} (tolerance: ${TOLERANCE})`);
  
  // Check bounding boxes for sanity
  const getBounds = (points) => {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  };
  
  const bounds2 = getBounds(chain2Points);
  const bounds3 = getBounds(chain3Points);
  const bounds4 = getBounds(chain4Points);
  
  console.log('\nBounding boxes:');
  console.log(`chain-2: (${bounds2.minX.toFixed(2)}, ${bounds2.minY.toFixed(2)}) to (${bounds2.maxX.toFixed(2)}, ${bounds2.maxY.toFixed(2)})`);
  console.log(`chain-3: (${bounds3.minX.toFixed(2)}, ${bounds3.minY.toFixed(2)}) to (${bounds3.maxX.toFixed(2)}, ${bounds3.maxY.toFixed(2)})`);
  console.log(`chain-4: (${bounds4.minX.toFixed(2)}, ${bounds4.minY.toFixed(2)}) to (${bounds4.maxX.toFixed(2)}, ${bounds4.maxY.toFixed(2)})`);
  
  // Check if smaller bounds are within larger bounds
  const isWithin = (inner, outer) => {
    return inner.minX >= outer.minX && inner.maxX <= outer.maxX && 
           inner.minY >= outer.minY && inner.maxY <= outer.maxY;
  };
  
  console.log(`\nBounding box containment (rough check):`);
  console.log(`chain-2 bounds within chain-3 bounds: ${isWithin(bounds2, bounds3)}`);
  console.log(`chain-4 bounds within chain-3 bounds: ${isWithin(bounds4, bounds3)}`);
}

debugContainment().catch(console.error);