import { describe, it, expect } from 'vitest';
import { generateGCode } from './gcode-generator';
import type { ToolPath, Drawing } from '../types';

describe('GCode Generator - Temporary Materials', () => {
    const mockDrawing: Drawing = {
        units: 'mm',
        shapes: [],
        bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
    };

    it('should generate temporary material with magic comments', () => {
        const mockPath: ToolPath = {
            id: 'path1',
            shapeId: 'shape1',
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 },
                { x: 0, y: 0 },
            ],
            isRapid: false,
            parameters: {
                feedRate: 3000,
                pierceHeight: 3.8,
                pierceDelay: 0.5,
                cutHeight: 1.5,
                kerf: 1.2,
                leadInLength: 5,
                leadOutLength: 5,
                toolName: 'Test Material',
                kerfWidth: 1.2,
                enableTHC: true,
                cutAmps: 45,
                cutVolts: 120,
            },
        };

        const gcode = generateGCode([mockPath], mockDrawing, {
            units: 'mm',
            safeZ: 10,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: 'off',
        });

        // Check for magic comment - using o=0 format
        expect(gcode).toContain('(o=0');
        expect(gcode).toContain('ph=3.8');
        expect(gcode).toContain('pd=0.5');
        expect(gcode).toContain('ch=1.5');
        expect(gcode).toContain('fr=3000');
        expect(gcode).toContain('kw=1.2');
        expect(gcode).toContain('th=1'); // THC enabled
        expect(gcode).toContain('ca=45');
        expect(gcode).toContain('cv=120');

        // M190 and M66 commands are not used with o=0 format
        // Feed rate is set via F#<_hal[plasmac.cut-feed-rate]>
        expect(gcode).toContain('F#<_hal[plasmac.cut-feed-rate]>');
    });

    it('should generate multiple temporary materials for multiple paths', () => {
        const mockPaths: ToolPath[] = [
            {
                id: 'path1',
                shapeId: 'shape1',
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                ],
                isRapid: false,
                parameters: {
                    feedRate: 2500,
                    pierceHeight: 3.5,
                    pierceDelay: 0.4,
                    cutHeight: 1.2,
                    kerf: 1.0,
                    leadInLength: 4,
                    leadOutLength: 4,
                    toolName: 'Material 1',
                },
            },
            {
                id: 'path2',
                shapeId: 'shape2',
                points: [
                    { x: 20, y: 0 },
                    { x: 30, y: 0 },
                ],
                isRapid: false,
                parameters: {
                    feedRate: 3500,
                    pierceHeight: 4.0,
                    pierceDelay: 0.6,
                    cutHeight: 1.8,
                    kerf: 1.5,
                    leadInLength: 6,
                    leadOutLength: 6,
                    toolName: 'Material 2',
                },
            },
        ];

        const gcode = generateGCode(mockPaths, mockDrawing, {
            units: 'mm',
            safeZ: 10,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: null,
        });

        // Check for first material - using o=0 format
        expect(gcode).toContain('(o=0');
        expect(gcode).toContain('fr=2500');
        expect(gcode).toContain('ph=3.5');
        expect(gcode).toContain('pd=0.4');
        expect(gcode).toContain('ch=1.2');

        // Check for second material - using o=0 format
        // Note: Both use o=0, parameters are in separate comments
        expect(gcode).toContain('fr=3500');
        expect(gcode).toContain('ph=4');
        expect(gcode).toContain('pd=0.6');
        expect(gcode).toContain('ch=1.8');
        // M190 commands are not used with o=0 format
    });

    it('should handle paths without parameters', () => {
        const mockPath: ToolPath = {
            id: 'rapid1',
            shapeId: 'shape1',
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ],
            isRapid: true,
            // No parameters - this is a rapid move
        };

        const gcode = generateGCode([mockPath], mockDrawing, {
            units: 'mm',
            safeZ: 10,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: 'off',
        });

        // Should not contain any material magic comments
        expect(gcode).not.toContain('(o=2');
        expect(gcode).not.toContain('M190 P1000000');
    });

    it('should use default values for missing parameters', () => {
        const mockPath: ToolPath = {
            id: 'path1',
            shapeId: 'shape1',
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ],
            isRapid: false,
            parameters: {
                feedRate: 0, // Will use default
                pierceHeight: 0, // Will use default
                pierceDelay: 0, // Will use default
                cutHeight: 0, // Will use default
                kerf: 1.0,
                leadInLength: 4,
                leadOutLength: 4,
            },
        };

        const gcode = generateGCode([mockPath], mockDrawing, {
            units: 'mm',
            safeZ: 10,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: 'off',
        });

        // Check for default values
        expect(gcode).toContain('ph=3.8'); // Default pierce height
        expect(gcode).toContain('pd=0.5'); // Default pierce delay
        expect(gcode).toContain('ch=1.5'); // Default cut height
        expect(gcode).toContain('fr=2540'); // Default feed rate
    });
});
