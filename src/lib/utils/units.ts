/**
 * Unit conversion utilities for MetalHead CAM
 * Handles conversion between different units and physical display scaling
 */

/**
 * Unit display precision for inches (3 decimal places vs 1 for mm)
 */
const INCH_DISPLAY_PRECISION = 3;

export enum Unit {
    MM = 'mm',
    INCH = 'inch',
}

// Physical constants for screen display
const MM_PER_INCH: number = 25.4;
const PIXELS_PER_INCH: number = 96; // Standard CSS DPI
const PIXELS_PER_MM: number = PIXELS_PER_INCH / MM_PER_INCH; // ~3.78 pixels per mm

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
    const precision: number = unit === Unit.INCH ? INCH_DISPLAY_PRECISION : 1; // 3 decimal places for inches, 1 for mm
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
            return 'in';
        default:
            return '';
    }
}

/**
 * Type guard for checking if a value is a valid Unit
 */
export function isUnit(value: unknown): value is Unit {
    return Object.values(Unit).includes(value as Unit);
}
