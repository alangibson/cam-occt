import { describe, it, expect } from 'vitest';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from './lead-calculation';
import { CutDirection, LeadType } from '../types/direction';
import { createPolylineFromVertices } from '../geometry/polyline';

describe('Lead Direction Debug', () => {
  it('should debug cut direction logic', () => {
    
    // Create a simple square to debug with
    const squareVertices = [
      { x: 0, y: 0, bulge: 0 },
      { x: 10, y: 0, bulge: 0 },
      { x: 10, y: 10, bulge: 0 },
      { x: 0, y: 10, bulge: 0 },
      { x: 0, y: 0, bulge: 0 }
    ];
    
    const squareChain = {
      id: 'test-square',
      shapes: [{
        id: 'square-1',
        type: 'polyline',
        geometry: createPolylineFromVertices(squareVertices, true)
      }]
    };
    
    const leadConfig: LeadInConfig = { type: LeadType.ARC, length: 5 };
    const noLeadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };
    
    // Create a simple part context to make it a shell
    const simplePart = {
      id: 'test-part',
      shell: {
        id: 'shell-1',
        chain: squareChain,
        boundingBox: { minX: 0, maxX: 10, minY: 0, maxY: 10 }
      },
      holes: []
    };
    
    const noneResult = calculateLeads(squareChain, leadConfig, noLeadOut, CutDirection.NONE, simplePart);
    if (noneResult.leadIn) {
      const start = noneResult.leadIn.points[0];
      const end = noneResult.leadIn.points[noneResult.leadIn.points.length - 1];
    }
    
    const clockwiseResult = calculateLeads(squareChain, leadConfig, noLeadOut, CutDirection.CLOCKWISE, simplePart);
    if (clockwiseResult.leadIn) {
      const start = clockwiseResult.leadIn.points[0];
      const end = clockwiseResult.leadIn.points[clockwiseResult.leadIn.points.length - 1];
    }
    
    const counterclockwiseResult = calculateLeads(squareChain, leadConfig, noLeadOut, CutDirection.COUNTERCLOCKWISE, simplePart);
    if (counterclockwiseResult.leadIn) {
      const start = counterclockwiseResult.leadIn.points[0];
      const end = counterclockwiseResult.leadIn.points[counterclockwiseResult.leadIn.points.length - 1];
    }
    
    // Test if results are different
    const results = [noneResult, clockwiseResult, counterclockwiseResult];
    const positions = results.map(r => r.leadIn ? `(${r.leadIn.points[0].x.toFixed(3)}, ${r.leadIn.points[0].y.toFixed(3)})` : 'none');
    
    
    // Check if they're all the same (problem) or different (good)
    const allSame = positions.every(pos => pos === positions[0]);
    
    if (allSame) {
    } else {
    }
  });
  
  it('should test without part context', () => {
    
    const squareVertices = [
      { x: 0, y: 0, bulge: 0 },
      { x: 10, y: 0, bulge: 0 },
      { x: 10, y: 10, bulge: 0 },
      { x: 0, y: 10, bulge: 0 },
      { x: 0, y: 0, bulge: 0 }
    ];
    
    const squareChain = {
      id: 'test-square',
      shapes: [{
        id: 'square-1',
        type: 'polyline',
        geometry: createPolylineFromVertices(squareVertices, true)
      }]
    };
    
    const leadConfig: LeadInConfig = { type: LeadType.ARC, length: 5 };
    const noLeadOut: LeadOutConfig = { type: LeadType.NONE, length: 0 };
    
    // Test without any part context
    const noneResult = calculateLeads(squareChain, leadConfig, noLeadOut, CutDirection.NONE);
    const clockwiseResult = calculateLeads(squareChain, leadConfig, noLeadOut, CutDirection.CLOCKWISE);
    const counterclockwiseResult = calculateLeads(squareChain, leadConfig, noLeadOut, CutDirection.COUNTERCLOCKWISE);
    
    const positions = [noneResult, clockwiseResult, counterclockwiseResult].map(r => 
      r.leadIn ? `(${r.leadIn.points[0].x.toFixed(3)}, ${r.leadIn.points[0].y.toFixed(3)})` : 'none'
    );
    
    
    const allSame = positions.every(pos => pos === positions[0]);
    
    if (allSame) {
    } else {
    }
  });
});