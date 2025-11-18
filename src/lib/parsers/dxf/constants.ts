// DXF INSUNITS constants
export const DXF_INSUNITS_INCHES = 1;
export const DXF_INSUNITS_FEET = 2;
export const DXF_INSUNITS_MILLIMETERS = 4;
export const DXF_INSUNITS_CENTIMETERS = 5;
export const DXF_INSUNITS_METERS = 6;
export const DEFAULT_ELLIPSE_START_PARAM = 0;
export const SCALING_AVERAGE_DIVISOR = 2;

// Unit conversion factors
export const CENTIMETERS_TO_MILLIMETERS = 10.0; // 1 cm = 10 mm
export const METERS_TO_MILLIMETERS = 1000.0; // 1 m = 1000 mm
export const FEET_TO_INCHES = 12.0; // 1 ft = 12 in

/**
 * Format raw DXF $INSUNITS value for display
 * Returns a human-readable unit name
 */
export function formatInsUnits(insUnits: number | undefined): string {
    if (insUnits === undefined) {
        return 'not specified';
    }

    switch (insUnits) {
        case DXF_INSUNITS_INCHES:
            return 'inches';
        case DXF_INSUNITS_FEET:
            return 'feet';
        case DXF_INSUNITS_MILLIMETERS:
            return 'mm';
        case DXF_INSUNITS_CENTIMETERS:
            return 'cm';
        case DXF_INSUNITS_METERS:
            return 'm';
        default:
            return `unknown (${insUnits})`;
    }
}
