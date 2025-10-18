/**
 * Algorithm Default Configuration
 *
 * Provides default values for various algorithm parameters including
 * tolerances, optimization settings, and processing parameters.
 */

import { MeasurementSystem } from '$lib/stores/settings/interfaces';
import { convertToCurrentSystem } from '$lib/utils/units';
import {
    DEFAULT_JOIN_COLINEAR_LINES_PARAMETERS_MM,
    DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS_MM,
    type JoinColinearLinesParameters,
    type StartPointOptimizationParameters,
} from '$lib/preprocessing/algorithm-parameters';
import { type PartDetectionParameters } from '$lib/cam/part/interfaces';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';

export class AlgorithmDefaults {
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
     * Get join colinear lines parameters with converted tolerances
     */
    get joinColinearLinesParameters(): JoinColinearLinesParameters {
        return {
            tolerance: convertToCurrentSystem(
                DEFAULT_JOIN_COLINEAR_LINES_PARAMETERS_MM.tolerance,
                this.measurementSystem
            ),
        };
    }

    /**
     * Get start point optimization parameters with converted tolerances
     */
    get startPointOptimizationParameters(): StartPointOptimizationParameters {
        return {
            splitPosition:
                DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS_MM.splitPosition,
            tolerance: convertToCurrentSystem(
                DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS_MM.tolerance,
                this.measurementSystem
            ),
        };
    }

    /**
     * Get part detection parameters (no unit conversion needed - counts and ratios)
     */
    get partDetectionParameters(): PartDetectionParameters {
        return DEFAULT_PART_DETECTION_PARAMETERS;
    }
}
