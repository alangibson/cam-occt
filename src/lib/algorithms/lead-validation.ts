import type { ShapeChain } from './chain-detection';
import type { DetectedPart } from './part-detection';
import { LeadType, CutDirection } from '../types/direction';
import type { LeadInConfig, LeadOutConfig } from './lead-calculation';

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
  chain: ShapeChain,
  part?: DetectedPart
): LeadValidationResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let severity: 'info' | 'warning' | 'error' = 'info';
  let isValid = true;

  // 1. Basic configuration validation
  const basicValidation = validateBasicConfiguration(config);
  warnings.push(...basicValidation.warnings);
  suggestions.push(...(basicValidation.suggestions || []));
  if (basicValidation.severity === 'warning' && severity === 'info') {
    severity = 'warning';
  } else if (basicValidation.severity === 'error') {
    severity = 'error';
    isValid = false;
  }

  // 2. Chain geometry validation
  const chainValidation = validateChainGeometry(chain, config);
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
    const partValidation = validatePartContext(config, chain, part);
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
  const lengthValidation = validateLeadLengths(config, chain, part);
  warnings.push(...lengthValidation.warnings);
  suggestions.push(...(lengthValidation.suggestions || []));
  if (lengthValidation.severity === 'warning' && severity === 'info') {
    severity = 'warning';
  }

  // 5. Cut direction compatibility
  const directionValidation = validateCutDirectionCompatibility(config, chain);
  warnings.push(...directionValidation.warnings);
  suggestions.push(...(directionValidation.suggestions || []));
  if (directionValidation.severity === 'warning' && severity === 'info') {
    severity = 'warning';
  }

  return {
    isValid,
    warnings,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    severity
  };
}

/**
 * Validate basic configuration parameters
 */
function validateBasicConfiguration(config: LeadConfig): LeadValidationResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let isValid = true;
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
    suggestions.push('Set lead-in length to 0 or change type to "line" or "arc"');
    if (severity === 'info') severity = 'warning';
  }

  if (config.leadOut.type === LeadType.NONE && config.leadOut.length > 0) {
    warnings.push('Lead-out type is "none" but length is greater than 0');
    suggestions.push('Set lead-out length to 0 or change type to "line" or "arc"');
    if (severity === 'info') severity = 'warning';
  }

  // Check for valid angle ranges if specified
  if (config.leadIn.angle !== undefined && (config.leadIn.angle < 0 || config.leadIn.angle >= 360)) {
    warnings.push('Lead-in angle must be between 0 and 359 degrees');
    suggestions.push('Adjust lead-in angle to be within 0-359 degree range');
    severity = 'error';
    isValid = false;
  }

  if (config.leadOut.angle !== undefined && (config.leadOut.angle < 0 || config.leadOut.angle >= 360)) {
    warnings.push('Lead-out angle must be between 0 and 359 degrees');
    suggestions.push('Adjust lead-out angle to be within 0-359 degree range');
    severity = 'error';
    isValid = false;
  }

  return { isValid, warnings, suggestions, severity };
}

/**
 * Validate chain geometry constraints
 */
function validateChainGeometry(chain: ShapeChain, config: LeadConfig): LeadValidationResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let isValid = true;
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
  const chainBounds = calculateChainBounds(chain);
  const chainSize = Math.max(chainBounds.width, chainBounds.height);

  // Check lead-in length relative to chain size
  if (config.leadIn.type !== LeadType.NONE && config.leadIn.length > chainSize * 2) {
    warnings.push('Lead-in length is very large compared to chain size');
    suggestions.push(`Consider reducing lead-in length to less than ${(chainSize * 2).toFixed(1)} units`);
    severity = 'warning';
  }

  // Check lead-out length relative to chain size
  if (config.leadOut.type !== LeadType.NONE && config.leadOut.length > chainSize * 2) {
    warnings.push('Lead-out length is very large compared to chain size');
    suggestions.push(`Consider reducing lead-out length to less than ${(chainSize * 2).toFixed(1)} units`);
    severity = 'warning';
  }

  // Check for very small chains with long leads
  if (chainSize < 3 && (config.leadIn.length > 10 || config.leadOut.length > 10)) {
    warnings.push('Chain is very small but leads are long - may cause intersection issues');
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
  chain: ShapeChain,
  part: DetectedPart
): LeadValidationResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let isValid = true;
  let severity: 'info' | 'warning' | 'error' = 'info';

  const isHole = part.holes.some(h => h.chain.id === chain.id);
  const isShell = part.shell.chain.id === chain.id;

  if (!isHole && !isShell) {
    warnings.push('Chain is not recognized as part of the specified part');
    suggestions.push('Verify that the chain belongs to the correct part');
    severity = 'warning';
    return { isValid, warnings, suggestions, severity };
  }

  // Check for potential collision issues with holes
  if (isShell && part.holes.length > 0) {
    const shellBounds = calculateChainBounds(chain);
    
    // Check if leads might intersect with holes
    for (const hole of part.holes) {
      const holeBounds = calculateChainBounds(hole.chain);
      const maxLeadLength = Math.max(config.leadIn.length, config.leadOut.length);
      
      // Simple proximity check - if hole is close to shell edge and leads are long
      const minDistanceToShell = calculateMinDistanceBetweenBounds(shellBounds, holeBounds);
      if (minDistanceToShell < maxLeadLength * 0.5) {
        warnings.push(`Lead may intersect with nearby hole (${hole.id})`);
        suggestions.push('Consider reducing lead length or adjusting lead angle');
        severity = 'warning';
      }
    }
  }

  // Check for hole lead direction
  if (isHole) {
    warnings.push('Generating leads for hole - leads will be placed inside the hole');
    // Don't change severity to info if it's already warning/error
  }

  return { isValid, warnings, suggestions, severity };
}

/**
 * Validate lead lengths for practical machining
 */
function validateLeadLengths(
  config: LeadConfig,
  chain: ShapeChain,
  part?: DetectedPart
): LeadValidationResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let severity: 'info' | 'warning' | 'error' = 'info';

  // Check for very long leads
  const maxRecommendedLength = 50; // Arbitrary but reasonable limit
  
  if (config.leadIn.length > maxRecommendedLength) {
    warnings.push(`Lead-in length (${config.leadIn.length}) is very long`);
    suggestions.push(`Consider reducing lead-in length to under ${maxRecommendedLength} units`);
    severity = 'warning';
  }

  if (config.leadOut.length > maxRecommendedLength) {
    warnings.push(`Lead-out length (${config.leadOut.length}) is very long`);
    suggestions.push(`Consider reducing lead-out length to under ${maxRecommendedLength} units`);
    severity = 'warning';
  }

  // Check for very short but non-zero leads
  const minRecommendedLength = 0.5;
  
  if (config.leadIn.type !== LeadType.NONE && config.leadIn.length > 0 && config.leadIn.length < minRecommendedLength) {
    warnings.push(`Lead-in length (${config.leadIn.length}) is very short`);
    suggestions.push(`Consider using length of at least ${minRecommendedLength} units or setting to 0`);
    severity = 'info';
  }

  if (config.leadOut.type !== LeadType.NONE && config.leadOut.length > 0 && config.leadOut.length < minRecommendedLength) {
    warnings.push(`Lead-out length (${config.leadOut.length}) is very short`);
    suggestions.push(`Consider using length of at least ${minRecommendedLength} units or setting to 0`);
    severity = 'info';
  }

  return { isValid: true, warnings, suggestions, severity };
}

/**
 * Validate cut direction compatibility with lead configuration
 */
function validateCutDirectionCompatibility(
  config: LeadConfig,
  chain: ShapeChain
): LeadValidationResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let severity: 'info' | 'warning' | 'error' = 'info';

  // Check if cut direction is specified for closed chains
  const isClosed = isChainClosed(chain);
  
  if (isClosed && config.cutDirection === CutDirection.NONE) {
    warnings.push('Closed chain detected but cut direction is "none"');
    suggestions.push('Consider specifying "clockwise" or "counterclockwise" cut direction for better lead tangency');
    severity = 'info';
  }

  // Check if cut direction is specified for open chains (not needed)
  if (!isClosed && config.cutDirection !== CutDirection.NONE) {
    warnings.push('Cut direction specified for open chain (not necessary)');
    suggestions.push('Cut direction only affects closed chains - can be set to "none" for open chains');
    severity = 'info';
  }

  // Check for arc leads with manual angles when cut direction is specified
  if (config.cutDirection !== CutDirection.NONE) {
    if (config.leadIn.type === LeadType.ARC && config.leadIn.angle !== undefined) {
      warnings.push('Manual lead-in angle specified with cut direction - angle may override automatic tangency');
      suggestions.push('Consider removing manual angle to allow automatic tangent calculation');
      severity = 'info';
    }
    
    if (config.leadOut.type === LeadType.ARC && config.leadOut.angle !== undefined) {
      warnings.push('Manual lead-out angle specified with cut direction - angle may override automatic tangency');
      suggestions.push('Consider removing manual angle to allow automatic tangent calculation');
      severity = 'info';
    }
  }

  return { isValid: true, warnings, suggestions, severity };
}

/**
 * Helper: Calculate bounding box for a chain
 */
function calculateChainBounds(chain: ShapeChain): { width: number; height: number; minX: number; maxX: number; minY: number; maxY: number } {
  if (!chain.shapes || chain.shapes.length === 0) {
    return { width: 0, height: 0, minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const shape of chain.shapes) {
    // Get shape bounds based on type
    const bounds = getShapeBounds(shape);
    minX = Math.min(minX, bounds.minX);
    maxX = Math.max(maxX, bounds.maxX);
    minY = Math.min(minY, bounds.minY);
    maxY = Math.max(maxY, bounds.maxY);
  }

  return {
    width: maxX - minX,
    height: maxY - minY,
    minX,
    maxX,
    minY,
    maxY
  };
}

/**
 * Helper: Get bounds for a single shape
 */
function getShapeBounds(shape: any): { minX: number; maxX: number; minY: number; maxY: number } {
  switch (shape.type) {
    case 'line':
      return {
        minX: Math.min(shape.geometry.start.x, shape.geometry.end.x),
        maxX: Math.max(shape.geometry.start.x, shape.geometry.end.x),
        minY: Math.min(shape.geometry.start.y, shape.geometry.end.y),
        maxY: Math.max(shape.geometry.start.y, shape.geometry.end.y)
      };
    
    case 'circle':
      return {
        minX: shape.geometry.center.x - shape.geometry.radius,
        maxX: shape.geometry.center.x + shape.geometry.radius,
        minY: shape.geometry.center.y - shape.geometry.radius,
        maxY: shape.geometry.center.y + shape.geometry.radius
      };
    
    case 'arc':
      // Simplified - use center ± radius (not precise but good enough for validation)
      return {
        minX: shape.geometry.center.x - shape.geometry.radius,
        maxX: shape.geometry.center.x + shape.geometry.radius,
        minY: shape.geometry.center.y - shape.geometry.radius,
        maxY: shape.geometry.center.y + shape.geometry.radius
      };
    
    case 'polyline':
      if (shape.geometry.points && shape.geometry.points.length > 0) {
        const xs = shape.geometry.points.map((p: any) => p.x);
        const ys = shape.geometry.points.map((p: any) => p.y);
        return {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys)
        };
      }
      break;
  }

  // Fallback for unknown shape types
  return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
}

/**
 * Helper: Calculate minimum distance between two bounding boxes
 */
function calculateMinDistanceBetweenBounds(
  bounds1: { minX: number; maxX: number; minY: number; maxY: number },
  bounds2: { minX: number; maxX: number; minY: number; maxY: number }
): number {
  const dx = Math.max(0, Math.max(bounds1.minX - bounds2.maxX, bounds2.minX - bounds1.maxX));
  const dy = Math.max(0, Math.max(bounds1.minY - bounds2.maxY, bounds2.minY - bounds1.maxY));
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Helper: Check if a chain is closed
 */
function isChainClosed(chain: ShapeChain): boolean {
  if (!chain.shapes || chain.shapes.length === 0) {
    return false;
  }

  // For single circles or arcs, they are inherently closed
  if (chain.shapes.length === 1) {
    const shape = chain.shapes[0];
    return shape.type === 'circle';
  }

  // For multiple shapes, check if end connects to start
  const firstShape = chain.shapes[0];
  const lastShape = chain.shapes[chain.shapes.length - 1];

  const startPoint = getShapeStartPoint(firstShape);
  const endPoint = getShapeEndPoint(lastShape);

  if (!startPoint || !endPoint) {
    return false;
  }

  const tolerance = 0.1; // Small tolerance for floating point comparison
  const distance = Math.sqrt(
    Math.pow(startPoint.x - endPoint.x, 2) + Math.pow(startPoint.y - endPoint.y, 2)
  );

  return distance < tolerance;
}

/**
 * Helper: Get start point of a shape
 */
function getShapeStartPoint(shape: any): { x: number; y: number } | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.start;
    case 'circle':
      return { x: shape.geometry.center.x + shape.geometry.radius, y: shape.geometry.center.y };
    case 'arc':
      return shape.geometry.start || { x: shape.geometry.center.x + shape.geometry.radius, y: shape.geometry.center.y };
    case 'polyline':
      return shape.geometry.points && shape.geometry.points.length > 0 ? shape.geometry.points[0] : null;
    default:
      return null;
  }
}

/**
 * Helper: Get end point of a shape
 */
function getShapeEndPoint(shape: any): { x: number; y: number } | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.end;
    case 'circle':
      return { x: shape.geometry.center.x + shape.geometry.radius, y: shape.geometry.center.y };
    case 'arc':
      return shape.geometry.end || { x: shape.geometry.center.x + shape.geometry.radius, y: shape.geometry.center.y };
    case 'polyline':
      return shape.geometry.points && shape.geometry.points.length > 0 ? 
        shape.geometry.points[shape.geometry.points.length - 1] : null;
    default:
      return null;
  }
}