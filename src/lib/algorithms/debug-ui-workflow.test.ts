/**
 * Debug Test: UI Workflow Reproduction
 * 
 * This test reproduces the EXACT same workflow as the UI to identify
 * why the UI shows 6 parts with 0 holes while tests show 4 parts with 2 holes.
 */

import { describe, it, expect } from 'vitest';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import fs from 'fs';
import path from 'path';

async function debugFileWorkflow(fileName: string, expectedParts: number, expectedHoles: number) {
  console.log(`\n=== DEBUGGING ${fileName} ===`);
  
  // Read the DXF file
  const dxfPath = path.join(process.cwd(), 'tests/dxf', fileName);
  const dxfContent = fs.readFileSync(dxfPath, 'utf8');
  
  console.log(`File size: ${dxfContent.length} bytes`);
  
  // Step 1: Parse DXF (EXACT same as UI - without decomposePolylines initially)
  console.log('\n--- Step 1: Initial DXF Parsing (UI Mode) ---');
  const parsedInitial = await parseDXF(dxfContent, { decomposePolylines: false });
  console.log(`Initial parse: ${parsedInitial.shapes.length} shapes`);
  
  // Log shape types
  const shapeTypeCounts = parsedInitial.shapes.reduce((acc, shape) => {
    acc[shape.type] = (acc[shape.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('Shape types (initial):', shapeTypeCounts);
  
  // Step 2: Parse DXF with polyline decomposition (like tests)
  console.log('\n--- Step 2: DXF Parsing with Polyline Decomposition (Test Mode) ---');
  const parsedDecomposed = await parseDXF(dxfContent, { decomposePolylines: true });
  console.log(`Decomposed parse: ${parsedDecomposed.shapes.length} shapes`);
  
  // Log shape types after decomposition
  const shapeTypeCountsDecomposed = parsedDecomposed.shapes.reduce((acc, shape) => {
    acc[shape.type] = (acc[shape.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('Shape types (decomposed):', shapeTypeCountsDecomposed);
  
  // Step 3: Chain detection on both modes
  const tolerance = 0.1; // Same as tests
  
  console.log('\n--- Step 3a: Chain Detection (UI Mode - No Decomposition) ---');
  const chainsInitial = detectShapeChains(parsedInitial.shapes, { tolerance });
  console.log(`Chains detected (initial): ${chainsInitial.length}`);
  
  chainsInitial.forEach((chain, i) => {
    console.log(`  Chain ${i + 1}: ${chain.shapes.length} shapes, ID: ${chain.id}`);
  });
  
  console.log('\n--- Step 3b: Chain Detection (Test Mode - With Decomposition) ---');
  const chainsDecomposed = detectShapeChains(parsedDecomposed.shapes, { tolerance });
  console.log(`Chains detected (decomposed): ${chainsDecomposed.length}`);
  
  chainsDecomposed.forEach((chain, i) => {
    console.log(`  Chain ${i + 1}: ${chain.shapes.length} shapes, ID: ${chain.id}`);
  });
  
  // Step 4: Part detection on both modes
  console.log('\n--- Step 4a: Part Detection (UI Mode) ---');
  const partsInitial = await detectParts(chainsInitial);
  console.log(`Parts detected (initial): ${partsInitial.parts.length}`);
  console.log(`Warnings (initial): ${partsInitial.warnings.length}`);
  
  let totalHolesInitial = 0;
  partsInitial.parts.forEach((part, i) => {
    console.log(`  Part ${i + 1}: Shell with ${part.holes.length} holes`);
    totalHolesInitial += part.holes.length;
  });
  console.log(`Total holes (initial): ${totalHolesInitial}`);
  
  if (partsInitial.warnings.length > 0) {
    console.log('Warnings (initial):');
    partsInitial.warnings.forEach((warning, i) => {
      console.log(`  ${i + 1}. ${warning.message}`);
    });
  }
  
  console.log('\n--- Step 4b: Part Detection (Test Mode) ---');
  const partsDecomposed = await detectParts(chainsDecomposed);
  console.log(`Parts detected (decomposed): ${partsDecomposed.parts.length}`);
  console.log(`Warnings (decomposed): ${partsDecomposed.warnings.length}`);
  
  let totalHolesDecomposed = 0;
  partsDecomposed.parts.forEach((part, i) => {
    console.log(`  Part ${i + 1}: Shell with ${part.holes.length} holes`);
    totalHolesDecomposed += part.holes.length;
  });
  console.log(`Total holes (decomposed): ${totalHolesDecomposed}`);
  
  if (partsDecomposed.warnings.length > 0) {
    console.log('Warnings (decomposed):');
    partsDecomposed.warnings.forEach((warning, i) => {
      console.log(`  ${i + 1}. ${warning.message}`);
    });
  }
  
  // Step 5: Analyze the differences
  console.log('\n--- Step 5: Analysis of Differences ---');
  console.log(`UI Mode (no decomposition): ${partsInitial.parts.length} parts, ${totalHolesInitial} holes`);
  console.log(`Test Mode (with decomposition): ${partsDecomposed.parts.length} parts, ${totalHolesDecomposed} holes`);
  console.log(`Expected: ${expectedParts} parts, ${expectedHoles} holes`);
  
  // Check if the issue is in polyline decomposition
  const polylineCount = parsedInitial.shapes.filter(s => s.type === 'polyline').length;
  const lineCountAfterDecomp = parsedDecomposed.shapes.filter(s => s.type === 'line').length;
  const lineCountInitial = parsedInitial.shapes.filter(s => s.type === 'line').length;
  
  console.log(`\nPolyline analysis:`);
  console.log(`  Initial polylines: ${polylineCount}`);
  console.log(`  Initial lines: ${lineCountInitial}`);
  console.log(`  Lines after decomposition: ${lineCountAfterDecomp}`);
  console.log(`  Lines created by decomposition: ${lineCountAfterDecomp - lineCountInitial}`);
  
  // Detailed chain analysis
  console.log('\n--- Step 6: Detailed Chain Analysis ---');
  
  // Check for closed vs open chains in both modes
  const analyzeChains = (chains: any[], mode: string) => {
    console.log(`\n${mode} chains analysis:`);
    let closedCount = 0;
    let openCount = 0;
    
    chains.forEach((chain, i) => {
      const isClosed = isChainClosed(chain);
      console.log(`  Chain ${i + 1} (${chain.id}): ${chain.shapes.length} shapes, ${isClosed ? 'CLOSED' : 'OPEN'}`);
      if (isClosed) closedCount++;
      else openCount++;
    });
    
    console.log(`  Summary: ${closedCount} closed, ${openCount} open chains`);
    return { closedCount, openCount };
  };
  
  const initialStats = analyzeChains(chainsInitial, 'Initial');
  const decomposedStats = analyzeChains(chainsDecomposed, 'Decomposed');
  
  // Return results for assertion
  return {
    initial: {
      parts: partsInitial.parts.length,
      holes: totalHolesInitial,
      chains: chainsInitial.length,
      closedChains: initialStats.closedCount
    },
    decomposed: {
      parts: partsDecomposed.parts.length,
      holes: totalHolesDecomposed,
      chains: chainsDecomposed.length,
      closedChains: decomposedStats.closedCount
    },
    rawShapeCount: {
      initial: parsedInitial.shapes.length,
      decomposed: parsedDecomposed.shapes.length
    }
  };
}

// Helper function to check if chain is closed (copied from part-detection.ts)
function isChainClosed(chain: any): boolean {
  if (chain.shapes.length === 0) return false;
  
  const firstShape = chain.shapes[0];
  const lastShape = chain.shapes[chain.shapes.length - 1];
  
  const firstStart = getShapeStartPoint(firstShape);
  const lastEnd = getShapeEndPoint(lastShape);
  
  if (!firstStart || !lastEnd) return false;
  
  const tolerance = 0.01;
  const distance = Math.sqrt(
    Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
  );
  
  return distance < tolerance;
}

function getShapeStartPoint(shape: any): any {
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
      const circle = shape.geometry;
      return { x: circle.center.x + circle.radius, y: circle.center.y };
    default:
      return null;
  }
}

function getShapeEndPoint(shape: any): any {
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
      const circle = shape.geometry;
      return { x: circle.center.x + circle.radius, y: circle.center.y };
    default:
      return null;
  }
}

describe('Debug UI Workflow vs Test Workflow', () => {
  it('should debug 1997.dxf discrepancy', async () => {
    const results = await debugFileWorkflow('1997.dxf', 4, 2);
    
    console.log('\n=== FINAL ANALYSIS ===');
    console.log(`The discrepancy appears to be: ${results.initial.parts !== results.decomposed.parts ? 'CONFIRMED' : 'NOT FOUND'}`);
    
    if (results.initial.parts !== results.decomposed.parts) {
      console.log('\nROOT CAUSE ANALYSIS:');
      console.log(`1. UI uses parseDXF without decomposePolylines: ${results.initial.parts} parts`);
      console.log(`2. Tests use parseDXF WITH decomposePolylines: ${results.decomposed.parts} parts`);
      console.log(`3. Raw shape difference: ${results.rawShapeCount.initial} vs ${results.rawShapeCount.decomposed}`);
      console.log(`4. Chain difference: ${results.initial.chains} vs ${results.decomposed.chains}`);
      console.log(`5. Closed chain difference: ${results.initial.closedChains} vs ${results.decomposed.closedChains}`);
      
      console.log('\nRECOMMENDATION:');
      if (results.decomposed.parts === 4 && results.decomposed.holes === 2) {
        console.log('The UI should use decomposePolylines: true to match test expectations');
      } else {
        console.log('Further investigation needed - both modes show unexpected results');
      }
    }
    
    // The test expectation should match what the UI actually does vs what tests expect
    expect(results).toBeDefined();
  }, 30000);
  
  it('should debug ADLER.dxf', async () => {
    const results = await debugFileWorkflow('ADLER.dxf', 0, 0); // We don't know expected values yet
    
    console.log('\n=== ADLER.DXF ANALYSIS ===');
    console.log(`UI Mode: ${results.initial.parts} parts, ${results.initial.holes} holes`);
    console.log(`Test Mode: ${results.decomposed.parts} parts, ${results.decomposed.holes} holes`);
    
    expect(results).toBeDefined();
  }, 30000);
});