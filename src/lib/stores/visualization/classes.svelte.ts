/**
 * Unified Visualization Store
 *
 * Combines all visualization-related stores:
 * - ChainStore: Chain visualization options
 * - CutStore: Cut visualization options
 * - KerfStore: Kerf visualization options
 * - LeadStore: Lead visualization options
 * - RapidsStore: Rapids visualization options
 * - ShapeStore: Shape visualization options
 * - TessellationStore: Tessellation visualization state
 */

import type { TessellationPoint } from '$lib/stores/overlay/interfaces';

export interface CutsState {
    showCutNormals: boolean;
    showCutDirections: boolean;
    showCutPaths: boolean;
    showCutStartPoints: boolean;
    showCutEndPoints: boolean;
    showCutTangentLines: boolean;
}

interface LeadState {
    showLeadNormals: boolean;
    showLeadPaths: boolean;
    showLeadKerfs: boolean;
}

interface ShapeVisualizationState {
    showShapePaths: boolean;
    showShapeStartPoints: boolean;
    showShapeEndPoints: boolean;
    showShapeNormals: boolean;
    showShapeWindingDirection: boolean;
    showShapeTangentLines: boolean;
    showShapeTessellation: boolean;
}

class VisualizationStore {
    // Chain visualization
    tolerance = $state(0.1);
    showChainPaths = $state(true);
    showChainStartPoints = $state(false);
    showChainEndPoints = $state(false);
    showChainTangentLines = $state(false);
    showChainNormals = $state(false);
    showChainDirections = $state(false);
    showChainTessellation = $state(false);

    // Cut visualization
    showCutNormals = $state(false);
    showCutDirections = $state(false);
    showCutPaths = $state(true);
    showCutStartPoints = $state(false);
    showCutEndPoints = $state(false);
    showCutTangentLines = $state(false);

    // Kerf visualization
    showKerfPaths = $state(false);
    showCutter = $state(false);

    // Lead visualization
    showLeadNormals = $state(false);
    showLeadPaths = $state(true);
    showLeadKerfs = $state(false);

    // Rapids visualization
    showRapids = $state(true);
    showRapidDirections = $state(false);

    // Shape visualization
    showShapePaths = $state(false);
    showShapeStartPoints = $state(false);
    showShapeEndPoints = $state(false);
    showShapeNormals = $state(false);
    showShapeWindingDirection = $state(false);
    showShapeTangentLines = $state(false);
    showShapeTessellation = $state(false);

    // Tessellation state
    tessellationActive = $state(false);
    tessellationPoints = $state<TessellationPoint[]>([]);
    tessellationLastUpdate = $state(0);

    // Chain methods
    setTolerance(tolerance: number) {
        this.tolerance = tolerance;
    }

    setShowChainStartPoints(show: boolean) {
        this.showChainStartPoints = show;
    }

    setShowChainEndPoints(show: boolean) {
        this.showChainEndPoints = show;
    }

    setShowChainTangentLines(show: boolean) {
        this.showChainTangentLines = show;
    }

    setShowChainNormals(show: boolean) {
        this.showChainNormals = show;
    }

    setShowChainDirections(show: boolean) {
        this.showChainDirections = show;
    }

    setShowChainPaths(show: boolean) {
        this.showChainPaths = show;
    }

    setShowChainTessellation(show: boolean) {
        this.showChainTessellation = show;
    }

    // Cut methods
    setShowCutNormals(show: boolean) {
        this.showCutNormals = show;
    }

    setShowCutDirections(show: boolean) {
        this.showCutDirections = show;
    }

    setShowCutPaths(show: boolean) {
        this.showCutPaths = show;
    }

    setShowCutStartPoints(show: boolean) {
        this.showCutStartPoints = show;
    }

    setShowCutEndPoints(show: boolean) {
        this.showCutEndPoints = show;
    }

    setShowCutTangentLines(show: boolean) {
        this.showCutTangentLines = show;
    }

    resetCuts() {
        this.showCutNormals = false;
        this.showCutDirections = false;
        this.showCutPaths = true;
        this.showCutStartPoints = false;
        this.showCutEndPoints = false;
        this.showCutTangentLines = false;
    }

    restoreCuts(cutsState: CutsState) {
        this.showCutNormals = cutsState.showCutNormals;
        this.showCutDirections = cutsState.showCutDirections;
        this.showCutPaths = cutsState.showCutPaths;
        this.showCutStartPoints = cutsState.showCutStartPoints;
        this.showCutEndPoints = cutsState.showCutEndPoints;
        this.showCutTangentLines = cutsState.showCutTangentLines;
    }

    // Kerf methods
    setShowKerfPaths(show: boolean) {
        this.showKerfPaths = show;
    }

    setShowCutter(show: boolean) {
        this.showCutter = show;
    }

    resetKerfs() {
        this.showKerfPaths = false;
        this.showCutter = false;
    }

    // Lead methods
    setShowLeadNormals(show: boolean) {
        this.showLeadNormals = show;
    }

    setShowLeadPaths(show: boolean) {
        this.showLeadPaths = show;
    }

    setShowLeadKerfs(show: boolean) {
        this.showLeadKerfs = show;
    }

    resetLeads() {
        this.showLeadNormals = false;
        this.showLeadPaths = true;
        this.showLeadKerfs = false;
    }

    restoreLeads(leadState: LeadState) {
        this.showLeadNormals = leadState.showLeadNormals;
        this.showLeadPaths = leadState.showLeadPaths;
        this.showLeadKerfs = leadState.showLeadKerfs;
    }

    // Rapids methods
    toggleShowRapids() {
        this.showRapids = !this.showRapids;
    }

    setShowRapids(show: boolean) {
        this.showRapids = show;
    }

    setShowRapidDirections(show: boolean) {
        this.showRapidDirections = show;
    }

    resetRapids() {
        this.showRapids = true;
        this.showRapidDirections = false;
    }

    // Shape methods
    setShowShapePaths(show: boolean) {
        this.showShapePaths = show;
    }

    setShowShapeStartPoints(show: boolean) {
        this.showShapeStartPoints = show;
    }

    setShowShapeEndPoints(show: boolean) {
        this.showShapeEndPoints = show;
    }

    setShowShapeNormals(show: boolean) {
        this.showShapeNormals = show;
    }

    setShowShapeWindingDirection(show: boolean) {
        this.showShapeWindingDirection = show;
    }

    setShowShapeTangentLines(show: boolean) {
        this.showShapeTangentLines = show;
    }

    setShowShapeTessellation(show: boolean) {
        this.showShapeTessellation = show;
    }

    resetShapes() {
        this.showShapePaths = false;
        this.showShapeStartPoints = false;
        this.showShapeEndPoints = false;
        this.showShapeNormals = false;
        this.showShapeWindingDirection = false;
        this.showShapeTangentLines = false;
        this.showShapeTessellation = false;
    }

    restoreShapes(state: ShapeVisualizationState) {
        this.showShapePaths = state.showShapePaths;
        this.showShapeStartPoints = state.showShapeStartPoints;
        this.showShapeEndPoints = state.showShapeEndPoints;
        this.showShapeNormals = state.showShapeNormals;
        this.showShapeWindingDirection = state.showShapeWindingDirection;
        this.showShapeTangentLines = state.showShapeTangentLines;
        this.showShapeTessellation = state.showShapeTessellation;
    }

    // Tessellation methods
    setTessellation(points: TessellationPoint[]) {
        this.tessellationActive = true;
        this.tessellationPoints = points;
        this.tessellationLastUpdate = Date.now();
    }

    clearTessellation() {
        this.tessellationActive = false;
        this.tessellationPoints = [];
        this.tessellationLastUpdate = Date.now();
    }

    toggleTessellation(points?: TessellationPoint[]) {
        if (this.tessellationActive) {
            this.tessellationActive = false;
            this.tessellationPoints = [];
            this.tessellationLastUpdate = Date.now();
        } else {
            this.tessellationActive = true;
            this.tessellationPoints = points || [];
            this.tessellationLastUpdate = Date.now();
        }
    }

    // Global reset
    reset() {
        this.resetCuts();
        this.resetKerfs();
        this.resetLeads();
        this.resetRapids();
        this.resetShapes();
        this.clearTessellation();
    }
}

export const visualizationStore = new VisualizationStore();

/**
 * Parse a lead ID into its components
 */
export function parseLeadId(leadId: string): {
    cutId: string;
    leadType: 'leadIn' | 'leadOut';
} | null {
    if (!leadId) return null;

    const parts = leadId.split('-');
    if (parts.length < 2) return null;

    const LAST_INDEX_OFFSET = -1;
    const leadType = parts[parts.length + LAST_INDEX_OFFSET];
    if (leadType !== 'leadIn' && leadType !== 'leadOut') return null;

    const cutId = parts.slice(0, LAST_INDEX_OFFSET).join('-');

    return {
        cutId,
        leadType: leadType as 'leadIn' | 'leadOut',
    };
}
