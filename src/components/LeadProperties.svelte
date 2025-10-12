<script lang="ts">
    import { leadStore, parseLeadId } from '$lib/stores/leads/store';
    import { cutStore } from '$lib/stores/cuts/store';
    import { operationsStore } from '$lib/stores/operations/store';
    import { LeadType } from '$lib/types/direction';

    // Reactive lead data
    $: leadState = $leadStore;
    $: selectedLeadId = leadState.selectedLeadId;
    $: cuts = $cutStore.cuts;
    $: operations = $operationsStore;

    // Parse lead ID and get associated data
    $: parsedLead = selectedLeadId ? parseLeadId(selectedLeadId) : null;
    $: selectedCut = parsedLead
        ? cuts.find((cut) => cut.id === parsedLead.cutId)
        : null;
    $: selectedOperation =
        selectedCut && operations && operations.length > 0
            ? operations.find((op) => op.id === selectedCut.operationId)
            : null;
    $: leadConfig =
        parsedLead && selectedCut
            ? parsedLead.leadType === 'leadIn'
                ? selectedCut.leadInConfig
                : selectedCut.leadOutConfig
            : null;
    $: leadGeometry =
        parsedLead && selectedCut
            ? parsedLead.leadType === 'leadIn'
                ? selectedCut.leadIn
                : selectedCut.leadOut
            : null;

    function getLeadTypeName(leadType: 'leadIn' | 'leadOut'): string {
        return leadType === 'leadIn' ? 'Lead-In' : 'Lead-Out';
    }

    function getLeadTypeLabel(type: LeadType): string {
        switch (type) {
            case LeadType.ARC:
                return 'Arc';
            case LeadType.NONE:
                return 'None';
            default:
                return 'Unknown';
        }
    }

    function radiansToDegrees(radians: number): number {
        return (radians * 180) / Math.PI;
    }

    function calculateSweepAngle(
        startAngle: number,
        endAngle: number,
        clockwise: boolean
    ): number {
        let sweep: number;

        if (clockwise) {
            // For clockwise arcs, sweep from start to end going clockwise
            sweep = startAngle - endAngle;
            if (sweep < 0) {
                sweep += 2 * Math.PI;
            }
        } else {
            // For counterclockwise arcs, sweep from start to end going counterclockwise
            sweep = endAngle - startAngle;
            if (sweep < 0) {
                sweep += 2 * Math.PI;
            }
        }

        // Convert to degrees
        return radiansToDegrees(sweep);
    }

    async function copyLeadToClipboard() {
        if (!selectedLeadId || !parsedLead || !selectedCut || !leadConfig)
            return;

        try {
            const leadData = {
                leadId: selectedLeadId,
                leadType: parsedLead.leadType,
                cutId: parsedLead.cutId,
                cutName: selectedCut.name,
                operationName: selectedOperation?.name,
                config: leadConfig,
                geometry: leadGeometry,
            };
            const json = JSON.stringify(leadData, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="lead-properties">
    {#if parsedLead && selectedCut && leadConfig}
        <div class="property-group">
            <div class="property-row">
                <span class="property-label">Type:</span>
                <span class="property-value lead-type">
                    {getLeadTypeName(parsedLead.leadType)}
                </span>
            </div>

            <div class="property-row">
                <span class="property-label">Cut:</span>
                <span class="property-value">{selectedCut.name}</span>
            </div>

            {#if selectedOperation}
                <div class="property-row">
                    <span class="property-label">Operation:</span>
                    <span class="property-value">{selectedOperation.name}</span>
                </div>
            {/if}

            <div class="property-section-title">Lead Configuration</div>

            <div class="property-row">
                <span class="property-label">Lead Type:</span>
                <span class="property-value"
                    >{getLeadTypeLabel(leadConfig.type)}</span
                >
            </div>

            <div class="property-row">
                <span class="property-label">Length:</span>
                <span class="property-value"
                    >{leadConfig.length.toFixed(2)} units</span
                >
            </div>

            {#if leadConfig.angle !== undefined}
                <div class="property-row">
                    <span class="property-label">Angle:</span>
                    <span class="property-value">{leadConfig.angle}°</span>
                </div>
            {:else}
                <div class="property-row">
                    <span class="property-label">Angle:</span>
                    <span class="property-value auto">Auto-calculated</span>
                </div>
            {/if}

            <div class="property-row">
                <span class="property-label">Flip Side:</span>
                <span class="property-value"
                    >{leadConfig.flipSide ? 'Yes' : 'No'}</span
                >
            </div>

            {#if leadConfig.fit !== undefined}
                <div class="property-row">
                    <span class="property-label">Auto-fit:</span>
                    <span class="property-value"
                        >{leadConfig.fit ? 'Yes' : 'No'}</span
                    >
                </div>
            {/if}

            {#if leadGeometry}
                <div class="property-section-title">Lead Geometry</div>

                {#if leadGeometry.connectionPoint}
                    <div class="property-row">
                        <span class="property-label">Connection:</span>
                        <span class="property-value">
                            ({leadGeometry.connectionPoint.x.toFixed(2)}, {leadGeometry.connectionPoint.y.toFixed(
                                2
                            )})
                        </span>
                    </div>
                {/if}

                {#if leadGeometry.normal}
                    <div class="property-row">
                        <span class="property-label">Normal:</span>
                        <span class="property-value">
                            ({leadGeometry.normal.x.toFixed(3)}, {leadGeometry.normal.y.toFixed(
                                3
                            )})
                        </span>
                    </div>
                {/if}

                {#if leadConfig.type === LeadType.ARC && leadGeometry.geometry}
                    <div class="property-section-title">Arc Geometry</div>

                    <div class="property-row">
                        <span class="property-label">Center:</span>
                        <span class="property-value">
                            ({leadGeometry.geometry.center.x.toFixed(2)}, {leadGeometry.geometry.center.y.toFixed(
                                2
                            )})
                        </span>
                    </div>

                    <div class="property-row">
                        <span class="property-label">Radius:</span>
                        <span class="property-value"
                            >{leadGeometry.geometry.radius.toFixed(2)} units</span
                        >
                    </div>

                    <div class="property-row">
                        <span class="property-label">Start Angle:</span>
                        <span class="property-value"
                            >{radiansToDegrees(
                                leadGeometry.geometry.startAngle
                            ).toFixed(1)}°</span
                        >
                    </div>

                    <div class="property-row">
                        <span class="property-label">End Angle:</span>
                        <span class="property-value"
                            >{radiansToDegrees(
                                leadGeometry.geometry.endAngle
                            ).toFixed(1)}°</span
                        >
                    </div>

                    <div class="property-row">
                        <span class="property-label">Sweep:</span>
                        <span class="property-value"
                            >{calculateSweepAngle(
                                leadGeometry.geometry.startAngle,
                                leadGeometry.geometry.endAngle,
                                leadGeometry.geometry.clockwise
                            ).toFixed(1)}°</span
                        >
                    </div>

                    <div class="property-row">
                        <span class="property-label">Direction:</span>
                        <span class="property-value"
                            >{leadGeometry.geometry.clockwise
                                ? 'Clockwise'
                                : 'Counter-clockwise'}</span
                        >
                    </div>
                {/if}
            {/if}

            <button class="copy-button" onclick={copyLeadToClipboard}>
                Copy to Clipboard
            </button>
        </div>
    {:else}
        <p class="no-selection">No lead selected</p>
    {/if}
</div>

<style>
    .lead-properties {
        padding: 0.5rem;
    }

    .property-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .property-section-title {
        font-weight: 600;
        font-size: 0.9rem;
        color: #333;
        margin-top: 0.5rem;
        padding-top: 0.5rem;
        border-top: 1px solid #e0e0e0;
    }

    .property-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        font-size: 0.875rem;
    }

    .property-label {
        font-weight: 500;
        color: #666;
        flex-shrink: 0;
    }

    .property-value {
        text-align: right;
        word-break: break-word;
        color: #333;
        font-family: 'Courier New', monospace;
    }

    .property-value.lead-type {
        font-weight: 600;
        color: rgb(0, 83, 135);
    }

    .property-value.auto {
        font-style: italic;
        color: #999;
    }

    .property-value.enabled {
        color: #00aa00;
        font-weight: 600;
    }

    .property-value.disabled {
        color: #cc0000;
        font-weight: 600;
    }

    .copy-button {
        margin-top: 0.5rem;
        padding: 0.5rem;
        background-color: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.2s ease;
    }

    .copy-button:hover {
        background-color: #e0e0e0;
        border-color: #999;
    }

    .copy-button:active {
        background-color: #d0d0d0;
    }

    .no-selection {
        color: #666;
        font-style: italic;
        margin: 0;
        text-align: center;
        padding: 1rem;
    }
</style>
