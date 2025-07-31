import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import { calculateLeads } from './lead-calculation';

describe('ADLER.dxf Part 5 Lead Placement Debug', () => {
  it('should analyze Part 5 geometry and lead placement', async () => {
    // Load and parse ADLER.dxf
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    
    // Detect chains and parts
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    const partResult = await detectParts(chains);
    
    console.log(`\n=== ADLER.DXF PART 5 ANALYSIS ===`);
    console.log(`Total parts detected: ${partResult.parts.length}`);
    
    // Find Part 5 (should be index 4, 0-based)
    const part5 = partResult.parts[4];
    expect(part5).toBeDefined();
    expect(part5.holes.length).toBe(1); // Part 5 should have 1 hole
    
    console.log(`Part 5 shell chain ID: ${part5.shell.id}`);
    console.log(`Part 5 hole chain ID: ${part5.holes[0].id}`);
    
    // Get the shell chain geometry
    const shellChain = part5.shell.chain;
    console.log(`Shell chain has ${shellChain.shapes.length} shapes`);
    
    // Analyze shell chain shapes
    shellChain.shapes.forEach((shape, index) => {
      console.log(`  Shape ${index + 1}: type=${shape.type}`);
      if (shape.type === 'polyline') {
        const polyline = shape.geometry as any;
        console.log(`    Polyline: ${polyline.points.length} points, closed=${polyline.closed}`);
        console.log(`    First point: (${polyline.points[0].x.toFixed(3)}, ${polyline.points[0].y.toFixed(3)})`);
        console.log(`    Last point: (${polyline.points[polyline.points.length - 1].x.toFixed(3)}, ${polyline.points[polyline.points.length - 1].y.toFixed(3)})`);
      }
    });
    
    // Get the hole chain geometry  
    const holeChain = part5.holes[0].chain;
    console.log(`\nHole chain has ${holeChain.shapes.length} shapes`);
    
    holeChain.shapes.forEach((shape, index) => {
      console.log(`  Shape ${index + 1}: type=${shape.type}`);
      if (shape.type === 'polyline') {
        const polyline = shape.geometry as any;
        console.log(`    Polyline: ${polyline.points.length} points, closed=${polyline.closed}`);
        console.log(`    First point: (${polyline.points[0].x.toFixed(3)}, ${polyline.points[0].y.toFixed(3)})`);
        console.log(`    Last point: (${polyline.points[polyline.points.length - 1].x.toFixed(3)}, ${polyline.points[polyline.points.length - 1].y.toFixed(3)})`);
      }
    });
    
    // Test lead-in calculation on the shell
    console.log(`\n=== TESTING LEAD PLACEMENT ON PART 5 SHELL ===`);
    
    // Try different lead lengths to see the problem
    const testLengths = [1.0, 2.0, 5.0, 10.0, 20.0];
    
    for (const leadLength of testLengths) {
      console.log(`\nTesting lead length: ${leadLength}`);
      
      try {
        const leadResult = calculateLeads(
          shellChain, 
          { type: 'arc', length: leadLength }, 
          { type: 'none', length: 0 },
          part5
        );
        
        if (leadResult.leadIn) {
          console.log(`  ✓ Lead-in calculated successfully`);
          console.log(`  Lead-in points: ${leadResult.leadIn.points.length}`);
          if (leadResult.leadIn.points.length >= 2) {
            const firstPoint = leadResult.leadIn.points[0];
            const lastPoint = leadResult.leadIn.points[leadResult.leadIn.points.length - 1];
            console.log(`  Lead start: (${firstPoint.x.toFixed(3)}, ${firstPoint.y.toFixed(3)})`);
            console.log(`  Entry point: (${lastPoint.x.toFixed(3)}, ${lastPoint.y.toFixed(3)})`);
            
            // Calculate actual lead length
            const actualLength = Math.sqrt(
              (lastPoint.x - firstPoint.x) ** 2 + (lastPoint.y - firstPoint.y) ** 2
            );
            console.log(`  Actual lead length: ${actualLength.toFixed(3)}`);
          }
        } else {
          console.log(`  ✗ No lead-in calculated`);
        }
      } catch (error) {
        console.log(`  ✗ Lead calculation threw error: ${(error as Error).message}`);
      }
    }
  });
  
  it('should examine Part 5 bounding box and geometry characteristics', async () => {
    // Load and parse ADLER.dxf
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    
    // Detect chains and parts
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    const partResult = await detectParts(chains);
    const part5 = partResult.parts[4];
    
    console.log(`\n=== PART 5 GEOMETRIC ANALYSIS ===`);
    
    // Calculate bounding box of shell
    const shellShape = part5.shell.chain.shapes[0];
    if (shellShape.type === 'polyline') {
      const polyline = shellShape.geometry as any;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      
      polyline.points.forEach((point: any) => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      });
      
      console.log(`Shell bounding box: (${minX.toFixed(3)}, ${minY.toFixed(3)}) to (${maxX.toFixed(3)}, ${maxY.toFixed(3)})`);
      console.log(`Shell dimensions: ${(maxX - minX).toFixed(3)} × ${(maxY - minY).toFixed(3)}`);
      console.log(`Shell center: (${((minX + maxX) / 2).toFixed(3)}, ${((minY + maxY) / 2).toFixed(3)})`);
    }
    
    // Calculate bounding box of hole
    const holeShape = part5.holes[0].chain.shapes[0];
    if (holeShape.type === 'polyline') {
      const polyline = holeShape.geometry as any;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      
      polyline.points.forEach((point: any) => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      });
      
      console.log(`Hole bounding box: (${minX.toFixed(3)}, ${minY.toFixed(3)}) to (${maxX.toFixed(3)}, ${maxY.toFixed(3)})`);
      console.log(`Hole dimensions: ${(maxX - minX).toFixed(3)} × ${(maxY - minY).toFixed(3)}`);
      console.log(`Hole center: (${((minX + maxX) / 2).toFixed(3)}, ${((minY + maxY) / 2).toFixed(3)})`);
    }
    
    // Check the shape complexity
    if (shellShape.type === 'polyline') {
      const polyline = shellShape.geometry as any;
      console.log(`\nShell shape complexity:`);
      console.log(`  Total points: ${polyline.points.length}`);
      console.log(`  Has bulges: ${polyline.bulges && polyline.bulges.some((b: any) => b !== 0)}`);
      
      if (polyline.bulges) {
        const nonZeroBulges = polyline.bulges.filter((b: any) => b !== 0);
        console.log(`  Non-zero bulges: ${nonZeroBulges.length}/${polyline.bulges.length}`);
        if (nonZeroBulges.length > 0) {
          console.log(`  Bulge range: ${Math.min(...nonZeroBulges).toFixed(3)} to ${Math.max(...nonZeroBulges).toFixed(3)}`);
        }
      }
    }
  });
});