/**
 * Centralized render state for the canvas rendering pipeline
 */

import type { Drawing, Shape, Point2D } from '$lib/types';
import type { WorkflowStage } from '$lib/stores/workflow/enums';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import type { Cut, CutsState } from '$lib/stores/cuts/interfaces';
import type { Operation } from '$lib/stores/operations/interfaces';
import type { Rapid } from '$lib/algorithms/optimize-cut-order/optimize-cut-order';
import { Unit } from '$lib/utils/units';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';

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
export interface SelectionState {
    selectedShapes: Set<string>;
    hoveredShape: string | null;
    selectedOffsetShape: Shape | null;
    selectedChainId: string | null;
    highlightedChainId: string | null;
    selectedPartId: string | null;
    highlightedPartId: string | null;
    hoveredPartId: string | null;
    selectedCutId: string | null;
    highlightedCutId: string | null;
    selectedRapidId: string | null;
    highlightedRapidId: string | null;
}

/**
 * Hover state for interactive feedback
 */
export interface HoverState {
    hoveredChain: string | null;
    hoveredPart: string | null;
    hoveredCut: string | null;
    hoveredRapid: string | null;
    mousePosition: Point2D | null;
}

/**
 * Visibility state for layers and elements
 */
export interface VisibilityState {
    layerVisibility: Record<string, boolean>;
    showRapids: boolean;
    showCuts: boolean;
    showChains: boolean;
    showParts: boolean;
    showOverlays: boolean;
    showShapeStartPoints: boolean;
    showShapeEndPoints: boolean;
    showChainStartPoints: boolean;
    showChainEndPoints: boolean;
    showChainTangentLines: boolean;
    showChainNormals: boolean;
    showShapeNormals: boolean;
    showShapeWindingDirection: boolean;
    showShapeTangentLines: boolean;
    showLeadNormals: boolean;
}

/**
 * Overlay configuration for stage-specific visualizations
 */
export interface OverlayState {
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
    drawing: Drawing | null;

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
    parts: DetectedPart[];

    // Cut data
    cuts: Cut[];
    cutsState: CutsState | null;
    chainsWithCuts: string[]; // Chain IDs that have cuts

    // Operations
    operations: Operation[];

    // Rapids
    rapids: Rapid[];

    // Overlays
    overlays: Record<WorkflowStage, OverlayState>;
    currentOverlay: OverlayState | null;

    // Interaction settings
    respectLayerVisibility: boolean;
    interactionMode: 'shapes' | 'chains' | 'cuts';
    selectionMode: 'auto' | 'chain' | 'shape' | 'part' | 'cut';
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
            selectedChainId: null,
            highlightedChainId: null,
            selectedPartId: null,
            highlightedPartId: null,
            hoveredPartId: null,
            selectedCutId: null,
            highlightedCutId: null,
            selectedRapidId: null,
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
            showCuts: true,
            showChains: true,
            showParts: true,
            showOverlays: true,
            showShapeStartPoints: false,
            showShapeEndPoints: false,
            showChainStartPoints: false,
            showChainEndPoints: false,
            showChainTangentLines: false,
            showChainNormals: false,
            showShapeNormals: false,
            showShapeWindingDirection: false,
            showShapeTangentLines: false,
            showLeadNormals: false,
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
                  cuts: [...state.cutsState.cuts],
                  selectedCutId: state.cutsState.selectedCutId,
                  highlightedCutId: state.cutsState.highlightedCutId,
              }
            : null,
        chainsWithCuts: [...state.chainsWithCuts],
        operations: [...state.operations],
        rapids: [...state.rapids],
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
