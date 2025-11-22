import { describe, it, expect } from 'vitest';
import { cutToKerf } from './functions';
import type { CutData } from '$lib/cam/cut/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { ChainData } from '$lib/geometry/chain/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import { CutDirection, NormalSide } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { calculateChainBoundingBox } from '$lib/geometry/bounding-box/functions';
import { Chain } from '$lib/geometry/chain/classes';
import { Shape } from '$lib/geometry/shape/classes';

describe('cutToKerf', () => {
    // Helper to create a simple rectangular cut
    function createRectangularCut(
        x: number,
        y: number,
        width: number,
        height: number
    ): CutData {
        const chain: ChainData = {
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
            cutChain: new Chain(chain),
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x, y },
            normalSide: NormalSide.RIGHT,
        };
    }

    // Helper to create a circular cut
    function createCircularCut(
        cx: number,
        cy: number,
        radius: number
    ): CutData {
        const chain: ChainData = {
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
            cutChain: new Chain(chain),
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

    it('should detect overlap detection properties exist', async () => {
        // This test verifies that the kerf object has the overlap detection properties
        const cut = createRectangularCut(0, 0, 100, 100);

        // Add a lead-in
        cut.leadIn = {
            geometry: {
                center: { x: -10, y: 50 },
                radius: 10,
                startAngle: 0,
                endAngle: Math.PI / 2,
                clockwise: true,
            },
            type: LeadType.ARC,
            connectionPoint: { x: 0, y: 50 },
            normal: { x: -1, y: 0 },
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
        };

        const tool = createTool(2.0);
        const kerf = await cutToKerf(cut, tool);

        // Verify the properties exist (they can be true or false)
        expect(kerf).toHaveProperty('leadInKerfOverlapsChain');
        expect(kerf).toHaveProperty('leadOutKerfOverlapsChain');
        expect(typeof kerf.leadInKerfOverlapsChain).toBe('boolean');
        expect(typeof kerf.leadOutKerfOverlapsChain).toBe('boolean');
    });

    it('should NOT detect overlap when lead is outside original chain', async () => {
        // Real-world test case: lead that should NOT overlap with the original chain
        // This is a spline chain from actual DXF with a lead-in that's positioned correctly
        const originalChain: ChainData = {
            id: 'chain-14',
            shapes: [
                {
                    id: 'shape_1760989421272_37',
                    type: GeometryType.SPLINE,
                    geometry: {
                        controlPoints: [
                            { x: 7.792490479999999, y: 10.992474479999993 },
                            { x: 7.681860479999999, y: 10.907604479999994 },
                            { x: 7.578360479999999, y: 10.903904479999994 },
                            { x: 7.481980479999999, y: 10.981384479999994 },
                            { x: 7.348150479999998, y: 11.136034479999994 },
                            { x: 7.3851204799999985, y: 11.324564479999994 },
                            { x: 7.592880479999999, y: 11.546964479999994 },
                            { x: 7.833130479999999, y: 11.762474479999995 },
                            { x: 8.20278048, y: 11.814224479999993 },
                            { x: 8.70184048, y: 11.702214479999993 },
                            { x: 8.93077048, y: 11.570264479999993 },
                            { x: 9.06014048, y: 11.392834479999994 },
                            { x: 9.08998048, y: 11.169914479999994 },
                            { x: 9.005840479999998, y: 10.986184479999993 },
                            { x: 8.86166048, y: 10.930734479999995 },
                            { x: 8.657490479999998, y: 11.003564479999994 },
                            { x: 8.52031048, y: 11.125964479999993 },
                            { x: 8.586850479999999, y: 11.262734479999994 },
                            { x: 8.85710048, y: 11.413884479999993 },
                            { x: 8.546590479999999, y: 11.813104479999994 },
                            { x: 7.703770479999998, y: 11.613504479999994 },
                            { x: 7.570690479999999, y: 11.347344479999993 },
                            { x: 7.658330479999999, y: 11.243584479999994 },
                            { x: 7.962610479999999, y: 11.213744479999994 },
                            { x: 7.792490479999999, y: 10.992474479999993 },
                        ],
                        knots: [
                            0, 0, 0, 0, 0.125, 0.125, 0.125, 0.25, 0.25, 0.25,
                            0.375, 0.375, 0.375, 0.5, 0.5, 0.5, 0.625, 0.625,
                            0.625, 0.75, 0.75, 0.75, 0.875, 0.875, 0.875, 1, 1,
                            1, 1,
                        ],
                        weights: [
                            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
                            1, 1, 1, 1, 1, 1, 1, 1,
                        ],
                        degree: 3,
                        fitPoints: [],
                        closed: true,
                    },
                } as any,
            ],
        };

        // Create a cut using this chain
        const cut: CutData = {
            id: '03eb0715-b65d-417e-ab98-deabcf70eb60',
            name: 'Operation 1 - Part 1 (Hole 8)',
            enabled: true,
            order: 0,
            operationId: 'op-1',
            chainId: 'chain-14',
            toolId: 'tool-1',
            cutDirection: CutDirection.CLOCKWISE,
            cutChain: new Chain(originalChain),
            normal: { x: -0.21847234485073125, y: 0.9758431403332317 },
            normalConnectionPoint: { x: 7.6655, y: 10.9635 },
            normalSide: NormalSide.LEFT,
            isHole: true, // This is a hole
            // Store original chain
            offset: {
                originalShapes: originalChain.shapes.map((s) => new Shape(s)),
                offsetShapes: originalChain.shapes.map((s) => new Shape(s)), // No actual offset for this test
                direction: 'none' as any,
                kerfWidth: 0.002,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            },
        };

        // Add the lead-in geometry that should NOT overlap
        cut.leadIn = {
            geometry: {
                center: { x: 7.660075731236548, y: 10.987728400476751 },
                radius: 0.024828171122335672,
                startAngle: 3.3618413769804922,
                endAngle: 4.932637703775389,
                clockwise: false,
            },
            type: LeadType.ARC,
            connectionPoint: { x: 7.6655, y: 10.9635 },
            normal: { x: -0.21847234485073125, y: 0.9758431403332317 },
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
        };

        // Use a tool with 2mm (0.002 units) kerf width
        const tool = createTool(0.002);
        const kerf = await cutToKerf(cut, tool);

        // The lead should NOT overlap with the original chain
        // This lead is positioned correctly for a hole - it stays inside the hole
        // and doesn't extend outward into the solid material
        expect(kerf.leadInKerfOverlapsChain).toBe(false);
    });

    it('should detect when lead kerf overlaps with original chain on offset cut', async () => {
        // Create a rectangular cut at (0,0) to (100,100)
        const cut = createRectangularCut(0, 0, 100, 100);

        // Simulate an offset of 10mm inward (cut path is inside the original)
        // Store the original shapes
        const offsetShapes = [
            // Offset rectangle 10mm inward to (10,10) to (90,90)
            new Shape({
                id: crypto.randomUUID(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 10 },
                    end: { x: 90, y: 10 },
                } as Line,
                layer: '0',
            }),
            new Shape({
                id: crypto.randomUUID(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 90, y: 10 },
                    end: { x: 90, y: 90 },
                } as Line,
                layer: '0',
            }),
            new Shape({
                id: crypto.randomUUID(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 90, y: 90 },
                    end: { x: 10, y: 90 },
                } as Line,
                layer: '0',
            }),
            new Shape({
                id: crypto.randomUUID(),
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 90 },
                    end: { x: 10, y: 10 },
                } as Line,
                layer: '0',
            }),
        ];
        cut.offset = {
            originalShapes: cut.cutChain!.shapes, // Original rectangle at (0,0) to (100,100)
            offsetShapes,
            direction: 'inset' as any,
            kerfWidth: 10.0,
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
        };

        // Update cutChain to use the offset shapes
        cut.cutChain = new Chain({
            id: cut.cutChain!.id,
            shapes: cut.offset!.offsetShapes.map((s) => s.toData()),
        });

        // Add a lead-in that extends outward from the offset cut path
        // Connection point at (10, 50) - the offset edge
        // Arc extends from (0, 50) toward (10, 50)
        // This lead clearly crosses through the space between original (x=0) and offset (x=10)
        cut.leadIn = {
            geometry: {
                center: { x: 5, y: 40 },
                radius: 12,
                startAngle: Math.PI / 2,
                endAngle: Math.PI,
                clockwise: false,
            },
            type: LeadType.ARC,
            connectionPoint: { x: 10, y: 50 },
            normal: { x: -1, y: 0 }, // Points outward (toward x=0)
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
        };

        // Use a tool with 4mm kerf width (2mm on each side)
        // The lead kerf will extend from the lead arc
        // Since the lead goes from ~(0,50) to (10,50), and the kerf adds ±2mm,
        // the kerf zone will definitely overlap the original chain edge at x=0
        const tool = createTool(4.0);
        const kerf = await cutToKerf(cut, tool);

        // The lead kerf should overlap with the original chain
        // because the lead extends outward from x=10 toward x=0,
        // and the kerf width adds to that, ensuring overlap with the original edge
        expect(kerf.leadInKerfOverlapsChain).toBe(true);
    });
});
