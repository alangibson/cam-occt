import type { Point2D, Shape } from './geometry';

export interface CuttingParameters {
  feedRate: number; // mm/min or inch/min
  pierceHeight: number; // mm or inch
  pierceDelay: number; // seconds
  cutHeight: number; // mm or inch
  kerf: number; // mm or inch
  leadInLength: number; // mm or inch
  leadOutLength: number; // mm or inch
}

export interface ToolPath {
  id: string;
  shapeId: string;
  points: Point2D[];
  leadIn?: Point2D[];
  leadOut?: Point2D[];
  isRapid: boolean;
  parameters?: CuttingParameters;
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
}