/**
 * Optimize Starts Enum
 *
 * Defines how chain start points should be optimized for cutting operations.
 */

export enum OptimizeStarts {
    NONE = 'none',
    MIDPOINT = 'midpoint',
}

/**
 * Default value for optimize starts
 */
export const DEFAULT_OPTIMIZE_STARTS: OptimizeStarts = OptimizeStarts.MIDPOINT;
