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
    type AlgorithmParameters,
} from '$lib/preprocessing/algorithm-parameters';
import { type PartDetectionParameters } from '$lib/cam/part/interfaces';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';
import {
    DUPLICATE_FILTERING_TOLERANCE_MM,
    MAX_EXTENSION_MM,
    AREA_RATIO_THRESHOLD,
} from '$lib/algorithms/constants';
import { TOLERANCE } from '$lib/geometry/math';

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

    /**
     * Get duplicate filtering tolerance
     */
    get duplicateFilteringTolerance(): number {
        return convertToCurrentSystem(
            DUPLICATE_FILTERING_TOLERANCE_MM,
            this.measurementSystem
        );
    }

    /**
     * Get maximum extension for offset gap filling
     */
    get maxExtension(): number {
        return convertToCurrentSystem(MAX_EXTENSION_MM, this.measurementSystem);
    }

    /**
     * Get area ratio threshold (no unit conversion needed - it's a ratio)
     */
    get areaRatioThreshold(): number {
        return AREA_RATIO_THRESHOLD;
    }

    /**
     * Get base tolerance value (converted)
     */
    get baseTolerance(): number {
        return convertToCurrentSystem(TOLERANCE, this.measurementSystem);
    }

    /**
     * Get complete algorithm parameters with all converted values
     * Note: Chain defaults are handled separately by ChainDefaults class
     */
    get allParameters(): Partial<AlgorithmParameters> {
        return {
            joinColinearLines: this.joinColinearLinesParameters,
            startPointOptimization: this.startPointOptimizationParameters,
            partDetection: this.partDetectionParameters,
            // chainDetection and chainNormalization are handled by ChainDefaults
        };
    }
}
