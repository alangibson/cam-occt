<script lang="ts">
    import { parseLeadId } from '$lib/stores/leads/store.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import { planStore } from '$lib/stores/plan/store.svelte';
    import { operationsStore } from '$lib/stores/operations/store.svelte';
    import { LeadType } from '$lib/cam/lead/enums';
    import InspectProperties from './InspectProperties.svelte';

    // Reactive lead data
    let selectedLeadIds = $derived(selectionStore.leads.selected);
    let selectedLeadId = $derived(
        selectedLeadIds.size === 1 ? Array.from(selectedLeadIds)[0] : null
    );
    let highlightedLeadId = $derived(selectionStore.leads.highlighted);
    let activeLeadId = $derived(selectedLeadId || highlightedLeadId);
    let cuts = $derived(planStore.plan.cuts);
    let operations = $derived(operationsStore.operations);

    // Parse lead ID and get associated data
    let parsedLead = $derived(activeLeadId ? parseLeadId(activeLeadId) : null);
    let selectedCut = $derived(
        parsedLead ? cuts.find((cut) => cut.id === parsedLead.cutId) : null
    );
    let selectedOperation = $derived(
        selectedCut && operations && operations.length > 0
            ? operations.find((op) => op.id === selectedCut.sourceOperationId)
            : null
    );
    let leadConfig = $derived(
        parsedLead && selectedCut
            ? parsedLead.leadType === 'leadIn'
                ? selectedCut.leadInConfig
                : selectedCut.leadOutConfig
            : null
    );
    let leadGeometry = $derived(
        parsedLead && selectedCut
            ? parsedLead.leadType === 'leadIn'
                ? selectedCut.leadIn
                : selectedCut.leadOut
            : null
    );

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
            sweep = startAngle - endAngle;
            if (sweep < 0) {
                sweep += 2 * Math.PI;
            }
        } else {
            sweep = endAngle - startAngle;
            if (sweep < 0) {
                sweep += 2 * Math.PI;
            }
        }

        return radiansToDegrees(sweep);
    }

    // Build properties array
    let properties = $derived(
        parsedLead && selectedCut && leadConfig
            ? (() => {
                  const props: Array<{ property: string; value: string }> = [];

                  // Type is always first
                  props.push({
                      property: 'Type',
                      value: getLeadTypeName(parsedLead.leadType),
                  });

                  props.push({
                      property: 'Cut',
                      value: selectedCut.name,
                  });

                  if (selectedOperation) {
                      props.push({
                          property: 'Operation',
                          value: selectedOperation.name,
                      });
                  }

                  props.push({
                      property: 'Lead Type',
                      value: getLeadTypeLabel(leadConfig.type),
                  });

                  props.push({
                      property: 'Length',
                      value: `${leadConfig.length.toFixed(2)} units`,
                  });

                  if (leadConfig.angle !== undefined) {
                      props.push({
                          property: 'Angle',
                          value: `${leadConfig.angle}°`,
                      });
                  } else {
                      props.push({
                          property: 'Angle',
                          value: 'Auto-calculated',
                      });
                  }

                  props.push({
                      property: 'Flip Side',
                      value: leadConfig.flipSide ? 'Yes' : 'No',
                  });

                  if (leadConfig.fit !== undefined) {
                      props.push({
                          property: 'Auto-fit',
                          value: leadConfig.fit ? 'Yes' : 'No',
                      });
                  }

                  // Add geometry properties if available
                  if (leadGeometry) {
                      if (leadGeometry.connectionPoint) {
                          props.push({
                              property: 'Connection',
                              value: `(${leadGeometry.connectionPoint.x.toFixed(2)}, ${leadGeometry.connectionPoint.y.toFixed(2)})`,
                          });
                      }

                      if (leadGeometry.normal) {
                          props.push({
                              property: 'Normal',
                              value: `(${leadGeometry.normal.x.toFixed(3)}, ${leadGeometry.normal.y.toFixed(3)})`,
                          });
                      }
                  }

                  return props;
              })()
            : []
    );

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
        <InspectProperties {properties} onCopy={copyLeadToClipboard}>
            {#if leadConfig.type === LeadType.ARC && leadGeometry?.geometry}
                <div class="geometry-section">
                    <h4 class="section-title">Arc Geometry:</h4>
                    <div class="geometry-properties">
                        <div class="geometry-row">
                            <span class="geometry-label">Center:</span>
                            <span class="geometry-value">
                                ({leadGeometry.geometry.center.x.toFixed(2)}, {leadGeometry.geometry.center.y.toFixed(
                                    2
                                )})
                            </span>
                        </div>
                        <div class="geometry-row">
                            <span class="geometry-label">Radius:</span>
                            <span class="geometry-value">
                                {leadGeometry.geometry.radius.toFixed(2)} units
                            </span>
                        </div>
                        <div class="geometry-row">
                            <span class="geometry-label">Start Angle:</span>
                            <span class="geometry-value">
                                {radiansToDegrees(
                                    leadGeometry.geometry.startAngle
                                ).toFixed(1)}°
                            </span>
                        </div>
                        <div class="geometry-row">
                            <span class="geometry-label">End Angle:</span>
                            <span class="geometry-value">
                                {radiansToDegrees(
                                    leadGeometry.geometry.endAngle
                                ).toFixed(1)}°
                            </span>
                        </div>
                        <div class="geometry-row">
                            <span class="geometry-label">Sweep:</span>
                            <span class="geometry-value">
                                {calculateSweepAngle(
                                    leadGeometry.geometry.startAngle,
                                    leadGeometry.geometry.endAngle,
                                    leadGeometry.geometry.clockwise
                                ).toFixed(1)}°
                            </span>
                        </div>
                        <div class="geometry-row">
                            <span class="geometry-label">Direction:</span>
                            <span class="geometry-value">
                                {leadGeometry.geometry.clockwise
                                    ? 'Clockwise'
                                    : 'Counter-clockwise'}
                            </span>
                        </div>
                    </div>
                </div>
            {/if}
        </InspectProperties>
    {:else}
        <p class="no-selection">No lead selected</p>
    {/if}
</div>

<style>
    .lead-properties {
        padding: 0.5rem;
        min-height: 200px;
    }

    .geometry-section {
        margin-top: 1rem;
        padding: 0.75rem;
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.25rem;
    }

    .section-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
        margin: 0 0 0.5rem 0;
    }

    .geometry-properties {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .geometry-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8rem;
    }

    .geometry-label {
        font-weight: 500;
        color: #6b7280;
    }

    .geometry-value {
        font-family: monospace;
        color: #374151;
        background-color: #f3f4f6;
        padding: 0.125rem 0.25rem;
        border-radius: 0.125rem;
        font-size: 0.75rem;
    }

    .no-selection {
        color: #666;
        font-style: italic;
        margin: 0;
        text-align: center;
        padding: 1rem;
    }
</style>
