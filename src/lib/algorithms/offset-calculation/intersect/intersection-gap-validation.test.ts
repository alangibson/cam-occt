import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { 
  offsetShape, 
} from '../offset/index';
import { SVGBuilder } from '../../../test/svg-builder';
import { findShapeIntersections } from '../intersect';
import type { 
  Line, 
  Arc, 
  Circle, 
  Spline, 
  Ellipse, 
  Shape, 
} from '../../../types/geometry';
import { createPolylineFromVertices } from '../../../geometry/polyline';

describe('Intersection Gap Visual Validation Tests', { timeout: 180000 }, () => {
  const outputDir = 'tests/output/visual/intersections/gap';

  beforeAll(() => {
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }
  });

  // Helper function to create SVG using the enhanced SVGBuilder
  function createSVG(width: number, height: number) {
    return new SVGBuilder(width, height);
  }


  // Helper function to visualize intersections between two shapes
  function visualizeIntersection(
    shape1: Shape, 
    shape2: Shape, 
    combinationName: string,
    offsetDistance: number = 8,
    extensionLength: number = 100
  ) {
    const svg = createSVG(500, 400);
    
    // Draw original shapes
    svg.addShape(shape1, 'black', 2, 'Original ' + shape1.type);
    svg.addShape(shape2, 'black', 2, 'Original ' + shape2.type);

    // Draw extensions for original shapes to visualize gap detection
    svg.addShapeExtensions(shape1, 'gray', 1, extensionLength);
    svg.addShapeExtensions(shape2, 'gray', 1, extensionLength);

    // Generate offsets
    const shape1Outset = offsetShape(shape1, offsetDistance, 'outset');
    const shape1Inset = offsetShape(shape1, offsetDistance, 'inset');
    const shape2Outset = offsetShape(shape2, offsetDistance, 'outset');
    const shape2Inset = offsetShape(shape2, offsetDistance, 'inset');

    // Draw offset shapes
    if (shape1Outset.success && shape1Outset.shapes.length > 0) {
      svg.addShape(shape1Outset.shapes[0], 'red', 1, `${shape1.type} outset`);
      svg.addShapeExtensions(shape1Outset.shapes[0], 'red', 1, extensionLength);
    }
    if (shape1Inset.success && shape1Inset.shapes.length > 0) {
      svg.addShape(shape1Inset.shapes[0], 'blue', 1, `${shape1.type} inset`);
      svg.addShapeExtensions(shape1Inset.shapes[0], 'blue', 1, extensionLength);
    }
    if (shape2Outset.success && shape2Outset.shapes.length > 0) {
      svg.addShape(shape2Outset.shapes[0], 'red', 1, `${shape2.type} outset`);
      svg.addShapeExtensions(shape2Outset.shapes[0], 'red', 1, extensionLength);
    }
    if (shape2Inset.success && shape2Inset.shapes.length > 0) {
      svg.addShape(shape2Inset.shapes[0], 'blue', 1, `${shape2.type} inset`);
      svg.addShapeExtensions(shape2Inset.shapes[0], 'blue', 1, extensionLength);
    }

    // Find and visualize intersections
    let totalIntersections = 0;

    // Original shapes intersection (without extensions)
    const originalIntersections = findShapeIntersections(shape1, shape2, 0.1, false, extensionLength);
    originalIntersections.forEach(intersection => {
      svg.addIntersectionPoint(intersection.point, 'yellow', 4);
      totalIntersections++;
    });

    // Outset-Outset intersections with gap extension enabled
    if (shape1Outset.success && shape1Outset.shapes.length > 0 && 
        shape2Outset.success && shape2Outset.shapes.length > 0) {
      const outsetIntersections = findShapeIntersections(shape1Outset.shapes[0], shape2Outset.shapes[0], 0.1, true, extensionLength);
      outsetIntersections.forEach(intersection => {
        const color = intersection.onExtension ? 'orange' : 'red';
        svg.addIntersectionPoint(intersection.point, color, 3);
        totalIntersections++;
      });
    }

    // Inset-Inset intersections with gap extension enabled
    if (shape1Inset.success && shape1Inset.shapes.length > 0 && 
        shape2Inset.success && shape2Inset.shapes.length > 0) {
      const insetIntersections = findShapeIntersections(shape1Inset.shapes[0], shape2Inset.shapes[0], 0.1, true, extensionLength);
      insetIntersections.forEach(intersection => {
        const color = intersection.onExtension ? 'cyan' : 'blue';
        svg.addIntersectionPoint(intersection.point, color, 3);
        totalIntersections++;
      });
    }

    // Add title and legend  
    svg.addTitle(`${combinationName} Gap Test`);
    
    // Special note for ellipse intersections
    const hasEllipse = shape1.type === 'ellipse' || shape2.type === 'ellipse';
    const offsetShapeTypes = new Set<string>();
    if (shape1Outset.success && shape1Outset.shapes.length > 0) {
      offsetShapeTypes.add(shape1Outset.shapes[0].type);
    }
    if (shape2Outset.success && shape2Outset.shapes.length > 0) {
      offsetShapeTypes.add(shape2Outset.shapes[0].type);
    }
    
    const legendItems = [
      { color: 'black', label: 'Original Shapes' },
      { color: 'yellow', label: 'Original Intersections' },
      { color: 'red', label: `Outset (+${offsetDistance}) Intersections` },
      { color: 'orange', label: `Outset Gap Intersections` },
      { color: 'blue', label: `Inset (-${offsetDistance}) Intersections` },
      { color: 'cyan', label: `Inset Gap Intersections` }
    ];
    
    // Add note if ellipse offsets are polylines
    if (hasEllipse && offsetShapeTypes.has('polyline')) {
      legendItems.push({ color: 'gray', label: 'Note: Ellipse offsets are polyline approximations' });
    }
    
    svg.addLegend(legendItems);

    // Add intersection count
    svg.addText(10, 370, `Total Intersections: ${totalIntersections}`, 'black', '12px');
    
    // Add warning if ellipse offset intersections may appear off curve
    if (hasEllipse && offsetShapeTypes.has('polyline') && totalIntersections > 0) {
      svg.addText(10, 350, 'Warning: Intersection points may appear off ellipse curves due to polyline approximation', 'red', '10px');
    }

    const fileName = combinationName.toLowerCase().replace('-', '-') + '-gap.svg';
    writeFileSync(join(outputDir, fileName), svg.toString());

    return totalIntersections;
  }

  // Line combination tests
  describe('Line gap tests', () => {

    it('should test Line-Line gaps', () => {
      // Independent shape definitions for this test
      const line1 = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 100, y: 200 }, end: { x: 180, y: 200 } } as Line
      };
      const line2 = {
        id: 'line2', 
        type: 'line' as const,
        geometry: { start: { x: 220, y: 100 }, end: { x: 220, y: 180 } } as Line
      };
      
      // Use explicit extension length for consistency
      const count = visualizeIntersection(line1, line2, 'Line-Line', 8, 100);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Line-Arc gaps', () => {
      // Independent shape definitions for this test
      const line1 = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 100, y: 200 }, end: { x: 180, y: 200 } } as Line
      };
      
      const arc1 = {
        id: 'arc1',
        type: 'arc' as const,
        geometry: {
          center: { x: 240, y: 170 },
          radius: 60,
          startAngle: Math.PI/3,  // Rotated 90° CCW: was -π/6, now π/3 (60 degrees)
          endAngle: 2*Math.PI/3,  // Rotated 90° CCW: was π/6, now 2π/3 (120 degrees)
          clockwise: false
        } as Arc
      };
      
      const count = visualizeIntersection(line1, arc1, 'Line-Arc');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Line-Circle gaps', () => {
      // Move line 2 lengths to the right (line1 length is 80, so move 160 units right)
      const customLine = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 260, y: 200 }, end: { x: 340, y: 200 } } as Line
      };
      const circle1 = {
        id: 'circle1',
        type: 'circle' as const,
        geometry: { center: { x: 150, y: 200 }, radius: 40 } as Circle
      };
      const count = visualizeIntersection(customLine, circle1, 'Line-Circle');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Line-Polyline gaps', () => {
      // Move line up (decrease y coordinates)
      const customLine = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 100, y: 120 }, end: { x: 180, y: 120 } } as Line
      };
      const polyline1 = {
        id: 'polyline1',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 260, y: 150, bulge: 0 },
          { x: 320, y: 190, bulge: 0 },
          { x: 300, y: 230, bulge: 0 }
        ], false).geometry
      };
      const count = visualizeIntersection(customLine, polyline1, 'Line-Polyline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Line-Spline gaps', () => {
      // Move line 2 lengths to the right (line1 length is 80, so move 160 units right)
      const customLine = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 200, y: 170 }, end: { x: 280, y: 170 } } as Line
      };
      const spline1 = {
        id: 'spline1',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 200, y: 130 },
            { x: 240, y: 70 },
            { x: 280, y: 110 }
          ],
          degree: 2,
          knots: [0, 0, 0, 1, 1, 1],
          weights: [1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      // Use a longer extension to test consistency between visual and computational
      const count = visualizeIntersection(customLine, spline1, 'Line-Spline', 8, 200);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Line-Ellipse gaps', () => {
      // Move line right 140 units (80 + 60)
      const customLine = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 240, y: 200 }, end: { x: 320, y: 200 } } as Line
      };
      const ellipse1 = {
        id: 'ellipse1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 150, y: 200 },
          majorAxisEndpoint: { x: 45, y: 0 },
          minorToMajorRatio: 0.6
        } as Ellipse
      };
      const count = visualizeIntersection(customLine, ellipse1, 'Line-Ellipse');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test flipped-arc-debug specific Line-Arc case', () => {
      // Test the exact line-arc combination from the flipped-arc-debug test
      // that is failing to find intersections
      const line: import("$lib/types/geometry").Line = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 100, y: 50 }, end: { x: 200, y: 50 } } as Line
      };
      
      const arc: import("$lib/types/geometry").Arc = {
        id: 'arc1',
        type: 'arc' as const,
        geometry: {
          center: { x: 230, y: 50 },
          radius: 30,
          startAngle: Math.PI,    // Start pointing left (toward 200,50)
          endAngle: Math.PI/2,    // End pointing up (toward 230,80)
          clockwise: true
        } as Arc
      };
      
      const count = visualizeIntersection(line, arc, 'Flipped-Arc-Debug-Line-Arc', 8, 100);
      
      // This should find intersections for both inset and outset offsets
      expect(count).toBeGreaterThan(0);
      
      // Additional detailed test using specific offset shapes
      const lineInsetResult = offsetShape(line, 8, 'inset');
      const arcInsetResult = offsetShape(arc, 8, 'inset');
      
      if (lineInsetResult.success && arcInsetResult.success && 
          lineInsetResult.shapes.length > 0 && arcInsetResult.shapes.length > 0) {
        
        const insetIntersections = findShapeIntersections(
          lineInsetResult.shapes[0], 
          arcInsetResult.shapes[0], 
          0.1, 
          true, 
          50
        );
        
        
        // The key assertion: we must find at least 1 intersection for the inset case
        expect(insetIntersections.length).toBeGreaterThan(0);
      }
    });
  });

  // Arc combination tests
  describe('Arc gap tests', () => {

    it('should test Arc-Arc gaps', () => {
      // Independent shape definitions for this test
      const arc1 = {
        id: 'arc1',
        type: 'arc' as const,
        geometry: {
          center: { x: 240, y: 170 },
          radius: 60,
          startAngle: -Math.PI/6, // -30 degrees
          endAngle: Math.PI/6,    // +30 degrees (60 degree arc)
          clockwise: false
        } as Arc
      };
      const arc2 = {
        id: 'arc2',
        type: 'arc' as const,
        geometry: {
          center: { x: 200, y: 200 },
          radius: 50,
          startAngle: Math.PI*2/3,  // 120 degrees
          endAngle: Math.PI*4/3,    // 240 degrees (120 degree arc)
          clockwise: false
        } as Arc
      };
      
      const count = visualizeIntersection(arc1, arc2, 'Arc-Arc');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Arc-Circle gaps', () => {
      const arc: import("$lib/types/geometry").Arc = {
        id: 'arc1',
        type: 'arc' as const,
        geometry: {
          center: { x: 220, y: 180 },
          radius: 50,
          startAngle: -Math.PI/6, // -30 degrees
          endAngle: Math.PI/6,    // +30 degrees
          clockwise: false
        } as Arc
      };
      const circle: import("$lib/types/geometry").Circle = {
        id: 'circle1',
        type: 'circle' as const,
        geometry: { center: { x: 210, y: 200 }, radius: 35 } as Circle
      };
      const count = visualizeIntersection(arc, circle, 'Arc-Circle');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Arc-Polyline gaps', () => {
      const arc: import("$lib/types/geometry").Arc = {
        id: 'arc1',
        type: 'arc' as const,
        geometry: {
          center: { x: 160, y: 200 },
          radius: 40,
          startAngle: Math.PI*3/4,  // Flipped: was -Math.PI/4, now 3π/4
          endAngle: Math.PI/4,      // Flipped: was Math.PI/4, now π/4
          clockwise: true           // Flipped clockwise direction
        } as Arc
      };
      const polyline: import("$lib/types/geometry").Polyline = {
        id: 'polyline1',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 240, y: 200, bulge: 0 },  // Made horizontal: all y coordinates are 200
          { x: 280, y: 200, bulge: 0 },
          { x: 320, y: 200, bulge: 0 }
        ], false).geometry
      };
      const count = visualizeIntersection(arc, polyline, 'Arc-Polyline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Arc-Spline gaps', () => {
      // Independent shape definitions for this test - rotated 90 degrees CCW
      const arc1 = {
        id: 'arc1',
        type: 'arc' as const,
        geometry: {
          center: { x: 240, y: 170 },
          radius: 60,
          startAngle: Math.PI/3,  // Rotated 90° CCW: was -π/6, now π/3
          endAngle: 2*Math.PI/3,  // Rotated 90° CCW: was π/6, now 2π/3
          clockwise: false
        } as Arc
      };
      
      const spline1 = {
        id: 'spline1',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 190, y: 170 },  // Moved left 10 and down 40 total (130+40)
            { x: 230, y: 110 },  // Moved left 10 and down 40 total (70+40)
            { x: 270, y: 150 }   // Moved left 10 and down 40 total (110+40)
          ],
          degree: 2,
          knots: [0, 0, 0, 1, 1, 1],
          weights: [1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      
      const count = visualizeIntersection(arc1, spline1, 'Arc-Spline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Arc-Ellipse gaps', () => {
      const arc: import("$lib/types/geometry").Arc = {
        id: 'arc1',
        type: 'arc' as const,
        geometry: {
          center: { x: 160, y: 200 },
          radius: 45,
          startAngle: Math.PI/6,   // 30 degrees
          endAngle: Math.PI/2,     // 90 degrees
          clockwise: false
        } as Arc
      };
      const ellipse: import("$lib/types/geometry").Ellipse = {
        id: 'ellipse1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 220, y: 180 },
          majorAxisEndpoint: { x: 45, y: 0 },
          minorToMajorRatio: 0.6
        } as Ellipse
      };
      const count = visualizeIntersection(arc, ellipse, 'Arc-Ellipse');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // Circle combination tests
  describe('Circle gap tests', () => {

    it('should test Circle-Polyline gaps', () => {
      // Move circle down 40 units and right 30 units
      const customCircle = {
        id: 'circle1',
        type: 'circle' as const,
        geometry: { center: { x: 180, y: 240 }, radius: 40 } as Circle
      };
      const polyline1 = {
        id: 'polyline1',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 175, y: 120, bulge: 0 },
          { x: 235, y: 160, bulge: 0 },
          { x: 215, y: 200, bulge: 0 }
        ], false).geometry
      };
      const count = visualizeIntersection(customCircle, polyline1, 'Circle-Polyline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Circle-Spline gaps', () => {
      const circle1 = {
        id: 'circle1',
        type: 'circle' as const,
        geometry: { center: { x: 150, y: 200 }, radius: 40 } as Circle
      };
      const spline1 = {
        id: 'spline1',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 200, y: 130 },
            { x: 240, y: 70 },
            { x: 280, y: 110 }
          ],
          degree: 2,
          knots: [0, 0, 0, 1, 1, 1],
          weights: [1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      const count = visualizeIntersection(circle1, spline1, 'Circle-Spline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

  });

  // Polyline combination tests
  describe('Polyline gap tests', () => {

    it('should test Polyline-Polyline gaps', () => {
      const polyline1 = {
        id: 'polyline1',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 260, y: 150, bulge: 0 },
          { x: 320, y: 190, bulge: 0 },
          { x: 300, y: 230, bulge: 0 }
        ], false).geometry
      };
      const polyline2 = {
        id: 'polyline2',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 100, y: 280, bulge: 0 },
          { x: 140, y: 240, bulge: 0 },
          { x: 220, y: 180, bulge: 0 }
        ], false).geometry
      };
      const count = visualizeIntersection(polyline1, polyline2, 'Polyline-Polyline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Polyline-Spline gaps', () => {
      const polyline1 = {
        id: 'polyline1',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 260, y: 180, bulge: 0 },
          { x: 320, y: 220, bulge: 0 },
          { x: 300, y: 260, bulge: 0 }
        ], false).geometry
      };
      const spline1 = {
        id: 'spline1',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 200, y: 130 },
            { x: 240, y: 70 },
            { x: 280, y: 110 }
          ],
          degree: 2,
          knots: [0, 0, 0, 1, 1, 1],
          weights: [1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      const count = visualizeIntersection(polyline1, spline1, 'Polyline-Spline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Polyline-Ellipse gaps', () => {
      const polyline: import("$lib/types/geometry").Polyline = {
        id: 'polyline1',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 120, y: 180, bulge: 0 },
          { x: 160, y: 160, bulge: 0 },
          { x: 180, y: 180, bulge: 0 }
        ], false).geometry
      };
      const ellipse: import("$lib/types/geometry").Ellipse = {
        id: 'ellipse1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 240, y: 220 },
          majorAxisEndpoint: { x: 40, y: 0 },
          minorToMajorRatio: 0.8
        } as Ellipse
      };
      const count = visualizeIntersection(polyline, ellipse, 'Polyline-Ellipse');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // Spline combination tests
  describe('Spline gap tests', () => {

    it('should test Spline-Spline gaps', () => {
      const spline1 = {
        id: 'spline1',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 200, y: 130 },
            { x: 240, y: 70 },
            { x: 280, y: 110 }
          ],
          degree: 2,
          knots: [0, 0, 0, 1, 1, 1],
          weights: [1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      const spline2 = {
        id: 'spline2',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 240, y: 150 },
            { x: 280, y: 190 },
            { x: 320, y: 150 }
          ],
          degree: 2,
          knots: [0, 0, 0, 1, 1, 1],
          weights: [1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      const count = visualizeIntersection(spline1, spline2, 'Spline-Spline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Spline-Ellipse gaps', () => {
      const spline1 = {
        id: 'spline1',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 200, y: 130 },
            { x: 240, y: 70 },
            { x: 280, y: 110 }
          ],
          degree: 2,
          knots: [0, 0, 0, 1, 1, 1],
          weights: [1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      const ellipse1 = {
        id: 'ellipse1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 150, y: 200 },
          majorAxisEndpoint: { x: 45, y: 0 },
          minorToMajorRatio: 0.6
        } as Ellipse
      };
      const count = visualizeIntersection(spline1, ellipse1, 'Spline-Ellipse');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // Ellipse combination tests
  describe('Ellipse gap tests', () => {

    it('should test EllipseArc-EllipseArc gaps', () => {
      // Create two ellipse arcs with gaps
      const ellipseArc1 = {
        id: 'ellipseArc1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 150, y: 200 },
          majorAxisEndpoint: { x: 45, y: 0 },
          minorToMajorRatio: 0.6,
          startParam: 0,
          endParam: Math.PI/2
        } as Ellipse
      };
      
      const ellipseArc2 = {
        id: 'ellipseArc2',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 270, y: 200 },
          majorAxisEndpoint: { x: 0, y: 40 }, // Rotated 90 degrees
          minorToMajorRatio: 0.8,
          startParam: Math.PI,
          endParam: 3*Math.PI/2
        } as Ellipse
      };
      
      const count = visualizeIntersection(ellipseArc1, ellipseArc2, 'EllipseArc-EllipseArc');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Ellipse-EllipseArc gaps', () => {
      const ellipse1 = {
        id: 'ellipse1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 150, y: 200 },
          majorAxisEndpoint: { x: 45, y: 0 },
          minorToMajorRatio: 0.6
        } as Ellipse
      };
      const ellipseArc = {
        id: 'ellipseArc',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 200, y: 200 },
          majorAxisEndpoint: { x: 50, y: 0 },
          minorToMajorRatio: 0.5,
          startParam: 0,
          endParam: Math.PI/2
        } as Ellipse
      };
      const count = visualizeIntersection(ellipse1, ellipseArc, 'Ellipse-EllipseArc');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Line-EllipseArc gaps', () => {
      // Based on ellipse-arc-chain.dxf test file
      // Ellipse arc from center (0,0), major axis (30,0), ratio 0.6, from 0 to π/2
      // Line from (0,18) to (50,50) - positioned to create gap with ellipse arc
      const ellipseArc = {
        id: 'ellipseArc1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 200, y: 200 },
          majorAxisEndpoint: { x: 30, y: 0 },
          minorToMajorRatio: 0.6,
          startParam: 0,
          endParam: Math.PI/2
        } as Ellipse
      };
      const line = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 200, y: 218 }, end: { x: 250, y: 250 } } as Line
      };
      const count = visualizeIntersection(line, ellipseArc, 'Line-EllipseArc');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});