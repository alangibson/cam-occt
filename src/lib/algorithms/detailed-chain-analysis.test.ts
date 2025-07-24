import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { normalizeChain } from './chain-normalization';
import { isChainGeometricallyContained } from '../utils/geometric-operations';

// Import the internal face creation function for testing
const openCascadeModule = import('opencascade.js');

describe('Detailed Chain Analysis - Root Cause Investigation', () => {
  it('should analyze why chain-7 & chain-9 work but chain-8 fails', async () => {
    // Load the DXF file
    const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // Parse DXF
    const drawing = await parseDXF(dxfContent, {
      decomposePolylines: true,
      translateToPositiveQuadrant: true,
      squashLayers: true
    });

    // Detect chains
    const tolerance = 1.0;
    const chains = detectShapeChains(drawing.shapes, { tolerance });
    
    // Normalize chains
    const normalizedChains = chains.map(chain => normalizeChain(chain));
    
    // Find the specific chains we're investigating
    const boundaryChain = normalizedChains.find(chain => chain.shapes.length === 42);
    const chain7 = normalizedChains.find(chain => chain.id === 'chain-7');
    const chain8 = normalizedChains.find(chain => chain.id === 'chain-8');
    const chain9 = normalizedChains.find(chain => chain.id === 'chain-9');
    
    expect(boundaryChain).toBeDefined();
    expect(chain7).toBeDefined();
    expect(chain8).toBeDefined();
    expect(chain9).toBeDefined();
    
    console.log(`\n=== DETAILED CHAIN ANALYSIS ===`);
    
    // Analyze each chain's properties
    const chainsToAnalyze = [
      { name: 'chain-7 (WORKS)', chain: chain7!, expected: 'CONTAINED' },
      { name: 'chain-8 (FAILS)', chain: chain8!, expected: 'NOT CONTAINED' },
      { name: 'chain-9 (WORKS)', chain: chain9!, expected: 'CONTAINED' }
    ];
    
    for (const { name, chain, expected } of chainsToAnalyze) {
      console.log(`\n--- ${name} ---`);
      console.log(`Shapes: ${chain.shapes.length}`);
      
      // Analyze gap distance after normalization
      const firstShape = chain.shapes[0];
      const lastShape = chain.shapes[chain.shapes.length - 1];
      const firstStart = getShapeStartPoint(firstShape);
      const lastEnd = getShapeEndPoint(lastShape);
      
      if (firstStart && lastEnd) {
        const gapDistance = Math.sqrt(
          Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
        );
        console.log(`Gap distance: ${gapDistance.toFixed(6)}`);
        console.log(`Is closed (gap < 0.1): ${gapDistance < 0.1}`);
        console.log(`First start: (${firstStart.x.toFixed(2)}, ${firstStart.y.toFixed(2)})`);
        console.log(`Last end: (${lastEnd.x.toFixed(2)}, ${lastEnd.y.toFixed(2)})`);
      }
      
      // Analyze shape types in the chain
      const shapeTypes = chain.shapes.map(shape => shape.type);
      const shapeTypeCounts = shapeTypes.reduce((counts, type) => {
        counts[type] = (counts[type] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
      
      console.log(`Shape types: ${Object.entries(shapeTypeCounts).map(([type, count]) => `${type}:${count}`).join(', ')}`);
      
      // Test face creation specifically for this chain
      let faceCreated = false;
      let faceCreationError = '';
      
      try {
        // We can't directly access convertChainToFace, so we test containment
        // If containment works without error, face creation succeeded
        await isChainGeometricallyContained(chain, boundaryChain!);
        faceCreated = true;
      } catch (error: any) {
        faceCreationError = error.message;
        if (error.message.includes('Failed to create faces')) {
          faceCreated = false;
        } else {
          // Face was created but boolean operation failed
          faceCreated = true;
        }
      }
      
      console.log(`Face creation: ${faceCreated ? 'SUCCESS' : 'FAILED'}`);
      if (!faceCreated) {
        console.log(`Face creation error: ${faceCreationError}`);
      }
      
      // Test actual containment
      let containmentResult = 'UNKNOWN';
      let containmentError = '';
      
      try {
        const isContained = await isChainGeometricallyContained(chain, boundaryChain!);
        containmentResult = isContained ? 'CONTAINED' : 'NOT CONTAINED';
      } catch (error: any) {
        containmentResult = 'ERROR';
        containmentError = error.message;
      }
      
      console.log(`Containment result: ${containmentResult}`);
      if (containmentError) {
        console.log(`Containment error: ${containmentError}`);
      }
      
      console.log(`Expected: ${expected}, Actual: ${containmentResult}`);
      console.log(`Match: ${expected === containmentResult ? '✅' : '❌'}`);
      
      // Analyze connectivity patterns - check if shapes are properly connected
      let connectivityIssues = 0;
      let maxGapInChain = 0;
      
      for (let i = 0; i < chain.shapes.length - 1; i++) {
        const currentEnd = getShapeEndPoint(chain.shapes[i]);
        const nextStart = getShapeStartPoint(chain.shapes[i + 1]);
        
        if (currentEnd && nextStart) {
          const gap = Math.sqrt(
            Math.pow(currentEnd.x - nextStart.x, 2) + Math.pow(currentEnd.y - nextStart.y, 2)
          );
          maxGapInChain = Math.max(maxGapInChain, gap);
          
          if (gap > 0.1) {
            connectivityIssues++;
          }
        }
      }
      
      console.log(`Max gap between sequential shapes: ${maxGapInChain.toFixed(6)}`);
      console.log(`Connectivity issues (gaps > 0.1): ${connectivityIssues}`);
    }
    
    // Compare boundary chain properties
    console.log(`\n--- BOUNDARY CHAIN (chain-5) ---`);
    console.log(`Shapes: ${boundaryChain!.shapes.length}`);
    
    const boundaryFirstStart = getShapeStartPoint(boundaryChain!.shapes[0]);
    const boundaryLastEnd = getShapeEndPoint(boundaryChain!.shapes[boundaryChain!.shapes.length - 1]);
    
    if (boundaryFirstStart && boundaryLastEnd) {
      const boundaryGap = Math.sqrt(
        Math.pow(boundaryFirstStart.x - boundaryLastEnd.x, 2) + Math.pow(boundaryFirstStart.y - boundaryLastEnd.y, 2)
      );
      console.log(`Boundary gap distance: ${boundaryGap.toFixed(6)}`);
      console.log(`Boundary is closed: ${boundaryGap < 0.1}`);
    }
    
    // Test boundary face creation
    let boundaryFaceWorks = false;
    try {
      // Test by trying containment with a known working chain
      await isChainGeometricallyContained(chain7!, boundaryChain!);
      boundaryFaceWorks = true;
    } catch (error: any) {
      if (error.message.includes('outer chain chain-5=false')) {
        boundaryFaceWorks = false;
      } else {
        boundaryFaceWorks = true;
      }
    }
    
    console.log(`Boundary face creation: ${boundaryFaceWorks ? 'SUCCESS' : 'FAILED'}`);
    
    console.log(`\n=== ANALYSIS SUMMARY ===`);
    console.log(`This analysis should reveal the specific differences between working and failing chains.`);
    
  }, 20000);
});

// Helper functions
function getShapeStartPoint(shape: any): { x: number; y: number } | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.start;
    case 'polyline':
      return shape.geometry.points.length > 0 ? shape.geometry.points[0] : null;
    case 'arc':
      const arc = shape.geometry;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle)
      };
    case 'circle':
      return {
        x: shape.geometry.center.x + shape.geometry.radius,
        y: shape.geometry.center.y
      };
    default:
      return null;
  }
}

function getShapeEndPoint(shape: any): { x: number; y: number } | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.end;
    case 'polyline':
      const points = shape.geometry.points;
      return points.length > 0 ? points[points.length - 1] : null;
    case 'arc':
      const arc = shape.geometry;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle)
      };
    case 'circle':
      return {
        x: shape.geometry.center.x + shape.geometry.radius,
        y: shape.geometry.center.y
      };
    default:
      return null;
  }
}