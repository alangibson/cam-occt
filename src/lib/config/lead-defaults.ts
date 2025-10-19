/**
 * Lead Default Configuration
 *
 * Provides default values for lead-in and lead-out operations in plasma cutting.
 * Leads are essential for smooth torch entry/exit and help prevent material damage.
 */

import { MeasurementSystem } from './settings/enums';
import { convertToCurrentSystem } from '$lib/config/units/units';
import {
    DEFAULT_LEAD_IN_LENGTH_MM,
    DEFAULT_LEAD_OUT_LENGTH_MM,
    MINIMUM_SHELL_DISTANCE_MM,
    LEAD_PROXIMITY_THRESHOLD_MM,
} from '$lib/cam/lead/constants';
import { LeadType } from '$lib/cam/lead/enums';
import type { LeadConfig } from '$lib/cam/lead/interfaces';
import { getDefaults } from './defaults-manager';

export class LeadDefaults {
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
     * Get default lead-in length
     */
    get leadInLength(): number {
        return convertToCurrentSystem(
            DEFAULT_LEAD_IN_LENGTH_MM,
            this.measurementSystem
        );
    }

    /**
     * Get default lead-out length
     */
    get leadOutLength(): number {
        return convertToCurrentSystem(
            DEFAULT_LEAD_OUT_LENGTH_MM,
            this.measurementSystem
        );
    }

    /**
     * Get minimum shell distance for lead validation
     */
    get minimumShellDistance(): number {
        return convertToCurrentSystem(
            MINIMUM_SHELL_DISTANCE_MM,
            this.measurementSystem
        );
    }

    /**
     * Get lead proximity threshold for validation
     */
    get proximityThreshold(): number {
        return convertToCurrentSystem(
            LEAD_PROXIMITY_THRESHOLD_MM,
            this.measurementSystem
        );
    }
}

/**
 * Get default lead-in configuration based on current measurement system
 */

export function getDefaultLeadInConfig(): LeadConfig {
    const defaults = getDefaults();
    return {
        type: LeadType.ARC,
        length: defaults.lead.leadInLength, // Unit-aware default
        angle: 0,
        flipSide: false,
        fit: false,
    };
}

/**
 * Get default lead-out configuration based on current measurement system
 */
export function getDefaultLeadOutConfig(): LeadConfig {
    const defaults = getDefaults();
    return {
        type: LeadType.ARC,
        length: defaults.lead.leadOutLength, // Unit-aware default
        angle: 0,
        flipSide: false,
        fit: false,
    };
}
