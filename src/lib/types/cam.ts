import type { Point2D, Shape } from './geometry';

/**
 * Cutter compensation modes for G-code generation
 */
export enum CutterCompensation {
    LEFT_OUTER = 'left_outer',
    RIGHT_INNER = 'right_inner',
    OFF = 'off',
}

/**
 * Target type for operations (parts or chains)
 */
export enum TargetType {
    PARTS = 'parts',
    CHAINS = 'chains',
}

export interface CuttingParameters {
    feedRate: number; // mm/min or inch/min
    pierceHeight: number; // mm or inch
    pierceDelay: number; // seconds
    cutHeight: number; // mm or inch
    kerf: number; // mm or inch
    leadInLength: number; // mm or inch
    leadOutLength: number; // mm or inch
    // Optional QtPlasmaC material parameters
    toolName?: string; // Material name
    kerfWidth?: number; // Kerf width override
    enableTHC?: boolean; // THC enable/disable
    cutAmps?: number; // Cut amps
    cutVolts?: number; // Cut voltage
    pauseAtEnd?: number; // Pause at end delay
    cutMode?: number; // Cut mode
    gasPresure?: number; // Gas pressure
    torchEnable?: boolean; // Torch enable
    // Hole cutting parameters
    isHole?: boolean; // Whether this is a hole (for velocity reduction)
    holeUnderspeedPercent?: number; // Velocity percentage for hole cutting (10-100)
}

export interface ToolPath {
    id: string;
    shapeId: string;
    points: Point2D[];
    leadIn?: Point2D[];
    leadOut?: Point2D[];
    isRapid: boolean;
    parameters?: CuttingParameters;
    originalShape?: Shape; // Preserve original shape for native G-code generation
    executionClockwise?: boolean | null; // Execution direction from path (true=CW, false=CCW, null=no direction)
}

export interface CutSequence {
    paths: ToolPath[];
    totalLength: number;
    rapidLength: number;
    cutLength: number;
    estimatedTime: number; // seconds
}

export interface Material {
    name: string;
    thickness: number;
    defaultParameters: CuttingParameters;
}

export interface GCodeCommand {
    code: string;
    parameters: Record<string, number | string>;
    comment?: string;
    rawValue?: number | string; // For special commands like F that need raw value
}

/**
 * Type guard for checking if a value is a valid CutterCompensation
 */
export function isCutterCompensation(
    value: unknown
): value is CutterCompensation {
    return Object.values(CutterCompensation).includes(
        value as CutterCompensation
    );
}

/**
 * Type guard for checking if a value is a valid TargetType
 */
export function isTargetType(value: unknown): value is TargetType {
    return Object.values(TargetType).includes(value as TargetType);
}
