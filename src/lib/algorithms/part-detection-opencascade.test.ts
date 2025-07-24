import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import { initOpenCascadeForTests } from '../test-utils/opencascade-setup';

describe('Part Detection with OpenCascade.js', () => {
  beforeAll(async () => {
    // Initialize OpenCascade.js before running any tests
    await initOpenCascadeForTests();
  }, 30000); // 30 second timeout for WASM initialization

  describe('1997.dxf with Geometric Containment', () => {
    it('should correctly detect 4 parts with 2 holes using geometric operations', async () => {
      // Load and parse the DXF file
      const dxfPath = join(process.cwd(), 'tests/dxf/1997.dxf');
      const dxfContent = readFileSync(dxfPath, 'utf-8');
      const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
      
      console.log(`DXF parsed: ${parsed.shapes.length} shapes`);
      
      // Detect chains
      const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
      console.log(`Chains detected: ${chains.length}`);
      
      chains.forEach((chain, index) => {
        console.log(`Chain ${index + 1}: ${chain.shapes.length} shapes, ID: ${chain.id}`);
      });
      
      // Detect parts using geometric containment (should not fall back to bounding box)
      const partResult = await detectParts(chains);
      console.log(`Parts detected: ${partResult.parts.length}`);
      
      partResult.parts.forEach((part, index) => {
        console.log(`Part ${index + 1}: Shell (${part.shell.chain.id}) with ${part.holes.length} holes`);
        part.holes.forEach((hole, holeIndex) => {
          console.log(`  Hole ${holeIndex + 1}: ${hole.chain.id}`);
        });
      });
      
      const totalHoles = partResult.parts.reduce((sum, part) => sum + part.holes.length, 0);
      console.log(`Total holes across all parts: ${totalHoles}`);
      
      // Verify results
      expect(partResult.parts).toHaveLength(4); // Should be 4 parts
      expect(totalHoles).toBe(2); // Should have 2 holes total
      expect(partResult.warnings).toHaveLength(0); // Should have no warnings
      
      // Verify specific structure
      const partsWithHoles = partResult.parts.filter(part => part.holes.length > 0);
      expect(partsWithHoles).toHaveLength(2); // Two parts should have holes
      partsWithHoles.forEach(part => {
        expect(part.holes).toHaveLength(1); // Each should have exactly 1 hole
      });
    }, 60000); // 60 second timeout for geometric operations
  });

  describe('ADLER.dxf with Geometric Containment', () => {
    it('should correctly detect 9 parts with 1 hole using geometric operations', async () => {
      // Load and parse the DXF file
      const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
      const dxfContent = readFileSync(dxfPath, 'utf-8');
      const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
      
      console.log(`DXF parsed: ${parsed.shapes.length} shapes`);
      
      // Detect chains
      const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
      console.log(`Chains detected: ${chains.length}`);
      
      chains.forEach((chain, index) => {
        console.log(`Chain ${index + 1}: ${chain.shapes.length} shapes, ID: ${chain.id}`);
      });
      
      // Detect parts using geometric containment
      const partResult = await detectParts(chains);
      console.log(`Parts detected: ${partResult.parts.length}`);
      
      partResult.parts.forEach((part, index) => {
        console.log(`Part ${index + 1}: Shell (${part.shell.chain.id}) with ${part.holes.length} holes`);
        part.holes.forEach((hole, holeIndex) => {
          console.log(`  Hole ${holeIndex + 1}: ${hole.chain.id}`);
        });
      });
      
      const totalHoles = partResult.parts.reduce((sum, part) => sum + part.holes.length, 0);
      console.log(`Total holes across all parts: ${totalHoles}`);
      
      // CRITICAL: ADLER.dxf must have exactly 9 parts with 1 hole total
      // This test will fail until proper geometric containment is implemented
      expect(partResult.parts).toHaveLength(9); // Must be exactly 9 parts
      expect(totalHoles).toBe(1); // Must have exactly 1 hole total
      expect(partResult.warnings).toHaveLength(0); // Should have no warnings
      
      // Verify specific structure: exactly one part should contain the single hole
      const partsWithHoles = partResult.parts.filter(part => part.holes.length > 0);
      expect(partsWithHoles).toHaveLength(1); // Only one part should have a hole
      expect(partsWithHoles[0].holes).toHaveLength(1); // That part should have exactly 1 hole
      
      // Verify the remaining 8 parts have no holes
      const partsWithoutHoles = partResult.parts.filter(part => part.holes.length === 0);
      expect(partsWithoutHoles).toHaveLength(8); // Eight parts should have no holes
    }, 60000); // 60 second timeout for geometric operations
  });

  describe('1.dxf', () => {
    it('should detect 2 parts (currently fails - detects 1)', async () => {
      const dxfPath = join(process.cwd(), 'tests/dxf/1.dxf');
      const dxfContent = readFileSync(dxfPath, 'utf-8');
      const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
      
      const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
      const partResult = await detectParts(chains);
      
      console.log(`1.dxf: ${partResult.parts.length} parts detected`);
      partResult.parts.forEach((part, index) => {
        console.log(`  Part ${index + 1}: Shell (${part.shell.chain.id}) with ${part.holes.length} holes`);
      });
      
      expect(partResult.parts).toHaveLength(2); // Should detect 2 parts
    }, 60000);
  });

  describe('2.dxf', () => {
    it('should detect 2 parts (currently working)', async () => {
      const dxfPath = join(process.cwd(), 'tests/dxf/2.dxf');
      const dxfContent = readFileSync(dxfPath, 'utf-8');
      const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
      
      const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
      const partResult = await detectParts(chains);
      
      console.log(`2.dxf: ${partResult.parts.length} parts detected`);
      partResult.parts.forEach((part, index) => {
        console.log(`  Part ${index + 1}: Shell (${part.shell.chain.id}) with ${part.holes.length} holes`);
      });
      
      expect(partResult.parts).toHaveLength(2); // Should detect 2 parts
    }, 60000);
  });

  describe('3.dxf', () => {
    it('should detect 2 parts (currently fails - detects 1)', async () => {
      const dxfPath = join(process.cwd(), 'tests/dxf/3.dxf');
      const dxfContent = readFileSync(dxfPath, 'utf-8');
      const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
      
      const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
      const partResult = await detectParts(chains);
      
      console.log(`3.dxf: ${partResult.parts.length} parts detected`);
      partResult.parts.forEach((part, index) => {
        console.log(`  Part ${index + 1}: Shell (${part.shell.chain.id}) with ${part.holes.length} holes`);
      });
      
      expect(partResult.parts).toHaveLength(2); // Should detect 2 parts
    }, 60000);
  });

  describe('Tractor Seat Mount - Left.dxf', () => {
    it('should detect 1 part (currently fails - detects 4, has multiple layers)', async () => {
      const dxfPath = join(process.cwd(), 'tests/dxf/Tractor Seat Mount - Left.dxf');
      const dxfContent = readFileSync(dxfPath, 'utf-8');
      const parsed = await parseDXF(dxfContent, { decomposePolylines: true, squashLayers: true });
      
      const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
      const partResult = await detectParts(chains);
      
      console.log(`Tractor Seat Mount - Left.dxf: ${partResult.parts.length} parts detected`);
      partResult.parts.forEach((part, index) => {
        console.log(`  Part ${index + 1}: Shell (${part.shell.chain.id}) with ${part.holes.length} holes`);
        part.holes.forEach((hole, holeIndex) => {
          console.log(`    Hole ${holeIndex + 1}: ${hole.chain.id}`);
        });
      });
      
      expect(partResult.parts).toHaveLength(1); // Should detect 1 part with holes
      if (partResult.parts.length === 1) {
        expect(partResult.parts[0].holes.length).toBeGreaterThan(0); // Should have holes
      }
    }, 60000);
  });

  describe('2013-11-08_test.dxf', () => {
    it('should detect 1 part with 3 holes (currently fails - detects 3 parts, has multiple layers)', async () => {
      const dxfPath = join(process.cwd(), 'tests/dxf/2013-11-08_test.dxf');
      const dxfContent = readFileSync(dxfPath, 'utf-8');
      const parsed = await parseDXF(dxfContent, { decomposePolylines: true, squashLayers: true });
      
      const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
      const partResult = await detectParts(chains);
      
      console.log(`2013-11-08_test.dxf: ${partResult.parts.length} parts detected`);
      partResult.parts.forEach((part, index) => {
        console.log(`  Part ${index + 1}: Shell (${part.shell.chain.id}) with ${part.holes.length} holes`);
        part.holes.forEach((hole, holeIndex) => {
          console.log(`    Hole ${holeIndex + 1}: ${hole.chain.id}`);
        });
      });
      
      const totalHoles = partResult.parts.reduce((sum, part) => sum + part.holes.length, 0);
      
      expect(partResult.parts).toHaveLength(1); // Should detect 1 part
      expect(totalHoles).toBe(3); // Should have 3 holes total
    }, 60000);
  });

  describe('probleme.dxf', () => {
    it('should warn about unclosed chains when no parts detected', async () => {
      const dxfPath = join(process.cwd(), 'tests/dxf/probleme.dxf');
      const dxfContent = readFileSync(dxfPath, 'utf-8');
      const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
      
      const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
      const partResult = await detectParts(chains);
      
      console.log(`probleme.dxf: ${partResult.parts.length} parts detected`);
      console.log(`Warnings: ${partResult.warnings.length}`);
      partResult.warnings.forEach((warning, index) => {
        console.log(`  Warning ${index + 1}: ${warning.message}`);
      });
      
      if (partResult.parts.length === 0) {
        expect(partResult.warnings.length).toBeGreaterThan(0); // Should have warnings about unclosed chains
        expect(partResult.warnings.some(w => w.message.includes('unclosed') || w.message.includes('chain') || w.message.includes('problem'))).toBe(true);
      }
    }, 60000);
  });
});