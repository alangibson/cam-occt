import { describe, it, expect } from 'vitest';
import { parseDXF } from '../parsers/dxf-parser';
import { decomposePolylines } from './decompose-polylines';
import { detectShapeChains } from './chain-detection/chain-detection';
import { detectParts } from './part-detection';
import fs from 'fs';
import path from 'path';

describe('1997.dxf Part Detection', () => {
  it('should detect 6 chains and 4 parts from the 1997.dxf file', async () => {
    // Read the DXF file
    const dxfPath = path.join(process.cwd(), 'tests/dxf/1997.dxf');
    const dxfContent = fs.readFileSync(dxfPath, 'utf8');
    
    // Parse DXF (no decomposition in parser)
    const parsed = await parseDXF(dxfContent);
    
    // Decompose polylines separately
    const decomposed = decomposePolylines(parsed.shapes);
    
    // Verify we have the expected number of shapes after decomposition
    expect(decomposed.length).toBeGreaterThan(400); // Should have ~454 line segments
    
    // Detect chains using decomposed shapes
    const chains = detectShapeChains(decomposed, { tolerance: 0.1 });
    
    // Log chain details
    chains.forEach(() => {
    });
    
    // Detect parts
    const partResult = await detectParts(chains);
    
    // Log part details
    partResult.parts.forEach(() => {
    });
    
    // Log warnings if any
    if (partResult.warnings.length > 0) {
      partResult.warnings.forEach(() => {
      });
    }
    
    // Assertions
    expect(chains.length).toBe(6); // Expected: 6 chains
    expect(partResult.parts.length).toBe(4); // Expected: 4 parts
    expect(decomposed.length).toBeGreaterThan(0); // Should have shapes after decomposition
    
    // Additional validation: total holes across all parts
    const totalHoles = partResult.parts.reduce((sum, part) => sum + part.holes.length, 0);
    
    // Since we have 6 chains and 4 parts, we should have 2 holes total (6 - 4 = 2)
    expect(totalHoles).toBe(2);
  });
  
  it('should process the 1997.dxf file without errors', async () => {
    const dxfPath = path.join(process.cwd(), 'tests/dxf/1997.dxf');
    const dxfContent = fs.readFileSync(dxfPath, 'utf8');
    
    // DXF parsing should not throw
    const parsed = await parseDXF(dxfContent);
    expect(parsed).toBeDefined();
    expect(parsed.shapes).toBeDefined();
    
    // Polyline decomposition should not throw
    const decomposed = decomposePolylines(parsed.shapes);
    expect(decomposed).toBeDefined();
    expect(Array.isArray(decomposed)).toBe(true);
    
    // Chain detection should not throw
    const chains = detectShapeChains(decomposed, { tolerance: 0.1 });
    expect(chains).toBeDefined();
    expect(Array.isArray(chains)).toBe(true);
    
    // Part detection should not throw
    const partResult = await detectParts(chains);
    expect(partResult).toBeDefined();
    expect(partResult.parts).toBeDefined();
    expect(partResult.warnings).toBeDefined();
  });
});