import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from './lead-calculation';

describe('ADLER Part 5 Cut Direction Analysis', () => {
  // Helper to check if a point is inside a polygon using ray casting
  function isPointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
    let inside = false;
    const x = point.x;
    const y = point.y;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  // Helper to get polygon points from a chain
  function getPolygonFromChain(chain: any): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    
    for (const shape of chain.shapes) {
      if (shape.type === 'line') {
        points.push(shape.geometry.start);
      } else if (shape.type === 'polyline') {
        points.push(...shape.geometry.points);
      }
    }
    
    return points;
  }

  // Helper to check if point is in solid area (inside shell, outside holes)
  function isPointInSolidArea(point: { x: number; y: number }, part: any): boolean {
    const shellPolygon = getPolygonFromChain(part.shell.chain);
    
    // First check if point is inside the shell
    if (!isPointInPolygon(point, shellPolygon)) {
      return false; // Not inside shell, definitely not in solid area
    }

    // Check if point is inside any hole
    for (const hole of part.holes) {
      const holePolygon = getPolygonFromChain(hole.chain);
      if (isPointInPolygon(point, holePolygon)) {
        return false; // Inside hole, not solid area
      }
    }

    return true; // Inside shell, outside all holes = solid area
  }

  it('should find best cut direction for ADLER Part 5', async () => {
    console.log('\n=== FINDING BEST CUT DIRECTION FOR ADLER PART 5 ===');
    
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    const partResult = await detectParts(chains);
    const part5 = partResult.parts[4];
    
    if (!part5) return;
    
    console.log(`Part 5 shell bounding box spans ${(part5.shell.boundingBox.maxX - part5.shell.boundingBox.minX).toFixed(1)} × ${(part5.shell.boundingBox.maxY - part5.shell.boundingBox.minY).toFixed(1)} units`);
    
    // Test different lead lengths with both cut directions
    const testLengths = [2, 5, 8, 10, 15];
    const cutDirections: ('clockwise' | 'counterclockwise')[] = ['clockwise', 'counterclockwise'];
    
    console.log('\nTesting different lead lengths and cut directions:');
    console.log('Length | Clockwise | Counter | Best');
    console.log('-------|-----------|---------|-----');
    
    for (const length of testLengths) {
      const leadIn: LeadInConfig = { type: 'arc', length };
      const leadOut: LeadOutConfig = { type: 'none', length: 0 };
      
      let results: Array<{ direction: string; solidPoints: number; warnings: number }> = [];
      
      for (const cutDirection of cutDirections) {
        const result = calculateLeads(part5.shell.chain, leadIn, leadOut, cutDirection, part5);
        
        let solidPoints = 0;
        if (result.leadIn) {
          for (let i = 0; i < result.leadIn.points.length - 1; i++) {
            if (isPointInSolidArea(result.leadIn.points[i], part5)) {
              solidPoints++;
            }
          }
        }
        
        results.push({
          direction: cutDirection,
          solidPoints,
          warnings: result.warnings?.length || 0
        });
      }
      
      const clockwise = results[0];
      const counter = results[1];
      const best = clockwise.solidPoints <= counter.solidPoints ? 'CW' : 'CCW';
      
      console.log(`${length.toString().padStart(6)} | ${clockwise.solidPoints.toString().padStart(9)} | ${counter.solidPoints.toString().padStart(7)} | ${best}`);
    }
    
    // Test with very short leads
    console.log('\nTesting very short leads:');
    const shortResult = calculateLeads(part5.shell.chain, { type: 'arc', length: 1 }, { type: 'none', length: 0 }, 'counterclockwise', part5);
    
    if (shortResult.leadIn) {
      let solidPoints = 0;
      for (let i = 0; i < shortResult.leadIn.points.length - 1; i++) {
        if (isPointInSolidArea(shortResult.leadIn.points[i], part5)) {
          solidPoints++;
        }
      }
      console.log(`Length 1 counterclockwise: ${solidPoints} solid points`);
      
      if (solidPoints === 0) {
        console.log('✅ SUCCESS: Found a working configuration!');
      }
    }
  });

  it('should analyze Part 5 geometry for lead placement insights', async () => {
    console.log('\n=== ANALYZING PART 5 GEOMETRY ===');
    
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    const partResult = await detectParts(chains);
    const part5 = partResult.parts[4];
    
    if (!part5) return;
    
    // Analyze the shell geometry
    const shellShape = part5.shell.chain.shapes[0];
    if (shellShape.type === 'polyline') {
      const points = shellShape.geometry.points;
      
      console.log(`Shell has ${points.length} points`);
      console.log(`Connection point: (${points[0].x.toFixed(3)}, ${points[0].y.toFixed(3)})`);
      
      // Find the nearest edge of the bounding box to understand constraints
      const bbox = part5.shell.boundingBox;
      const connectionPoint = points[0];
      
      const distToLeft = connectionPoint.x - bbox.minX;
      const distToRight = bbox.maxX - connectionPoint.x;
      const distToBottom = connectionPoint.y - bbox.minY;
      const distToTop = bbox.maxY - connectionPoint.y;
      
      console.log(`Connection point distance to edges:`);
      console.log(`  Left: ${distToLeft.toFixed(1)}, Right: ${distToRight.toFixed(1)}`);
      console.log(`  Bottom: ${distToBottom.toFixed(1)}, Top: ${distToTop.toFixed(1)}`);
      
      const minDist = Math.min(distToLeft, distToRight, distToBottom, distToTop);
      console.log(`Minimum distance to edge: ${minDist.toFixed(1)} units`);
      
      if (minDist < 15) {
        console.log('⚠️  Connection point is very close to part boundary');
        console.log('   This makes lead placement extremely challenging');
        console.log(`   Maximum safe lead length: ~${(minDist * 0.8).toFixed(1)} units`);
      }
    }
    
    // Analyze hole position relative to connection point
    if (part5.holes.length > 0) {
      const holeShape = part5.holes[0].chain.shapes[0];
      if (holeShape.type === 'polyline') {
        const holePoints = holeShape.geometry.points;
        const holeCenter = {
          x: holePoints.reduce((sum, p) => sum + p.x, 0) / holePoints.length,
          y: holePoints.reduce((sum, p) => sum + p.y, 0) / holePoints.length
        };
        
        const connectionPoint = shellShape.geometry.points[0];
        const distToHole = Math.sqrt(
          (connectionPoint.x - holeCenter.x) ** 2 + 
          (connectionPoint.y - holeCenter.y) ** 2
        );
        
        console.log(`Distance from connection point to hole center: ${distToHole.toFixed(1)} units`);
      }
    }
  });
});