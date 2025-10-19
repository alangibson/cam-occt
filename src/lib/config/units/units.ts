/**
 * Unit conversion utilities for MetalHead CAM
 * Handles conversion between different units and physical display scaling
 */

import { MeasurementSystem } from '$lib/config/settings/enums';

/**
 * Unit display precision
 * Imperial: 4 decimal places (ten-thousandths: 0.0001")
 * Metric: 1 decimal place (tenths: 0.1mm)
 */
const INCH_DISPLAY_PRECISION = 4;
const MM_DISPLAY_PRECISION = 1;

export enum Unit {
    MM = 'mm',
    INCH = 'inch',
    NONE = 'none',
}

// Physical constants for screen display
export const MM_PER_INCH: number = 25.4;
const PIXELS_PER_INCH: number = 96; // Standard CSS DPI
const PIXELS_PER_MM: number = PIXELS_PER_INCH / MM_PER_INCH; // ~3.78 pixels per mm

// Conversion precision constants
export const THOUSANDTHS_PRECISION_FACTOR = 1000; // For rounding to thousandths (3 decimal places)

/**
 * Convert millimeters to inches
 * Rounds to thousandths of an inch (3 decimal places)
 */
export function mmToInch(mm: number): number {
    const inches = mm / MM_PER_INCH;
    return (
        Math.round(inches * THOUSANDTHS_PRECISION_FACTOR) /
        THOUSANDTHS_PRECISION_FACTOR
    );
}

/**
 * Convert inches to millimeters
 */
export function inchToMm(inch: number): number {
    return inch * MM_PER_INCH;
}

/**
 * Convert a value from mm to the current measurement system
 * Used for converting default values based on user's measurement system preference
 */
export function convertToCurrentSystem(
    valueInMm: number,
    measurementSystem: MeasurementSystem
): number {
    return measurementSystem === MeasurementSystem.Imperial
        ? mmToInch(valueInMm)
        : valueInMm;
}

/**
 * Get the pixels per unit for physical display scaling
 * This ensures that 1 unit on screen = 1 physical unit when zoom is 100%
 */
export function getPixelsPerUnit(unit: Unit): number {
    switch (unit) {
        case Unit.MM:
            return PIXELS_PER_MM; // ~3.78 pixels per mm
        case Unit.INCH:
            return PIXELS_PER_INCH; // 96 pixels per inch
        case Unit.NONE:
            return PIXELS_PER_MM; // Default to mm when no units specified
        default:
            return PIXELS_PER_MM; // Default to mm
    }
}

/**
 * Convert a value from one unit to another
 * Used for unit conversion when switching display units
 */
export function convertUnits(
    value: number,
    fromUnit: Unit,
    toUnit: Unit
): number {
    if (fromUnit === toUnit) {
        return value;
    }

    if (fromUnit === Unit.MM && toUnit === Unit.INCH) {
        return value / MM_PER_INCH;
    }

    if (fromUnit === Unit.INCH && toUnit === Unit.MM) {
        return value * MM_PER_INCH;
    }

    return value;
}

/**
 * Calculate the physical scale factor needed to display geometry
 * at the correct physical size for the selected display unit
 */
export function getPhysicalScaleFactor(
    geometryUnit: Unit,
    displayUnit: Unit
): number {
    // Scale factor to display geometry values as if they were in display units
    // Example: 186.2mm geometry displayed as inches should appear 186.2" on screen
    return getPixelsPerUnit(displayUnit);
}

/**
 * Format a numeric value with appropriate precision for the given unit
 */
export function formatValue(value: number, unit: Unit): string {
    const precision: number =
        unit === Unit.INCH ? INCH_DISPLAY_PRECISION : MM_DISPLAY_PRECISION;
    return value.toFixed(precision);
}

/**
 * Get the unit symbol for display
 */
export function getUnitSymbol(unit: Unit): string {
    switch (unit) {
        case Unit.MM:
            return 'mm';
        case Unit.INCH:
            return 'in.';
        case Unit.NONE:
            return 'none';
        default:
            return '';
    }
}

/**
 * Get the unit symbol based on measurement system setting
 * This provides reactive unit symbols for UI components
 */
export function getReactiveUnitSymbol(
    measurementSystem: MeasurementSystem
): string {
    switch (measurementSystem) {
        case 'metric':
            return 'mm';
        case 'imperial':
            return 'in.';
        default:
            return 'mm';
    }
}

/**
 * Convert Unit enum to MeasurementSystem
 */
export function unitToMeasurementSystem(unit: Unit): MeasurementSystem {
    switch (unit) {
        case Unit.MM:
            return MeasurementSystem.Metric;
        case Unit.INCH:
            return MeasurementSystem.Imperial;
        case Unit.NONE:
            return MeasurementSystem.Metric; // Default to metric when no units specified
        default:
            return MeasurementSystem.Metric;
    }
}

/**
 * Convert MeasurementSystem to Unit enum
 */
export function measurementSystemToUnit(system: MeasurementSystem): Unit {
    switch (system) {
        case MeasurementSystem.Metric:
            return Unit.MM;
        case MeasurementSystem.Imperial:
            return Unit.INCH;
        default:
            return Unit.MM;
    }
}

/**
 * Convert coordinates from one unit system to another
 * Used during import when file units differ from application setting
 */
export function convertCoordinates(
    coordinates: number[],
    fromUnit: Unit,
    toUnit: Unit
): number[] {
    if (fromUnit === toUnit) {
        return coordinates;
    }

    return coordinates.map((coord) => convertUnits(coord, fromUnit, toUnit));
}

/**
 * Type guard for checking if a value is a valid Unit
 */
export function isUnit(value: string): value is Unit {
    return Object.values(Unit).includes(value as Unit);
}
