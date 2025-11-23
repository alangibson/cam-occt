import type { OperationAction } from '$lib/cam/operation/enums';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import type { NormalSide } from '$lib/cam/cut/enums';
import type { Lead } from './types';

export interface CutPath {
    id: string;
    shapeId: string;
    points: Point2D[];
    leadIn?: Lead;
    leadOut?: Lead;
    isRapid: boolean;
    parameters?: CuttingParameters;
    originalShape?: ShapeData; // Preserve original shape for native G-code generation
    executionClockwise?: boolean | null; // Execution direction from cut (true=CW, false=CCW, null=no direction)
    normalSide?: NormalSide; // Which side the normal is on (for machine cutter compensation)
    hasOffset?: boolean; // Whether this cut has an offset applied
}

export interface CuttingParameters {
    feedRate: number; // mm/min or inch/min
    pierceHeight: number; // mm or inch
    pierceDelay: number; // seconds
    cutHeight: number; // mm or inch
    kerf: number; // mm or inch

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

    // Operation action parameters
    action?: OperationAction; // Operation action type (cut, spot)
    spotDuration?: number; // Duration in milliseconds for spot operations
}

export interface GCodeCommand {
    code: string;
    parameters: Record<string, number | string>;
    comment?: string;
    rawValue?: number | string; // For special commands like F that need raw value
}
