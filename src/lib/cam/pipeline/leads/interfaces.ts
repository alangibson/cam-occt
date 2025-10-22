/**
 * Interfaces for lead orchestration pipeline
 */

import type { Lead } from '$lib/cam/lead/interfaces';

/**
 * Result from calculating lead geometry for a cut
 */
export interface CutLeadResult {
    /** Lead-in geometry */
    leadIn?: Lead;
    /** Lead-out geometry */
    leadOut?: Lead;
    /** Validation results for the lead calculations */
    validation?: LeadValidation;
}

/**
 * Lead validation result
 */
export interface LeadValidation {
    /** Whether the leads are valid */
    isValid: boolean;
    /** Warning messages */
    warnings: string[];
    /** Error messages */
    errors: string[];
    /** Severity level */
    severity: 'info' | 'warning' | 'error';
}
