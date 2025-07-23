import { describe, it, expect } from 'vitest';
import { parseDXF } from './dxf-parser';

describe('Translation to Positive Quadrant Feature', () => {
  describe('Basic translation functionality', () => {
    it('should translate drawing with negative coordinates to origin', async () => {
      // Mock DXF content with shapes in negative quadrant
      const mockDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
-100
20
-50
11
-50
21
-25
0
CIRCLE
10
-75
20
-100
40
25
0
ENDSEC
0
EOF`;

      const drawing = await parseDXF(mockDXFContent, { 
        translateToPositiveQuadrant: true,
        decomposePolylines: false 
      });

      // Check that bounds start at origin
      expect(drawing.bounds.min.x).toBe(0);
      expect(drawing.bounds.min.y).toBe(0);
      expect(drawing.bounds.max.x).toBeGreaterThan(0);
      expect(drawing.bounds.max.y).toBeGreaterThan(0);

      // Check that shapes were translated
      const line = drawing.shapes.find(s => s.type === 'line');
      const circle = drawing.shapes.find(s => s.type === 'circle');

      if (line) {
        const lineGeom = line.geometry as any;
        expect(lineGeom.start.x).toBeGreaterThanOrEqual(0);
        expect(lineGeom.start.y).toBeGreaterThanOrEqual(0);
        expect(lineGeom.end.x).toBeGreaterThanOrEqual(0);
        expect(lineGeom.end.y).toBeGreaterThanOrEqual(0);
      }

      if (circle) {
        const circleGeom = circle.geometry as any;
        expect(circleGeom.center.x).toBeGreaterThanOrEqual(0);
        expect(circleGeom.center.y).toBeGreaterThanOrEqual(0);
      }
    });

    it('should not translate drawing already in positive quadrant', async () => {
      const mockDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
10
20
20
11
50
21
60
0
CIRCLE
10
30
20
40
40
15
0
ENDSEC
0
EOF`;

      const originalDrawing = await parseDXF(mockDXFContent, { 
        translateToPositiveQuadrant: false 
      });
      
      const translatedDrawing = await parseDXF(mockDXFContent, { 
        translateToPositiveQuadrant: true 
      });

      // Should be identical since already in positive quadrant
      expect(translatedDrawing.bounds).toEqual(originalDrawing.bounds);
      
      // Check shapes are identical
      expect(translatedDrawing.shapes.length).toBe(originalDrawing.shapes.length);
      
      for (let i = 0; i < translatedDrawing.shapes.length; i++) {
        const original = originalDrawing.shapes[i];
        const translated = translatedDrawing.shapes[i];
        expect(translated.geometry).toEqual(original.geometry);
      }
    });

    it('should handle mixed quadrant drawing correctly', async () => {
      const mockDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
-50
20
-25
11
100
21
75
0
CIRCLE
10
25
20
-10
40
5
0
ENDSEC
0
EOF`;

      const drawing = await parseDXF(mockDXFContent, { 
        translateToPositiveQuadrant: true 
      });

      // Should start at origin
      expect(drawing.bounds.min.x).toBe(0);
      expect(drawing.bounds.min.y).toBe(0);

      // All shapes should be in positive quadrant
      drawing.shapes.forEach(shape => {
        switch (shape.type) {
          case 'line':
            const line = shape.geometry as any;
            expect(line.start.x).toBeGreaterThanOrEqual(0);
            expect(line.start.y).toBeGreaterThanOrEqual(0);
            expect(line.end.x).toBeGreaterThanOrEqual(0);
            expect(line.end.y).toBeGreaterThanOrEqual(0);
            break;
          case 'circle':
            const circle = shape.geometry as any;
            expect(circle.center.x - circle.radius).toBeGreaterThanOrEqual(0);
            expect(circle.center.y - circle.radius).toBeGreaterThanOrEqual(0);
            break;
        }
      });
    });
  });

  describe('Polyline translation', () => {
    it('should translate simple polylines correctly', async () => {
      const mockDXFContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
90
3
10
-20
20
-30
10
-10
20
-20
10
0
20
-10
0
ENDSEC
0
EOF`;

      const drawing = await parseDXF(mockDXFContent, { 
        translateToPositiveQuadrant: true,
        decomposePolylines: false 
      });

      const polyline = drawing.shapes.find(s => s.type === 'polyline');
      expect(polyline).toBeDefined();

      if (polyline) {
        const geom = polyline.geometry as any;
        
        // Check points array
        geom.points.forEach((point: any) => {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeGreaterThanOrEqual(0);
        });

        // Check vertices array if it exists
        if (geom.vertices) {
          geom.vertices.forEach((vertex: any) => {
            expect(vertex.x).toBeGreaterThanOrEqual(0);
            expect(vertex.y).toBeGreaterThanOrEqual(0);
          });
        }
      }
    });

    it('should translate polylines with bulges correctly', async () => {
      // Create a more complex DXF with bulge data
      const mockDXFContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
90
4
10
-50
20
-50
42
0.5
10
-25
20
-50
42
0.0
10
-25
20
-25
42
-0.3
10
-50
20
-25
70
1
0
ENDSEC
0
EOF`;

      const drawing = await parseDXF(mockDXFContent, { 
        translateToPositiveQuadrant: true,
        decomposePolylines: false 
      });

      const polyline = drawing.shapes.find(s => s.type === 'polyline');
      expect(polyline).toBeDefined();

      if (polyline) {
        const geom = polyline.geometry as any;
        
        // All coordinates should be non-negative
        geom.points.forEach((point: any) => {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeGreaterThanOrEqual(0);
        });

        if (geom.vertices) {
          geom.vertices.forEach((vertex: any) => {
            expect(vertex.x).toBeGreaterThanOrEqual(0);
            expect(vertex.y).toBeGreaterThanOrEqual(0);
            // Bulge values should be preserved
            expect(typeof vertex.bulge).toBe('number');
          });
        }
      }
    });

    it('should translate decomposed polylines correctly', async () => {
      const mockDXFContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
90
3
10
-100
20
-50
42
1.0
10
-50
20
-50
42
0.0
10
-50
20
0
0
ENDSEC
0
EOF`;

      const drawing = await parseDXF(mockDXFContent, { 
        translateToPositiveQuadrant: true,
        decomposePolylines: true 
      });

      // Should have multiple shapes (decomposed)
      expect(drawing.shapes.length).toBeGreaterThan(1);

      // All shapes should be in positive quadrant
      drawing.shapes.forEach(shape => {
        switch (shape.type) {
          case 'line':
            const line = shape.geometry as any;
            expect(line.start.x).toBeGreaterThanOrEqual(0);
            expect(line.start.y).toBeGreaterThanOrEqual(0);
            expect(line.end.x).toBeGreaterThanOrEqual(0);
            expect(line.end.y).toBeGreaterThanOrEqual(0);
            break;
          case 'arc':
            const arc = shape.geometry as any;
            expect(arc.center.x - arc.radius).toBeGreaterThanOrEqual(0);
            expect(arc.center.y - arc.radius).toBeGreaterThanOrEqual(0);
            break;
        }
      });
    });
  });

  describe('Translation calculations', () => {
    it('should calculate correct translation vector', async () => {
      const mockDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
-75
20
-100
11
25
21
50
0
ENDSEC
0
EOF`;

      const originalDrawing = await parseDXF(mockDXFContent, { 
        translateToPositiveQuadrant: false 
      });
      
      const translatedDrawing = await parseDXF(mockDXFContent, { 
        translateToPositiveQuadrant: true 
      });

      // Translation should be (75, 100) to move (-75, -100) to (0, 0)
      const expectedTranslationX = -originalDrawing.bounds.min.x;
      const expectedTranslationY = -originalDrawing.bounds.min.y;

      expect(expectedTranslationX).toBe(75);
      expect(expectedTranslationY).toBe(100);

      // Check that translation was applied correctly
      expect(translatedDrawing.bounds.min.x).toBe(0);
      expect(translatedDrawing.bounds.min.y).toBe(0);
      expect(translatedDrawing.bounds.max.x).toBe(originalDrawing.bounds.max.x + expectedTranslationX);
      expect(translatedDrawing.bounds.max.y).toBe(originalDrawing.bounds.max.y + expectedTranslationY);
    });

    it('should preserve relative positions after translation', async () => {
      const mockDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
-50
20
-30
11
-25
21
-10
0
LINE
10
-25
20
-10
11
0
21
10
0
ENDSEC
0
EOF`;

      const originalDrawing = await parseDXF(mockDXFContent, { 
        translateToPositiveQuadrant: false 
      });
      
      const translatedDrawing = await parseDXF(mockDXFContent, { 
        translateToPositiveQuadrant: true 
      });

      // Get the two lines
      const originalLines = originalDrawing.shapes.filter(s => s.type === 'line');
      const translatedLines = translatedDrawing.shapes.filter(s => s.type === 'line');

      expect(originalLines.length).toBe(2);
      expect(translatedLines.length).toBe(2);

      // Calculate relative distances in original drawing
      const origLine1 = originalLines[0].geometry as any;
      const origLine2 = originalLines[1].geometry as any;
      const origDistance = Math.sqrt(
        Math.pow(origLine2.start.x - origLine1.start.x, 2) + 
        Math.pow(origLine2.start.y - origLine1.start.y, 2)
      );

      // Calculate relative distances in translated drawing
      const transLine1 = translatedLines[0].geometry as any;
      const transLine2 = translatedLines[1].geometry as any;
      const transDistance = Math.sqrt(
        Math.pow(transLine2.start.x - transLine1.start.x, 2) + 
        Math.pow(transLine2.start.y - transLine1.start.y, 2)
      );

      // Distances should be preserved
      expect(transDistance).toBeCloseTo(origDistance, 5);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty drawing', async () => {
      const emptyDXFContent = `0
SECTION
2
ENTITIES
0
ENDSEC
0
EOF`;

      const drawing = await parseDXF(emptyDXFContent, { 
        translateToPositiveQuadrant: true 
      });

      expect(drawing.shapes.length).toBe(0);
      expect(drawing.bounds.min.x).toBe(0);
      expect(drawing.bounds.min.y).toBe(0);
      expect(drawing.bounds.max.x).toBe(0);
      expect(drawing.bounds.max.y).toBe(0);
    });

    it('should handle drawing at exact origin', async () => {
      const originDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
0
20
0
11
50
21
50
0
ENDSEC
0
EOF`;

      const drawing = await parseDXF(originDXFContent, { 
        translateToPositiveQuadrant: true 
      });

      // Should remain unchanged
      expect(drawing.bounds.min.x).toBe(0);
      expect(drawing.bounds.min.y).toBe(0);
      expect(drawing.bounds.max.x).toBe(50);
      expect(drawing.bounds.max.y).toBe(50);
    });

    it('should handle very small negative coordinates', async () => {
      const smallNegativeDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
-0.001
20
-0.002
11
10
21
20
0
ENDSEC
0
EOF`;

      const drawing = await parseDXF(smallNegativeDXFContent, { 
        translateToPositiveQuadrant: true 
      });

      // Should still translate to origin
      expect(drawing.bounds.min.x).toBe(0);
      expect(drawing.bounds.min.y).toBe(0);
    });
  });

  describe('Option toggling', () => {
    it('should respect translateToPositiveQuadrant option when false', async () => {
      const mockDXFContent = `0
SECTION
2
ENTITIES
0
LINE
10
-50
20
-25
11
25
21
75
0
ENDSEC
0
EOF`;

      const drawing = await parseDXF(mockDXFContent, { 
        translateToPositiveQuadrant: false 
      });

      // Should preserve original negative coordinates
      expect(drawing.bounds.min.x).toBeLessThan(0);
      expect(drawing.bounds.min.y).toBeLessThan(0);

      const line = drawing.shapes[0].geometry as any;
      expect(line.start.x).toBe(-50);
      expect(line.start.y).toBe(-25);
    });

    it('should work with both decomposePolylines and translateToPositiveQuadrant enabled', async () => {
      const mockDXFContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
90
3
10
-50
20
-30
42
0.5
10
-25
20
-30
42
0.0
10
-25
20
-10
0
ENDSEC
0
EOF`;

      const drawing = await parseDXF(mockDXFContent, { 
        decomposePolylines: true,
        translateToPositiveQuadrant: true 
      });

      // Should have decomposed shapes
      expect(drawing.shapes.length).toBeGreaterThan(1);
      
      // All shapes should be in positive quadrant
      expect(drawing.bounds.min.x).toBe(0);
      expect(drawing.bounds.min.y).toBe(0);

      drawing.shapes.forEach(shape => {
        const bounds = getShapeBounds(shape);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-1e-10); // Allow for floating point precision
        expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-10);
      });
    });
  });
});

// Helper function to get shape bounds
function getShapeBounds(shape: any) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  switch (shape.type) {
    case 'line':
      const line = shape.geometry;
      minX = Math.min(line.start.x, line.end.x);
      maxX = Math.max(line.start.x, line.end.x);
      minY = Math.min(line.start.y, line.end.y);
      maxY = Math.max(line.start.y, line.end.y);
      break;
    case 'circle':
      const circle = shape.geometry;
      minX = circle.center.x - circle.radius;
      maxX = circle.center.x + circle.radius;
      minY = circle.center.y - circle.radius;
      maxY = circle.center.y + circle.radius;
      break;
    case 'arc':
      const arc = shape.geometry;
      minX = arc.center.x - arc.radius;
      maxX = arc.center.x + arc.radius;
      minY = arc.center.y - arc.radius;
      maxY = arc.center.y + arc.radius;
      break;
    case 'polyline':
      const polyline = shape.geometry;
      polyline.points.forEach((point: any) => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      });
      break;
  }
  
  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY }
  };
}