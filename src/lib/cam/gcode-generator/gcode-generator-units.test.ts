import { describe, expect, it } from 'vitest';
import { generateGCode } from './gcode-generator';
import { CutterCompensation } from '$lib/types/cam';
import { type Drawing, type CutPath, Unit } from '$lib/types';

describe('GCode Generator - Units', () => {
    const mockPath: CutPath = {
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
            // Lead lengths removed from CuttingParameters
        },
    };

    const baseOptions = {
        safeZ: 10,
        rapidFeedRate: 5000,
        includeComments: true,
        cutterCompensation: CutterCompensation.OFF,
        adaptiveFeedControl: true as boolean | null,
        enableTHC: true as boolean | null,
    };

    it('should generate G21 for millimeter units', () => {
        const mockDrawing: Drawing = {
            units: Unit.MM,
            shapes: [],
            bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
        };

        const gcode = generateGCode([mockPath], mockDrawing, {
            ...baseOptions,
            units: Unit.MM, // Use display unit, not drawing.units
        });

        expect(gcode).toContain('G21');
        expect(gcode).toContain('Set units to millimeters');
    });

    it('should generate G20 for inch units', () => {
        const mockDrawing: Drawing = {
            units: Unit.INCH,
            shapes: [],
            bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
        };

        const gcode = generateGCode([mockPath], mockDrawing, {
            ...baseOptions,
            units: Unit.INCH, // Use display unit, not drawing.units
        });

        expect(gcode).toContain('G20');
        expect(gcode).toContain('Set units to inches');
    });

    it('should use different tolerance values for different units', () => {
        const mockDrawingMM: Drawing = {
            units: Unit.MM,
            shapes: [],
            bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
        };

        const mockDrawingInch: Drawing = {
            units: Unit.INCH,
            shapes: [],
            bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
        };

        const gcodeMetric = generateGCode([mockPath], mockDrawingMM, {
            ...baseOptions,
            units: Unit.MM, // Use display unit
        });

        const gcodeImperial = generateGCode([mockPath], mockDrawingInch, {
            ...baseOptions,
            units: Unit.INCH, // Use display unit
        });

        // MM should use 0.1 tolerance
        expect(gcodeMetric).toContain('G64 P0.1');

        // Inch should use 0.004 tolerance
        expect(gcodeImperial).toContain('G64 P0.004');
    });

    it('should maintain unit consistency throughout the G-code', () => {
        const mockDrawing: Drawing = {
            units: Unit.MM,
            shapes: [],
            bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
        };

        const gcode = generateGCode([mockPath], mockDrawing, {
            ...baseOptions,
            units: Unit.MM, // Use display unit
        });

        // Should have G21 (mm) but not G20 (inch)
        expect(gcode).toContain('G21');
        expect(gcode).not.toContain('G20');

        // Should use mm tolerance
        expect(gcode).toContain('G64 P0.1');
        expect(gcode).not.toContain('G64 P0.004');
    });

    it('should handle unit changes properly', () => {
        // Simulate first generation with mm
        const mockDrawingMM: Drawing = {
            units: Unit.MM,
            shapes: [],
            bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
        };

        const gcodeMetric = generateGCode([mockPath], mockDrawingMM, {
            ...baseOptions,
            units: Unit.MM, // Display unit set to mm
        });

        // Simulate unit change to inches
        const mockDrawingInch: Drawing = {
            ...mockDrawingMM,
            units: Unit.INCH,
        };

        const gcodeImperial = generateGCode([mockPath], mockDrawingInch, {
            ...baseOptions,
            units: Unit.INCH, // Display unit changed to inch
        });

        // Verify they generate different unit codes
        expect(gcodeMetric).toContain('G21');
        expect(gcodeMetric).toContain('millimeters');
        expect(gcodeMetric).toContain('G64 P0.1');

        expect(gcodeImperial).toContain('G20');
        expect(gcodeImperial).toContain('inches');
        expect(gcodeImperial).toContain('G64 P0.004');
    });
});
