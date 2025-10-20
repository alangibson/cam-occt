import { describe, it, expect } from 'vitest';
import { cutToKerf } from './functions';
import type { Cut } from '$lib/cam/cut/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { NormalSide } from '$lib/cam/cut/enums';
import { calculateChainBoundingBox } from '$lib/geometry/bounding-box/functions';

describe('cutToKerf', () => {
    // Helper to create a simple rectangular cut
    function createRectangularCut(
        x: number,
        y: number,
        width: number,
        height: number
    ): Cut {
        const chain: Chain = {
            id: crypto.randomUUID(),
            shapes: [
                {
                    id: crypto.randomUUID(),
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x, y },
                        end: { x: x + width, y },
                    } as Line,
                },
                {
                    id: crypto.randomUUID(),
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: x + width, y },
                        end: { x: x + width, y: y + height },
                    } as Line,
                },
                {
                    id: crypto.randomUUID(),
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: x + width, y: y + height },
                        end: { x, y: y + height },
                    } as Line,
                },
                {
                    id: crypto.randomUUID(),
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x, y: y + height },
                        end: { x, y },
                    } as Line,
                },
            ],
            clockwise: true,
        };

        return {
            id: crypto.randomUUID(),
            name: 'Rectangular Cut',
            enabled: true,
            order: 1,
            operationId: crypto.randomUUID(),
            chainId: chain.id,
            toolId: crypto.randomUUID(),
            cutDirection: CutDirection.CLOCKWISE,
            cutChain: chain,
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x, y },
            normalSide: NormalSide.RIGHT,
        };
    }

    // Helper to create a circular cut
    function createCircularCut(cx: number, cy: number, radius: number): Cut {
        const chain: Chain = {
            id: crypto.randomUUID(),
            shapes: [
                {
                    id: crypto.randomUUID(),
                    type: GeometryType.CIRCLE,
                    geometry: {
                        center: { x: cx, y: cy },
                        radius,
                    } as Circle,
                },
            ],
            clockwise: true,
        };

        return {
            id: crypto.randomUUID(),
            name: 'Circular Cut',
            enabled: true,
            order: 1,
            operationId: crypto.randomUUID(),
            chainId: chain.id,
            toolId: crypto.randomUUID(),
            cutDirection: CutDirection.CLOCKWISE,
            cutChain: chain,
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x: cx + radius, y: cy },
            normalSide: NormalSide.RIGHT,
        };
    }

    // Helper to create a tool with specified kerf width
    function createTool(kerfWidth: number): Tool {
        return {
            id: crypto.randomUUID(),
            toolNumber: 1,
            toolName: 'Test Tool',
            feedRate: 3000,
            pierceHeight: 3.0,
            cutHeight: 1.5,
            pierceDelay: 0.5,
            arcVoltage: 120,
            kerfWidth,
            thcEnable: true,
            gasPressure: 5.5,
            pauseAtEnd: 0.0,
            puddleJumpHeight: 0.0,
            puddleJumpDelay: 0.0,
            plungeRate: 1000,
        };
    }

    it('should create a kerf from a rectangular cut', async () => {
        const cut = createRectangularCut(0, 0, 100, 50);
        const tool = createTool(2.0);

        const kerf = await cutToKerf(cut, tool);

        expect(kerf).toBeDefined();
        expect(kerf.id).toBeDefined();
        expect(kerf.name).toBe('Kerf for Rectangular Cut');
        expect(kerf.enabled).toBe(true);
        expect(kerf.cutId).toBe(cut.id);
        expect(kerf.kerfWidth).toBe(2.0);
        expect(kerf.isClosed).toBe(true);
        expect(kerf.generatedAt).toBeDefined();
        expect(kerf.version).toBe('1.0.0');
    });

    it('should create inner and outer offset chains', async () => {
        const cut = createRectangularCut(0, 0, 100, 50);
        const tool = createTool(2.0);

        const kerf = await cutToKerf(cut, tool);

        expect(kerf.innerChain).toBeDefined();
        expect(kerf.outerChain).toBeDefined();
        expect(kerf.innerChain.shapes.length).toBeGreaterThan(0);
        expect(kerf.outerChain.shapes.length).toBeGreaterThan(0);
    });

    it('should offset by half the kerf width in each direction', async () => {
        const cut = createRectangularCut(0, 0, 100, 50);
        const tool = createTool(4.0); // 4mm kerf width

        const kerf = await cutToKerf(cut, tool);

        // Calculate bounding boxes to verify offset distances
        const innerBBox = calculateChainBoundingBox(kerf.innerChain);
        const outerBBox = calculateChainBoundingBox(kerf.outerChain);

        // Inner should be smaller (offset inward by 2mm)
        // Outer should be larger (offset outward by 2mm)
        // Allow some tolerance for round corners tessellation
        const tolerance = 0.5;

        expect(innerBBox.min.x).toBeGreaterThanOrEqual(0 + 2 - tolerance);
        expect(innerBBox.min.y).toBeGreaterThanOrEqual(0 + 2 - tolerance);
        expect(innerBBox.max.x).toBeLessThanOrEqual(100 - 2 + tolerance);
        expect(innerBBox.max.y).toBeLessThanOrEqual(50 - 2 + tolerance);

        expect(outerBBox.min.x).toBeLessThanOrEqual(0 - 2 + tolerance);
        expect(outerBBox.min.y).toBeLessThanOrEqual(0 - 2 + tolerance);
        expect(outerBBox.max.x).toBeGreaterThanOrEqual(100 + 2 - tolerance);
        expect(outerBBox.max.y).toBeGreaterThanOrEqual(50 + 2 - tolerance);
    });

    it('should create kerf for circular cut', async () => {
        const cut = createCircularCut(50, 50, 20);
        const tool = createTool(3.0);

        const kerf = await cutToKerf(cut, tool);

        expect(kerf).toBeDefined();
        expect(kerf.innerChain).toBeDefined();
        expect(kerf.outerChain).toBeDefined();
        expect(kerf.isClosed).toBe(true);
    });

    it('should create correct kerf width for circular cut', async () => {
        const centerX = 50;
        const centerY = 50;
        const radius = 30;
        const kerfWidth = 6.0;

        const cut = createCircularCut(centerX, centerY, radius);
        const tool = createTool(kerfWidth);

        const kerf = await cutToKerf(cut, tool);

        // For a circle, the inner radius should be ~radius - kerfWidth/2
        // and outer radius should be ~radius + kerfWidth/2
        const innerBBox = calculateChainBoundingBox(kerf.innerChain);
        const outerBBox = calculateChainBoundingBox(kerf.outerChain);

        // Calculate approximate radii from bounding boxes
        const innerRadius = (innerBBox.max.x - innerBBox.min.x) / 2;
        const outerRadius = (outerBBox.max.x - outerBBox.min.x) / 2;

        const tolerance = 1.0; // Allow tolerance for tessellation

        expect(innerRadius).toBeCloseTo(radius - kerfWidth / 2, tolerance);
        expect(outerRadius).toBeCloseTo(radius + kerfWidth / 2, tolerance);
    });

    it('should throw error if cut has no cutChain', async () => {
        const cut = createRectangularCut(0, 0, 100, 50);
        cut.cutChain = undefined;
        const tool = createTool(2.0);

        await expect(cutToKerf(cut, tool)).rejects.toThrow(
            'Cut must have a cutChain to generate kerf'
        );
    });

    it('should throw error if tool has no kerf width', async () => {
        const cut = createRectangularCut(0, 0, 100, 50);
        const tool = createTool(0);

        await expect(cutToKerf(cut, tool)).rejects.toThrow(
            'Tool must have a positive kerfWidth to generate kerf'
        );
    });

    it('should throw error if tool has negative kerf width', async () => {
        const cut = createRectangularCut(0, 0, 100, 50);
        const tool = createTool(-2.0);

        await expect(cutToKerf(cut, tool)).rejects.toThrow(
            'Tool must have a positive kerfWidth to generate kerf'
        );
    });

    it('should reference the correct cut ID', async () => {
        const cut = createRectangularCut(0, 0, 100, 50);
        const tool = createTool(2.0);

        const kerf = await cutToKerf(cut, tool);

        expect(kerf.cutId).toBe(cut.id);
    });

    it('should store the correct kerf width', async () => {
        const cut = createRectangularCut(0, 0, 100, 50);
        const kerfWidth = 5.5;
        const tool = createTool(kerfWidth);

        const kerf = await cutToKerf(cut, tool);

        expect(kerf.kerfWidth).toBe(kerfWidth);
    });

    it('should work with different kerf widths', async () => {
        const cut = createRectangularCut(0, 0, 100, 50);
        const kerfWidths = [1.0, 2.5, 5.0, 10.0];

        for (const kerfWidth of kerfWidths) {
            const tool = createTool(kerfWidth);
            const kerf = await cutToKerf(cut, tool);

            expect(kerf.kerfWidth).toBe(kerfWidth);

            // Verify offset distance is half the kerf width
            const innerBBox = calculateChainBoundingBox(kerf.innerChain);
            const outerBBox = calculateChainBoundingBox(kerf.outerChain);

            const tolerance = 1.0;
            const halfKerf = kerfWidth / 2;

            // Inner should be offset inward by halfKerf
            expect(innerBBox.min.x).toBeGreaterThanOrEqual(
                0 + halfKerf - tolerance
            );
            expect(innerBBox.min.y).toBeGreaterThanOrEqual(
                0 + halfKerf - tolerance
            );

            // Outer should be offset outward by halfKerf
            expect(outerBBox.min.x).toBeLessThanOrEqual(
                0 - halfKerf + tolerance
            );
            expect(outerBBox.min.y).toBeLessThanOrEqual(
                0 - halfKerf + tolerance
            );
        }
    });

    it('should have continuous line segments in closed chains', async () => {
        const cut = createRectangularCut(0, 0, 100, 50);
        const tool = createTool(2.0);

        const kerf = await cutToKerf(cut, tool);

        // Check inner chain continuity
        const innerShapes = kerf.innerChain.shapes;
        console.log(`Inner chain has ${innerShapes.length} shapes`);

        for (let i = 0; i < innerShapes.length; i++) {
            const currentLine = innerShapes[i].geometry as Line;
            const nextLine = innerShapes[(i + 1) % innerShapes.length]
                .geometry as Line;

            console.log(
                `  Shape ${i}: (${currentLine.start.x.toFixed(2)}, ${currentLine.start.y.toFixed(2)}) -> (${currentLine.end.x.toFixed(2)}, ${currentLine.end.y.toFixed(2)})`
            );

            // Verify current line's end connects to next line's start
            const dx = currentLine.end.x - nextLine.start.x;
            const dy = currentLine.end.y - nextLine.start.y;
            const gap = Math.sqrt(dx * dx + dy * dy);

            if (gap > 0.001) {
                console.log(`    GAP DETECTED! Distance to next shape: ${gap}`);
            }

            expect(gap).toBeLessThan(0.001);
        }

        // Check outer chain continuity
        const outerShapes = kerf.outerChain.shapes;
        console.log(`Outer chain has ${outerShapes.length} shapes`);

        for (let i = 0; i < outerShapes.length; i++) {
            const currentLine = outerShapes[i].geometry as Line;
            const nextLine = outerShapes[(i + 1) % outerShapes.length]
                .geometry as Line;

            const dx = currentLine.end.x - nextLine.start.x;
            const dy = currentLine.end.y - nextLine.start.y;
            const gap = Math.sqrt(dx * dx + dy * dy);

            if (gap > 0.001) {
                console.log(`  Outer shape ${i}: GAP of ${gap} to next shape`);
            }

            expect(gap).toBeLessThan(0.001);
        }
    });
});
