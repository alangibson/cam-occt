import type { Shape } from '$lib/geometry/shape';

/**
 * Direction for offset operation
 */
export enum OffsetDirection {
    NONE = 'none',
    INSET = 'inset',
    OUTSET = 'outset',
}

/**
 * Result of an offset operation
 */
export interface OffsetResult {
    success: boolean;
    shapes: Shape[];
    warnings: string[];
    errors: string[];
}
