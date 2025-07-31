import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from './lead-calculation';

describe('Lead Solid Area Verification - Catch the Error', () => {
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

  it('SHOULD FAIL: Lead points must NOT be in solid area of ADLER.dxf Part 5', async () => {
    console.log('=== TESTING ADLER.DXF PART 5 LEAD SOLID AREA VIOLATION ===');
    
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
    
    console.log(`Part 5 has shell chain ${part5.shell.chain.id} with ${part5.shell.chain.shapes.length} shapes`);
    console.log(`Part 5 has ${part5.holes.length} holes`);
    
    // Test lead generation for the shell chain
    const leadIn: LeadInConfig = { type: 'arc', length: 10 }; // Standard lead length
    const leadOut: LeadOutConfig = { type: 'none', length: 0 };
    
    const result = calculateLeads(part5.shell.chain, leadIn, leadOut, 'clockwise', part5);
    
    expect(result.leadIn).toBeDefined();
    const leadPoints = result.leadIn!.points;
    console.log(`Generated ${leadPoints.length} lead-in points`);
    
    // Get the connection point (should be on boundary, not in solid area)
    const connectionPoint = leadPoints[leadPoints.length - 1];
    console.log(`Connection point: (${connectionPoint.x.toFixed(3)}, ${connectionPoint.y.toFixed(3)})`);
    
    // Check each lead point (excluding connection point)
    let pointsInSolidArea = 0;
    let totalCheckedPoints = 0;
    
    console.log('\nChecking lead points for solid area violations:');
    
    for (let i = 0; i < leadPoints.length; i++) {
      const point = leadPoints[i];
      
      // Skip connection point as it's on the boundary
      if (i === leadPoints.length - 1) {
        console.log(`Point ${i}: (${point.x.toFixed(3)}, ${point.y.toFixed(3)}) - SKIPPED (connection point)`);
        continue;
      }
      
      const inSolidArea = isPointInSolidArea(point, part5);
      totalCheckedPoints++;
      
      if (inSolidArea) {
        pointsInSolidArea++;
      }
      
      console.log(`Point ${i}: (${point.x.toFixed(3)}, ${point.y.toFixed(3)}) - ${inSolidArea ? 'INSIDE SOLID AREA ❌' : 'Outside solid area ✅'}`);
    }
    
    console.log(`\nRESULT: ${pointsInSolidArea}/${totalCheckedPoints} lead points are in solid area`);
    
    // Log warnings if any
    if (result.warnings && result.warnings.length > 0) {
      console.log('\nWarnings generated:');
      result.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`);
      });
    } else {
      console.log('\nNo warnings generated');
    }
    
    // THIS TEST SHOULD FAIL if leads are still inside solid areas
    // The expectation is that NO lead points should be in solid areas
    expect(pointsInSolidArea).toBe(0); // This should fail and catch the error
  });

  it('Debug: Verify part 5 geometry and chain association', async () => {
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    const partResult = await detectParts(chains);
    const part5 = partResult.parts[4];
    
    if (!part5) return;
    
    console.log('\n=== PART 5 GEOMETRY DEBUG ===');
    console.log(`Shell chain ID: ${part5.shell.chain.id}`);
    console.log(`Shell chain shapes: ${part5.shell.chain.shapes.length}`);
    
    // Get shell geometry details
    const shellShape = part5.shell.chain.shapes[0];
    console.log(`Shell shape type: ${shellShape.type}`);
    
    if (shellShape.type === 'polyline') {
      const polylineGeom = shellShape.geometry as any;
      console.log(`Shell polyline points: ${polylineGeom.points.length}`);
      console.log(`First point: (${polylineGeom.points[0].x.toFixed(3)}, ${polylineGeom.points[0].y.toFixed(3)})`);
      console.log(`Last point: (${polylineGeom.points[polylineGeom.points.length - 1].x.toFixed(3)}, ${polylineGeom.points[polylineGeom.points.length - 1].y.toFixed(3)})`);
      
      // Calculate bounding box
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      polylineGeom.points.forEach((p: any) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      });
      console.log(`Shell bounding box: (${minX.toFixed(3)}, ${minY.toFixed(3)}) to (${maxX.toFixed(3)}, ${maxY.toFixed(3)})`);
    }
    
    // Check holes
    console.log(`\nHoles: ${part5.holes.length}`);
    part5.holes.forEach((hole: any, i: number) => {
      console.log(`Hole ${i + 1} chain ID: ${hole.chain.id}`);
      console.log(`Hole ${i + 1} shapes: ${hole.chain.shapes.length}`);
    });
  });
});