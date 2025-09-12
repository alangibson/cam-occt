import type {
    DetectedPart,
    PartDetectionWarning,
} from '$lib/algorithms/part-detection/part-detection';

export interface PartStore {
    parts: DetectedPart[];
    warnings: PartDetectionWarning[];
    highlightedPartId: string | null;
    hoveredPartId: string | null;
    selectedPartId: string | null;
}
