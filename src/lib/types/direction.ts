/**
 * Direction Logic Enums
 *
 * This file centralizes all direction-related constants and enums to improve
 * type safety, code clarity, and reduce errors in geometric calculations.
 */

/**
 * Cut Direction - Specifies the direction for cutting operations
 */
export enum CutDirection {
    CLOCKWISE = 'clockwise',
    COUNTERCLOCKWISE = 'counterclockwise',
    NONE = 'none',
}

/**
 * Lead Type - Specifies the type of lead-in/lead-out geometry
 */
export enum LeadType {
    ARC = 'arc',
    LINE = 'line',
    NONE = 'none',
}

/**
 * Geometric Direction - Semantic directions for geometric operations
 */
export enum GeometricDirection {
    LEFT = 'left',
    RIGHT = 'right',
    UP = 'up',
    DOWN = 'down',
    INWARD = 'inward',
    OUTWARD = 'outward',
    FORWARD = 'forward',
    BACKWARD = 'backward',
}

/**
 * Coordinate System - Different coordinate system conventions
 */
export enum CoordinateSystem {
    SCREEN = 'screen', // Y+ down (canvas coordinates)
    WORLD = 'world', // Y+ up (CAD/engineering coordinates)
    UNIT_CIRCLE = 'unit', // Standard mathematical unit circle
}

/**
 * Angle Unit - Units for angle measurements
 */
export enum AngleUnit {
    DEGREES = 'degrees',
    RADIANS = 'radians',
}

/**
 * Cardinal Direction - Standard compass directions
 */
export enum CardinalDirection {
    NORTH = 'north', // 90° or π/2 radians
    EAST = 'east', // 0° or 0 radians
    SOUTH = 'south', // 270° or 3π/2 radians
    WEST = 'west', // 180° or π radians
}

/**
 * Rotation Direction - Direction of rotation
 */
export enum RotationDirection {
    CLOCKWISE = 'clockwise',
    COUNTERCLOCKWISE = 'counterclockwise',
}

/**
 * Direction utilities and conversion functions
 */
export class DirectionUtils {
    /**
     * Convert CutDirection to RotationDirection
     */
    static cutDirectionToRotation(
        cutDir: CutDirection
    ): RotationDirection | null {
        switch (cutDir) {
            case CutDirection.CLOCKWISE:
                return RotationDirection.CLOCKWISE;
            case CutDirection.COUNTERCLOCKWISE:
                return RotationDirection.COUNTERCLOCKWISE;
            case CutDirection.NONE:
                return null;
            default:
                return null;
        }
    }

    /**
     * Get opposite cut direction
     */
    static oppositeCutDirection(cutDir: CutDirection): CutDirection {
        switch (cutDir) {
            case CutDirection.CLOCKWISE:
                return CutDirection.COUNTERCLOCKWISE;
            case CutDirection.COUNTERCLOCKWISE:
                return CutDirection.CLOCKWISE;
            case CutDirection.NONE:
                return CutDirection.NONE;
            default:
                return CutDirection.NONE;
        }
    }

    /**
     * Convert angle degrees to radians
     */
    static degreesToRadians(degrees: number): number {
        return (degrees * Math.PI) / 180;
    }

    /**
     * Convert angle radians to degrees
     */
    static radiansToDegrees(radians: number): number {
        return (radians * 180) / Math.PI;
    }

    /**
     * Normalize angle to be within -π to π range
     */
    static normalizeRadians(angle: number): number {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    /**
     * Normalize angle to be within 0 to 360 degrees range
     */
    static normalizeDegrees(angle: number): number {
        while (angle >= 360) angle -= 360;
        while (angle < 0) angle += 360;
        return angle;
    }

    /**
     * Convert angle between coordinate systems
     */
    static convertAngle(
        angle: number,
        unit: AngleUnit,
        fromSystem: CoordinateSystem,
        toSystem: CoordinateSystem
    ): number {
        if (fromSystem === toSystem) return angle;

        let radians: number =
            unit === AngleUnit.DEGREES ? this.degreesToRadians(angle) : angle;

        // Convert from source coordinate system to standard (unit circle)
        if (fromSystem === CoordinateSystem.SCREEN) {
            // Screen coordinates: Y+ down, so flip Y component
            radians = -radians;
        } else if (fromSystem === CoordinateSystem.WORLD) {
            // World coordinates: Y+ up, matches unit circle
            // No conversion needed
        }

        // Convert from standard to target coordinate system
        if (toSystem === CoordinateSystem.SCREEN) {
            // Convert to screen coordinates: Y+ down
            radians = -radians;
        } else if (toSystem === CoordinateSystem.WORLD) {
            // World coordinates match unit circle
            // No conversion needed
        }

        return unit === AngleUnit.DEGREES
            ? this.radiansToDegrees(radians)
            : radians;
    }

    /**
     * Get unit vector for a cardinal direction
     */
    static getCardinalVector(direction: CardinalDirection): {
        x: number;
        y: number;
    } {
        switch (direction) {
            case CardinalDirection.EAST:
                return { x: 1, y: 0 };
            case CardinalDirection.NORTH:
                return { x: 0, y: 1 };
            case CardinalDirection.WEST:
                return { x: -1, y: 0 };
            case CardinalDirection.SOUTH:
                return { x: 0, y: -1 };
            default:
                return { x: 1, y: 0 };
        }
    }

    /**
     * Get angle in radians for a cardinal direction
     */
    static getCardinalAngle(direction: CardinalDirection): number {
        switch (direction) {
            case CardinalDirection.EAST:
                return 0;
            case CardinalDirection.NORTH:
                return Math.PI / 2;
            case CardinalDirection.WEST:
                return Math.PI;
            case CardinalDirection.SOUTH:
                return (3 * Math.PI) / 2;
            default:
                return 0;
        }
    }

    /**
     * Check if a CutDirection is valid
     */
    static isValidCutDirection(value: string): value is CutDirection {
        return Object.values(CutDirection).includes(value as CutDirection);
    }

    /**
     * Check if a LeadType is valid
     */
    static isValidLeadType(value: string): value is LeadType {
        return Object.values(LeadType).includes(value as LeadType);
    }

    /**
     * Get human-readable description of cut direction
     */
    static describeCutDirection(cutDir: CutDirection): string {
        switch (cutDir) {
            case CutDirection.CLOCKWISE:
                return 'Clockwise (CW)';
            case CutDirection.COUNTERCLOCKWISE:
                return 'Counterclockwise (CCW)';
            case CutDirection.NONE:
                return 'No specific direction';
            default:
                return 'Unknown direction';
        }
    }
}

/**
 * Type guards for runtime type checking
 */
export const isLeadType: (value: unknown) => value is LeadType = (
    value: unknown
): value is LeadType => {
    return Object.values(LeadType).includes(value as LeadType);
};

export const isCutDirection: (value: unknown) => value is CutDirection = (
    value: unknown
): value is CutDirection => {
    return Object.values(CutDirection).includes(value as CutDirection);
};

export const isGeometricDirection: (
    value: unknown
) => value is GeometricDirection = (
    value: unknown
): value is GeometricDirection => {
    return Object.values(GeometricDirection).includes(
        value as GeometricDirection
    );
};

/**
 * Default values for common use cases
 */
export const DEFAULT_CUT_DIRECTION: CutDirection = CutDirection.NONE;
export const DEFAULT_LEAD_TYPE: LeadType = LeadType.NONE;
export const DEFAULT_COORDINATE_SYSTEM: CoordinateSystem =
    CoordinateSystem.WORLD;
