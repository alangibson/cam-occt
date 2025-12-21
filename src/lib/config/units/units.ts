/**
 * Unit conversion utilities for MetalHead CAM
 * Handles conversion between different units and physical display scaling
 */

import { MeasurementSystem } from '$lib/config/settings/enums';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import { GeometryType } from '$lib/geometry/enums';

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
function mmToInch(mm: number): number {
    const inches = mm / MM_PER_INCH;
    return (
        Math.round(inches * THOUSANDTHS_PRECISION_FACTOR) /
        THOUSANDTHS_PRECISION_FACTOR
    );
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
 * Convert all coordinates in a DrawingData object from one unit to another
 * Recursively processes all shapes and their geometries
 */
export function convertDrawingCoordinates(
    drawing: DrawingData,
    fromUnit: Unit,
    toUnit: Unit
): DrawingData {
    if (fromUnit === toUnit || fromUnit === Unit.NONE) {
        return drawing;
    }

    // Helper to convert a single coordinate value
    const convert = (value: number): number =>
        convertUnits(value, fromUnit, toUnit);

    // Helper to convert a point
    const convertPoint = (point: {
        x: number;
        y: number;
    }): { x: number; y: number } => ({
        x: convert(point.x),
        y: convert(point.y),
    });

    // Helper to convert a shape's geometry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convertShapeGeometry = (shape: any): any => {
        const { type, geometry } = shape;

        switch (type) {
            case GeometryType.LINE:
                return {
                    ...shape,
                    geometry: {
                        start: convertPoint(geometry.start),
                        end: convertPoint(geometry.end),
                    },
                };

            case GeometryType.CIRCLE:
                return {
                    ...shape,
                    geometry: {
                        center: convertPoint(geometry.center),
                        radius: convert(geometry.radius),
                    },
                };

            case GeometryType.ARC:
                return {
                    ...shape,
                    geometry: {
                        center: convertPoint(geometry.center),
                        radius: convert(geometry.radius),
                        startAngle: geometry.startAngle,
                        endAngle: geometry.endAngle,
                        clockwise: geometry.clockwise,
                    },
                };

            case GeometryType.ELLIPSE:
                return {
                    ...shape,
                    geometry: {
                        center: convertPoint(geometry.center),
                        majorAxisEndpoint: convertPoint(
                            geometry.majorAxisEndpoint
                        ),
                        minorToMajorRatio: geometry.minorToMajorRatio,
                        startParam: geometry.startParam,
                        endParam: geometry.endParam,
                    },
                };

            case GeometryType.SPLINE:
                return {
                    ...shape,
                    geometry: {
                        controlPoints: geometry.controlPoints.map(convertPoint),
                        knots: geometry.knots,
                        weights: geometry.weights,
                        degree: geometry.degree,
                        fitPoints: geometry.fitPoints.map(convertPoint),
                        closed: geometry.closed,
                    },
                };

            case GeometryType.POLYLINE:
                return {
                    ...shape,
                    geometry: {
                        closed: geometry.closed,
                        shapes: geometry.shapes.map(convertShapeGeometry),
                    },
                };

            default:
                return shape;
        }
    };

    // Convert all shapes
    const convertedShapes = drawing.shapes.map(convertShapeGeometry);

    return {
        ...drawing,
        shapes: convertedShapes,
        units: toUnit,
    };
}
