<script lang="ts">
    import { Layer } from '$lib/cam/layer/classes.svelte';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import { planStore } from '$lib/stores/plan/store';
    import { cutStore } from '$lib/stores/cuts/store';
    import { selectLead } from '$lib/stores/leads/store';
    import { rapidStore } from '$lib/stores/rapids/store';
    import { kerfStore } from '$lib/stores/kerfs/store';
    import { layerStore } from '$lib/stores/layers/store.svelte';
    import { Grid, Willow } from '@svar-ui/svelte-grid';

    interface TreeNode {
        id: string;
        name: string;
        type: string;
        open?: boolean;
        data?: TreeNode[];
        chainId?: string; // For chain rows
        shapeId?: string; // For shape rows that are children of chains
        partId?: string; // For part rows
        shellChainId?: string; // For part shell rows
        voidChainId?: string; // For part void rows
        slotChainId?: string; // For part slot rows
        cutId?: string; // For cut rows
        rapidInId?: string; // For rapidIn rows
        leadInId?: string; // For leadIn rows
        cutChainId?: string; // For cutChain rows
        leadOutId?: string; // For leadOut rows
    }

    const drawing = $derived($drawingStore.drawing);
    const fileName = $derived(drawing?.fileName ?? 'Drawing');
    const cuts = $derived($planStore.plan.cuts);
    // Get layers from Drawing class
    const layers = $derived(
        drawing
            ? Object.values(drawing.layers).sort((a, b) => {
                  // Sort with default layer '0' first
                  if (a.name === '0') return -1;
                  if (b.name === '0') return 1;
                  return (a.name ?? '').localeCompare(b.name ?? '');
              })
            : []
    );
    // Transform data into tree structure for SVAR Grid
    const treeData = $derived(
        drawing
            ? [
                  {
                      id: 'drawing',
                      name: fileName,
                      type: 'Drawing',
                      open: true,
                      data: [
                          {
                              id: 'layers',
                              name: 'Layers',
                              type: 'Layer[]',
                              open: true,
                              data: layers.map((layer: Layer) => ({
                                  id: `layer-${layer.name}`,
                                  name: layer.name ?? '0',
                                  type: 'Layer',
                                  open: layerExpansion[layer.name] ?? false,
                                  data: [
                                      {
                                          id: `shapes-${layer.name}`,
                                          name: 'Shapes',
                                          type: 'Shape[]',
                                          open: false,
                                          data: layer.shapes.map((shape) => ({
                                              id: shape.id,
                                              name: shape.id,
                                              type: `Shape<${shape.type}>`,
                                          })),
                                      },
                                      {
                                          id: `chains-${layer.name}`,
                                          name: 'Chains',
                                          type: 'Chain[]',
                                          open: false,
                                          data: layer.chains.map((chain) => ({
                                              id: `${layer.name}-${chain.id}`,
                                              name: chain.id,
                                              type: 'Chain',
                                              chainId: chain.id, // Store actual chain ID for selection
                                              open: false,
                                              data: chain.shapes.map(
                                                  (shape) => ({
                                                      id: `chain-${chain.id}-${shape.id}`,
                                                      name: shape.id,
                                                      type: `Shape<${shape.type}>`,
                                                      shapeId: shape.id, // Store actual shape ID for selection
                                                  })
                                              ),
                                          })),
                                      },
                                      {
                                          id: `parts-${layer.name}`,
                                          name: 'Parts',
                                          type: 'Part[]',
                                          open: false,
                                          data: layer.parts.map((part) => ({
                                              id: `${layer.name}-${part.id}`,
                                              name: part.id,
                                              type: 'Part',
                                              partId: part.id, // Store actual part ID for selection
                                              open: false,
                                              data: [
                                                  {
                                                      id: `part-${part.id}-chains`,
                                                      name: 'Chains',
                                                      type: 'Chain[]',
                                                      open: false,
                                                      data: [
                                                          {
                                                              id: `part-${part.id}-shell`,
                                                              name: 'shell',
                                                              type: 'Chain',
                                                              shellChainId:
                                                                  part.shell.id,
                                                          },
                                                          ...(part.voids
                                                              .length > 0 ||
                                                          part.slots.length > 0
                                                              ? [
                                                                    {
                                                                        id: `part-${part.id}-voids`,
                                                                        name: 'Voids',
                                                                        type: 'Chain[]',
                                                                        open: false,
                                                                        data: [
                                                                            ...part.voids.map(
                                                                                (
                                                                                    void_
                                                                                ) => ({
                                                                                    id: `part-${part.id}-void-${void_.id}`,
                                                                                    name: void_.id,
                                                                                    type: 'Chain',
                                                                                    voidChainId:
                                                                                        void_
                                                                                            .chain
                                                                                            .id,
                                                                                })
                                                                            ),
                                                                            ...part.slots.map(
                                                                                (
                                                                                    slot
                                                                                ) => ({
                                                                                    id: `part-${part.id}-slot-${slot.id}`,
                                                                                    name: slot.id,
                                                                                    type: 'Chain',
                                                                                    slotChainId:
                                                                                        slot
                                                                                            .chain
                                                                                            .id,
                                                                                })
                                                                            ),
                                                                        ],
                                                                    },
                                                                ]
                                                              : []),
                                                      ],
                                                  },
                                              ],
                                          })),
                                      },
                                  ],
                              })),
                          },
                      ],
                  },
                  {
                      id: 'plan',
                      name: 'Plan',
                      type: 'Plan',
                      open: true,
                      data: [
                          {
                              id: 'cuts',
                              name: 'Cuts',
                              type: 'Cut[]',
                              open: true,
                              data: cuts.map((cut) => {
                                  const childRows = [];

                                  // Add rapidIn row if it exists
                                  if (cut.rapidIn) {
                                      childRows.push({
                                          id: `cut-${cut.id}-rapidIn`,
                                          name: 'Rapid In',
                                          type: 'Rapid',
                                          rapidInId: cut.rapidIn.id,
                                      });
                                  }

                                  // Add leadIn row if it exists
                                  if (cut.leadIn) {
                                      childRows.push({
                                          id: `cut-${cut.id}-leadIn`,
                                          name: 'Lead In',
                                          type: 'Lead',
                                          leadInId: cut.id, // Reference the cut id for selection
                                      });
                                  }

                                  // Add cutChain row if it exists
                                  if (cut.cutChain) {
                                      childRows.push({
                                          id: `cut-${cut.id}-cutChain`,
                                          name: 'Cut Path',
                                          type: 'Chain',
                                          cutChainId: cut.cutChain.id,
                                      });
                                  }

                                  // Add leadOut row if it exists
                                  if (cut.leadOut) {
                                      childRows.push({
                                          id: `cut-${cut.id}-leadOut`,
                                          name: 'Lead Out',
                                          type: 'Lead',
                                          leadOutId: cut.id, // Reference the cut id for selection
                                      });
                                  }

                                  return {
                                      id: `cut-${cut.id}`,
                                      name: cut.name,
                                      type: 'Cut',
                                      cutId: cut.id,
                                      open: false,
                                      data:
                                          childRows.length > 0
                                              ? childRows
                                              : undefined,
                                  };
                              }),
                          },
                      ],
                  },
              ]
            : []
    );

    // Track layer expansion state locally
    let layerExpansion: { [layerName: string]: boolean } = {};

    // Grid API instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let gridApi: any;

    // Handle row selection
    function handleRowSelection() {
        if (!gridApi) return;

        const state = gridApi.getState();
        const selectedRows = state.selectedRows;

        if (selectedRows && selectedRows.length > 0) {
            const rowId = String(selectedRows[0]);

            // Process both container rows (like layers) and leaf rows (shapes, chains, parts, cuts)
            if (rowId !== 'drawing' && rowId !== 'plan' && drawing) {
                // Handle layer selection
                if (rowId.startsWith('layer-')) {
                    const layerName = rowId.replace('layer-', '');
                    layerStore.selectLayer(layerName);
                    // Clear other selections
                    chainStore.clearChainSelection();
                    partStore.clearPartSelection();
                    drawingStore.clearSelection();
                    cutStore.selectCut(null);
                    return;
                }

                // Clear layer selection when selecting anything else
                layerStore.clearSelection();

                // Only process leaf rows, ignore container rows
                // Container rows: shapes-, chains-, parts-, part-*-chains, part-*-voids, cuts, layers
                const isContainer =
                    rowId.startsWith('shapes-') ||
                    rowId.startsWith('chains-') ||
                    rowId.startsWith('parts-') ||
                    rowId.endsWith('-chains') ||
                    rowId.endsWith('-voids') ||
                    rowId === 'cuts' ||
                    rowId === 'layers';

                if (!isContainer) {
                    // Get the row data to check if it has a chainId, partId, or cutId property
                    const rowData = findRowData(treeData, rowId);

                    if (rowData?.cutId) {
                        // It's a cut row - select the cut
                        cutStore.selectCut(rowData.cutId);
                        chainStore.clearChainSelection();
                        partStore.clearPartSelection();
                        drawingStore.clearSelection();
                    } else if (rowData?.rapidInId) {
                        // It's a rapidIn row - select the rapid
                        rapidStore.selectRapids(new Set([rowData.rapidInId]));
                        chainStore.clearChainSelection();
                        partStore.clearPartSelection();
                        drawingStore.clearSelection();
                        cutStore.selectCut(null);
                        selectLead(null);
                        kerfStore.selectKerf(null);
                    } else if (rowData?.leadInId) {
                        // It's a leadIn row - select the cut
                        cutStore.selectCut(rowData.leadInId);
                        chainStore.clearChainSelection();
                        partStore.clearPartSelection();
                        drawingStore.clearSelection();
                    } else if (rowData?.cutChainId) {
                        // It's a cutChain row - select the chain
                        chainStore.selectChain(rowData.cutChainId);
                        partStore.clearPartSelection();
                        drawingStore.clearSelection();
                        cutStore.selectCut(null);
                        selectLead(null);
                        rapidStore.clearSelection();
                        kerfStore.selectKerf(null);
                    } else if (rowData?.leadOutId) {
                        // It's a leadOut row - select the cut
                        cutStore.selectCut(rowData.leadOutId);
                        chainStore.clearChainSelection();
                        partStore.clearPartSelection();
                        drawingStore.clearSelection();
                    } else if (rowData?.shellChainId) {
                        // It's a part shell row - select the shell chain
                        console.log(
                            '[LayersList] Selecting shell chain:',
                            rowData.shellChainId
                        );
                        chainStore.selectChain(rowData.shellChainId);
                        partStore.clearPartSelection();
                        partStore.clearHighlight();
                        partStore.clearPartHover();
                        drawingStore.clearSelection();
                        cutStore.selectCut(null);
                        selectLead(null);
                        rapidStore.clearSelection();
                        kerfStore.selectKerf(null);
                    } else if (rowData?.voidChainId) {
                        // It's a part void row - select the void chain
                        console.log(
                            '[LayersList] Selecting void chain:',
                            rowData.voidChainId
                        );
                        chainStore.selectChain(rowData.voidChainId);
                        partStore.clearPartSelection();
                        partStore.clearHighlight();
                        partStore.clearPartHover();
                        drawingStore.clearSelection();
                        cutStore.selectCut(null);
                        selectLead(null);
                        rapidStore.clearSelection();
                        kerfStore.selectKerf(null);
                    } else if (rowData?.slotChainId) {
                        // It's a part slot row - select the slot chain
                        console.log(
                            '[LayersList] Selecting slot chain:',
                            rowData.slotChainId
                        );
                        chainStore.selectChain(rowData.slotChainId);
                        partStore.clearPartSelection();
                        partStore.clearHighlight();
                        partStore.clearPartHover();
                        drawingStore.clearSelection();
                        cutStore.selectCut(null);
                        selectLead(null);
                        rapidStore.clearSelection();
                        kerfStore.selectKerf(null);
                    } else if (rowData?.chainId) {
                        // It's a chain row - select the chain
                        console.log(
                            '[LayersList] Selecting chain:',
                            rowData.chainId,
                            'from row:',
                            rowId
                        );
                        chainStore.selectChain(rowData.chainId);
                        partStore.clearPartSelection();
                        drawingStore.clearSelection();
                        cutStore.selectCut(null);
                        selectLead(null);
                        rapidStore.clearSelection();
                        kerfStore.selectKerf(null);
                    } else if (rowData?.partId) {
                        // It's a part row - select the part
                        partStore.selectPart(rowData.partId);
                        chainStore.clearChainSelection();
                        drawingStore.clearSelection();
                        cutStore.selectCut(null);
                    } else if (rowData?.shapeId) {
                        // It's a shape row from a chain (has shapeId property)
                        drawingStore.selectShape(rowData.shapeId);
                        chainStore.clearChainSelection();
                        partStore.clearPartSelection();
                        cutStore.selectCut(null);
                    } else {
                        // It's a shape row from Shapes folder (use rowId directly)
                        drawingStore.selectShape(rowId);
                        chainStore.clearChainSelection();
                        partStore.clearPartSelection();
                        cutStore.selectCut(null);
                    }
                }
            }
        }
    }

    // Helper function to find row data in tree structure
    function findRowData(
        data: TreeNode[],
        rowId: string
    ): TreeNode | undefined {
        for (const node of data) {
            if (node.id === rowId) {
                return node;
            }
            if (node.data) {
                const found = findRowData(node.data, rowId);
                if (found) return found;
            }
        }
        return undefined;
    }

    // Sync layer expansion state from grid
    function syncLayerExpansion() {
        if (!gridApi || !drawing) return;

        const state = gridApi.getState();
        const data = state.data;

        if (
            data &&
            data.length > 0 &&
            data[0].data &&
            data[0].data.length > 0 &&
            data[0].data[0].data
        ) {
            // Iterate through layer rows (nested under Drawing > Layers container) and sync their open state
            data[0].data[0].data.forEach(
                (layerRow: { name: string; open?: boolean }) => {
                    const layerName = layerRow.name;
                    const isOpen = layerRow.open ?? false;

                    // Update local state if it changed
                    if (layerExpansion[layerName] !== isOpen) {
                        layerExpansion = {
                            ...layerExpansion,
                            [layerName]: isOpen,
                        };
                    }
                }
            );
        }
    }

    // Sync expansion state after grid updates
    $effect(() => {
        // Read treeData to properly track it as a dependency
        const _ = treeData.length;

        // Sync after grid processes the new data
        if (gridApi) {
            setTimeout(syncLayerExpansion, 0);
        }
    });

    // Define columns for tree table
    const columns = [
        {
            id: 'name',
            header: 'Name',
            flexgrow: 1,
            treetoggle: true, // This column shows expand/collapse arrows
        },
        {
            id: 'type',
            header: 'Type',
            width: 100,
        },
    ];
</script>

<Willow>
    <Grid
        tree={true}
        data={treeData}
        {columns}
        bind:this={gridApi}
        onselectrow={handleRowSelection}
        onclick={syncLayerExpansion}
    />
</Willow>
