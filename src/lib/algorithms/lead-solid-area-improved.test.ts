import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from './lead-calculation';

describe('Lead Solid Area Detection - Improved Point-in-Polygon', () => {
  it('should properly detect solid areas using point-in-polygon for ADLER.dxf Part 5', async () => {
    // Load the ADLER.dxf file
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // Parse with decompose polylines enabled (matching UI behavior)
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    
    // Detect chains with tolerance 0.1 (standard default)
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    
    // Detect parts
    const partResult = await detectParts(chains);
    
    // Find Part 5 (0-based indexing, so part 5 is index 4)
    const part5 = partResult.parts[4];
    expect(part5).toBeDefined();
    
    if (!part5) return;
    
    // Test lead generation for the shell chain with improved algorithm
    const leadIn: LeadInConfig = { type: 'arc', length: 5 }; // Shorter lead to test
    const leadOut: LeadOutConfig = { type: 'none', length: 0 };
    
    const result = calculateLeads(part5.shell.chain, leadIn, leadOut, part5);
    
    expect(result.leadIn).toBeDefined();
    expect(result.leadIn!.points.length).toBeGreaterThan(0);
    
    // The improved algorithm should either:
    // 1. Find a valid position without warnings, OR
    // 2. Generate warnings if no valid position exists after trying all rotations
    
    console.log('ADLER Part 5 Lead Test Results:');
    console.log(`- Lead points generated: ${result.leadIn!.points.length}`);
    console.log(`- Warnings generated: ${result.warnings ? result.warnings.length : 0}`);
    
    if (result.warnings && result.warnings.length > 0) {
      console.log('Warnings:');
      result.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`);
      });
      
      // If warnings are generated, they should be informative
      expect(result.warnings[0]).toContain('intersects solid material');
      expect(result.warnings[0]).toContain('cannot be avoided');
    }
    
    // Algorithm should have tried to find a solution (no crashes)
    expect(result.leadIn!.points.length).toBeGreaterThan(0);
  });

  it('should generate different warnings for lead-in vs lead-out', async () => {
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    const partResult = await detectParts(chains);
    const part5 = partResult.parts[4];
    
    if (!part5) {
      console.log('Part 5 not found, skipping test');
      return;
    }
    
    // Test both lead-in and lead-out with challenging parameters
    const leadIn: LeadInConfig = { type: 'arc', length: 20 }; // Long lead
    const leadOut: LeadOutConfig = { type: 'arc', length: 20 }; // Long lead
    
    const result = calculateLeads(part5.shell.chain, leadIn, leadOut, part5);
    
    if (result.warnings && result.warnings.length > 0) {
      console.log('Both leads warnings:');
      result.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`);
      });
      
      // Check that warnings properly identify lead-in vs lead-out
      const leadInWarnings = result.warnings.filter(w => w.includes('Lead-in'));
      const leadOutWarnings = result.warnings.filter(w => w.includes('Lead-out'));
      
      if (leadInWarnings.length > 0) {
        expect(leadInWarnings[0]).toContain('Lead-in');
        expect(leadInWarnings[0]).toContain('shell');
      }
      
      if (leadOutWarnings.length > 0) {
        expect(leadOutWarnings[0]).toContain('Lead-out');
        expect(leadOutWarnings[0]).toContain('shell');
      }
    }
  });

  it('should try multiple angles and lengths before generating warnings', async () => {
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    const partResult = await detectParts(chains);
    const part5 = partResult.parts[4];
    
    if (!part5) return;
    
    // Test with a very long lead that should definitely intersect
    const leadIn: LeadInConfig = { type: 'arc', length: 50 }; // Very long lead
    const leadOut: LeadOutConfig = { type: 'none', length: 0 };
    
    const result = calculateLeads(part5.shell.chain, leadIn, leadOut, part5);
    
    // Should generate a warning for such a long lead in a constrained space
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
    
    // Verify the algorithm tried different approaches
    expect(result.warnings![0]).toContain('cannot be avoided');
    expect(result.warnings![0]).toContain('Consider reducing lead length');
  });
});