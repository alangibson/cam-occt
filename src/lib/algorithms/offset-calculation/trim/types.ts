import type { Shape } from '$lib/types/geometry';
import type { TrimPoint } from '../chain/types';

/**
 * Specifies which side of a shape to keep when trimming
 */

export type KeepSide = 'start' | 'end' | 'before' | 'after';
/**
 * Result of a shape trimming operation
 */

export interface TrimResult {
    /** Whether the trim operation was successful */
    success: boolean;

    /** The trimmed shape (null if trim failed) */
    shape: Shape | null;

    /** Information about the trim operation */
    trimPoint?: TrimPoint;

    /** Any warnings generated during trimming */
    warnings: string[];

    /** Any errors that occurred during trimming */
    errors: string[];
}
