import type { Chain } from '$lib/geometry/chain/interfaces';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import { LeadType, CutDirection } from '$lib/types/direction';
import type { LeadInConfig, LeadOutConfig } from './lead-calculation';
import {
    getShapeStartPoint,
    getShapeEndPoint,
} from '$lib/geometry/shape/functions';
import type { Shape } from '$lib/types';
import { getShapeBoundingBox } from '../../utils/shape-bounds-utils';
import {
    HALF_PERCENT,
    GEOMETRIC_PRECISION_TOLERANCE,
} from '$lib/geometry/math';
import { MAX_ITERATIONS, STANDARD_GRID_SPACING } from '../../constants';
import { FULL_CIRCLE_DEG } from '$lib/geometry/circle';
import { POLYGON_POINTS_MIN } from '$lib/geometry/chain';

/**
 * Lead validation constants for lead distance validation
 */
const LEAD_PROXIMITY_THRESHOLD = 50;
const MINIMUM_SHELL_DISTANCE = 1.0;

export interface LeadValidationResult {
    isValid: boolean;
    warnings: string[];
    suggestions?: string[];
    severity: 'info' | 'warning' | 'error';
}

export interface LeadConfig {
    leadIn: LeadInConfig;
    leadOut: LeadOutConfig;
    cutDirection: CutDirection;
}

/**
 * Comprehensive validation pipeline for lead configurations.
 * Separates validation logic from calculation logic for better error handling.
 */
export function validateLeadConfiguration(
    config: LeadConfig,
    chain: Chain,
    part?: DetectedPart
): LeadValidationResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let severity: 'info' | 'warning' | 'error' = 'info';
    let isValid: boolean = true;

    // 1. Basic configuration validation
    const basicValidation: LeadValidationResult =
        validateBasicConfiguration(config);
    warnings.push(...basicValidation.warnings);
    suggestions.push(...(basicValidation.suggestions || []));
    if (basicValidation.severity === 'warning' && severity === 'info') {
        severity = 'warning';
    } else if (basicValidation.severity === 'error') {
        severity = 'error';
        isValid = false;
    }

    // 2. Chain geometry validation
    const chainValidation: LeadValidationResult = validateChainGeometry(
        chain,
        config
    );
    warnings.push(...chainValidation.warnings);
    suggestions.push(...(chainValidation.suggestions || []));
    if (chainValidation.severity === 'warning' && severity === 'info') {
        severity = 'warning';
    } else if (chainValidation.severity === 'error') {
        severity = 'error';
        isValid = false;
    }

    // 3. Part context validation
    if (part) {
        const partValidation: LeadValidationResult = validatePartContext(
            config,
            chain,
            part
        );
        warnings.push(...partValidation.warnings);
        suggestions.push(...(partValidation.suggestions || []));
        if (partValidation.severity === 'warning' && severity === 'info') {
            severity = 'warning';
        } else if (partValidation.severity === 'error') {
            severity = 'error';
            isValid = false;
        }
    }

    // 4. Lead length validation
    const lengthValidation: LeadValidationResult = validateLeadLengths(config);
    warnings.push(...lengthValidation.warnings);
    suggestions.push(...(lengthValidation.suggestions || []));
    if (lengthValidation.severity === 'warning' && severity === 'info') {
        severity = 'warning';
    }

    // 5. Cut direction compatibility
    const directionValidation: LeadValidationResult =
        validateCutDirectionCompatibility(config, chain);
    warnings.push(...directionValidation.warnings);
    suggestions.push(...(directionValidation.suggestions || []));
    if (directionValidation.severity === 'warning' && severity === 'info') {
        severity = 'warning';
    }

    return {
        isValid,
        warnings,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        severity,
    };
}

/**
 * Validate basic configuration parameters
 */
function validateBasicConfiguration(config: LeadConfig): LeadValidationResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let isValid: boolean = true;
    let severity: 'info' | 'warning' | 'error' = 'info';

    // Check for negative lengths
    if (config.leadIn.length < 0) {
        warnings.push('Lead-in length cannot be negative');
        suggestions.push('Set lead-in length to 0 or a positive value');
        severity = 'error';
        isValid = false;
    }

    if (config.leadOut.length < 0) {
        warnings.push('Lead-out length cannot be negative');
        suggestions.push('Set lead-out length to 0 or a positive value');
        severity = 'error';
        isValid = false;
    }

    // Check for invalid lead types with non-zero lengths
    if (config.leadIn.type === LeadType.NONE && config.leadIn.length > 0) {
        warnings.push('Lead-in type is "none" but length is greater than 0');
        suggestions.push(
            'Set lead-in length to 0 or change type to "line" or "arc"'
        );
        if (severity === 'info') severity = 'warning';
    }

    if (config.leadOut.type === LeadType.NONE && config.leadOut.length > 0) {
        warnings.push('Lead-out type is "none" but length is greater than 0');
        suggestions.push(
            'Set lead-out length to 0 or change type to "line" or "arc"'
        );
        if (severity === 'info') severity = 'warning';
    }

    // Check for valid angle ranges if specified
    if (
        config.leadIn.angle !== undefined &&
        (config.leadIn.angle < 0 || config.leadIn.angle >= FULL_CIRCLE_DEG)
    ) {
        warnings.push('Lead-in angle must be between 0 and 359 degrees');
        suggestions.push(
            'Adjust lead-in angle to be within 0-359 degree range'
        );
        severity = 'error';
        isValid = false;
    }

    if (
        config.leadOut.angle !== undefined &&
        (config.leadOut.angle < 0 || config.leadOut.angle >= FULL_CIRCLE_DEG)
    ) {
        warnings.push('Lead-out angle must be between 0 and 359 degrees');
        suggestions.push(
            'Adjust lead-out angle to be within 0-359 degree range'
        );
        severity = 'error';
        isValid = false;
    }

    return { isValid, warnings, suggestions, severity };
}

/**
 * Validate chain geometry constraints
 */
function validateChainGeometry(
    chain: Chain,
    config: LeadConfig
): LeadValidationResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let isValid: boolean = true;
    let severity: 'info' | 'warning' | 'error' = 'info';

    // Check if chain is empty
    if (!chain.shapes || chain.shapes.length === 0) {
        warnings.push('Cannot generate leads for empty chain');
        suggestions.push('Ensure the chain contains at least one shape');
        severity = 'error';
        isValid = false;
        return { isValid, warnings, suggestions, severity };
    }

    // Check for very small chains where leads might be problematic
    const chainBounds: {
        width: number;
        height: number;
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    } = calculateChainBounds(chain);
    const chainSize: number = Math.max(chainBounds.width, chainBounds.height);

    // Check lead-in length relative to chain size
    if (
        config.leadIn.type !== LeadType.NONE &&
        config.leadIn.length > chainSize * 2
    ) {
        warnings.push('Lead-in length is very large compared to chain size');
        suggestions.push(
            `Consider reducing lead-in length to less than ${(chainSize * 2).toFixed(1)} units`
        );
        severity = 'warning';
    }

    // Check lead-out length relative to chain size
    if (
        config.leadOut.type !== LeadType.NONE &&
        config.leadOut.length > chainSize * 2
    ) {
        warnings.push('Lead-out length is very large compared to chain size');
        suggestions.push(
            `Consider reducing lead-out length to less than ${(chainSize * 2).toFixed(1)} units`
        );
        severity = 'warning';
    }

    // Check for very small chains with long leads
    if (
        chainSize < POLYGON_POINTS_MIN &&
        (config.leadIn.length > STANDARD_GRID_SPACING ||
            config.leadOut.length > STANDARD_GRID_SPACING)
    ) {
        warnings.push(
            'Chain is very small but leads are long - may cause intersection issues'
        );
        suggestions.push('Consider using shorter leads for small geometry');
        severity = 'warning';
    }

    return { isValid, warnings, suggestions, severity };
}

/**
 * Validate part context constraints (holes vs shells)
 */
function validatePartContext(
    config: LeadConfig,
    chain: Chain,
    part: DetectedPart
): LeadValidationResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const isValid: boolean = true;
    let severity: 'info' | 'warning' | 'error' = 'info';

    const isHole: boolean = part.holes.some((h) => h.chain.id === chain.id);
    const isShell: boolean = part.shell.chain.id === chain.id;

    if (!isHole && !isShell) {
        warnings.push('Chain is not recognized as part of the specified part');
        suggestions.push('Verify that the chain belongs to the correct part');
        severity = 'warning';
        return { isValid, warnings, suggestions, severity };
    }

    // Check for potential collision issues with holes
    if (isShell && part.holes.length > 0) {
        const shellBounds: {
            width: number;
            height: number;
            minX: number;
            maxX: number;
            minY: number;
            maxY: number;
        } = calculateChainBounds(chain);

        // Check if leads might intersect with holes
        for (const hole of part.holes) {
            const holeBounds: {
                width: number;
                height: number;
                minX: number;
                maxX: number;
                minY: number;
                maxY: number;
            } = calculateChainBounds(hole.chain);
            const maxLeadLength: number = Math.max(
                config.leadIn.length,
                config.leadOut.length
            );

            // Simple proximity check - only warn for extremely close holes with very long leads
            // Let actual solid area detection handle most cases
            const minDistanceToShell: number =
                calculateMinDistanceBetweenBounds(shellBounds, holeBounds);
            if (
                minDistanceToShell < MINIMUM_SHELL_DISTANCE &&
                maxLeadLength > LEAD_PROXIMITY_THRESHOLD
            ) {
                // Only warn for very close holes and very long leads
                warnings.push(
                    `Lead may intersect with nearby hole (${hole.id})`
                );
                suggestions.push(
                    'Consider reducing lead length or adjusting lead angle'
                );
                severity = 'warning';
            }
        }
    }

    // Check for hole lead direction
    if (isHole) {
        warnings.push(
            'Generating leads for hole - leads will be placed inside the hole'
        );
        // Don't change severity to info if it's already warning/error
    }

    return { isValid, warnings, suggestions, severity };
}

/**
 * Validate lead lengths for practical machining
 */
function validateLeadLengths(config: LeadConfig): LeadValidationResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let severity: 'info' | 'warning' | 'error' = 'info';

    // Check for very long leads
    const maxRecommendedLength: number = MAX_ITERATIONS; // Reasonable limit for lead lengths

    if (config.leadIn.length > maxRecommendedLength) {
        warnings.push(`Lead-in length (${config.leadIn.length}) is very long`);
        suggestions.push(
            `Consider reducing lead-in length to under ${maxRecommendedLength} units`
        );
        severity = 'warning';
    }

    if (config.leadOut.length > maxRecommendedLength) {
        warnings.push(
            `Lead-out length (${config.leadOut.length}) is very long`
        );
        suggestions.push(
            `Consider reducing lead-out length to under ${maxRecommendedLength} units`
        );
        severity = 'warning';
    }

    // Check for very short but non-zero leads
    const minRecommendedLength: number = HALF_PERCENT;

    if (
        config.leadIn.type !== LeadType.NONE &&
        config.leadIn.length > 0 &&
        config.leadIn.length < minRecommendedLength
    ) {
        warnings.push(`Lead-in length (${config.leadIn.length}) is very short`);
        suggestions.push(
            `Consider using length of at least ${minRecommendedLength} units or setting to 0`
        );
        severity = 'info';
    }

    if (
        config.leadOut.type !== LeadType.NONE &&
        config.leadOut.length > 0 &&
        config.leadOut.length < minRecommendedLength
    ) {
        warnings.push(
            `Lead-out length (${config.leadOut.length}) is very short`
        );
        suggestions.push(
            `Consider using length of at least ${minRecommendedLength} units or setting to 0`
        );
        severity = 'info';
    }

    return { isValid: true, warnings, suggestions, severity };
}

/**
 * Validate cut direction compatibility with lead configuration
 */
function validateCutDirectionCompatibility(
    config: LeadConfig,
    chain: Chain
): LeadValidationResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let severity: 'info' | 'warning' | 'error' = 'info';

    // Check if cut direction is specified for closed chains
    const isClosed: boolean = isChainClosed(chain);

    if (isClosed && config.cutDirection === CutDirection.NONE) {
        warnings.push('Closed chain detected but cut direction is "none"');
        suggestions.push(
            'Consider specifying "clockwise" or "counterclockwise" cut direction for better lead tangency'
        );
        severity = 'info';
    }

    // Check if cut direction is specified for open chains (not needed)
    if (!isClosed && config.cutDirection !== CutDirection.NONE) {
        warnings.push('Cut direction specified for open chain (not necessary)');
        suggestions.push(
            'Cut direction only affects closed chains - can be set to "none" for open chains'
        );
        severity = 'info';
    }

    // Check for arc leads with manual angles when cut direction is specified
    if (config.cutDirection !== CutDirection.NONE) {
        if (
            config.leadIn.type === LeadType.ARC &&
            config.leadIn.angle !== undefined
        ) {
            warnings.push(
                'Manual lead-in angle specified with cut direction - angle may override automatic tangency'
            );
            suggestions.push(
                'Consider removing manual angle to allow automatic tangent calculation'
            );
            severity = 'info';
        }

        if (
            config.leadOut.type === LeadType.ARC &&
            config.leadOut.angle !== undefined
        ) {
            warnings.push(
                'Manual lead-out angle specified with cut direction - angle may override automatic tangency'
            );
            suggestions.push(
                'Consider removing manual angle to allow automatic tangent calculation'
            );
            severity = 'info';
        }
    }

    return { isValid: true, warnings, suggestions, severity };
}

/**
 * Helper: Calculate bounding box for a chain
 */
function calculateChainBounds(chain: Chain): {
    width: number;
    height: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
} {
    if (!chain.shapes || chain.shapes.length === 0) {
        return { width: 0, height: 0, minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    let minX: number = Infinity;
    let maxX: number = -Infinity;
    let minY: number = Infinity;
    let maxY: number = -Infinity;

    for (const shape of chain.shapes) {
        // Get shape bounds based on type
        const bounds = getShapeBoundingBox(shape);
        minX = Math.min(minX, bounds.min.x);
        maxX = Math.max(maxX, bounds.max.x);
        minY = Math.min(minY, bounds.min.y);
        maxY = Math.max(maxY, bounds.max.y);
    }

    return {
        width: maxX - minX,
        height: maxY - minY,
        minX,
        maxX,
        minY,
        maxY,
    };
}

/**
 * Helper: Calculate minimum distance between two bounding boxes
 */
function calculateMinDistanceBetweenBounds(
    bounds1: { minX: number; maxX: number; minY: number; maxY: number },
    bounds2: { minX: number; maxX: number; minY: number; maxY: number }
): number {
    const dx: number = Math.max(
        0,
        Math.max(bounds1.minX - bounds2.maxX, bounds2.minX - bounds1.maxX)
    );
    const dy: number = Math.max(
        0,
        Math.max(bounds1.minY - bounds2.maxY, bounds2.minY - bounds1.maxY)
    );
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Helper: Check if a chain is closed
 */
function isChainClosed(chain: Chain): boolean {
    if (!chain.shapes || chain.shapes.length === 0) {
        return false;
    }

    // For single circles or arcs, they are inherently closed
    if (chain.shapes.length === 1) {
        const shape: Shape = chain.shapes[0];
        return shape.type === 'circle';
    }

    // For multiple shapes, check if end connects to start
    const firstShape: Shape = chain.shapes[0];
    const lastShape: Shape = chain.shapes[chain.shapes.length - 1];

    const startPoint: { x: number; y: number } = getShapeStartPoint(firstShape);
    const endPoint: { x: number; y: number } = getShapeEndPoint(lastShape);

    // eslint-disable-next-line no-magic-numbers
    const tolerance: number = GEOMETRIC_PRECISION_TOLERANCE * 100; // Small tolerance for floating point comparison (scaled up from precision tolerance)
    const distance: number = Math.sqrt(
        Math.pow(startPoint.x - endPoint.x, 2) +
            Math.pow(startPoint.y - endPoint.y, 2)
    );

    return distance < tolerance;
}
