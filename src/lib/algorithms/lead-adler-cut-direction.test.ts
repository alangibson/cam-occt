import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection/chain-detection';
import { detectParts } from './part-detection';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from './lead-calculation';
import { CutDirection, LeadType } from '../types/direction';
import { polylineToPoints } from '../geometry/polyline';
import type { Polyline } from '../types/geometry';

describe('ADLER Part 5 Cut Direction Analysis', () => {
  // Helper to check if a point is inside a polygon using ray casting
  function isPointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
    let inside = false;
    const x: number = point.x;
    const y: number = point.y;
    
    for (let i: number = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
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
        points.push(...polylineToPoints(shape.geometry));
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
    
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    const partResult = await detectParts(chains);
    const part5 = partResult.parts[4];
    
    if (!part5) return;
    
    
    // Test different lead lengths with both cut directions
    const testLengths = [2, 5, 8, 10, 15];
    const cutDirections: ('clockwise' | 'counterclockwise')[] = ['clockwise', 'counterclockwise'];
    
    
    for (const length of testLengths) {
      const leadIn: LeadInConfig = { type: LeadType.ARC, length };
      const leadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };
      
      let results: Array<{ direction: string; solidPoints: number; warnings: number }> = [];
      
      for (const cutDirection of cutDirections) {
        const result = calculateLeads(part5.shell.chain, leadIn, leadOut, cutDirection, part5);
        
        let solidPoints = 0;
        if (result.leadIn) {
          for (let i: number = 0; i < result.leadIn.points.length - 1; i++) {
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
      
    }
    
    // Test with very short leads
    const shortResult = calculateLeads(part5.shell.chain, { type: LeadType.ARC, length: 1 }, { type: LeadType.NONE, length: 0 }, CutDirection.COUNTERCLOCKWISE, part5);
    
    if (shortResult.leadIn) {
      let solidPoints = 0;
      for (let i: number = 0; i < shortResult.leadIn.points.length - 1; i++) {
        if (isPointInSolidArea(shortResult.leadIn.points[i], part5)) {
          solidPoints++;
        }
      }
      
      if (solidPoints === 0) {
      }
    }
  });

  it('should analyze Part 5 geometry for lead placement insights', async () => {
    
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
      const points = polylineToPoints(shellShape.geometry as Polyline);
      
      
      // Find the nearest edge of the bounding box to understand constraints
      const bbox = part5.shell.boundingBox;
      const connectionPoint = points[0];
      
      const distToLeft = connectionPoint.x - bbox.minX;
      const distToRight = bbox.maxX - connectionPoint.x;
      const distToBottom = connectionPoint.y - bbox.minY;
      const distToTop = bbox.maxY - connectionPoint.y;
      
      
      const minDist = Math.min(distToLeft, distToRight, distToBottom, distToTop);
      
      if (minDist < 15) {
      }
    }
    
    // Analyze hole position relative to connection point
    if (part5.holes.length > 0) {
      const holeShape = part5.holes[0].chain.shapes[0];
      if (holeShape.type === 'polyline') {
        const holePoints = polylineToPoints(holeShape.geometry as Polyline);
        const holeCenter = {
          x: holePoints.reduce((sum: number, p: any) => sum + p.x, 0) / holePoints.length,
          y: holePoints.reduce((sum: number, p: any) => sum + p.y, 0) / holePoints.length
        };
        
        const connectionPoint = polylineToPoints(shellShape.geometry as Polyline)[0];
        const distToHole = Math.sqrt(
          (connectionPoint.x - holeCenter.x) ** 2 + 
          (connectionPoint.y - holeCenter.y) ** 2
        );
        
      }
    }
  });
});