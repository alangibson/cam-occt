import { describe, it, expect } from 'vitest';
import { generateGCode } from './gcode-generator';
import { CutterCompensation } from '$lib/types/cam';
import { type ToolPath, type Drawing, Unit } from '$lib/types';

describe('GCode Generator - THC and Paused Motion', () => {
    const mockDrawing: Drawing = {
        units: Unit.MM,
        shapes: [],
        bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
    };

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
        },
    };

    describe('Adaptive Feed Control (M52)', () => {
        it('should generate M52 P1 when adaptiveFeedControl is true', () => {
            const gcode = generateGCode([mockPath], mockDrawing, {
                units: Unit.MM,
                safeZ: 10,
                rapidFeedRate: 5000,
                includeComments: true,
                cutterCompensation: CutterCompensation.OFF,
                adaptiveFeedControl: true,
                enableTHC: null,
            });

            expect(gcode).toContain('M52 P1');
            expect(gcode).toContain(
                'Enable paused motion for adaptive feed control'
            );
        });

        it('should generate M52 P0 when adaptiveFeedControl is false', () => {
            const gcode = generateGCode([mockPath], mockDrawing, {
                units: Unit.MM,
                safeZ: 10,
                rapidFeedRate: 5000,
                includeComments: true,
                cutterCompensation: CutterCompensation.OFF,
                adaptiveFeedControl: false,
                enableTHC: null,
            });

            expect(gcode).toContain('M52 P0');
            expect(gcode).toContain('Disable paused motion');
        });

        it('should not generate M52 when adaptiveFeedControl is null', () => {
            const gcode = generateGCode([mockPath], mockDrawing, {
                units: Unit.MM,
                safeZ: 10,
                rapidFeedRate: 5000,
                includeComments: true,
                cutterCompensation: CutterCompensation.OFF,
                adaptiveFeedControl: null,
                enableTHC: null,
            });

            expect(gcode).not.toContain('M52');
        });
    });

    describe('THC Control (M65/M64 P2)', () => {
        it('should generate M65 P2 when enableTHC is true', () => {
            const gcode = generateGCode([mockPath], mockDrawing, {
                units: Unit.MM,
                safeZ: 10,
                rapidFeedRate: 5000,
                includeComments: true,
                cutterCompensation: CutterCompensation.OFF,
                adaptiveFeedControl: null,
                enableTHC: true,
            });

            expect(gcode).toContain('M65 P2');
            expect(gcode).toContain('Enable THC');
            expect(gcode).not.toContain('M64 P2');
        });

        it('should generate M64 P2 when enableTHC is false', () => {
            const gcode = generateGCode([mockPath], mockDrawing, {
                units: Unit.MM,
                safeZ: 10,
                rapidFeedRate: 5000,
                includeComments: true,
                cutterCompensation: CutterCompensation.OFF,
                adaptiveFeedControl: null,
                enableTHC: false,
            });

            expect(gcode).toContain('M64 P2');
            expect(gcode).toContain('Disable THC');
            expect(gcode).not.toContain('M65 P2');
        });

        it('should not generate M65/M64 when enableTHC is null', () => {
            const gcode = generateGCode([mockPath], mockDrawing, {
                units: Unit.MM,
                safeZ: 10,
                rapidFeedRate: 5000,
                includeComments: true,
                cutterCompensation: CutterCompensation.OFF,
                adaptiveFeedControl: null,
                enableTHC: null,
            });

            expect(gcode).not.toContain('M65 P2');
            expect(gcode).not.toContain('M64 P2');
            expect(gcode).not.toContain('Enable THC');
            expect(gcode).not.toContain('Disable THC');
        });
    });

    describe('Combined Settings', () => {
        it('should generate both M52 and M65 when both are enabled', () => {
            const gcode = generateGCode([mockPath], mockDrawing, {
                units: Unit.MM,
                safeZ: 10,
                rapidFeedRate: 5000,
                includeComments: true,
                cutterCompensation: CutterCompensation.OFF,
                adaptiveFeedControl: true,
                enableTHC: true,
            });

            expect(gcode).toContain('M52 P1');
            expect(gcode).toContain('M65 P2');
            expect(gcode).toContain(
                'Enable paused motion for adaptive feed control'
            );
            expect(gcode).toContain('Enable THC');
        });

        it('should generate M52 P0 and M64 P2 when both are disabled', () => {
            const gcode = generateGCode([mockPath], mockDrawing, {
                units: Unit.MM,
                safeZ: 10,
                rapidFeedRate: 5000,
                includeComments: true,
                cutterCompensation: CutterCompensation.OFF,
                adaptiveFeedControl: false,
                enableTHC: false,
            });

            expect(gcode).toContain('M52 P0');
            expect(gcode).toContain('M64 P2');
            expect(gcode).toContain('Disable paused motion');
            expect(gcode).toContain('Disable THC');
        });

        it('should only generate necessary commands when some settings are null', () => {
            const gcode = generateGCode([mockPath], mockDrawing, {
                units: Unit.MM,
                safeZ: 10,
                rapidFeedRate: 5000,
                includeComments: true,
                cutterCompensation: CutterCompensation.OFF,
                adaptiveFeedControl: true,
                enableTHC: null,
            });

            expect(gcode).toContain('M52 P1');
            expect(gcode).not.toContain('M65');
            expect(gcode).not.toContain('M64');
        });
    });
});
