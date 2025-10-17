import type { PartDetectionParameters } from './interfaces';

export const DEFAULT_PART_DETECTION_PARAMETERS: PartDetectionParameters = {
    circleTessellationPoints: 64,
    arcTessellationTolerance: 0.1, // 0.1 mm maximum chord error
    decimalPrecision: 3,
    enableTessellation: false,
};
