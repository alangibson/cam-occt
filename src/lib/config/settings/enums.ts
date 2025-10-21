/**
 * Application measurement system options
 */
export enum MeasurementSystem {
    Metric = 'metric',
    Imperial = 'imperial',
}

/**
 * Import unit preference options
 */
export enum ImportUnitSetting {
    Automatic = 'automatic', // Use file's units, fall back to application setting if not specified
    Application = 'application', // Always use application's measurement system
    Metric = 'metric', // Force metric units during import
    Imperial = 'imperial',
}

/**
 * Selection mode options for canvas interaction
 */
export enum SelectionMode {
    Auto = 'auto', // Stage-dependent selection (default)
    Chain = 'chain', // Only chains can be selected/hovered
    Shape = 'shape', // Only individual shapes can be selected/hovered
    Part = 'part', // Only parts can be selected/hovered
    Cut = 'cut', // Only cuts can be selected/hovered
    Lead = 'lead',
    Kerf = 'kerf', // Only kerfs can be selected/hovered
}

/**
 * Preprocessing step identifiers
 */
export enum PreprocessingStep {
    DecomposePolylines = 'decomposePolylines',
    JoinColinearLines = 'joinColinearLines',
    TranslateToPositive = 'translateToPositive',
    DetectChains = 'detectChains',
    NormalizeChains = 'normalizeChains',
    OptimizeStarts = 'optimizeStarts',
    DetectParts = 'detectParts',
}

/**
 * Rapid optimization algorithm options
 */
export enum RapidOptimizationAlgorithm {
    None = 'none',
    TravelingSalesman = 'traveling-salesman',
}

/**
 * Offset calculation implementation options
 */
export enum OffsetImplementation {
    Exact = 'exact', // Existing TypeScript implementation (preserves curves)
    Polyline = 'polyline',
}
