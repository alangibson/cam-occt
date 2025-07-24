import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { normalizeChain } from './chain-normalization';

// We need to test the face creation process directly
const openCascadeModule = import('opencascade.js');

describe('Debug Identical Chains Face Creation', () => {
  it('should debug why identical chains produce different face creation results', async () => {
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
    
    // Find the specific chains
    const chain7 = normalizedChains.find(chain => chain.id === 'chain-7');
    const chain13 = normalizedChains.find(chain => chain.id === 'chain-13');
    
    expect(chain7).toBeDefined();
    expect(chain13).toBeDefined();
    
    console.log(`\n=== DETAILED GEOMETRY COMPARISON ===`);
    
    // Let's examine the actual coordinates of each shape in both chains
    console.log(`\n--- CHAIN-7 DETAILED GEOMETRY ---`);
    chain7!.shapes.forEach((shape, index) => {
      if (shape.type === 'line') {
        console.log(`Shape ${index + 1} (line): (${shape.geometry.start.x.toFixed(6)}, ${shape.geometry.start.y.toFixed(6)}) → (${shape.geometry.end.x.toFixed(6)}, ${shape.geometry.end.y.toFixed(6)})`);
      } else if (shape.type === 'polyline') {
        const points = shape.geometry.points;
        console.log(`Shape ${index + 1} (polyline): ${points.length} points from (${points[0].x.toFixed(6)}, ${points[0].y.toFixed(6)}) to (${points[points.length-1].x.toFixed(6)}, ${points[points.length-1].y.toFixed(6)})`);
      }
    });
    
    console.log(`\n--- CHAIN-13 DETAILED GEOMETRY ---`);
    chain13!.shapes.forEach((shape, index) => {
      if (shape.type === 'line') {
        console.log(`Shape ${index + 1} (line): (${shape.geometry.start.x.toFixed(6)}, ${shape.geometry.start.y.toFixed(6)}) → (${shape.geometry.end.x.toFixed(6)}, ${shape.geometry.end.y.toFixed(6)})`);
      } else if (shape.type === 'polyline') {
        const points = shape.geometry.points;
        console.log(`Shape ${index + 1} (polyline): ${points.length} points from (${points[0].x.toFixed(6)}, ${points[0].y.toFixed(6)}) to (${points[points.length-1].x.toFixed(6)}, ${points[points.length-1].y.toFixed(6)})`);
      }
    });
    
    // Check if the actual coordinates differ
    console.log(`\n--- COORDINATE COMPARISON ---`);
    let coordinatesDiffer = false;
    
    for (let i = 0; i < Math.min(chain7!.shapes.length, chain13!.shapes.length); i++) {
      const shape7 = chain7!.shapes[i];
      const shape13 = chain13!.shapes[i];
      
      if (shape7.type !== shape13.type) {
        console.log(`Shape ${i + 1}: Different types - chain-7: ${shape7.type}, chain-13: ${shape13.type}`);
        coordinatesDiffer = true;
        continue;
      }
      
      if (shape7.type === 'line' && shape13.type === 'line') {
        const dx1 = Math.abs(shape7.geometry.start.x - shape13.geometry.start.x);
        const dy1 = Math.abs(shape7.geometry.start.y - shape13.geometry.start.y);
        const dx2 = Math.abs(shape7.geometry.end.x - shape13.geometry.end.x);
        const dy2 = Math.abs(shape7.geometry.end.y - shape13.geometry.end.y);
        
        if (dx1 > 1e-6 || dy1 > 1e-6 || dx2 > 1e-6 || dy2 > 1e-6) {
          console.log(`Shape ${i + 1} (line): Coordinates differ`);
          console.log(`  Chain-7: (${shape7.geometry.start.x.toFixed(6)}, ${shape7.geometry.start.y.toFixed(6)}) → (${shape7.geometry.end.x.toFixed(6)}, ${shape7.geometry.end.y.toFixed(6)})`);
          console.log(`  Chain-13: (${shape13.geometry.start.x.toFixed(6)}, ${shape13.geometry.start.y.toFixed(6)}) → (${shape13.geometry.end.x.toFixed(6)}, ${shape13.geometry.end.y.toFixed(6)})`);
          coordinatesDiffer = true;
        }
      } else if (shape7.type === 'polyline' && shape13.type === 'polyline') {
        const points7 = shape7.geometry.points;
        const points13 = shape13.geometry.points;
        
        if (points7.length !== points13.length) {
          console.log(`Shape ${i + 1} (polyline): Different point counts - chain-7: ${points7.length}, chain-13: ${points13.length}`);
          coordinatesDiffer = true;
        } else {
          for (let j = 0; j < points7.length; j++) {
            const dx = Math.abs(points7[j].x - points13[j].x);
            const dy = Math.abs(points7[j].y - points13[j].y);
            
            if (dx > 1e-6 || dy > 1e-6) {
              console.log(`Shape ${i + 1} (polyline) point ${j + 1}: Coordinates differ`);
              console.log(`  Chain-7: (${points7[j].x.toFixed(6)}, ${points7[j].y.toFixed(6)})`);
              console.log(`  Chain-13: (${points13[j].x.toFixed(6)}, ${points13[j].y.toFixed(6)})`);
              coordinatesDiffer = true;
              break;
            }
          }
        }
      }
    }
    
    console.log(`\n--- ANALYSIS RESULT ---`);
    if (!coordinatesDiffer) {
      console.log(`✅ Chains have IDENTICAL coordinates - this is a true bug in OpenCascade face creation!`);
      console.log(`The geometric operations are not deterministic for identical input.`);
    } else {
      console.log(`❌ Chains have DIFFERENT coordinates - they are not actually identical.`);
      console.log(`The difference in containment results is due to different geometry, not a bug.`);
    }
    
  }, 15000);
});