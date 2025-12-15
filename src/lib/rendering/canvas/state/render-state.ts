/**
 * Centralized render state for the canvas rendering pipeline
 */

import type { DrawingData } from '$lib/cam/drawing/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { WorkflowStage } from '$lib/stores/workflow/enums';
import type { Part } from '$lib/cam/part/classes.svelte';
import type { CutsState } from '$lib/stores/visualization/classes.svelte';
import type { OperationData } from '$lib/cam/operation/interface';
import type { Rapid } from '$lib/cam/rapid/interfaces';
import { Unit } from '$lib/config/units/units';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import type { CutData } from '$lib/cam/cut/interfaces';
import type { KerfData } from '$lib/cam/kerf/interfaces';
import type { Chain } from '$lib/cam/chain/classes.svelte';

/**
 * Transform state for canvas rendering
 */
export interface TransformState {
    zoomScale: number;
    panOffset: Point2D;
    unitScale: number;
    coordinator: CoordinateTransformer;
}

/**
 * Selection state for various object types
 */
interface SelectionState {
    selectedShapes: Set<string>;
    hoveredShape: string | null;
    selectedOffsetShape: ShapeData | null;
    selectedChainIds: Set<string>;
    highlightedChainId: string | null;
    selectedPartIds: Set<string>;
    highlightedPartId: string | null;
    hoveredPartId: string | null;
    selectedCutIds: Set<string>;
    highlightedCutId: string | null;
    selectedRapidIds: Set<string>;
    highlightedRapidId: string | null;
    selectedLeadIds?: Set<string>;
    highlightedLeadId?: string | null;
    selectedKerfId?: string | null;
    highlightedKerfId?: string | null;
}

/**
 * Hover state for interactive feedback
 */
interface HoverState {
    hoveredChain: string | null;
    hoveredPart: string | null;
    hoveredCut: string | null;
    hoveredRapid: string | null;
    mousePosition: Point2D | null;
}

/**
 * Visibility state for layers and elements
 */
interface VisibilityState {
    layerVisibility: Record<string, boolean>;
    showRapids: boolean;
    showRapidDirections: boolean;
    showCuts: boolean;
    showChains: boolean;
    showParts: boolean;
    showPartSurface: boolean;
    showOverlays: boolean;
    showShapePaths: boolean;
    showShapeStartPoints: boolean;
    showShapeEndPoints: boolean;
    showChainPaths: boolean;
    showChainStartPoints: boolean;
    showChainEndPoints: boolean;
    showChainTangentLines: boolean;
    showChainNormals: boolean;
    showChainDirections: boolean;
    showChainTessellation: boolean;
    showShapeNormals: boolean;
    showShapeWindingDirection: boolean;
    showShapeTangentLines: boolean;
    showShapeTessellation: boolean;
    showCutNormals: boolean;
    showCutDirections: boolean;
    showCutPaths: boolean;
    showCutter: boolean;
    showCutStartPoints: boolean;
    showCutEndPoints: boolean;
    showCutTangentLines: boolean;
    showLeadNormals: boolean;
    showLeadPaths: boolean;
    showLeadKerfs: boolean;
    showKerfPaths: boolean;
}

/**
 * Overlay configuration for stage-specific visualizations
 */
interface OverlayState {
    shapePoints?: (Point2D & { type?: string })[];
    chainEndpoints?: (Point2D & { type?: string })[];
    tessellationPoints?: Point2D[];
    toolHead?: { x: number; y: number; visible: boolean };
}

/**
 * Complete render state for the canvas
 */
export interface RenderState {
    // Core drawing data
    drawing: DrawingData | null;

    // Transform and viewport
    transform: TransformState;

    // Selection and interaction
    selection: SelectionState;
    hover: HoverState;

    // Visibility controls
    visibility: VisibilityState;

    // Workflow stage
    stage: WorkflowStage;

    // Display settings
    displayUnit: Unit;

    // Chain data
    chains: Chain[];

    // Part detection results
    parts: Part[];

    // Cut data
    cuts: CutData[];
    cutsState: CutsState | null;
    chainsWithCuts: string[]; // Chain IDs that have cuts

    // Operations
    operations: OperationData[];

    // Rapids
    rapids: Rapid[];

    // Kerfs
    kerfs: KerfData[];

    // Overlays
    overlays: Record<WorkflowStage, OverlayState>;
    currentOverlay: OverlayState | null;

    // Interaction settings
    respectLayerVisibility: boolean;
    interactionMode: 'shapes' | 'chains' | 'cuts' | 'kerfs';
    selectionMode:
        | 'auto'
        | 'chain'
        | 'shape'
        | 'part'
        | 'cut'
        | 'lead'
        | 'kerf'
        | 'rapid';
}

/**
 * Create an empty render state
 * @param stage - Optional workflow stage to initialize with (defaults to 'import')
 */
export function createEmptyRenderState(stage?: WorkflowStage): RenderState {
    return {
        drawing: null,
        transform: {
            zoomScale: 1,
            panOffset: { x: 0, y: 0 },
            unitScale: 1,
            coordinator: {} as CoordinateTransformer, // Will be set by pipeline
        },
        selection: {
            selectedShapes: new Set(),
            hoveredShape: null,
            selectedOffsetShape: null,
            selectedChainIds: new Set(),
            highlightedChainId: null,
            selectedPartIds: new Set(),
            highlightedPartId: null,
            hoveredPartId: null,
            selectedCutIds: new Set(),
            highlightedCutId: null,
            selectedRapidIds: new Set(),
            highlightedRapidId: null,
        },
        hover: {
            hoveredChain: null,
            hoveredPart: null,
            hoveredCut: null,
            hoveredRapid: null,
            mousePosition: null,
        },
        visibility: {
            layerVisibility: {},
            showRapids: true,
            showRapidDirections: false,
            showCuts: true,
            showChains: true,
            showParts: true,
            showPartSurface: true,
            showOverlays: true,
            showShapePaths: true,
            showShapeStartPoints: false,
            showShapeEndPoints: false,
            showChainPaths: true,
            showChainStartPoints: false,
            showChainEndPoints: false,
            showChainTangentLines: false,
            showChainNormals: false,
            showChainDirections: false,
            showChainTessellation: false,
            showShapeNormals: false,
            showShapeWindingDirection: false,
            showShapeTangentLines: false,
            showShapeTessellation: false,
            showCutNormals: false,
            showCutDirections: false,
            showCutPaths: true,
            showCutter: false,
            showCutStartPoints: false,
            showCutEndPoints: false,
            showCutTangentLines: false,
            showLeadNormals: false,
            showLeadPaths: true,
            showLeadKerfs: false,
            showKerfPaths: false,
        },
        stage: stage || ('import' as WorkflowStage),
        displayUnit: Unit.MM,
        chains: [],
        parts: [],
        cuts: [],
        cutsState: null,
        chainsWithCuts: [],
        operations: [],
        rapids: [],
        kerfs: [],
        overlays: {
            import: {},
            edit: {},
            prepare: {},
            program: {},
            simulate: {},
            export: {},
        } as Record<WorkflowStage, OverlayState>,
        currentOverlay: null,
        respectLayerVisibility: true,
        interactionMode: 'shapes',
        selectionMode: 'auto',
    };
}

/**
 * Convert screen pixels to world units using the render state transform
 */
export function screenToWorldDistance(
    state: RenderState,
    screenPixels: number
): number {
    const totalScale = state.transform.zoomScale * state.transform.unitScale;
    return screenPixels / totalScale;
}

/**
 * Clone a render state (deep copy)
 */
export function cloneRenderState(state: RenderState): RenderState {
    return {
        ...state,
        transform: {
            ...state.transform,
            panOffset: { ...state.transform.panOffset },
        },
        selection: {
            ...state.selection,
            selectedShapes: new Set(state.selection.selectedShapes),
            selectedChainIds: new Set(state.selection.selectedChainIds),
            selectedPartIds: new Set(state.selection.selectedPartIds),
            selectedCutIds: new Set(state.selection.selectedCutIds),
            selectedRapidIds: new Set(state.selection.selectedRapidIds),
        },
        hover: {
            ...state.hover,
            mousePosition: state.hover.mousePosition
                ? { ...state.hover.mousePosition }
                : null,
        },
        visibility: {
            ...state.visibility,
            layerVisibility: { ...state.visibility.layerVisibility },
        },
        chains: [...state.chains],
        parts: [...state.parts],
        cuts: [...state.cuts],
        cutsState: state.cutsState
            ? {
                  showCutNormals: state.cutsState.showCutNormals,
                  showCutDirections: state.cutsState.showCutDirections,
                  showCutPaths: state.cutsState.showCutPaths,
                  showCutStartPoints: state.cutsState.showCutStartPoints,
                  showCutEndPoints: state.cutsState.showCutEndPoints,
                  showCutTangentLines: state.cutsState.showCutTangentLines,
              }
            : null,
        chainsWithCuts: [...state.chainsWithCuts],
        operations: [...state.operations],
        rapids: [...state.rapids],
        kerfs: [...state.kerfs],
        overlays: Object.keys(state.overlays).reduce(
            (acc, key) => {
                const workflowStage = key as WorkflowStage;
                acc[workflowStage] = { ...state.overlays[workflowStage] };
                return acc;
            },
            {} as Record<WorkflowStage, OverlayState>
        ),
        currentOverlay: state.currentOverlay
            ? { ...state.currentOverlay }
            : null,
    };
}
