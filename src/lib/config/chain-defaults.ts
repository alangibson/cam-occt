/**
 * Chain Default Configuration
 *
 * Provides default values for chain detection and normalization operations.
 * Chains are connected sequences of shapes that form continuous cuts.
 */

import { MeasurementSystem } from './settings/enums';
import { convertToCurrentSystem } from '$lib/config/units/units';
import {
    DEFAULT_CHAIN_DETECTION_PARAMETERS_MM,
    DEFAULT_CHAIN_NORMALIZATION_PARAMETERS_MM,
    type ChainDetectionParameters,
    type ChainNormalizationParameters,
} from '$lib/preprocessing/algorithm-parameters';

export class ChainDefaults {
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
     * Get chain detection parameters with converted tolerances
     */
    get detectionParameters(): ChainDetectionParameters {
        return {
            tolerance: convertToCurrentSystem(
                DEFAULT_CHAIN_DETECTION_PARAMETERS_MM.tolerance,
                this.measurementSystem
            ),
        };
    }

    /**
     * Get chain detection tolerance only
     */
    get detectionTolerance(): number {
        return convertToCurrentSystem(
            DEFAULT_CHAIN_DETECTION_PARAMETERS_MM.tolerance,
            this.measurementSystem
        );
    }

    /**
     * Get chain normalization parameters with converted tolerances
     */
    get normalizationParameters(): ChainNormalizationParameters {
        return {
            traversalTolerance: convertToCurrentSystem(
                DEFAULT_CHAIN_NORMALIZATION_PARAMETERS_MM.traversalTolerance,
                this.measurementSystem
            ),
            maxTraversalAttempts:
                DEFAULT_CHAIN_NORMALIZATION_PARAMETERS_MM.maxTraversalAttempts, // No conversion needed
        };
    }

    /**
     * Get chain traversal tolerance only
     */
    get traversalTolerance(): number {
        return convertToCurrentSystem(
            DEFAULT_CHAIN_NORMALIZATION_PARAMETERS_MM.traversalTolerance,
            this.measurementSystem
        );
    }

    /**
     * Get maximum traversal attempts (no unit conversion needed)
     */
    get maxTraversalAttempts(): number {
        return DEFAULT_CHAIN_NORMALIZATION_PARAMETERS_MM.maxTraversalAttempts;
    }
}
