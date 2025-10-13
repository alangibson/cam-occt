/**
 * CAM (Computer-Aided Manufacturing) Default Configuration
 *
 * Provides default values for CAM operations including pierce heights,
 * cut heights, feed rates, and other plasma cutting parameters.
 * All values are converted based on the current measurement system.
 */

import { MeasurementSystem } from '$lib/stores/settings/interfaces';
import { convertToCurrentSystem } from '$lib/utils/units';
import {
    DEFAULT_PIERCE_HEIGHT_MM,
    DEFAULT_CUT_HEIGHT_MM,
    DEFAULT_FEED_RATE_MM,
    IMPERIAL_FEED_RATE_MM,
    DEFAULT_PIERCE_DELAY,
    CAM_CALCULATION_TOLERANCE_MM,
    PERCENTAGE_MULTIPLIER,
    GCODE_COORDINATE_PRECISION,
    GCODE_PARAMETER_PRECISION,
    DEFAULT_KERF_WIDTH_MM,
    DEFAULT_PUDDLE_JUMP_HEIGHT_MM,
    DEFAULT_PLUNGE_RATE_MM,
    DEFAULT_RAPID_RATE_MM,
    IMPERIAL_RAPID_RATE_MM,
} from '$lib/cam/constants';

export class CamDefaults {
    private measurementSystem: MeasurementSystem;

    constructor(measurementSystem: MeasurementSystem) {
        this.measurementSystem = measurementSystem;
    }

    /**
     * Update the measurement system and recalculate all defaults
     */
    setMeasurementSystem(system: MeasurementSystem): void {
        this.measurementSystem = system;
    }

    /**
     * Get default pierce height for plasma cutting
     */
    get pierceHeight(): number {
        return convertToCurrentSystem(
            DEFAULT_PIERCE_HEIGHT_MM,
            this.measurementSystem
        );
    }

    /**
     * Get default cut height for plasma cutting
     */
    get cutHeight(): number {
        return convertToCurrentSystem(
            DEFAULT_CUT_HEIGHT_MM,
            this.measurementSystem
        );
    }

    /**
     * Get default feed rate for plasma cutting (units/min)
     */
    get feedRate(): number {
        return convertToCurrentSystem(
            DEFAULT_FEED_RATE_MM,
            this.measurementSystem
        );
    }

    /**
     * Get imperial-specific feed rate (converted if needed)
     */
    get imperialFeedRate(): number {
        return convertToCurrentSystem(
            IMPERIAL_FEED_RATE_MM,
            this.measurementSystem
        );
    }

    /**
     * Get default pierce delay (seconds - no unit conversion needed)
     */
    get pierceDelay(): number {
        return DEFAULT_PIERCE_DELAY;
    }

    /**
     * Get CAM calculation tolerance
     */
    get calculationTolerance(): number {
        return convertToCurrentSystem(
            CAM_CALCULATION_TOLERANCE_MM,
            this.measurementSystem
        );
    }

    /**
     * Get percentage multiplier (no unit conversion needed)
     */
    get percentageMultiplier(): number {
        return PERCENTAGE_MULTIPLIER;
    }

    /**
     * Get G-code coordinate precision (decimal places - no unit conversion needed)
     */
    get gcodeCoordinatePrecision(): number {
        return GCODE_COORDINATE_PRECISION;
    }

    /**
     * Get G-code parameter precision (decimal places - no unit conversion needed)
     */
    get gcodeParameterPrecision(): number {
        return GCODE_PARAMETER_PRECISION;
    }

    /**
     * Get default kerf width for plasma cutting
     */
    get kerfWidth(): number {
        return convertToCurrentSystem(
            DEFAULT_KERF_WIDTH_MM,
            this.measurementSystem
        );
    }

    /**
     * Get default puddle jump height for plasma cutting
     */
    get puddleJumpHeight(): number {
        return convertToCurrentSystem(
            DEFAULT_PUDDLE_JUMP_HEIGHT_MM,
            this.measurementSystem
        );
    }

    /**
     * Get default plunge rate for plasma cutting (units/min)
     */
    get plungeRate(): number {
        return convertToCurrentSystem(
            DEFAULT_PLUNGE_RATE_MM,
            this.measurementSystem
        );
    }

    /**
     * Get default rapid rate for plasma cutting (units/min)
     * Uses appropriate rate based on measurement system (like feed rate does)
     */
    get rapidRate(): number {
        const rapidRateMM =
            this.measurementSystem === MeasurementSystem.Imperial
                ? IMPERIAL_RAPID_RATE_MM
                : DEFAULT_RAPID_RATE_MM;

        return convertToCurrentSystem(rapidRateMM, this.measurementSystem);
    }
}
