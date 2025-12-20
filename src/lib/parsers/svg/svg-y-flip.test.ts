import { describe, it, expect } from 'vitest';
import { parseSVG } from './functions';
import { GeometryType } from '$lib/geometry/enums';

describe('SVG Y-Axis Flipping', () => {
    it('should flip Y coordinates for line elements', async () => {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <line x1="10" y1="10" x2="50" y2="50" />
            </svg>
        `;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);

        const line = result.shapes[0];
        expect(line.type).toBe(GeometryType.LINE);

        // Y coordinates should be flipped: y' = height - y
        // y1=10 becomes 200-10=190
        // y2=50 becomes 200-50=150
        const geometry = line.geometry as any;
        expect(geometry.start.x).toBe(10);
        expect(geometry.start.y).toBe(190);
        expect(geometry.end.x).toBe(50);
        expect(geometry.end.y).toBe(150);
    });

    it('should flip Y coordinates for circle elements', async () => {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <circle cx="100" cy="100" r="25" />
            </svg>
        `;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);

        const circle = result.shapes[0];
        expect(circle.type).toBe(GeometryType.CIRCLE);

        // cy=100 becomes 200-100=100 (center of viewport)
        const geometry = circle.geometry as any;
        expect(geometry.center.x).toBe(100);
        expect(geometry.center.y).toBe(100);
        expect(geometry.radius).toBe(25);
    });

    it('should flip Y coordinates for rect elements', async () => {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <rect x="10" y="20" width="40" height="30" />
            </svg>
        `;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);

        const rect = result.shapes[0];
        expect(rect.type).toBe(GeometryType.POLYLINE);

        const geometry = rect.geometry as any;
        expect(geometry.closed).toBe(true);
        expect(geometry.shapes).toHaveLength(4);

        // Rect from (10,20) to (50,50) in SVG
        // Should become (10,180) to (50,150) in CAD (flipped Y)
        const lines = geometry.shapes;

        // Top line: y=20 -> y'=180
        expect(lines[0].geometry.start.y).toBe(180);
        expect(lines[0].geometry.end.y).toBe(180);

        // Bottom line: y=50 -> y'=150
        expect(lines[2].geometry.start.y).toBe(150);
        expect(lines[2].geometry.end.y).toBe(150);
    });

    it('should flip Y coordinates for polyline elements', async () => {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
                <polyline points="10,10 50,20 90,10" />
            </svg>
        `;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);

        const polyline = result.shapes[0];
        expect(polyline.type).toBe(GeometryType.POLYLINE);

        const geometry = polyline.geometry as any;
        expect(geometry.shapes).toHaveLength(2); // 3 points = 2 line segments

        // First point (10,10) -> (10,90)
        expect(geometry.shapes[0].geometry.start.x).toBe(10);
        expect(geometry.shapes[0].geometry.start.y).toBe(90);

        // Second point (50,20) -> (50,80)
        expect(geometry.shapes[0].geometry.end.x).toBe(50);
        expect(geometry.shapes[0].geometry.end.y).toBe(80);

        // Third point (90,10) -> (90,90)
        expect(geometry.shapes[1].geometry.end.x).toBe(90);
        expect(geometry.shapes[1].geometry.end.y).toBe(90);
    });

    it('should flip Y coordinates for path elements', async () => {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
                <path d="M 10 10 L 50 50 L 90 10 Z" />
            </svg>
        `;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBeGreaterThan(0);

        // Path generates multiple line segments
        const firstShape = result.shapes[0];
        expect(firstShape.type).toBe(GeometryType.LINE);

        // First point M 10 10 -> (10, 90)
        const geometry = firstShape.geometry as any;
        expect(geometry.start.x).toBe(10);
        expect(geometry.start.y).toBe(90);
    });

    it('should handle viewBox instead of width/height', async () => {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
                <line x1="0" y1="0" x2="300" y2="300" />
            </svg>
        `;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);

        const line = result.shapes[0];
        const geometry = line.geometry as any;

        // y=0 -> y'=300, y=300 -> y'=0
        expect(geometry.start.y).toBe(300);
        expect(geometry.end.y).toBe(0);
    });

    it('should handle ellipse Y flipping', async () => {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <ellipse cx="100" cy="50" rx="40" ry="20" />
            </svg>
        `;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);

        const ellipse = result.shapes[0];
        expect(ellipse.type).toBe(GeometryType.ELLIPSE);

        const geometry = ellipse.geometry as any;
        // cy=50 -> y'=200-50=150
        expect(geometry.center.x).toBe(100);
        expect(geometry.center.y).toBe(150);
    });

    it('should flip Y coordinates with translate transform', async () => {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <path transform="translate(5 10)" d="M 0 0 L 10 10" />
            </svg>
        `;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].type).toBe(GeometryType.LINE);

        const line = result.shapes[0].geometry as any;

        // SVG space: Point at (0,0) with translate(5,10) → (5,10)
        // CAD space with Y-flip: (0,0) is at bottom → (0,200)
        //   translate(5,10) means +5 in X, -10 in Y (down becomes up)
        //   So (0,200) + (5,-10) = (5,190)
        expect(line.start.x).toBe(5);
        expect(line.start.y).toBe(190);

        // SVG space: (10,10) with translate(5,10) → (15,20)
        // CAD space: (10,190) + (5,-10) = (15,180)
        expect(line.end.x).toBe(15);
        expect(line.end.y).toBe(180);
    });

    it('should handle diagonal line correctly (visual orientation test)', async () => {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
                <line x1="0" y1="0" x2="100" y2="100" />
            </svg>
        `;

        const result = await parseSVG(svg);
        const line = result.shapes[0].geometry as any;

        // In SVG: line from top-left (0,0) to bottom-right (100,100)
        // In CAD: should be from bottom-left (0,100) to top-right (100,0)
        expect(line.start).toEqual({ x: 0, y: 100 });
        expect(line.end).toEqual({ x: 100, y: 0 });
    });

    it('should calculate bounding box height for SVG without dimensions', async () => {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg">
                <line x1="0" y1="0" x2="50" y2="100" />
            </svg>
        `;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);

        const line = result.shapes[0].geometry as any;

        // Should calculate height from geometry (maxY=100)
        // y=0 → y'=100, y=100 → y'=0
        expect(line.start.x).toBe(0);
        expect(line.start.y).toBe(100);
        expect(line.end.x).toBe(50);
        expect(line.end.y).toBe(0);
    });
});
