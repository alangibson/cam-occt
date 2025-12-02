import type { ChainData } from '$lib/cam/chain/interfaces';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import type { PartData, PartDetectionWarning } from '$lib/cam/part/interfaces';
import type { OperationData } from '$lib/cam/operation/interface';
import type {
    TessellationPoint,
    DrawingOverlay,
} from '$lib/stores/overlay/interfaces';
import type { CutData } from '$lib/cam/cut/interfaces';
import type { PrepareStageState } from '$lib/stores/prepare-stage/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { ApplicationSettings } from '$lib/config/settings/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';

export interface PersistedState {
    // Drawing state
    drawing: DrawingData | null;
    scale: number;
    offset: { x: number; y: number };
    fileName: string | null;
    layerVisibility: Record<string, boolean>;
    displayUnit: 'mm' | 'inch';

    // Workflow state
    currentStage: string;
    completedStages: string[];

    // Chains state
    chains: ChainData[];
    tolerance: number;

    // Parts state
    parts: PartData[];
    partWarnings: PartDetectionWarning[];

    // Rapids UI state (rapids data is now in Cut.rapidIn)
    showRapids: boolean;

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
    operations: OperationData[];
    cuts: CutData[];
    tools: Tool[];

    // Application settings
    applicationSettings: ApplicationSettings;

    // Timestamp for debugging
    savedAt: string;

    // Cut visualization state
    showCutNormals: boolean;
    showCutDirections: boolean;
    showCutPaths: boolean;
    showCutStartPoints: boolean;
    showCutEndPoints: boolean;
    showCutTangentLines: boolean;

    // Unified selection state
    selection: {
        shapes: {
            selected: string[];
            hovered: string | null;
            selectedOffset: ShapeData | null;
        };
        chains: {
            selected: string[];
            highlighted: string | null;
        };
        parts: {
            selected: string[];
            highlighted: string | null;
            hovered: string | null;
        };
        cuts: {
            selected: string[];
            highlighted: string | null;
        };
        rapids: {
            selected: string[];
            highlighted: string | null;
        };
        leads: {
            selected: string[];
            highlighted: string | null;
        };
        kerfs: {
            selected: string | null;
            highlighted: string | null;
        };
    };
}
