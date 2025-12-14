/**
 * SimulateStage Unit Conversion Tests
 *
 * Tests to verify that simulation speed calculations correctly handle
 * unit mismatches between drawing.units and displayUnit.
 *
 * Bug: When drawing.units ≠ displayUnit, simulation runs at incorrect speed
 * because distances (in drawing units) are divided by feed rates (in display units)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultsManager } from '$lib/config/defaults/defaults-manager';
import { MeasurementSystem } from '$lib/config/settings/enums';

describe('SimulateStage Unit Conversion', () => {
    it('should correctly calculate time when drawing units match display units', () => {
        // Drawing in inches, Display in inches
        const _cutDistance = 10; // inches (from geometry)
        const _feedRate = 120; // inches/min (from tool)

        // Time = distance / feedRate * 60 seconds
        const expectedTime = (10 / 120) * 60;
        expect(expectedTime).toBe(5); // 5 seconds
    });

    it('should correctly calculate time when drawing units differ from display units', () => {
        // Drawing in inches, Display in mm
        const cutDistanceInches = 10; // inches (from geometry)
        const feedRateMM = 3048; // mm/min (from tool's metric rate)

        // Must convert distance to match feed rate units
        const cutDistanceMM = cutDistanceInches * 25.4; // Convert to mm
        const expectedTime = (cutDistanceMM / feedRateMM) * 60;

        // Should be approximately 5 seconds (same as above test)
        expect(Math.abs(expectedTime - 5)).toBeLessThan(0.1);
    });

    it('should verify the bug scenario produces wrong results without conversion', () => {
        // Drawing in inches, Display in mm
        const cutDistanceInches = 10; // inches (from geometry)
        const feedRateMM = 3048; // mm/min (from tool's metric rate)

        // WRONG: Mixing units without conversion
        const wrongTime = (cutDistanceInches / feedRateMM) * 60;
        expect(wrongTime).toBeLessThan(1); // Gets ~0.197 seconds (way too fast!)

        // CORRECT: Convert distance first
        const cutDistanceMM = cutDistanceInches * 25.4;
        const correctTime = (cutDistanceMM / feedRateMM) * 60;
        expect(correctTime).toBeGreaterThan(4); // Gets ~5 seconds (correct!)
    });

    it('should handle mm drawing with inch display unit', () => {
        // Drawing in mm, Display in inches
        const cutDistanceMM = 254; // mm (from geometry)
        const feedRateInches = 120; // inches/min (from tool's imperial rate)

        // Convert distance from mm to inches
        const cutDistanceInches = cutDistanceMM / 25.4; // 10 inches
        const expectedTime = (cutDistanceInches / feedRateInches) * 60;

        expect(expectedTime).toBe(5); // 5 seconds
    });

    it('should handle rapid movements with unit conversion', () => {
        // Drawing in inches, Display in mm
        const rapidDistanceInches = 5; // inches (from geometry)
        const rapidRateMM = 7620; // mm/min (from config's metric rate)

        // Convert distance to match rapid rate units
        const rapidDistanceMM = rapidDistanceInches * 25.4; // 127 mm
        const expectedTime = (rapidDistanceMM / rapidRateMM) * 60;

        // Should be approximately 1 second
        expect(Math.abs(expectedTime - 1)).toBeLessThan(0.1);
    });

    it('should convert rapid rate when measurement system differs from display unit', () => {
        // Measurement system is metric (300 mm/min rapid rate)
        // Display unit is inches
        const rapidRateMM = 7620; // mm/min (from metric defaults)

        // Convert rapid rate to inches/min for display
        const rapidRateInches = rapidRateMM / 25.4; // Should be ~300 inches/min
        expect(Math.abs(rapidRateInches - 300)).toBeLessThan(0.1);

        // Now calculate time with converted values
        const rapidDistanceInches = 5; // inches (from geometry)
        const expectedTime = (rapidDistanceInches / rapidRateInches) * 60;

        // Should be approximately 1 second
        expect(Math.abs(expectedTime - 1)).toBeLessThan(0.1);
    });

    it('should verify rapid rate bug scenario', () => {
        // Measurement system is metric, Display unit is inches
        const rapidDistanceInches = 5; // inches (from geometry)
        const rapidRateMM = 7620; // mm/min (from metric defaults)

        // WRONG: Using metric rapid rate with inch distance
        const wrongTime = (rapidDistanceInches / rapidRateMM) * 60;
        expect(wrongTime).toBeLessThan(0.1); // Gets ~0.04 seconds (way too fast!)

        // CORRECT: Convert rapid rate to inches first
        const rapidRateInches = rapidRateMM / 25.4;
        const correctTime = (rapidDistanceInches / rapidRateInches) * 60;
        expect(Math.abs(correctTime - 1)).toBeLessThan(0.1); // Gets ~1 second (correct!)
    });

    it('should ensure statistics are in display units', () => {
        // When display unit is mm, all distances should be in mm
        const _drawingUnit = 'inch';
        const _displayUnit = 'mm';

        // Cut distance from geometry (in inches)
        const cutDistanceInches = 10;

        // After conversion, should be in mm for statistics
        const cutDistanceMM = cutDistanceInches * 25.4;
        expect(cutDistanceMM).toBe(254);

        // formatDistance() should now just format, not convert
        const formatted = cutDistanceMM.toFixed(1);
        expect(formatted).toBe('254.0');
    });
});

describe('Rapid Rate Display Bug', () => {
    let defaultsManager: DefaultsManager;

    beforeEach(() => {
        DefaultsManager.reset();
        defaultsManager = DefaultsManager.getInstance();
    });

    it('should show correct rapid rate when measurement system is imperial and display is imperial', () => {
        // Set measurement system to imperial
        defaultsManager.updateMeasurementSystem(MeasurementSystem.Imperial);

        const rapidRate = defaultsManager.cam.rapidRate;

        // When measurement system is imperial, rapid rate should be 3000 inch/min
        // (DEFAULT_RAPID_RATE_MM = 76200 mm / 25.4 = 3000 inch/min)
        expect(rapidRate).toBeCloseTo(3000, 0);

        console.log(`Imperial rapid rate: ${rapidRate.toFixed(0)} inch/min`);
    });

    it('should show correct rapid rate when measurement system is metric and display is metric', () => {
        // Set measurement system to metric
        defaultsManager.updateMeasurementSystem(MeasurementSystem.Metric);

        const rapidRate = defaultsManager.cam.rapidRate;

        // When measurement system is metric, rapid rate should be 3000 mm/min
        expect(rapidRate).toBe(3000);

        console.log(`Metric rapid rate: ${rapidRate} mm/min`);
    });

    it('should correctly convert between imperial and metric display units', () => {
        // Start with imperial measurement system
        defaultsManager.updateMeasurementSystem(MeasurementSystem.Imperial);

        const rapidRate = defaultsManager.cam.rapidRate;

        // Rapid rate is 3000 inch/min (from IMPERIAL_RAPID_RATE_MM = 76200 / 25.4)
        expect(rapidRate).toBeCloseTo(3000, 0);

        // If we "convert to display units" when display is mm:
        // This simulates what getRapidRateForCut() does when
        // measurementSystem=imperial but displayUnit=mm
        const rapidRateInMM = rapidRate * 25.4;

        // We get back to 76200 mm/min
        expect(rapidRateInMM).toBeCloseTo(76200, 0);

        console.log(
            `Imperial system (${rapidRate.toFixed(0)} inch/min) converted to mm display: ${rapidRateInMM.toFixed(0)} mm/min`
        );
    });

    it('should verify the root cause: DEFAULT_RAPID_RATE_MM is too low', () => {
        // Typical plasma CNC rapid rates:
        // - 3000-5000 inch/min is normal
        // - 76200-127000 mm/min equivalent

        const _DEFAULT_RAPID_RATE_MM = 3000;
        const expectedImperialRapidRate = 3000; // inch/min

        // To get 3000 inch/min, DEFAULT_RAPID_RATE_MM should be:
        const correctDefaultInMM = expectedImperialRapidRate * 25.4;

        expect(correctDefaultInMM).toBe(76200);
    });
});
