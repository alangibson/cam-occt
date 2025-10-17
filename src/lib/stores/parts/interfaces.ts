import type {
    DetectedPart,
    PartDetectionWarning,
} from '$lib/cam/part/part-detection';

export interface PartStore {
    parts: DetectedPart[];
    warnings: PartDetectionWarning[];
    highlightedPartId: string | null;
    hoveredPartId: string | null;
    selectedPartId: string | null;
}
