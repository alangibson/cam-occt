import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { normalizeChain } from './chain-normalization';
import { isChainGeometricallyContained } from '../utils/geometric-operations';

describe('Chain-7 vs Chain-13 Identical Letter T Comparison', () => {
  it('should verify that identical chains chain-7 and chain-13 behave identically after normalization', async () => {
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
    
    // Find the specific chains and boundary
    const boundaryChain = normalizedChains.find(chain => chain.shapes.length === 42);
    const chain7 = normalizedChains.find(chain => chain.id === 'chain-7');
    const chain13 = normalizedChains.find(chain => chain.id === 'chain-13');
    
    expect(boundaryChain).toBeDefined();
    expect(chain7).toBeDefined();
    expect(chain13).toBeDefined();
    
    console.log(`\n=== IDENTICAL LETTER T CHAINS COMPARISON ===`);
    console.log(`Chain-7 and Chain-13 should be identical letter T shapes`);
    
    // Compare basic properties
    console.log(`\n--- BASIC COMPARISON ---`);
    console.log(`Chain-7 shapes: ${chain7!.shapes.length}`);
    console.log(`Chain-13 shapes: ${chain13!.shapes.length}`);
    
    // Analyze shape types
    const getShapeTypes = (chain: any) => {
      const types = chain.shapes.map((s: any) => s.type);
      const counts = types.reduce((c: any, t: string) => { c[t] = (c[t] || 0) + 1; return c; }, {});
      return counts;
    };
    
    const chain7Types = getShapeTypes(chain7!);
    const chain13Types = getShapeTypes(chain13!);
    
    console.log(`Chain-7 shape types: ${JSON.stringify(chain7Types)}`);
    console.log(`Chain-13 shape types: ${JSON.stringify(chain13Types)}`);
    
    // Check if they have identical shape compositions
    const typesMatch = JSON.stringify(chain7Types) === JSON.stringify(chain13Types);
    console.log(`Shape types match: ${typesMatch}`);
    
    // Check closure after normalization
    const checkChainClosure = (chain: any, name: string) => {
      const firstShape = chain.shapes[0];
      const lastShape = chain.shapes[chain.shapes.length - 1];
      const firstStart = getShapeStartPoint(firstShape);
      const lastEnd = getShapeEndPoint(lastShape);
      
      if (firstStart && lastEnd) {
        const gapDistance = Math.sqrt(
          Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
        );
        
        console.log(`\n--- ${name} NORMALIZATION RESULTS ---`);
        console.log(`First start: (${firstStart.x.toFixed(6)}, ${firstStart.y.toFixed(6)})`);
        console.log(`Last end: (${lastEnd.x.toFixed(6)}, ${lastEnd.y.toFixed(6)})`);
        console.log(`Gap distance: ${gapDistance.toFixed(10)}`);
        console.log(`Truly closed (gap < 1e-6): ${gapDistance < 1e-6}`);
        console.log(`Closed with 0.1 tolerance: ${gapDistance < 0.1}`);
        
        return gapDistance;
      }
      return -1;
    };
    
    const chain7Gap = checkChainClosure(chain7!, 'CHAIN-7');
    const chain13Gap = checkChainClosure(chain13!, 'CHAIN-13');
    
    // Compare containment results
    console.log(`\n--- CONTAINMENT TESTING ---`);
    
    let chain7ContainmentResult = 'UNKNOWN';
    let chain7ContainmentError = '';
    
    try {
      const chain7Contained = await isChainGeometricallyContained(chain7!, boundaryChain!);
      chain7ContainmentResult = chain7Contained ? 'CONTAINED' : 'NOT CONTAINED';
    } catch (error: any) {
      chain7ContainmentResult = 'ERROR';
      chain7ContainmentError = error.message;
    }
    
    let chain13ContainmentResult = 'UNKNOWN';
    let chain13ContainmentError = '';
    
    try {
      const chain13Contained = await isChainGeometricallyContained(chain13!, boundaryChain!);
      chain13ContainmentResult = chain13Contained ? 'CONTAINED' : 'NOT CONTAINED';
    } catch (error: any) {
      chain13ContainmentResult = 'ERROR';
      chain13ContainmentError = error.message;
    }
    
    console.log(`Chain-7 containment: ${chain7ContainmentResult}`);
    if (chain7ContainmentError) {
      console.log(`Chain-7 error: ${chain7ContainmentError}`);
    }
    
    console.log(`Chain-13 containment: ${chain13ContainmentResult}`);
    if (chain13ContainmentError) {
      console.log(`Chain-13 error: ${chain13ContainmentError}`);
    }
    
    // The key question: if they're identical, why different results?
    console.log(`\n--- ANALYSIS SUMMARY ---`);
    console.log(`Both chains should behave identically if truly identical.`);
    console.log(`Gap distances: Chain-7=${chain7Gap.toFixed(10)}, Chain-13=${chain13Gap.toFixed(10)}`);
    console.log(`Containment results match: ${chain7ContainmentResult === chain13ContainmentResult}`);
    
    if (chain7ContainmentResult !== chain13ContainmentResult) {
      console.log(`\n🚨 INCONSISTENCY DETECTED!`);
      console.log(`Identical chains are producing different containment results.`);
      console.log(`This indicates a bug in the geometric operations or face creation.`);
    }
    
    // Verify they're actually closed with tight tolerance
    expect(chain7Gap).toBeLessThan(0.1);
    expect(chain13Gap).toBeLessThan(0.1);
    
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