import type { Rapid } from '$lib/algorithms/optimize-cut-order/optimize-cut-order';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Drawing, DetectedPart, PartDetectionWarning } from '$lib/types';
import type { LeadWarning } from '../lead-warnings/interfaces';
import type { Operation } from '../operations/interfaces';
import type { TessellationPoint, DrawingOverlay } from '../overlay/interfaces';
import type { Path } from '../paths/interfaces';
import type { PrepareStageState } from '../prepare-stage/interfaces';
import type { Tool } from '../tools/interfaces';

export interface PersistedState {
    // Drawing state
    drawing: Drawing | null;
    selectedShapes: string[];
    hoveredShape: string | null;
    scale: number;
    offset: { x: number; y: number };
    fileName: string | null;
    layerVisibility: Record<string, boolean>;
    displayUnit: 'mm' | 'inch';

    // Workflow state
    currentStage: string;
    completedStages: string[];

    // Chains state
    chains: Chain[];
    tolerance: number;
    selectedChainId: string | null;

    // Parts state
    parts: DetectedPart[];
    partWarnings: PartDetectionWarning[];
    highlightedPartId: string | null;

    // Rapids state
    rapids: Rapid[];
    showRapids: boolean;
    selectedRapidId: string | null;
    highlightedRapidId: string | null;

    // UI state
    showToolTable: boolean;

    // Tessellation state
    tessellationActive: boolean;
    tessellationPoints: TessellationPoint[];

    // Overlay state
    overlayStage: string;
    overlays: Record<string, DrawingOverlay>;

    // Lead warnings
    leadWarnings: LeadWarning[];

    // Prepare stage state
    prepareStageState: PrepareStageState | null;

    // Operations, paths, and tools
    operations: Operation[];
    paths: Path[];
    tools: Tool[];

    // Timestamp for debugging
    savedAt: string;

    selectedPathId: string | null;
    highlightedPathId: string | null;
}
