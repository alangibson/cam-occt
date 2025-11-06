/**
 * Interfaces for kerf generation pipeline
 */

/**
 * Result from kerf generation with adjustment attempt
 */
export interface KerfGenerationResult {
    /** Whether the kerf was generated successfully */
    success: boolean;
    /** Whether start point adjustment was attempted */
    adjustmentAttempted?: boolean;
    /** Whether start point adjustment succeeded */
    adjustmentSucceeded?: boolean;
    /** Error message if generation failed */
    error?: string;
}
