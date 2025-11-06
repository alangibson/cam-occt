import type { ChainOffsetParameters } from './types';

/**
 * Maximum offset gap filling extension length (mm)
 */
const MAX_EXTENSION_MM: number = 20;

/**
 * Default parameters for chain offset operations
 */
export const DEFAULT_CHAIN_OFFSET_PARAMETERS: ChainOffsetParameters = {
    tolerance: 0.05,
    maxExtension: MAX_EXTENSION_MM,
    snapThreshold: 0.1,
    validateInvariants: true,
    maxIterations: 100,
    polylineIntersections: false,
};
