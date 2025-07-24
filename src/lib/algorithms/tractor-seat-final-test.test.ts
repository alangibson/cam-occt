import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';

describe('Tractor Seat Mount Final Test', () => {
  it('should detect 1 part with multiple holes after gap closing fix', async () => {
    // Load the DXF file
    const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // Parse DXF with squashed layers to combine all geometry
    const drawing = await parseDXF(dxfContent, {
      decomposePolylines: true,
      translateToPositiveQuadrant: true,
      squashLayers: true
    });

    // Detect chains
    const chains = detectShapeChains(drawing.shapes, { tolerance: 0.05 });
    
    // Detect parts
    const partResult = await detectParts(chains);
    
    console.log(`\n=== FINAL TEST RESULTS ===`);
    console.log(`Parts detected: ${partResult.parts.length}`);
    console.log(`Total holes across all parts: ${partResult.parts.reduce((sum, part) => sum + part.holes.length, 0)}`);
    
    partResult.parts.forEach((part, index) => {
      console.log(`Part ${index + 1}: ${part.holes.length} holes, shell has ${part.shell.chain.shapes.length} shapes`);
      part.holes.forEach((hole, holeIndex) => {
        console.log(`  Hole ${holeIndex + 1}: chain ${hole.chain.id} with ${hole.chain.shapes.length} shapes`);
      });
    });
    
    if (partResult.warnings.length > 0) {
      console.log(`Warnings: ${partResult.warnings.length}`);
      partResult.warnings.forEach(warning => console.log(`  - ${warning.message}`));
    }
    
    // The expected behavior: 1 part with multiple holes
    expect(partResult.parts.length).toBe(1);
    expect(partResult.parts[0].holes.length).toBeGreaterThan(0);
    
    // The largest chain should be the shell
    const shellChain = partResult.parts[0].shell.chain;
    expect(shellChain.shapes.length).toBe(42); // The large boundary chain
  }, 10000);
});