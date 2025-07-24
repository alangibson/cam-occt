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
    
    console.log(`Step 1 - DXF parsed: ${parsed.shapes.length} shapes`);
    
    // Step 2: Detect chains (matching UI flow)
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    console.log(`Step 2 - Chains detected: ${chains.length}`);
    
    chains.forEach((chain, index) => {
      console.log(`  Chain ${index + 1}: ${chain.shapes.length} shapes, ID: ${chain.id}`);
    });
    
    // Step 3: Detect parts (matching UI flow)
    const partResult = await detectParts(chains);
    console.log(`Step 3 - Parts detected: ${partResult.parts.length}`);
    
    partResult.parts.forEach((part, index) => {
      console.log(`  Part ${index + 1}: Shell (${part.shell.chain.id}) with ${part.holes.length} holes`);
      part.holes.forEach((hole, holeIndex) => {
        console.log(`    Hole ${holeIndex + 1}: ${hole.chain.id}`);
      });
    });
    
    // Step 4: Test part type detection for each chain
    console.log(`Step 4 - Testing part type detection:`);
    
    const chainPartTypes: Record<string, 'shell' | 'hole' | null> = {};
    
    chains.forEach(chain => {
      const partType = getChainPartType(chain.id, partResult.parts);
      chainPartTypes[chain.id] = partType;
      console.log(`  Chain ${chain.id}: ${partType || 'null'}`);
    });
    
    // Verify expectations
    expect(partResult.parts).toHaveLength(4); // Should be 4 parts
    expect(partResult.parts.reduce((sum, part) => sum + part.holes.length, 0)).toBe(2); // Should have 2 holes total
    
    // Count shells and holes
    const shellCount = Object.values(chainPartTypes).filter(type => type === 'shell').length;
    const holeCount = Object.values(chainPartTypes).filter(type => type === 'hole').length;
    const nullCount = Object.values(chainPartTypes).filter(type => type === null).length;
    
    console.log(`Summary: ${shellCount} shells, ${holeCount} holes, ${nullCount} unclassified`);
    
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
    
    console.log(`Step 1 - DXF parsed: ${parsed.shapes.length} shapes`);
    
    // Step 2: Detect chains (matching UI flow)
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    console.log(`Step 2 - Chains detected: ${chains.length}`);
    
    // Step 3: Detect parts (matching UI flow)
    const partResult = await detectParts(chains);
    console.log(`Step 3 - Parts detected: ${partResult.parts.length}`);
    
    // Step 4: Test part type detection for each chain
    console.log(`Step 4 - Testing part type detection:`);
    
    const chainPartTypes: Record<string, 'shell' | 'hole' | null> = {};
    
    chains.forEach(chain => {
      const partType = getChainPartType(chain.id, partResult.parts);
      chainPartTypes[chain.id] = partType;
      console.log(`  Chain ${chain.id}: ${partType || 'null'}`);
    });
    
    // Verify expectations for ADLER.dxf
    expect(partResult.parts).toHaveLength(9); // Should be 9 parts
    expect(partResult.parts.reduce((sum, part) => sum + part.holes.length, 0)).toBe(1); // Should have 1 hole total
    
    // Count shells and holes
    const shellCount = Object.values(chainPartTypes).filter(type => type === 'shell').length;
    const holeCount = Object.values(chainPartTypes).filter(type => type === 'hole').length;
    const nullCount = Object.values(chainPartTypes).filter(type => type === null).length;
    
    console.log(`Summary: ${shellCount} shells, ${holeCount} holes, ${nullCount} unclassified`);
    
    expect(shellCount).toBe(9); // Should have 9 shells (one per part)
    expect(holeCount).toBe(1); // Should have 1 hole
    expect(nullCount).toBe(0); // All chains should be classified
  });
});