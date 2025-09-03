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

describe('Lead Solid Area Verification - Catch the Error', () => {
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
      } else if (shape.type === 'arc') {
        // Sample points along the arc
        const arc: import("$lib/types/geometry").Arc = shape.geometry;
        const segments = Math.max(8, Math.ceil(Math.abs(arc.endAngle - arc.startAngle) * arc.radius / 2));
        for (let i: number = 0; i < segments; i++) {
          const t: number = i / segments;
          const angle: number = arc.startAngle + (arc.endAngle - arc.startAngle) * t;
          points.push({
            x: arc.center.x + arc.radius * Math.cos(angle),
            y: arc.center.y + arc.radius * Math.sin(angle)
          });
        }
      } else if (shape.type === 'circle') {
        // Sample points around the circle
        const circle: import("$lib/types/geometry").Circle = shape.geometry;
        const segments = Math.max(16, Math.ceil(2 * Math.PI * circle.radius / 2));
        for (let i: number = 0; i < segments; i++) {
          const angle: number = (2 * Math.PI * i) / segments;
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


  it('Debug: Verify part 5 geometry and chain association', async () => {
    const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    const parsed = await parseDXF(dxfContent, { decomposePolylines: true });
    const chains = detectShapeChains(parsed.shapes, { tolerance: 0.1 });
    const partResult = await detectParts(chains);
    const part5 = partResult.parts[4];
    
    if (!part5) return;
    
    
    // Get shell geometry details
    const shellShape = part5.shell.chain.shapes[0];
    
    if (shellShape.type === 'polyline') {
      const polylineGeom = shellShape.geometry as Polyline;
      
      // Calculate bounding box
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      const points = polylineToPoints(polylineGeom);
      points.forEach((p: any) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      });
    }
    
    // Check holes
    part5.holes.forEach((hole: any, i: number) => {
    });
  });
});