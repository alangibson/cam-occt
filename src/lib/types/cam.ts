import type { Point2D, Shape } from './geometry';

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