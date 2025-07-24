import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { normalizeChain } from './chain-normalization';

// Import the internal face creation function
const openCascadeModule = import('opencascade.js');

describe('Debug Face Creation for Small Circle Chains', () => {
  it('should debug why small circle chains fail face creation', async () => {
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
    
    // Find small circle chains (2 shapes each)
    const smallCircleChains = normalizedChains.filter(chain => chain.shapes.length === 2);
    
    console.log(`\n=== SMALL CIRCLE CHAIN ANALYSIS ===`);
    console.log(`Found ${smallCircleChains.length} small circle chains`);
    
    for (const circleChain of smallCircleChains) {
      console.log(`\nChain ${circleChain.id}:`);
      console.log(`  Shapes: ${circleChain.shapes.length}`);
      
      // Analyze the shapes in this chain
      circleChain.shapes.forEach((shape, index) => {
        console.log(`  Shape ${index + 1}: type=${shape.type}`);
        
        if (shape.type === 'arc') {
          const arc = shape.geometry;
          console.log(`    Arc center: (${arc.center.x.toFixed(2)}, ${arc.center.y.toFixed(2)})`);
          console.log(`    Arc radius: ${arc.radius.toFixed(2)}`);
          console.log(`    Arc start angle: ${arc.startAngle.toFixed(4)}`);
          console.log(`    Arc end angle: ${arc.endAngle.toFixed(4)}`);
          console.log(`    Arc clockwise: ${arc.clockwise}`);
        } else if (shape.type === 'circle') {
          const circle = shape.geometry;
          console.log(`    Circle center: (${circle.center.x.toFixed(2)}, ${circle.center.y.toFixed(2)})`);
          console.log(`    Circle radius: ${circle.radius.toFixed(2)}`);
        } else if (shape.type === 'line') {
          const line = shape.geometry;
          console.log(`    Line start: (${line.start.x.toFixed(2)}, ${line.start.y.toFixed(2)})`);
          console.log(`    Line end: (${line.end.x.toFixed(2)}, ${line.end.y.toFixed(2)})`);
        }
      });
      
      // Check closure gap
      const firstShape = circleChain.shapes[0];
      const lastShape = circleChain.shapes[circleChain.shapes.length - 1];
      const firstStart = getShapeStartPoint(firstShape);
      const lastEnd = getShapeEndPoint(lastShape);
      
      if (firstStart && lastEnd) {
        const gapDistance = Math.sqrt(
          Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
        );
        console.log(`  Gap distance: ${gapDistance.toFixed(6)}`);
        console.log(`  First start: (${firstStart.x.toFixed(2)}, ${firstStart.y.toFixed(2)})`);
        console.log(`  Last end: (${lastEnd.x.toFixed(2)}, ${lastEnd.y.toFixed(2)})`);
        
        const isClosed = gapDistance < 0.1;
        console.log(`  Is closed (gap < 0.1): ${isClosed}`);
      }
    }
    
    // Let's look at a specific failing chain in detail
    if (smallCircleChains.length > 0) {
      const testChain = smallCircleChains[0];
      console.log(`\n=== DETAILED ANALYSIS OF ${testChain.id} ===`);
      
      // Check if this is actually two arc segments that should form a circle
      if (testChain.shapes.length === 2 && 
          testChain.shapes[0].type === 'arc' && 
          testChain.shapes[1].type === 'arc') {
        
        const arc1 = testChain.shapes[0].geometry;
        const arc2 = testChain.shapes[1].geometry;
        
        console.log(`Arc 1: center=(${arc1.center.x.toFixed(2)}, ${arc1.center.y.toFixed(2)}), radius=${arc1.radius.toFixed(2)}`);
        console.log(`Arc 2: center=(${arc2.center.x.toFixed(2)}, ${arc2.center.y.toFixed(2)}), radius=${arc2.radius.toFixed(2)}`);
        
        // Check if they have the same center and radius (should be parts of the same circle)
        const centerDist = Math.sqrt(
          Math.pow(arc1.center.x - arc2.center.x, 2) + Math.pow(arc1.center.y - arc2.center.y, 2)
        );
        const radiusDiff = Math.abs(arc1.radius - arc2.radius);
        
        console.log(`Center distance: ${centerDist.toFixed(6)}`);
        console.log(`Radius difference: ${radiusDiff.toFixed(6)}`);
        
        if (centerDist < 0.01 && radiusDiff < 0.01) {
          console.log(`  -> These appear to be two halves of the same circle`);
          
          // Check angular coverage
          const arc1Coverage = Math.abs(arc1.endAngle - arc1.startAngle);
          const arc2Coverage = Math.abs(arc2.endAngle - arc2.startAngle);
          const totalCoverage = arc1Coverage + arc2Coverage;
          
          console.log(`Arc 1 coverage: ${arc1Coverage.toFixed(4)} radians (${(arc1Coverage * 180 / Math.PI).toFixed(1)} degrees)`);
          console.log(`Arc 2 coverage: ${arc2Coverage.toFixed(4)} radians (${(arc2Coverage * 180 / Math.PI).toFixed(1)} degrees)`);
          console.log(`Total coverage: ${totalCoverage.toFixed(4)} radians (${(totalCoverage * 180 / Math.PI).toFixed(1)} degrees)`);
          
          if (Math.abs(totalCoverage - 2 * Math.PI) < 0.1) {
            console.log(`  -> This should form a complete circle (2π coverage)`);
          } else {
            console.log(`  -> This does NOT form a complete circle - missing ${(2 * Math.PI - totalCoverage).toFixed(4)} radians`);
          }
        }
      }
    }
    
    expect(smallCircleChains.length).toBeGreaterThan(0);
    
  }, 10000);
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