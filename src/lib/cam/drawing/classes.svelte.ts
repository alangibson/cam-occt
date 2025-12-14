import type { DrawingData } from './interfaces';
import type { LayerData } from '$lib/cam/layer/interfaces';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';
import { shapesBoundingBox } from '$lib/cam/shape/functions';
import { Layer } from '$lib/cam/layer/classes.svelte';
import { Shape } from '$lib/cam/shape/classes';
import { Unit } from '$lib/config/units/units';

export class Drawing implements DrawingData {
    #data: DrawingData;
    #layers: Record<string, Layer> | undefined = undefined;

    constructor(data: DrawingData) {
        this.#data = data;
    }

    get fileName(): string {
        return this.#data.fileName;
    }

    set fileName(value: string) {
        this.#data.fileName = value;
    }

    // Read-only: Returns flat map of all shapes from all layers.
    // To modify shapes, use layer.shapes setter
    get shapes(): Shape[] {
        // Flatten shapes from all layers
        return Object.values(this.layers).flatMap((layer) => layer.shapes);
    }

    get bounds(): BoundingBoxData {
        return shapesBoundingBox(this.shapes);
    }

    get units() {
        return this.#data?.units ?? Unit.MM;
    }

    set units(value: Unit) {
        this.#data.units = value;
    }

    get layers(): Record<string, Layer> {
        // Return cached layers if available
        if (this.#layers) {
            return this.#layers;
        }

        const layersMap: Record<string, Layer> = {};

        // Guard against undefined or missing shapes
        if (!this.#data || !this.#data.shapes) {
            this.#layers = layersMap;
            return layersMap;
        }

        // Group shapes by layer (as LayerData)
        const layerDataMap: Record<string, LayerData> = {};

        this.#data.shapes.forEach((shape) => {
            // Use default layer "0" if shape has no layer or empty layer
            const layerName =
                shape.layer && shape.layer.trim() !== '' ? shape.layer : '0';

            // Create layer data if it doesn't exist
            if (!layerDataMap[layerName]) {
                layerDataMap[layerName] = {
                    name: layerName,
                    shapes: [],
                };
            }

            // Add shape to the layer
            layerDataMap[layerName].shapes.push(shape);
        });

        // Convert LayerData to Layer instances
        Object.entries(layerDataMap).forEach(([name, data]) => {
            layersMap[name] = new Layer(data);
        });

        // Cache the result
        this.#layers = layersMap;
        return layersMap;
    }

    /**
     * Convert Drawing instance to plain DrawingData object for serialization
     */
    toData(): DrawingData {
        return {
            shapes: this.shapes.map((shape) => shape.toData()),
            units: this.#data.units,
            fileName: this.fileName,
        };
    }

    /**
     * Translate all layers in this drawing by the given offset
     * Recursively calls translate on all layers
     * @param dx X offset to translate by
     * @param dy Y offset to translate by
     */
    translate(dx: number, dy: number): void {
        // Translate each layer (Layer.translate handles its own reactivity)
        for (const layer of Object.values(this.layers)) {
            layer.translate(dx, dy);
        }

        // Trigger Svelte 5 reactivity by reassigning the $state layers
        this.#layers = { ...this.layers };
    }
}
