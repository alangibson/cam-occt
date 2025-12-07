import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { normalizeChain } from '$lib/cam/chain/chain-normalization';
import { DEFAULT_CHAIN_NORMALIZATION_PARAMETERS_MM } from '$lib/cam/preprocess/algorithm-parameters';
import { Chain } from '$lib/cam/chain/classes.svelte';
import { Shape } from '$lib/cam/shape/classes';
import type { LayerData } from './interfaces';
import { detectParts } from '$lib/cam/part/part-detection';
import { Part } from '$lib/cam/part/classes.svelte';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/cam/chain/constants';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';

export class Layer implements LayerData {
    #data: LayerData;
    #shapes: Shape[] = $state([]);
    #chains: Chain[] = $state([]);
    #parts: Part[] = $state([]);
    #partsGenerated: boolean = false;

    constructor(data: LayerData) {
        this.#data = data;

        // Convert ShapeData[] to Shape[] and store
        this.#shapes = data.shapes.map((s) => new Shape(s));

        // Detect and normalize chains
        this.#generateChains();

        // Generate parts immediately in constructor
        this.#generateParts();
    }

    #generateChains() {
        const layerName = this.#data.name ?? '0';

        // Clear existing chains
        this.#chains = [];

        // Detect chains and normalize them to set clockwise property
        const detectedChains: Chain[] = detectShapeChains(this.#shapes, {
            tolerance: 0.05,
        });

        this.#chains.push(
            ...detectedChains.map((chain: Chain) => {
                // Prefix chain name with layer name for human readability
                // Pass Shape instances directly to preserve references
                const prefixedChain: ChainData = {
                    id: chain.id,
                    name: `${layerName}-${chain.name}`,
                    shapes: chain.shapes.map((s) => s.toData()) as ShapeData[],
                    clockwise: chain.clockwise,
                    originalChainId: chain.originalChainId,
                };
                const normalizedChain: Chain = normalizeChain(
                    new Chain(prefixedChain),
                    DEFAULT_CHAIN_NORMALIZATION_PARAMETERS_MM
                );
                return normalizedChain;
            })
        );
    }

    async #generateParts() {
        if (this.#partsGenerated) return;

        const layerName = this.#data.name ?? '0';
        try {
            const result = await detectParts(
                this.#chains,
                CHAIN_CLOSURE_TOLERANCE,
                DEFAULT_PART_DETECTION_PARAMETERS,
                layerName
            );
            this.#parts = result.parts;
            this.#partsGenerated = true;
        } catch (error) {
            console.error(
                `Error generating parts for layer ${layerName}:`,
                error
            );
            this.#partsGenerated = true; // Mark as generated even if it failed to avoid retrying
        }
    }

    get shapes() {
        return this.#shapes;
    }

    set shapes(value: Shape[]) {
        this.#shapes = value;
        this.#data.shapes = value.map((s) => s.toData());
        // Regenerate chains and parts when shapes change
        this.#partsGenerated = false;
        this.#generateChains();
        this.#generateParts();
    }

    get chains() {
        return this.#chains;
    }

    get parts() {
        return this.#parts;
    }

    get name() {
        return this.#data.name ?? '(none)';
    }

    toData(): LayerData {
        return {
            shapes: this.shapes.map((s) => s.toData()),
            name: this.name,
        };
    }

    /**
     * Translate all shapes, chains, and parts in this layer by the given offset
     * @param dx X offset to translate by
     * @param dy Y offset to translate by
     */
    translate(dx: number, dy: number): void {
        // Translate shapes (chains/parts share these Shape objects, so they update automatically)
        for (const shape of this.#shapes) {
            shape.translate(dx, dy);
        }

        // Trigger Svelte 5 reactivity by reassigning the $state arrays
        this.#shapes = [...this.#shapes];
        this.#chains = [...this.#chains];
        this.#parts = [...this.#parts];
    }
}
