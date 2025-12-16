/**
 * Geometry Default Configuration
 *
 * Provides default values for geometric operations and calculations.
 * These values are used across various geometry-related algorithms.
 */

import { MeasurementSystem } from '$lib/config/settings/enums';
import { convertToCurrentSystem } from '$lib/config/units/units';
import { DEFAULT_ORIGIN_CROSS_SIZE_MM } from '$lib/geometry/constants';

/**
 * Geometric precision tolerance for shape matching and distance calculations (in mm)
 * Internal constant - use GeometryDefaults.precisionTolerance for unit-aware access
 */
const GEOMETRIC_PRECISION_TOLERANCE_MM: number = 0.001;

/**
 * Curve tessellation tolerance for adaptive sampling (in mm)
 * This controls the maximum chord error (sagitta) when approximating arcs
 * 0.01mm provides smooth curves while maintaining reasonable point counts
 * Separate from GEOMETRIC_PRECISION_TOLERANCE which is for point coincidence
 */
export const CURVE_TESSELLATION_TOLERANCE_MM = 0.0001;

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
     * Get default origin cross size for canvas background rendering
     */
    get originCrossSize(): number {
        return convertToCurrentSystem(
            DEFAULT_ORIGIN_CROSS_SIZE_MM,
            this.measurementSystem
        );
    }

    /**
     * Get precision tolerance with unit conversion applied
     * Used for geometric comparisons and shape matching
     */
    get precisionTolerance(): number {
        return convertToCurrentSystem(
            GEOMETRIC_PRECISION_TOLERANCE_MM,
            this.measurementSystem
        );
    }

    /**
     * Get curve tessellation tolerance with unit conversion applied
     * Used for adaptive arc sampling to control curve approximation quality
     */
    get tessellationTolerance(): number {
        return convertToCurrentSystem(
            CURVE_TESSELLATION_TOLERANCE_MM,
            this.measurementSystem
        );
    }
}
