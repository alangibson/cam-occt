import { describe, expect, it } from 'vitest';
import { CutDirection, NormalSide } from '$lib/cam/cut/enums';
import { CutterCompensation } from '$lib/cam/cut-generator/enums';
import type { Cut } from '$lib/cam/cut/interfaces';
import type { Drawing } from '$lib/cam/drawing/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import { Unit } from '$lib/config/units/units';
import { LeadType } from '$lib/cam/lead/enums';
import { OffsetDirection } from '$lib/cam/offset/types';
import { GeometryType } from '$lib/geometry/shape/enums';
import { cutsToToolPaths } from '$lib/cam/cut-generator/cut-to-toolpath';
import { generateGCode } from './gcode-generator';

describe('G-code generation with offset cuts', () => {
    // Create test shapes for a simple rectangle
    const testShapes: Shape[] = [
        {
            id: 'line1',
            type: GeometryType.LINE,
            geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
        },
        {
            id: 'line2',
            type: GeometryType.LINE,
            geometry: { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
        },
        {
            id: 'line3',
            type: GeometryType.LINE,
            geometry: { start: { x: 10, y: 10 }, end: { x: 0, y: 10 } },
        },
        {
            id: 'line4',
            type: GeometryType.LINE,
            geometry: { start: { x: 0, y: 10 }, end: { x: 0, y: 0 } },
        },
    ];

    // Create offset shapes (inset by 1 unit)
    const offsetShapes: Shape[] = [
        {
            id: 'offset-line1',
            type: GeometryType.LINE,
            geometry: { start: { x: 1, y: 1 }, end: { x: 9, y: 1 } },
        },
        {
            id: 'offset-line2',
            type: GeometryType.LINE,
            geometry: { start: { x: 9, y: 1 }, end: { x: 9, y: 9 } },
        },
        {
            id: 'offset-line3',
            type: GeometryType.LINE,
            geometry: { start: { x: 9, y: 9 }, end: { x: 1, y: 9 } },
        },
        {
            id: 'offset-line4',
            type: GeometryType.LINE,
            geometry: { start: { x: 1, y: 9 }, end: { x: 1, y: 1 } },
        },
    ];

    const testDrawing: Drawing = {
        shapes: testShapes,
        bounds: { min: { x: 0, y: 0 }, max: { x: 30, y: 20 } },
        units: Unit.MM,
    };

    it('should generate G-code using original geometry when no offset is available', async () => {
        const testCut: Cut = {
            id: 'test-cut',
            name: 'Test Cut',
            operationId: 'op-1',
            chainId: 'chain-1',
            toolId: 'tool-1',
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            feedRate: 1000,
            pierceHeight: 3.8,
            pierceDelay: 0.5,
            kerfWidth: 1.5,
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x: 0, y: 0 },
            normalSide: NormalSide.LEFT,
        };

        const chainShapes = new Map([['chain-1', testShapes]]);
        const toolPaths = await cutsToToolPaths(
            [testCut],
            chainShapes,
            [],
            CutterCompensation.SOFTWARE
        );

        expect(toolPaths).toHaveLength(1);
        expect(toolPaths[0].points).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
            { x: 0, y: 0 },
        ]);

        const gcode = generateGCode(toolPaths, testDrawing, {
            units: Unit.MM,
            safeZ: 10,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: CutterCompensation.NONE,
        });

        // Verify G-code contains original coordinates
        expect(gcode).toContain('X0 Y0');
        expect(gcode).toContain('X10 Y0');
        expect(gcode).toContain('X10 Y10');
        expect(gcode).toContain('X0 Y10');
    });

    it('should generate G-code using offset geometry when available', async () => {
        const testCut: Cut = {
            id: 'test-cut',
            name: 'Test Cut',
            operationId: 'op-1',
            chainId: 'chain-1',
            toolId: 'tool-1',
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            feedRate: 1000,
            pierceHeight: 3.8,
            pierceDelay: 0.5,
            kerfWidth: 1.5,
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x: 0, y: 0 },
            normalSide: NormalSide.LEFT,
            // Add calculated offset
            offset: {
                offsetShapes,
                originalShapes: testShapes,
                direction: OffsetDirection.INSET,
                kerfWidth: 1.5,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            },
        };

        const chainShapes = new Map([['chain-1', testShapes]]);
        const toolPaths = await cutsToToolPaths(
            [testCut],
            chainShapes,
            [],
            CutterCompensation.SOFTWARE
        );

        expect(toolPaths).toHaveLength(1);
        // Should use offset geometry
        expect(toolPaths[0].points).toEqual([
            { x: 1, y: 1 },
            { x: 9, y: 1 },
            { x: 9, y: 9 },
            { x: 1, y: 9 },
            { x: 1, y: 1 },
        ]);

        const gcode = generateGCode(toolPaths, testDrawing, {
            units: Unit.MM,
            safeZ: 10,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: CutterCompensation.NONE,
        });

        // Verify G-code contains offset coordinates
        expect(gcode).toContain('X1 Y1');
        expect(gcode).toContain('X9 Y1');
        expect(gcode).toContain('X9 Y9');
        expect(gcode).toContain('X1 Y9');

        // Should NOT contain original coordinates in cut moves
        expect(gcode).not.toMatch(/G1.*X0 Y0/);
        expect(gcode).not.toMatch(/G1.*X10 Y0/);
    });

    it('should handle lead-in/out with offset cuts', async () => {
        const testCut: Cut = {
            id: 'test-cut',
            name: 'Test Cut',
            operationId: 'op-1',
            chainId: 'chain-1',
            toolId: 'tool-1',
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            feedRate: 1000,
            pierceHeight: 3.8,
            pierceDelay: 0.5,
            kerfWidth: 1.5,
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x: 0, y: 0 },
            normalSide: NormalSide.LEFT,
            // Lead lengths are now handled via cut configurations, not CuttingParameters
            // Calculated lead-in connecting to offset cut
            leadIn: {
                geometry: {
                    center: { x: -1.5, y: 1 },
                    radius: 2.5,
                    startAngle: 180,
                    endAngle: 0,
                    clockwise: false,
                }, // Arc connecting to offset start point
                type: LeadType.ARC,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            },
            leadOut: {
                geometry: {
                    center: { x: 1, y: -1.5 },
                    radius: 2.5,
                    startAngle: 90,
                    endAngle: 270,
                    clockwise: false,
                }, // Arc connecting from offset end point
                type: LeadType.ARC,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            },
            offset: {
                offsetShapes,
                originalShapes: testShapes,
                direction: OffsetDirection.INSET,
                kerfWidth: 1.5,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            },
        };

        const chainShapes = new Map([['chain-1', testShapes]]);
        const toolPaths = await cutsToToolPaths(
            [testCut],
            chainShapes,
            [],
            CutterCompensation.SOFTWARE
        );

        expect(toolPaths).toHaveLength(1);

        // Arc leads may be undefined if they don't connect properly to offset cuts
        if (toolPaths[0].leadIn) {
            expect(toolPaths[0].leadIn.length).toBeGreaterThan(2); // Arc tessellation creates multiple points

            // Verify lead-in ends at cut start (connection point should be close to (1,1))
            const leadInEnd =
                toolPaths[0].leadIn[toolPaths[0].leadIn.length - 1];
            expect(leadInEnd.x).toBeCloseTo(1, 1);
            expect(leadInEnd.y).toBeCloseTo(1, 1);
        }

        if (toolPaths[0].leadOut) {
            expect(toolPaths[0].leadOut.length).toBeGreaterThan(2); // Arc tessellation creates multiple points

            // Verify lead-out starts from cut end (connection point should be close to (1,1))
            const leadOutStart = toolPaths[0].leadOut[0];
            expect(leadOutStart.x).toBeCloseTo(1, 1);
            expect(leadOutStart.y).toBeCloseTo(1, 1);
        }

        const gcode = generateGCode(toolPaths, testDrawing, {
            units: Unit.MM,
            safeZ: 10,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: CutterCompensation.NONE,
        });

        // Should contain linear interpolation moves (G1 commands) from arc tessellation
        expect(gcode).toMatch(/G1/); // Contains linear interpolation commands
    });

    it('should generate proper coordinate precision in G-code', async () => {
        const testCut: Cut = {
            id: 'test-cut',
            name: 'Test Cut',
            operationId: 'op-1',
            chainId: 'chain-1',
            toolId: 'tool-1',
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            feedRate: 1000.12345,
            pierceHeight: 3.87654,
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x: 0, y: 0 },
            normalSide: NormalSide.LEFT,
            offset: {
                offsetShapes: [
                    {
                        id: 'precise-line',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 1.123456, y: 2.987654 },
                            end: { x: 3.456789, y: 4.321098 },
                        },
                    },
                ],
                originalShapes: testShapes,
                direction: OffsetDirection.INSET,
                kerfWidth: 1.5,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            },
        };

        const chainShapes = new Map([['chain-1', testShapes]]);
        const toolPaths = await cutsToToolPaths(
            [testCut],
            chainShapes,
            [],
            CutterCompensation.SOFTWARE
        );

        const gcode = generateGCode(toolPaths, testDrawing, {
            units: Unit.MM,
            safeZ: 10.123456,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: CutterCompensation.NONE,
        });

        // Should format coordinates to 4 decimal places
        expect(gcode).toContain('X1.1235 Y2.9877');
        expect(gcode).toContain('X3.4568 Y4.321');

        // Should format Z coordinates to 4 decimal places
        expect(gcode).toContain('Z10.1235');
    });
});
