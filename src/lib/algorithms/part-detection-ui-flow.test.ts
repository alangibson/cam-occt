import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import { getChainPartType } from '../stores/parts';

describe('UI Flow Integration Test', () => {
  it('should correctly identify part types in the complete 1997.dxf workflow', async () => {
    // Step 1: Load and parse DXF (matching UI flow)
    const dxfPath = join(process.cwd(), 'tests/dxf/1997.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    
    
    // Step 2: Detect chains (matching UI flow)
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    
    chains.forEach((chain, index) => {
    });
    
    // Step 3: Detect parts (matching UI flow)
    const partResult = await detectParts(chains);
    
    partResult.parts.forEach((part, index) => {
      part.holes.forEach((hole, holeIndex) => {
      });
    });
    
    // Step 4: Test part type detection for each chain
    
    const chainPartTypes: Record<string, 'shell' | 'hole' | null> = {};
    
    chains.forEach(chain => {
      const partType = getChainPartType(chain.id, partResult.parts);
      chainPartTypes[chain.id] = partType;
    });
    
    // Verify expectations
    expect(partResult.parts).toHaveLength(4); // Should be 4 parts
    expect(partResult.parts.reduce((sum, part) => sum + part.holes.length, 0)).toBe(2); // Should have 2 holes total
    
    // Count shells and holes
    const shellCount = Object.values(chainPartTypes).filter(type => type === 'shell').length;
    const holeCount = Object.values(chainPartTypes).filter(type => type === 'hole').length;
    const nullCount = Object.values(chainPartTypes).filter(type => type === null).length;
    
    
    expect(shellCount).toBe(4); // Should have 4 shells (one per part)
    expect(holeCount).toBe(2); // Should have 2 holes
    expect(nullCount).toBe(0); // All chains should be classified
    
    // Verify specific chain types
    chains.forEach(chain => {
      expect(chainPartTypes[chain.id]).not.toBeNull();
    });
  });
  
  it('should correctly identify part types in the complete ADLER.dxf workflow', async () => {
    // Step 1: Load and parse DXF (matching UI flow)
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');  
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    
    
    // Step 2: Detect chains (matching UI flow)
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    
    // Step 3: Detect parts (matching UI flow)
    const partResult = await detectParts(chains);
    
    // Step 4: Test part type detection for each chain
    
    const chainPartTypes: Record<string, 'shell' | 'hole' | null> = {};
    
    chains.forEach(chain => {
      const partType = getChainPartType(chain.id, partResult.parts);
      chainPartTypes[chain.id] = partType;
    });
    
    // Verify expectations for ADLER.dxf
    expect(partResult.parts).toHaveLength(9); // Should be 9 parts
    expect(partResult.parts.reduce((sum, part) => sum + part.holes.length, 0)).toBe(1); // Should have 1 hole total
    
    // Count shells and holes
    const shellCount = Object.values(chainPartTypes).filter(type => type === 'shell').length;
    const holeCount = Object.values(chainPartTypes).filter(type => type === 'hole').length;
    const nullCount = Object.values(chainPartTypes).filter(type => type === null).length;
    
    
    expect(shellCount).toBe(9); // Should have 9 shells (one per part)
    expect(holeCount).toBe(1); // Should have 1 hole
    expect(nullCount).toBe(0); // All chains should be classified
  });
});