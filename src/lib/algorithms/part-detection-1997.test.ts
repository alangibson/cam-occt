import { describe, it, expect } from 'vitest';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import fs from 'fs';
import path from 'path';

describe('1997.dxf Part Detection', () => {
  it('should detect 6 chains and 4 parts from the 1997.dxf file', async () => {
    // Read the DXF file
    const dxfPath = path.join(process.cwd(), 'tests/dxf/1997.dxf');
    const dxfContent = fs.readFileSync(dxfPath, 'utf8');
    
    // Parse DXF with polyline decomposition
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    console.log(`DXF parsed: ${parsed.shapes.length} shapes`);
    
    // Verify we have the expected number of shapes after decomposition
    expect(parsed.shapes.length).toBeGreaterThan(400); // Should have ~454 line segments
    
    // Detect chains with increased tolerance
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    console.log(`Chains detected: ${chains.length}`);
    
    // Log chain details
    chains.forEach((chain, i) => {
      console.log(`Chain ${i + 1}: ${chain.shapes.length} shapes, ID: ${chain.id}`);
    });
    
    // Detect parts
    const partResult = await detectParts(chains);
    console.log(`Parts detected: ${partResult.parts.length}`);
    console.log(`Warnings: ${partResult.warnings.length}`);
    
    // Log part details
    partResult.parts.forEach((part, i) => {
      console.log(`Part ${i + 1}: Shell with ${part.holes.length} holes`);
    });
    
    // Log warnings if any
    if (partResult.warnings.length > 0) {
      console.log('Warnings:');
      partResult.warnings.forEach((warning, i) => {
        console.log(`${i + 1}. ${warning.message}`);
      });
    }
    
    // Assertions
    expect(chains.length).toBe(6); // Expected: 6 chains
    expect(partResult.parts.length).toBe(4); // Expected: 4 parts
    expect(parsed.shapes.length).toBeGreaterThan(0); // Should have shapes
    
    // Additional validation: total holes across all parts
    const totalHoles = partResult.parts.reduce((sum, part) => sum + part.holes.length, 0);
    console.log(`Total holes across all parts: ${totalHoles}`);
    
    // Since we have 6 chains and 4 parts, we should have 2 holes total (6 - 4 = 2)
    expect(totalHoles).toBe(2);
  });
  
  it('should process the 1997.dxf file without errors', async () => {
    const dxfPath = path.join(process.cwd(), 'tests/dxf/1997.dxf');
    const dxfContent = fs.readFileSync(dxfPath, 'utf8');
    
    // This should not throw
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    expect(parsed).toBeDefined();
    expect(parsed.shapes).toBeDefined();
    
    // Chain detection should not throw
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    expect(chains).toBeDefined();
    expect(Array.isArray(chains)).toBe(true);
    
    // Part detection should not throw
    const partResult = await detectParts(chains);
    expect(partResult).toBeDefined();
    expect(partResult.parts).toBeDefined();
    expect(partResult.warnings).toBeDefined();
  });
});