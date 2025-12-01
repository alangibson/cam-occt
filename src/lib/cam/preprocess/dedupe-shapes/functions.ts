import type { ShapeData } from '$lib/cam/shape/interfaces';
import { Shape } from '$lib/cam/shape/classes';

/**
 * Deduplicate shapes by removing exact duplicates within each layer
 *
 * Uses Shape.hash() to identify duplicate shapes. Only removes duplicates
 * within the same layer - shapes on different layers are never deduplicated.
 * Preserves the first occurrence of each unique shape.
 *
 * @param shapes - Array of shapes to deduplicate
 * @returns Array of deduplicated shapes
 */
export async function deduplicateShapes(
    shapes: ShapeData[]
): Promise<ShapeData[]> {
    if (shapes.length === 0) {
        return [];
    }

    // Group shapes by layer
    const shapesByLayer = new Map<string, ShapeData[]>();

    for (const shape of shapes) {
        const layer = shape.layer || 'default';
        if (!shapesByLayer.has(layer)) {
            shapesByLayer.set(layer, []);
        }
        shapesByLayer.get(layer)!.push(shape);
    }

    // Deduplicate within each layer
    const deduplicatedShapes: ShapeData[] = [];

    for (const layerShapes of shapesByLayer.values()) {
        const seenHashes = new Set<string>();

        for (const shapeData of layerShapes) {
            const shape = new Shape(shapeData);
            const hash = await shape.hash();

            if (!seenHashes.has(hash)) {
                seenHashes.add(hash);
                deduplicatedShapes.push(shapeData);
            }
        }
    }

    return deduplicatedShapes;
}
