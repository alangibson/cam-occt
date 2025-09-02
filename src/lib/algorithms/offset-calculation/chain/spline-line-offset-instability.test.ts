import { describe, it, expect } from 'vitest';
import type { Shape, Spline, Line } from '../../../types/geometry';
import { offsetShape } from '../offset/index';
import { findShapeIntersections } from '../intersect';
import { detectChainSide } from './side-detection';
import { detectShapeChains } from '../../chain-detection';
import { normalizeChain } from '../../chain-normalization';
import { createPolylineFromVertices } from '../../../geometry/polyline';

describe('Spline-Line Offset Intersection Instability', () => {
  // Exact geometries from the chain-closed test case
  const createTestSpline = (): Shape => ({
    id: 'spline1',
    type: 'spline',
    geometry: {
      controlPoints: [
        { x: 160, y: 180 },
        { x: 130, y: 170 },
        { x: 100, y: 150 },
        { x: 80, y: 120 },
        { x: 80, y: 80 }
      ],
      degree: 3,
      knots: [0, 0, 0, 0, 0.5, 1, 1, 1, 1],
      weights: [1, 1, 1, 1, 1],
      fitPoints: [],
      closed: false
    } as Spline
  });

  const createTestLine = (): Shape => ({
    id: 'line-closing',
    type: 'line',
    geometry: {
      start: { x: 80, y: 80 },
      end: { x: 100, y: 50 }
    } as Line
  });

  const createFullChain = (): Shape[] => [
    {
      id: 'line1',
      type: 'line',
      geometry: {
        start: { x: 100, y: 50 },
        end: { x: 200, y: 50 }
      } as Line
    },
    {
      id: 'arc1',
      type: 'arc',
      geometry: {
        center: { x: 200, y: 80 },
        radius: 30,
        startAngle: -Math.PI/2,
        endAngle: 0,
        clockwise: false
      }
    },
    {
      id: 'line2',
      type: 'line',
      geometry: {
        start: { x: 230, y: 80 },
        end: { x: 230, y: 150 }
      } as Line
    },
    {
      id: 'polyline1',
      type: 'polyline',
      geometry: createPolylineFromVertices([
        { x: 230, y: 150, bulge: 0 },
        { x: 220, y: 170, bulge: 0 },
        { x: 200, y: 180, bulge: 0 },
        { x: 180, y: 170, bulge: 0 },
        { x: 160, y: 180, bulge: 0 }
      ], false).geometry
    },
    createTestSpline(),
    createTestLine()
  ];

  it('should reproduce the exact offset intersection instability', () => {
    const splineShape = createTestSpline();
    const lineShape = createTestLine();
    const offsetDistance = 8;
    
    console.log('Testing spline-line offset intersection stability...');
    
    // Generate offsets multiple times and check for consistency
    const intersectionCounts: number[] = [];
    const detailedResults: any[] = [];
    const splineOffsetResults: any[] = [];
    const lineOffsetResults: any[] = [];
    
    for (let run = 0; run < 10; run++) {
      // Generate spline offsets
      const splineInset = offsetShape(splineShape, offsetDistance, 'inset');
      const splineOutset = offsetShape(splineShape, offsetDistance, 'outset');
      
      // Generate line offsets  
      const lineInset = offsetShape(lineShape, offsetDistance, 'inset');
      const lineOutset = offsetShape(lineShape, offsetDistance, 'outset');
      
      splineOffsetResults.push({
        insetSuccess: splineInset.success,
        outsetSuccess: splineOutset.success,
        insetShapes: splineInset.shapes.length,
        outsetShapes: splineOutset.shapes.length
      });
      
      lineOffsetResults.push({
        insetSuccess: lineInset.success,
        outsetSuccess: lineOutset.success,
        insetShapes: lineInset.shapes.length,
        outsetShapes: lineOutset.shapes.length
      });
      
      // Test intersections between all offset combinations with detailed logging
      const runResults: any = { run: run + 1 };
      let totalIntersections = 0;
      
      if (splineInset.success && lineInset.success && splineInset.shapes.length > 0 && lineInset.shapes.length > 0) {
        const intersections = findShapeIntersections(
          splineInset.shapes[0], 
          lineInset.shapes[0], 
          0.1, 
          true, 
          50
        );
        runResults.splineInset_lineInset = intersections.length;
        totalIntersections += intersections.length;
      }
      
      if (splineOutset.success && lineOutset.success && splineOutset.shapes.length > 0 && lineOutset.shapes.length > 0) {
        const intersections = findShapeIntersections(
          splineOutset.shapes[0], 
          lineOutset.shapes[0], 
          0.1, 
          true, 
          50
        );
        runResults.splineOutset_lineOutset = intersections.length;
        totalIntersections += intersections.length;
      }
      
      if (splineInset.success && lineOutset.success && splineInset.shapes.length > 0 && lineOutset.shapes.length > 0) {
        const intersections = findShapeIntersections(
          splineInset.shapes[0], 
          lineOutset.shapes[0], 
          0.1, 
          true, 
          50
        );
        runResults.splineInset_lineOutset = intersections.length;
        totalIntersections += intersections.length;
      }
      
      if (splineOutset.success && lineInset.success && splineOutset.shapes.length > 0 && lineInset.shapes.length > 0) {
        const intersections = findShapeIntersections(
          splineOutset.shapes[0], 
          lineInset.shapes[0], 
          0.1, 
          true, 
          50
        );
        runResults.splineOutset_lineInset = intersections.length;
        totalIntersections += intersections.length;
      }
      
      runResults.total = totalIntersections;
      detailedResults.push(runResults);
      intersectionCounts.push(totalIntersections);
      console.log(`Run ${run + 1}: ${totalIntersections} total intersections`, runResults);
    }
    
    // Check if offset generation is consistent
    const firstSplineResult = JSON.stringify(splineOffsetResults[0]);
    const splineOffsetsConsistent = splineOffsetResults.every(result => 
      JSON.stringify(result) === firstSplineResult
    );
    
    const firstLineResult = JSON.stringify(lineOffsetResults[0]);
    const lineOffsetsConsistent = lineOffsetResults.every(result => 
      JSON.stringify(result) === firstLineResult
    );
    
    console.log('Spline offsets consistent:', splineOffsetsConsistent);
    console.log('Line offsets consistent:', lineOffsetsConsistent);
    
    // Check which specific intersection pair is inconsistent
    const firstDetailedResult = detailedResults[0];
    const pairKeys = ['splineInset_lineInset', 'splineOutset_lineOutset', 'splineInset_lineOutset', 'splineOutset_lineInset'];
    
    for (const key of pairKeys) {
      const counts = detailedResults.map(result => result[key]);
      const firstCount = counts[0];
      const isConsistent = counts.every(count => count === firstCount);
      console.log(`${key}: ${isConsistent ? 'CONSISTENT' : 'INCONSISTENT'} - counts: [${counts.join(', ')}]`);
    }
    
    // Check if intersection counts are consistent
    const firstCount = intersectionCounts[0];
    const intersectionCountsConsistent = intersectionCounts.every(count => count === firstCount);
    
    console.log('Intersection counts:', intersectionCounts);
    console.log('Intersection counts consistent:', intersectionCountsConsistent);
    
    // Report findings
    if (!splineOffsetsConsistent) {
      console.log('INSTABILITY FOUND: Spline offset generation is non-deterministic');
    }
    if (!lineOffsetsConsistent) {
      console.log('INSTABILITY FOUND: Line offset generation is non-deterministic');
    }
    if (splineOffsetsConsistent && lineOffsetsConsistent && !intersectionCountsConsistent) {
      console.log('INSTABILITY FOUND: Intersection detection between offset shapes is non-deterministic');
    }
    
    // This test documents the instability - we expect it to show inconsistency
    // The actual expectation will be that we can identify WHERE the instability occurs
    expect(splineOffsetsConsistent).toBeDefined(); // Just verify test runs without error
  });

  it('should debug the specific problematic intersection pair', () => {
    const splineShape = createTestSpline();
    const lineShape = createTestLine();
    const offsetDistance = 8;
    
    console.log('Debugging splineInset_lineOutset intersection...');
    
    // Generate the problematic offset pair once
    const splineInset = offsetShape(splineShape, offsetDistance, 'inset');
    const lineOutset = offsetShape(lineShape, offsetDistance, 'outset');
    
    if (!splineInset.success || !lineOutset.success || 
        splineInset.shapes.length === 0 || lineOutset.shapes.length === 0) {
      console.log('Offset generation failed');
      return;
    }
    
    const offsetSpline = splineInset.shapes[0];
    const offsetLine = lineOutset.shapes[0];
    
    console.log('Offset spline geometry:', JSON.stringify(offsetSpline.geometry, null, 2));
    console.log('Offset line geometry:', JSON.stringify(offsetLine.geometry, null, 2));
    
    // Test this specific intersection multiple times
    const intersectionResults: any[] = [];
    
    for (let run = 0; run < 20; run++) {
      const intersections = findShapeIntersections(
        offsetSpline,
        offsetLine,
        0.1,
        true,
        50
      );
      
      intersectionResults.push({
        run: run + 1,
        count: intersections.length,
        points: intersections.map(int => ({ 
          x: Math.round(int.point.x * 1000) / 1000, 
          y: Math.round(int.point.y * 1000) / 1000,
          onExtension: int.onExtension,
          confidence: int.confidence
        }))
      });
      
      console.log(`Run ${run + 1}: ${intersections.length} intersections`);
      if (intersections.length > 0) {
        console.log('  Points:', intersections.map(int => 
          `(${int.point.x.toFixed(3)}, ${int.point.y.toFixed(3)}) ext:${int.onExtension} conf:${int.confidence}`
        ));
      }
    }
    
    // Check for consistency
    const counts = intersectionResults.map(r => r.count);
    const unique = [...new Set(counts)];
    console.log('Unique intersection counts:', unique);
    console.log('Distribution:', unique.map(count => 
      `${count}: ${counts.filter(c => c === count).length} times`
    ));
    
    expect(intersectionResults.length).toBeGreaterThan(0); // Just verify test runs
  });

  it('should test side detection consistency for offset shapes', { timeout: 30000 }, () => {
    const chain = {
      id: 'test-chain',
      shapes: createFullChain(),
      closed: true
    };
    
    const splineShape = createTestSpline();
    const lineShape = createTestLine();
    const offsetDistance = 8;
    
    console.log('Testing side detection consistency...');
    
    const sideDetectionResults: any[] = [];
    
    for (let run = 0; run < 5; run++) {
      // Generate offsets
      const splineInset = offsetShape(splineShape, offsetDistance, 'inset');
      const splineOutset = offsetShape(splineShape, offsetDistance, 'outset');
      const lineInset = offsetShape(lineShape, offsetDistance, 'inset');
      const lineOutset = offsetShape(lineShape, offsetDistance, 'outset');
      
      const results: any = { run: run + 1 };
      
      if (splineInset.success && splineInset.shapes.length > 0) {
        const sideResult = detectChainSide(splineInset.shapes[0], -offsetDistance, chain, 0.1);
        results.splineInsetSide = sideResult.side;
      }
      
      if (splineOutset.success && splineOutset.shapes.length > 0) {
        const sideResult = detectChainSide(splineOutset.shapes[0], offsetDistance, chain, 0.1);
        results.splineOutsetSide = sideResult.side;
      }
      
      if (lineInset.success && lineInset.shapes.length > 0) {
        const sideResult = detectChainSide(lineInset.shapes[0], -offsetDistance, chain, 0.1);
        results.lineInsetSide = sideResult.side;
      }
      
      if (lineOutset.success && lineOutset.shapes.length > 0) {
        const sideResult = detectChainSide(lineOutset.shapes[0], offsetDistance, chain, 0.1);
        results.lineOutsetSide = sideResult.side;
      }
      
      sideDetectionResults.push(results);
      console.log(`Run ${run + 1}:`, results);
    }
    
    // Check consistency
    const firstResult = sideDetectionResults[0];
    const sideDetectionConsistent = sideDetectionResults.every(result => {
      return (result.splineInsetSide === firstResult.splineInsetSide &&
              result.splineOutsetSide === firstResult.splineOutsetSide &&
              result.lineInsetSide === firstResult.lineInsetSide &&
              result.lineOutsetSide === firstResult.lineOutsetSide);
    });
    
    console.log('Side detection consistent:', sideDetectionConsistent);
    
    if (!sideDetectionConsistent) {
      console.log('INSTABILITY FOUND: Side detection for offset shapes is non-deterministic');
    }
    
    expect(sideDetectionConsistent).toBeDefined(); // Just verify test runs
  });

  it('should test individual intersection detection stability', () => {
    const splineShape = createTestSpline();
    const lineShape = createTestLine();
    const offsetDistance = 8;
    
    console.log('Testing individual intersection detection...');
    
    // Generate offset shapes once
    const splineInset = offsetShape(splineShape, offsetDistance, 'inset');
    const lineInset = offsetShape(lineShape, offsetDistance, 'inset');
    
    if (!splineInset.success || !lineInset.success || 
        splineInset.shapes.length === 0 || lineInset.shapes.length === 0) {
      console.log('Offset generation failed, skipping intersection test');
      return;
    }
    
    const offsetSpline = splineInset.shapes[0];
    const offsetLine = lineInset.shapes[0];
    
    console.log('Testing intersection detection between fixed offset shapes...');
    
    const intersectionResults: number[] = [];
    
    for (let run = 0; run < 10; run++) {
      const intersections = findShapeIntersections(
        offsetSpline,
        offsetLine,
        0.1,
        true,
        50
      );
      
      intersectionResults.push(intersections.length);
      console.log(`Run ${run + 1}: ${intersections.length} intersections`);
    }
    
    const firstCount = intersectionResults[0];
    const intersectionConsistent = intersectionResults.every(count => count === firstCount);
    
    console.log('Intersection detection consistent:', intersectionConsistent);
    
    if (!intersectionConsistent) {
      console.log('INSTABILITY FOUND: Intersection detection between fixed offset shapes is non-deterministic');
      console.log('Intersection counts:', intersectionResults);
    }
    
    expect(intersectionConsistent).toBeDefined(); // Just verify test runs
  });
});