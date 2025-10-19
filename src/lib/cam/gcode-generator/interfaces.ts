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
}

export interface GCodeCommand {
    code: string;
    parameters: Record<string, number | string>;
    comment?: string;
    rawValue?: number | string; // For special commands like F that need raw value
}
