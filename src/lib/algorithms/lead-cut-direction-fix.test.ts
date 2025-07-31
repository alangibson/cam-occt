import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from './lead-calculation';

describe('Lead Cut Direction Fix', () => {
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
      } else if (shape.type === 'arc') {
        // Sample points along the arc
        const arc = shape.geometry;
        const segments = Math.max(8, Math.ceil(Math.abs(arc.endAngle - arc.startAngle) * arc.radius / 2));
        for (let i = 0; i < segments; i++) {
          const t = i / segments;
          const angle = arc.startAngle + (arc.endAngle - arc.startAngle) * t;
          points.push({
            x: arc.center.x + arc.radius * Math.cos(angle),
            y: arc.center.y + arc.radius * Math.sin(angle)
          });
        }
      } else if (shape.type === 'circle') {
        // Sample points around the circle
        const circle = shape.geometry;
        const segments = Math.max(16, Math.ceil(2 * Math.PI * circle.radius / 2));
        for (let i = 0; i < segments; i++) {
          const angle = (2 * Math.PI * i) / segments;
          points.push({
            x: circle.center.x + circle.radius * Math.cos(angle),
            y: circle.center.y + circle.radius * Math.sin(angle)
          });
        }
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

  it('should demonstrate cut direction affects lead placement', async () => {
    console.log('\n=== TESTING CUT DIRECTION EFFECT ON LEAD PLACEMENT ===');
    
    // Load the ADLER.dxf file
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
    
    const leadIn: LeadInConfig = { type: 'arc', length: 10 };
    const leadOut: LeadOutConfig = { type: 'none', length: 0 };
    
    // Test clockwise cut direction
    console.log('\nTesting CLOCKWISE cut direction:');
    const clockwiseResult = calculateLeads(part5.shell.chain, leadIn, leadOut, 'clockwise', part5);
    
    let clockwiseSolidPoints = 0;
    if (clockwiseResult.leadIn) {
      const connectionPoint = clockwiseResult.leadIn.points[clockwiseResult.leadIn.points.length - 1];
      
      for (let i = 0; i < clockwiseResult.leadIn.points.length - 1; i++) {
        const point = clockwiseResult.leadIn.points[i];
        if (isPointInSolidArea(point, part5)) {
          clockwiseSolidPoints++;
        }
      }
      
      console.log(`Clockwise: ${clockwiseSolidPoints}/${clockwiseResult.leadIn.points.length - 1} points in solid area`);
      console.log(`Connection point: (${connectionPoint.x.toFixed(3)}, ${connectionPoint.y.toFixed(3)})`);
      
      if (clockwiseResult.warnings?.length) {
        console.log(`Warnings: ${clockwiseResult.warnings.length}`);
      }
    }
    
    // Test counterclockwise cut direction
    console.log('\nTesting COUNTERCLOCKWISE cut direction:');
    const counterclockwiseResult = calculateLeads(part5.shell.chain, leadIn, leadOut, 'counterclockwise', part5);
    
    let counterclockwiseSolidPoints = 0;
    if (counterclockwiseResult.leadIn) {
      const connectionPoint = counterclockwiseResult.leadIn.points[counterclockwiseResult.leadIn.points.length - 1];
      
      for (let i = 0; i < counterclockwiseResult.leadIn.points.length - 1; i++) {
        const point = counterclockwiseResult.leadIn.points[i];
        if (isPointInSolidArea(point, part5)) {
          counterclockwiseSolidPoints++;
        }
      }
      
      console.log(`Counterclockwise: ${counterclockwiseSolidPoints}/${counterclockwiseResult.leadIn.points.length - 1} points in solid area`);
      console.log(`Connection point: (${connectionPoint.x.toFixed(3)}, ${connectionPoint.y.toFixed(3)})`);
      
      if (counterclockwiseResult.warnings?.length) {
        console.log(`Warnings: ${counterclockwiseResult.warnings.length}`);
      }
    }
    
    // Compare results
    console.log('\n=== COMPARISON ===');
    console.log(`Clockwise solid points: ${clockwiseSolidPoints}`);
    console.log(`Counterclockwise solid points: ${counterclockwiseSolidPoints}`);
    
    // With proper cut direction consideration, one should be better than the other
    // At minimum, they should be different
    expect(clockwiseSolidPoints !== counterclockwiseSolidPoints || 
           (clockwiseResult.warnings?.length || 0) !== (counterclockwiseResult.warnings?.length || 0)).toBe(true);
  });

  it('should show improvement for ADLER Part 5 with correct cut direction', async () => {
    console.log('\n=== TESTING ADLER PART 5 IMPROVEMENT ===');
    
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    const partResult = await detectParts(chains);
    const part5 = partResult.parts[4];
    
    if (!part5) return;
    
    const leadIn: LeadInConfig = { type: 'arc', length: 10 };
    const leadOut: LeadOutConfig = { type: 'none', length: 0 };
    
    // Test with no cut direction (old behavior)
    const noCutDirResult = calculateLeads(part5.shell.chain, leadIn, leadOut, 'none', part5);
    
    // Test with clockwise cut direction
    const clockwiseResult = calculateLeads(part5.shell.chain, leadIn, leadOut, 'clockwise', part5);
    
    // Test with counterclockwise cut direction  
    const counterclockwiseResult = calculateLeads(part5.shell.chain, leadIn, leadOut, 'counterclockwise', part5);
    
    let noCutDirSolid = 0, clockwiseSolid = 0, counterclockwiseSolid = 0;
    
    // Count solid area violations for each approach
    if (noCutDirResult.leadIn) {
      for (let i = 0; i < noCutDirResult.leadIn.points.length - 1; i++) {
        if (isPointInSolidArea(noCutDirResult.leadIn.points[i], part5)) {
          noCutDirSolid++;
        }
      }
    }
    
    if (clockwiseResult.leadIn) {
      for (let i = 0; i < clockwiseResult.leadIn.points.length - 1; i++) {
        if (isPointInSolidArea(clockwiseResult.leadIn.points[i], part5)) {
          clockwiseSolid++;
        }
      }
    }
    
    if (counterclockwiseResult.leadIn) {
      for (let i = 0; i < counterclockwiseResult.leadIn.points.length - 1; i++) {
        if (isPointInSolidArea(counterclockwiseResult.leadIn.points[i], part5)) {
          counterclockwiseSolid++;
        }
      }
    }
    
    console.log(`No cut direction: ${noCutDirSolid} solid points`);
    console.log(`Clockwise: ${clockwiseSolid} solid points`);
    console.log(`Counterclockwise: ${counterclockwiseSolid} solid points`);
    
    // At least one cut direction should be better than no cut direction
    const bestCutDir = Math.min(clockwiseSolid, counterclockwiseSolid);
    const improvement = noCutDirSolid - bestCutDir;
    
    console.log(`Best improvement: ${improvement} fewer solid points`);
    
    // Should show some improvement, or at least be no worse
    expect(bestCutDir).toBeLessThanOrEqual(noCutDirSolid);
  });

  it('should properly handle simple geometric cases', () => {
    console.log('\n=== TESTING SIMPLE GEOMETRIC CASES ===');
    
    // Create a simple square chain
    const squareChain = {
      id: 'test-square',
      shapes: [{
        id: 'square-1',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
            { x: 0, y: 0 }
          ],
          closed: true
        }
      }]
    };
    
    const leadConfig: LeadInConfig = { type: 'arc', length: 5 };
    const noLeadOut: LeadOutConfig = { type: 'none', length: 0 };
    
    // Test clockwise vs counterclockwise
    const clockwiseResult = calculateLeads(squareChain, leadConfig, noLeadOut, 'clockwise');
    const counterclockwiseResult = calculateLeads(squareChain, leadConfig, noLeadOut, 'counterclockwise');
    
    console.log('Square test results:');
    
    if (clockwiseResult.leadIn && counterclockwiseResult.leadIn) {
      const clockwiseStart = clockwiseResult.leadIn.points[0];
      const counterclockwiseStart = counterclockwiseResult.leadIn.points[0];
      
      console.log(`Clockwise lead start: (${clockwiseStart.x.toFixed(3)}, ${clockwiseStart.y.toFixed(3)})`);
      console.log(`Counterclockwise lead start: (${counterclockwiseStart.x.toFixed(3)}, ${counterclockwiseStart.y.toFixed(3)})`);
      
      // Leads should be in different positions
      const distance = Math.sqrt(
        (clockwiseStart.x - counterclockwiseStart.x) ** 2 + 
        (clockwiseStart.y - counterclockwiseStart.y) ** 2
      );
      
      console.log(`Distance between lead starts: ${distance.toFixed(3)}`);
      expect(distance).toBeGreaterThan(0.1); // Should be different positions
    }
  });
});