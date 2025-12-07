/**
 * Part class - Reactive wrapper for PartData
 *
 * Provides a reactive Svelte 5 class that wraps PartData interface
 * with getters for all properties.
 */

import type { PartData, PartVoid, PartSlot } from './interfaces';
import { Chain } from '$lib/cam/chain/classes.svelte';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';
import { PartType } from './enums';

export class Part {
    #data: PartData;
    #shellChain: Chain | null = null;
    #voidChains: Map<string, Chain> = new Map();
    #slotChains: Map<string, Chain> = new Map();

    constructor(data: PartData) {
        this.#data = data;
    }

    get id(): string {
        return this.#data.id;
    }

    get name(): string {
        return this.#data.name;
    }

    get shell(): Chain {
        if (!this.#shellChain) {
            this.#shellChain = new Chain(this.#data.shell);
        }
        return this.#shellChain;
    }

    get type(): PartType.SHELL {
        return this.#data.type;
    }

    get boundingBox(): BoundingBoxData {
        return this.#data.boundingBox;
    }

    get voids(): Array<Omit<PartVoid, 'chain'> & { chain: Chain }> {
        return this.#data.voids.map((voidData) => {
            let voidChain = this.#voidChains.get(voidData.id);
            if (!voidChain) {
                voidChain = new Chain(voidData.chain);
                this.#voidChains.set(voidData.id, voidChain);
            }
            return {
                id: voidData.id,
                chain: voidChain,
                type: voidData.type,
                boundingBox: voidData.boundingBox,
            };
        });
    }

    /**
     * Helper method for functions that need Part with Chain instances
     * Returns a structural type compatible with isPointInsidePart
     */
    getChainStructure(): { shell: Chain; voids: { chain: Chain }[] } {
        return {
            shell: this.shell,
            voids: this.voids,
        };
    }

    get slots(): Array<Omit<PartSlot, 'chain'> & { chain: Chain }> {
        return this.#data.slots.map((slotData) => {
            let slotChain = this.#slotChains.get(slotData.id);
            if (!slotChain) {
                slotChain = new Chain(slotData.chain);
                this.#slotChains.set(slotData.id, slotChain);
            }
            return {
                id: slotData.id,
                chain: slotChain,
                type: slotData.type,
                boundingBox: slotData.boundingBox,
            };
        });
    }

    get layerName(): string {
        return this.#data.layerName;
    }

    /**
     * Get the underlying PartData for serialization or legacy code
     */
    toData(): PartData {
        return {
            ...this.#data,
            name: this.name,
        };
    }

    /**
     * Translate the part by the given offset
     * Translates shell chain and all void chains
     * @param dx X offset to translate by
     * @param dy Y offset to translate by
     */
    translate(dx: number, dy: number): void {
        // Translate shell
        this.shell.translate(dx, dy);
        this.#data.shell = this.shell.toData();

        // Translate voids
        const voids = this.voids;
        for (let i = 0; i < voids.length; i++) {
            voids[i].chain.translate(dx, dy);
            this.#data.voids[i].chain = voids[i].chain.toData();
        }

        // Translate slots
        const slots = this.slots;
        for (let i = 0; i < slots.length; i++) {
            slots[i].chain.translate(dx, dy);
            this.#data.slots[i].chain = slots[i].chain.toData();
        }

        // Update bounding box
        this.#data.boundingBox = {
            min: {
                x: this.#data.boundingBox.min.x + dx,
                y: this.#data.boundingBox.min.y + dy,
            },
            max: {
                x: this.#data.boundingBox.max.x + dx,
                y: this.#data.boundingBox.max.y + dy,
            },
        };
    }
}
