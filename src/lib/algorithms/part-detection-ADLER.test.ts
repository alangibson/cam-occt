import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';

describe('ADLER.dxf Part Detection', () => {
  it('should detect 9 parts with 1 hole from the ADLER.dxf file', async () => {
    // Read the ADLER.dxf file
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // Parse with decompose polylines enabled (matching UI behavior)
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    console.log(`DXF parsed: ${parsed.shapes.length} shapes`);
    
    // Detect chains with tolerance 0.1 (matching current default)
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    console.log(`Chains detected: ${chains.length}`);
    
    // Log details about each chain
    chains.forEach((chain, index) => {
      console.log(`Chain ${index + 1}: ${chain.shapes.length} shapes, ID: ${chain.id}`);
    });
    
    // Detect parts
    const partResult = await detectParts(chains);
    console.log(`Parts detected: ${partResult.parts.length}`);
    console.log(`Warnings: ${partResult.warnings.length}`);
    
    // Log details about each part
    partResult.parts.forEach((part, index) => {
      console.log(`Part ${index + 1}: Shell with ${part.holes.length} holes`);
    });
    
    const totalHoles = partResult.parts.reduce((sum, part) => sum + part.holes.length, 0);
    console.log(`Total holes across all parts: ${totalHoles}`);
    
    // Verify expected results for ADLER.dxf
    expect(partResult.parts).toHaveLength(9); // Should be 9 parts
    expect(totalHoles).toBe(1); // Should have 1 hole total
    expect(partResult.warnings).toHaveLength(0); // Should have no warnings
    
    // Should have 9 parts, with only one having a hole
    const partsWithHoles = partResult.parts.filter(part => part.holes.length > 0);
    expect(partsWithHoles).toHaveLength(1); // Only one part should have a hole
    expect(partsWithHoles[0].holes).toHaveLength(1); // That part should have exactly 1 hole
  });
  
  it('should process the ADLER.dxf file without errors', async () => {
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // This should not throw
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    const partResult = await detectParts(chains);
    
    expect(parsed.shapes.length).toBeGreaterThan(0);
    expect(chains.length).toBeGreaterThan(0);
    expect(partResult.parts.length).toBeGreaterThan(0);
  });
});