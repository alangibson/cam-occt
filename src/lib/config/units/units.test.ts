import { describe, expect, it } from 'vitest';
import {
    Unit,
    convertUnits,
    formatValue,
    getPhysicalScaleFactor,
    getPixelsPerUnit,
    getUnitSymbol,
    getReactiveUnitSymbol,
    measurementSystemToUnit,
    convertCoordinates,
} from './units';
import { MeasurementSystem } from '$lib/config/settings/enums';

describe('Units utilities', () => {
    describe('getPixelsPerUnit', () => {
        it('should return correct pixels per mm', () => {
            const pixelsPerMm = getPixelsPerUnit(Unit.MM);
            expect(pixelsPerMm).toBeCloseTo(3.78, 2); // ~96/25.4
        });

        it('should return correct pixels per inch', () => {
            const pixelsPerInch = getPixelsPerUnit(Unit.INCH);
            expect(pixelsPerInch).toBe(96);
        });
    });

    describe('convertUnits', () => {
        it('should convert mm to inches correctly', () => {
            const result = convertUnits(25.4, Unit.MM, Unit.INCH);
            expect(result).toBeCloseTo(1.0, 5);
        });

        it('should convert inches to mm correctly', () => {
            const result = convertUnits(1.0, Unit.INCH, Unit.MM);
            expect(result).toBeCloseTo(25.4, 5);
        });

        it('should return same value for same units', () => {
            expect(convertUnits(10, Unit.MM, Unit.MM)).toBe(10);
            expect(convertUnits(5, Unit.INCH, Unit.INCH)).toBe(5);
        });
    });

    describe('getPhysicalScaleFactor', () => {
        it('should return display unit pixels per unit', () => {
            // When displaying as mm, use mm scale regardless of geometry units
            expect(getPhysicalScaleFactor(Unit.MM, Unit.MM)).toBeCloseTo(
                3.78,
                2
            );
            expect(getPhysicalScaleFactor(Unit.INCH, Unit.MM)).toBeCloseTo(
                3.78,
                2
            );

            // When displaying as inches, use inch scale regardless of geometry units
            expect(getPhysicalScaleFactor(Unit.MM, Unit.INCH)).toBe(96);
            expect(getPhysicalScaleFactor(Unit.INCH, Unit.INCH)).toBe(96);
        });
    });

    describe('formatValue', () => {
        it('should format mm values with 1 decimal place', () => {
            expect(formatValue(12.3456, Unit.MM)).toBe('12.3');
            expect(formatValue(10, Unit.MM)).toBe('10.0');
        });

        it('should format inch values with 4 decimal places (ten-thousandths)', () => {
            expect(formatValue(1.2345678, Unit.INCH)).toBe('1.2346');
            expect(formatValue(2, Unit.INCH)).toBe('2.0000');
            expect(formatValue(0.0001, Unit.INCH)).toBe('0.0001');
        });
    });

    describe('getUnitSymbol', () => {
        it('should return correct symbols', () => {
            expect(getUnitSymbol(Unit.MM)).toBe('mm');
            expect(getUnitSymbol(Unit.INCH)).toBe('in.');
        });
    });

    describe('getReactiveUnitSymbol', () => {
        it('should return correct symbols for measurement systems', () => {
            expect(getReactiveUnitSymbol(MeasurementSystem.Metric)).toBe('mm');
            expect(getReactiveUnitSymbol(MeasurementSystem.Imperial)).toBe(
                'in.'
            );
        });
    });

    describe('measurementSystemToUnit', () => {
        it('should convert MeasurementSystem to Unit enum', () => {
            expect(measurementSystemToUnit(MeasurementSystem.Metric)).toBe(
                Unit.MM
            );
            expect(measurementSystemToUnit(MeasurementSystem.Imperial)).toBe(
                Unit.INCH
            );
        });
    });

    describe('convertCoordinates', () => {
        it('should convert array of coordinates', () => {
            const mmCoords = [25.4, 50.8, 76.2]; // 1", 2", 3" in mm
            const inchCoords = convertCoordinates(mmCoords, Unit.MM, Unit.INCH);

            expect(inchCoords).toHaveLength(3);
            expect(inchCoords[0]).toBeCloseTo(1.0, 5);
            expect(inchCoords[1]).toBeCloseTo(2.0, 5);
            expect(inchCoords[2]).toBeCloseTo(3.0, 5);
        });

        it('should return same array for same units', () => {
            const coords = [10, 20, 30];
            const result = convertCoordinates(coords, Unit.MM, Unit.MM);
            expect(result).toEqual(coords);
        });
    });

    describe('Physical scaling integration', () => {
        it('should display geometry values at display unit physical size', () => {
            // 186.2mm geometry displayed as mm should be 186.2mm on screen
            const geometryValue = 186.2;
            const mmDisplayPixels =
                geometryValue * getPhysicalScaleFactor(Unit.MM, Unit.MM);
            const mmOnScreen = mmDisplayPixels / (96 / 25.4);
            expect(mmOnScreen).toBeCloseTo(186.2, 1);

            // 186.2mm geometry displayed as inches should be 186.2" on screen
            const inchDisplayPixels =
                geometryValue * getPhysicalScaleFactor(Unit.MM, Unit.INCH);
            const inchesOnScreen = inchDisplayPixels / 96;
            expect(inchesOnScreen).toBeCloseTo(186.2, 1);
        });

        it('should scale appropriately when switching display units', () => {
            // Same geometry value should appear different physical sizes based on display unit
            const geometryValue = 100; // Could be 100mm or 100 inches from DXF

            // When displayed as mm: 100 units → 100mm on screen
            const mmPixels =
                geometryValue * getPhysicalScaleFactor(Unit.MM, Unit.MM);
            const mmOnScreen = mmPixels / (96 / 25.4);
            expect(mmOnScreen).toBeCloseTo(100, 1);

            // When displayed as inches: 100 units → 100" on screen
            const inchPixels =
                geometryValue * getPhysicalScaleFactor(Unit.MM, Unit.INCH);
            const inchesOnScreen = inchPixels / 96;
            expect(inchesOnScreen).toBeCloseTo(100, 1);

            // The inch display should be much larger than mm display
            expect(inchPixels).toBeGreaterThan(mmPixels);
        });
    });
});
