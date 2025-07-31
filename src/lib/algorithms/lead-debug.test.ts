import { describe, it, expect } from 'vitest';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from './lead-calculation';

describe('Lead Direction Debug', () => {
  it('should debug cut direction logic', () => {
    console.log('\n=== DEBUGGING CUT DIRECTION LOGIC ===');
    
    // Create a simple square to debug with
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
    
    console.log('\n--- Testing with no cut direction ---');
    const noneResult = calculateLeads(squareChain, leadConfig, noLeadOut, 'none', simplePart);
    if (noneResult.leadIn) {
      const start = noneResult.leadIn.points[0];
      const end = noneResult.leadIn.points[noneResult.leadIn.points.length - 1];
      console.log(`No cut dir - Start: (${start.x.toFixed(3)}, ${start.y.toFixed(3)}), End: (${end.x.toFixed(3)}, ${end.y.toFixed(3)})`);
    }
    
    console.log('\n--- Testing with clockwise cut direction ---');
    const clockwiseResult = calculateLeads(squareChain, leadConfig, noLeadOut, 'clockwise', simplePart);
    if (clockwiseResult.leadIn) {
      const start = clockwiseResult.leadIn.points[0];
      const end = clockwiseResult.leadIn.points[clockwiseResult.leadIn.points.length - 1];
      console.log(`Clockwise - Start: (${start.x.toFixed(3)}, ${start.y.toFixed(3)}), End: (${end.x.toFixed(3)}, ${end.y.toFixed(3)})`);
    }
    
    console.log('\n--- Testing with counterclockwise cut direction ---');
    const counterclockwiseResult = calculateLeads(squareChain, leadConfig, noLeadOut, 'counterclockwise', simplePart);
    if (counterclockwiseResult.leadIn) {
      const start = counterclockwiseResult.leadIn.points[0];
      const end = counterclockwiseResult.leadIn.points[counterclockwiseResult.leadIn.points.length - 1];
      console.log(`Counterclockwise - Start: (${start.x.toFixed(3)}, ${start.y.toFixed(3)}), End: (${end.x.toFixed(3)}, ${end.y.toFixed(3)})`);
    }
    
    // Test if results are different
    const results = [noneResult, clockwiseResult, counterclockwiseResult];
    const positions = results.map(r => r.leadIn ? `(${r.leadIn.points[0].x.toFixed(3)}, ${r.leadIn.points[0].y.toFixed(3)})` : 'none');
    
    console.log(`\nPositions: ${positions.join(', ')}`);
    
    // Check if they're all the same (problem) or different (good)
    const allSame = positions.every(pos => pos === positions[0]);
    console.log(`All results identical: ${allSame}`);
    
    if (allSame) {
      console.log('❌ PROBLEM: Cut direction is not affecting lead placement');
    } else {
      console.log('✅ SUCCESS: Cut direction is affecting lead placement');
    }
  });
  
  it('should test without part context', () => {
    console.log('\n=== TESTING WITHOUT PART CONTEXT ===');
    
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
    
    // Test without any part context
    console.log('\n--- Testing without part context ---');
    const noneResult = calculateLeads(squareChain, leadConfig, noLeadOut, 'none');
    const clockwiseResult = calculateLeads(squareChain, leadConfig, noLeadOut, 'clockwise');
    const counterclockwiseResult = calculateLeads(squareChain, leadConfig, noLeadOut, 'counterclockwise');
    
    const positions = [noneResult, clockwiseResult, counterclockwiseResult].map(r => 
      r.leadIn ? `(${r.leadIn.points[0].x.toFixed(3)}, ${r.leadIn.points[0].y.toFixed(3)})` : 'none'
    );
    
    console.log(`Positions without part context: ${positions.join(', ')}`);
    
    const allSame = positions.every(pos => pos === positions[0]);
    console.log(`All results identical: ${allSame}`);
    
    if (allSame) {
      console.log('❌ PROBLEM: Even without part context, cut direction has no effect');
      console.log('   This suggests the cut direction logic is not being reached');
    } else {
      console.log('✅ Cut direction works without part context');
    }
  });
});