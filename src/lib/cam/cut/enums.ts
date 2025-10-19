/**
 * Normal side relative to cut direction (for machine cutter compensation)
 */

export enum NormalSide {
    LEFT = 'left',
    RIGHT = 'right',
    NONE = 'none',
}

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
 * Cut Direction - Specifies the direction for cutting operations
 */
export enum CutDirection {
    CLOCKWISE = 'clockwise',
    COUNTERCLOCKWISE = 'counterclockwise',
    NONE = 'none',
}
