import type { Rapid } from '$lib/cam/rapid/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Drawing } from '$lib/cam/drawing/interfaces';
import type { Part, PartDetectionWarning } from '$lib/cam/part/interfaces';
import type { Operation } from '$lib/cam/operation/interface';
import type {
    TessellationPoint,
    DrawingOverlay,
} from '$lib/stores/overlay/interfaces';
import type { Cut } from '$lib/cam/cut/interfaces';
import type { PrepareStageState } from '$lib/stores/prepare-stage/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { ApplicationSettings } from '$lib/config/settings/interfaces';

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
    selectedChainIds: string[];

    // Parts state
    parts: Part[];
    partWarnings: PartDetectionWarning[];
    highlightedPartId: string | null;
    selectedPartIds: string[];

    // Rapids state
    rapids: Rapid[];
    showRapids: boolean;
    selectedRapidIds: string[];
    highlightedRapidId: string | null;

    // UI state
    showToolTable: boolean;

    // Tessellation state
    tessellationActive: boolean;
    tessellationPoints: TessellationPoint[];

    // Overlay state
    overlayStage: string;
    overlays: Record<string, DrawingOverlay>;

    // Prepare stage state
    prepareStageState: PrepareStageState | null;

    // Operations, cuts, and tools
    operations: Operation[];
    cuts: Cut[];
    selectedCutIds: string[];
    tools: Tool[];

    // Application settings
    applicationSettings: ApplicationSettings;

    // Timestamp for debugging
    savedAt: string;

    highlightedCutId: string | null;
    showCutNormals: boolean;
    showCutDirections: boolean;
    showCutPaths: boolean;
    showCutStartPoints: boolean;
    showCutEndPoints: boolean;
    showCutTangentLines: boolean;
}
