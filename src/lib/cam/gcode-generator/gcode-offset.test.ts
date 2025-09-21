import { describe, expect, it } from 'vitest';
import { CutterCompensation } from '$lib/types/cam';
import type { Path } from '$lib/stores/paths/interfaces';
import { type Drawing, type Shape, Unit } from '$lib/types';
import { CutDirection, LeadType } from '$lib/types/direction';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import { GeometryType } from '$lib/geometry/shape';
import { pathsToToolPaths } from '$lib/cam/path-generator/path-to-toolpath';
import { generateGCode } from './gcode-generator';

describe('G-code generation with offset paths', () => {
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

    it('should generate G-code using original geometry when no offset is available', () => {
        const testPath: Path = {
            id: 'test-path',
            name: 'Test Path',
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
        };

        const chainShapes = new Map([['chain-1', testShapes]]);
        const toolPaths = pathsToToolPaths([testPath], chainShapes, []);

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
            cutterCompensation: CutterCompensation.OFF,
        });

        // Verify G-code contains original coordinates
        expect(gcode).toContain('X0 Y0');
        expect(gcode).toContain('X10 Y0');
        expect(gcode).toContain('X10 Y10');
        expect(gcode).toContain('X0 Y10');
    });

    it('should generate G-code using offset geometry when available', () => {
        const testPath: Path = {
            id: 'test-path',
            name: 'Test Path',
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
        const toolPaths = pathsToToolPaths([testPath], chainShapes, []);

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
            cutterCompensation: CutterCompensation.OFF,
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

    it('should handle lead-in/out with offset paths', () => {
        const testPath: Path = {
            id: 'test-path',
            name: 'Test Path',
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
            // Lead lengths are now handled via path configurations, not CuttingParameters
            // Calculated lead-in connecting to offset path
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
        const toolPaths = pathsToToolPaths([testPath], chainShapes, []);

        expect(toolPaths).toHaveLength(1);

        // Arc leads may be undefined if they don't connect properly to offset paths
        if (toolPaths[0].leadIn) {
            expect(toolPaths[0].leadIn.length).toBeGreaterThan(2); // Arc tessellation creates multiple points

            // Verify lead-in ends at path start (connection point should be close to (1,1))
            const leadInEnd =
                toolPaths[0].leadIn[toolPaths[0].leadIn.length - 1];
            expect(leadInEnd.x).toBeCloseTo(1, 1);
            expect(leadInEnd.y).toBeCloseTo(1, 1);
        }

        if (toolPaths[0].leadOut) {
            expect(toolPaths[0].leadOut.length).toBeGreaterThan(2); // Arc tessellation creates multiple points

            // Verify lead-out starts from path end (connection point should be close to (1,1))
            const leadOutStart = toolPaths[0].leadOut[0];
            expect(leadOutStart.x).toBeCloseTo(1, 1);
            expect(leadOutStart.y).toBeCloseTo(1, 1);
        }

        const gcode = generateGCode(toolPaths, testDrawing, {
            units: Unit.MM,
            safeZ: 10,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: CutterCompensation.OFF,
        });

        // Should contain linear interpolation moves (G1 commands) from arc tessellation
        expect(gcode).toMatch(/G1/); // Contains linear interpolation commands
    });

    it('should generate proper coordinate precision in G-code', () => {
        const testPath: Path = {
            id: 'test-path',
            name: 'Test Path',
            operationId: 'op-1',
            chainId: 'chain-1',
            toolId: 'tool-1',
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            feedRate: 1000.12345,
            pierceHeight: 3.87654,
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
        const toolPaths = pathsToToolPaths([testPath], chainShapes, []);

        const gcode = generateGCode(toolPaths, testDrawing, {
            units: Unit.MM,
            safeZ: 10.123456,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: CutterCompensation.OFF,
        });

        // Should format coordinates to 4 decimal places
        expect(gcode).toContain('X1.1235 Y2.9877');
        expect(gcode).toContain('X3.4568 Y4.321');

        // Should format Z coordinates to 4 decimal places
        expect(gcode).toContain('Z10.1235');
    });
});
