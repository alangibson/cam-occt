import type { Rapid } from '$lib/algorithms/optimize-cut-order/optimize-cut-order';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Drawing, DetectedPart, PartDetectionWarning } from '$lib/types';
import type { LeadWarning } from '$lib/stores/lead-warnings/interfaces';
import type { Operation } from '$lib/stores/operations/interfaces';
import type {
    TessellationPoint,
    DrawingOverlay,
} from '$lib/stores/overlay/interfaces';
import type { Cut } from '$lib/stores/cuts/interfaces';
import type { PrepareStageState } from '$lib/stores/prepare-stage/interfaces';
import type { Tool } from '$lib/stores/tools/interfaces';
import type { ApplicationSettings } from '$lib/stores/settings/interfaces';

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

    // Operations, cuts, and tools
    operations: Operation[];
    cuts: Cut[];
    tools: Tool[];

    // Application settings
    applicationSettings: ApplicationSettings;

    // Timestamp for debugging
    savedAt: string;

    selectedCutId: string | null;
    highlightedCutId: string | null;
    showCutNormals: boolean;
    showCutter: boolean;
    showCutDirections: boolean;
    showCutPaths: boolean;
    showCutStartPoints: boolean;
    showCutEndPoints: boolean;
    showCutTangentLines: boolean;
}
