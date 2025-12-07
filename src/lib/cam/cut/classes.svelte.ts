import type { CutData } from './interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { CutDirection } from './enums';
import type { CacheableLead, LeadConfig } from '$lib/cam/lead/interfaces';
import type { NormalSide } from './enums';
import type { OffsetDirection } from '$lib/cam/offset/types';
import type { Rapid } from '$lib/cam/rapid/interfaces';
import { Chain } from '$lib/cam/chain/classes.svelte';
import { Offset } from '$lib/cam/offset/classes';
import { Shape } from '$lib/cam/shape/classes';
import { shapesBoundingBox, translateShape } from '$lib/cam/shape/functions';
import { arcBoundingBox, translateArc } from '$lib/geometry/arc/functions';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';
import { EMPTY_BOUNDS } from '$lib/geometry/bounding-box/constants';
import { combineBoundingBoxes } from '$lib/geometry/bounding-box/functions';

export class Cut {
    #data: CutData;
    #chain?: Chain;

    constructor(data: CutData) {
        // Validate required fields
        if (!data.id) {
            console.error('Cut constructor called with invalid data:', data);
            throw new Error('Cut data must have an id field');
        }
        this.#data = data;

        // Cache chain instance if it exists
        if (data.chain) {
            this.#chain = new Chain(data.chain);
        }
    }

    get id(): string {
        return this.#data.id;
    }

    get name(): string {
        return this.#data.name;
    }

    get enabled(): boolean {
        return this.#data.enabled;
    }

    get order(): number {
        return this.#data.order;
    }

    get sourceOperationId(): string {
        return this.#data.sourceOperationId;
    }

    get sourceChainId(): string {
        return this.#data.sourceChainId;
    }

    get sourceToolId(): string | null {
        return this.#data.sourceToolId;
    }

    get feedRate(): number | undefined {
        return this.#data.feedRate;
    }

    get pierceHeight(): number | undefined {
        return this.#data.pierceHeight;
    }

    get pierceDelay(): number | undefined {
        return this.#data.pierceDelay;
    }

    get arcVoltage(): number | undefined {
        return this.#data.arcVoltage;
    }

    get thcEnabled(): boolean | undefined {
        return this.#data.thcEnabled;
    }

    get overcutLength(): number | undefined {
        return this.#data.overcutLength;
    }

    get direction(): CutDirection {
        return this.#data.direction;
    }

    get chain(): Chain | undefined {
        return this.#chain;
    }

    set chain(chain: Chain | undefined) {
        this.#chain = chain;
        // this.#data.chain = chain ? chain.toData() : undefined;
    }

    get executionClockwise(): boolean | null | undefined {
        return this.#data.executionClockwise;
    }

    get normal(): Point2D {
        return this.#data.normal;
    }

    set normal(normal: Point2D) {
        this.#data.normal = normal;
    }

    get normalConnectionPoint(): Point2D {
        return this.#data.normalConnectionPoint;
    }

    set normalConnectionPoint(normalConnectionPoint: Point2D) {
        this.#data.normalConnectionPoint = normalConnectionPoint;
    }

    get normalSide(): NormalSide {
        return this.#data.normalSide;
    }

    set normalSide(normalSide: NormalSide) {
        this.#data.normalSide = normalSide;
    }

    get isHole(): boolean | undefined {
        return this.#data.isHole;
    }

    get holeUnderspeedPercent(): number | undefined {
        return this.#data.holeUnderspeedPercent;
    }

    get action() {
        return this.#data.action;
    }

    get spotDuration(): number | undefined {
        return this.#data.spotDuration;
    }

    get rapidIn(): Rapid | undefined {
        return this.#data.rapidIn;
    }

    get leadInConfig(): LeadConfig | undefined {
        return this.#data.leadInConfig;
    }

    get leadOutConfig(): LeadConfig | undefined {
        return this.#data.leadOutConfig;
    }

    get leadIn(): CacheableLead | undefined {
        return this.#data.leadIn;
    }

    set leadIn(leadIn: CacheableLead) {
        this.#data.leadIn = leadIn;
    }

    get leadOut(): CacheableLead | undefined {
        return this.#data.leadOut;
    }

    set leadOut(leadOut: CacheableLead) {
        this.#data.leadOut = leadOut;
    }

    get kerfWidth(): number | undefined {
        return this.#data.kerfWidth;
    }

    get kerfCompensation(): OffsetDirection | undefined {
        return this.#data.kerfCompensation;
    }

    get offset(): Offset | undefined {
        return this.#data.offset ? new Offset(this.#data.offset) : undefined;
    }

    toData(): CutData {
        // Sync cached chain back to data before returning
        if (this.#chain) {
            this.#data.chain = this.#chain.toData();
        }
        return this.#data;
    }

    /**
     * Get the bounding box for this cut including offset shapes (if present) and leads
     * Priority: offset shapes > chain shapes
     * Also includes lead-in and lead-out arc bounds if they exist
     */
    get bounds(): BoundingBoxData {
        const boundingBoxes: BoundingBoxData[] = [];

        // 1. Get bounds from offset shapes (if present) or chain shapes
        if (
            this.#data.offset?.offsetShapes &&
            this.#data.offset.offsetShapes.length > 0
        ) {
            // Use offset shapes (kerf-compensated paths)
            try {
                boundingBoxes.push(
                    shapesBoundingBox(this.#data.offset.offsetShapes)
                );
            } catch (error) {
                console.warn(
                    'Failed to calculate offset shapes bounds:',
                    error
                );
            }
        } else if (this.chain?.shapes && this.chain.shapes.length > 0) {
            // Fallback to chain shapes
            try {
                boundingBoxes.push(this.chain.boundary);
            } catch (error) {
                console.warn('Failed to get chain boundary:', error);
            }
        }

        // 2. Add lead-in bounds if it exists
        if (this.#data.leadIn?.geometry) {
            try {
                boundingBoxes.push(
                    arcBoundingBox(this.#data.leadIn.geometry as Arc)
                );
            } catch (error) {
                console.warn('Failed to calculate lead-in bounds:', error);
            }
        }

        // 3. Add lead-out bounds if it exists
        if (this.#data.leadOut?.geometry) {
            try {
                boundingBoxes.push(
                    arcBoundingBox(this.#data.leadOut.geometry as Arc)
                );
            } catch (error) {
                console.warn('Failed to calculate lead-out bounds:', error);
            }
        }

        // Combine all bounding boxes or return empty bounds
        if (boundingBoxes.length === 0) {
            return EMPTY_BOUNDS;
        }

        try {
            return combineBoundingBoxes(boundingBoxes);
        } catch (error) {
            console.warn('Failed to combine bounding boxes:', error);
            return EMPTY_BOUNDS;
        }
    }

    /**
     * Translate this cut by the given offset
     * Translates the chain, offset shapes, leads, normal, and normalConnectionPoint
     * @param dx X offset to translate by
     * @param dy Y offset to translate by
     */
    translate(dx: number, dy: number): void {
        // Translate the chain if it exists
        if (this.chain) {
            this.chain.translate(dx, dy);
        }

        // Translate offset shapes if they exist
        if (this.#data.offset?.offsetShapes) {
            for (const shape of this.#data.offset.offsetShapes) {
                translateShape(new Shape(shape), dx, dy);
            }
        }

        // Translate lead-in if it exists
        if (this.#data.leadIn) {
            this.#data.leadIn.geometry = translateArc(
                this.#data.leadIn.geometry as Arc,
                dx,
                dy
            );
            // Normal is a unit vector, doesn't change with translation
            if (this.#data.leadIn.connectionPoint) {
                this.#data.leadIn.connectionPoint = {
                    x: this.#data.leadIn.connectionPoint.x + dx,
                    y: this.#data.leadIn.connectionPoint.y + dy,
                };
            }
        }

        // Translate lead-out if it exists
        if (this.#data.leadOut) {
            this.#data.leadOut.geometry = translateArc(
                this.#data.leadOut.geometry as Arc,
                dx,
                dy
            );
            // Normal is a unit vector, doesn't change with translation
            if (this.#data.leadOut.connectionPoint) {
                this.#data.leadOut.connectionPoint = {
                    x: this.#data.leadOut.connectionPoint.x + dx,
                    y: this.#data.leadOut.connectionPoint.y + dy,
                };
            }
        }

        // Normal is a unit vector (direction), doesn't change with translation

        // Translate the normalConnectionPoint (position)
        this.#data.normalConnectionPoint = {
            x: this.#data.normalConnectionPoint.x + dx,
            y: this.#data.normalConnectionPoint.y + dy,
        };
    }
}
