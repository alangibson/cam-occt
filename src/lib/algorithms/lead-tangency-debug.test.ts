import { describe, it, expect } from 'vitest';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from './lead-calculation';
import type { ShapeChain } from './chain-detection';
import type { Shape } from '../../types/geometry';

describe('Lead Tangency Debug', () => {
  function createLineChain(start: { x: number; y: number }, end: { x: number; y: number }): ShapeChain {
    const shape: Shape = {
      id: 'shape1',
      type: 'line',
      geometry: { start, end },
      layer: 'layer1'
    };
    
    return {
      id: 'chain1',
      shapes: [shape]
    };
  }

  it('should debug horizontal line lead-in geometry', () => {
    // Horizontal line from (0,0) to (10,0)
    const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
    const leadIn: LeadInConfig = { type: 'arc', length: 5 };
    const leadOut: LeadOutConfig = { type: 'none', length: 0 };
    
    const result = calculateLeads(chain, leadIn, leadOut);
    
    console.log('Lead-in result:', result.leadIn);
    
    if (result.leadIn) {
      const points = result.leadIn.points;
      console.log('Lead-in points:');
      points.forEach((point, i) => {
        console.log(`  Point ${i}: (${point.x.toFixed(3)}, ${point.y.toFixed(3)})`);
      });
      
      const connectionPoint = points[points.length - 1];
      const previousPoint = points[points.length - 2];
      
      console.log(`Connection point: (${connectionPoint.x.toFixed(3)}, ${connectionPoint.y.toFixed(3)})`);
      console.log(`Previous point: (${previousPoint.x.toFixed(3)}, ${previousPoint.y.toFixed(3)})`);
      
      const leadTangentFromPoints = {
        x: connectionPoint.x - previousPoint.x,
        y: connectionPoint.y - previousPoint.y
      };
      
      console.log(`Lead tangent from points: (${leadTangentFromPoints.x.toFixed(3)}, ${leadTangentFromPoints.y.toFixed(3)})`);
      
      // Let's also calculate the theoretical arc center and tangent
      if (points.length >= 3) {
        // Use 3-point method to find arc center
        const p1 = points[0];
        const p2 = points[Math.floor(points.length / 2)];
        const p3 = connectionPoint;
        
        console.log(`Arc points for center calculation:`);
        console.log(`  P1: (${p1.x.toFixed(3)}, ${p1.y.toFixed(3)})`);
        console.log(`  P2: (${p2.x.toFixed(3)}, ${p2.y.toFixed(3)})`);
        console.log(`  P3: (${p3.x.toFixed(3)}, ${p3.y.toFixed(3)})`);
        
        // For an arc, the tangent at any point is perpendicular to the radius at that point
        // If we can find the arc center, we can calculate the theoretical tangent
        
        // Estimate arc center by finding point equidistant from p1 and p3
        const midpoint = { x: (p1.x + p3.x) / 2, y: (p1.y + p3.y) / 2 };
        const chordDir = { x: p3.x - p1.x, y: p3.y - p1.y };
        const chordLen = Math.sqrt(chordDir.x * chordDir.x + chordDir.y * chordDir.y);
        const chordNormal = { x: -chordDir.y / chordLen, y: chordDir.x / chordLen };
        
        console.log(`Chord midpoint: (${midpoint.x.toFixed(3)}, ${midpoint.y.toFixed(3)})`);
        console.log(`Chord normal: (${chordNormal.x.toFixed(3)}, ${chordNormal.y.toFixed(3)})`);
      }
      
      console.log('Expected line tangent: (1, 0)');
      
      // Calculate angle using discrete tangent
      const lineTangent = { x: 1, y: 0 };
      const dot = leadTangentFromPoints.x * lineTangent.x + leadTangentFromPoints.y * lineTangent.y;
      const magLead = Math.sqrt(leadTangentFromPoints.x * leadTangentFromPoints.x + leadTangentFromPoints.y * leadTangentFromPoints.y);
      const magLine = Math.sqrt(lineTangent.x * lineTangent.x + lineTangent.y * lineTangent.y);
      const angle = Math.acos(dot / (magLead * magLine));
      
      console.log(`Angle between tangents: ${angle} radians (${(angle * 180 / Math.PI).toFixed(1)}°)`);
    }
    
    // This is just a debug test
    expect(result.leadIn).toBeDefined();
  });
});