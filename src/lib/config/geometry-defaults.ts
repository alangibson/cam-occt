/**
 * Geometry Default Configuration
 *
 * Provides default values for geometric operations and calculations.
 * These values are used across various geometry-related algorithms.
 */

import { MeasurementSystem } from '$lib/stores/settings/interfaces';
import { convertToCurrentSystem } from '$lib/utils/units';
import {
    DEFAULT_EXTENSION_LENGTH_MM,
    DEFAULT_ORIGIN_CROSS_SIZE_MM,
} from '$lib/geometry/constants';

export class GeometryDefaults {
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
     * Get default extension length for shape intersection calculations
     */
    get extensionLength(): number {
        return convertToCurrentSystem(
            DEFAULT_EXTENSION_LENGTH_MM,
            this.measurementSystem
        );
    }

    /**
     * Get default origin cross size for canvas background rendering
     */
    get originCrossSize(): number {
        return convertToCurrentSystem(
            DEFAULT_ORIGIN_CROSS_SIZE_MM,
            this.measurementSystem
        );
    }
}
