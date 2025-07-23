import { P as current_component, I as store_get, G as escape_html, E as ensure_array_like, F as attr_class, O as attr, Q as stringify, K as unsubscribe_stores, D as pop, z as push, R as maybe_selected } from "../../../chunks/index.js";
import { a as drawingLayers, b as selectedShapeInfo, p as project, e as applicationSettings, h as hoveredShapeInfo } from "../../../chunks/stores.js";
function onDestroy(fn) {
  var context = (
    /** @type {Component} */
    current_component
  );
  (context.d ??= []).push(fn);
}
function LayerMenu($$payload, $$props) {
  push();
  var $$store_subs;
  function getLayerIcon(entityTypes) {
    if (entityTypes.includes("SPLINE")) return "🌊";
    if (entityTypes.includes("CIRCLE")) return "○";
    if (entityTypes.includes("ARC")) return "◗";
    if (entityTypes.includes("LINE")) return "─";
    return "📄";
  }
  $$payload.out.push(`<div class="layer-menu svelte-u7ien0"><div class="layer-menu-header svelte-u7ien0"><h3 class="svelte-u7ien0">Layers</h3> `);
  if (store_get($$store_subs ??= {}, "$drawingLayers", drawingLayers).length > 0) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<small class="svelte-u7ien0">${escape_html(store_get($$store_subs ??= {}, "$drawingLayers", drawingLayers).length)} layer${escape_html(store_get($$store_subs ??= {}, "$drawingLayers", drawingLayers).length !== 1 ? "s" : "")}</small>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div> `);
  if (store_get($$store_subs ??= {}, "$drawingLayers", drawingLayers).length === 0) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="empty-state svelte-u7ien0"><p class="svelte-u7ien0">No layers detected</p> <small class="svelte-u7ien0">Import a DXF file to see layers</small></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
    const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$drawingLayers", drawingLayers));
    $$payload.out.push(`<div class="layer-list svelte-u7ien0"><!--[-->`);
    for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
      let layer = each_array[$$index_1];
      $$payload.out.push(`<div${attr_class("layer-item svelte-u7ien0", void 0, { "layer-hidden": !layer.visible })}><button class="layer-toggle svelte-u7ien0"${attr("title", layer.visible ? "Hide layer" : "Show layer")}><span class="visibility-icon">${escape_html(layer.visible ? "👁️" : "🙈")}</span></button> <div class="layer-info svelte-u7ien0"><div class="layer-name svelte-u7ien0"><span class="layer-icon svelte-u7ien0"${attr("title", `Primary entity types: ${stringify(layer.entityTypes.join(", "))}`)}>${escape_html(getLayerIcon(layer.entityTypes))}</span> <span class="name svelte-u7ien0">${escape_html(layer.name)}</span></div> <div class="layer-details svelte-u7ien0"><span class="entity-count svelte-u7ien0">${escape_html(layer.entityCount)} entit${escape_html(layer.entityCount !== 1 ? "ies" : "y")}</span> `);
      if (layer.entityTypes.length > 0) {
        $$payload.out.push("<!--[-->");
        const each_array_1 = ensure_array_like(layer.entityTypes);
        $$payload.out.push(`<div class="entity-types svelte-u7ien0"><!--[-->`);
        for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
          let entityType = each_array_1[$$index];
          $$payload.out.push(`<span class="entity-type-badge svelte-u7ien0">${escape_html(entityType)}</span>`);
        }
        $$payload.out.push(`<!--]--></div>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--></div></div></div>`);
    }
    $$payload.out.push(`<!--]--></div>`);
  }
  $$payload.out.push(`<!--]--></div>`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
function _page($$payload, $$props) {
  push();
  var $$store_subs;
  let unitsLocked = false;
  let editedStartX = 0;
  let editedStartY = 0;
  let editedEndX = 0;
  let editedEndY = 0;
  let editedOriginX = 0;
  let editedOriginY = 0;
  let shapeModifier;
  let shouldUpdatePreviousValues = true;
  onDestroy(() => {
  });
  if (store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo) && shouldUpdatePreviousValues) {
    if (store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo).startPoint && store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo).endPoint) {
      editedStartX = parseFloat(store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo).startPoint.x.toFixed(3));
      editedStartY = parseFloat(store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo).startPoint.y.toFixed(3));
      editedEndX = parseFloat(store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo).endPoint.x.toFixed(3));
      editedEndY = parseFloat(store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo).endPoint.y.toFixed(3));
    }
    const origin = store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo).origin || store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo).position;
    editedOriginX = parseFloat(origin.x.toFixed(3));
    editedOriginY = parseFloat(origin.y.toFixed(3));
  }
  if (store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo) && shapeModifier) ;
  $$payload.out.push(`<div class="modify-page svelte-59hy2x"><div class="toolbar svelte-59hy2x"><h2 class="svelte-59hy2x">Modify Drawing</h2> `);
  if (
    // Event handlers for when user starts/stops editing
    // Direct event handler for when user finishes editing origin values
    // Force update the previous values to current before checking
    // User explicitly triggered this, so modify regardless of our comparison
    // Force modification
    // Re-enable previousValues updates after modification
    // Check if values actually changed to avoid infinite loops
    // Modify the OpenCascade shapes
    // Update project state
    // Refresh visualization
    // Store currently selected shape index to restore selection after refresh
    // Convert OpenCascade shapes to Three.js geometries
    // Clear previous geometry but preserve zoom level
    // Don't reset zoom during refresh
    // Clear selection temporarily since objects changed
    // Convert to the format expected by the viewer
    // Add all geometries to the viewer, preserving current zoom
    // Update layer information FIRST (this preserves visibility states in the store)
    // CRITICAL: Restore layer visibility settings after geometry refresh
    // The new Three.js objects default to visible: true, but we need to restore
    // the actual visibility state from the drawingLayers store
    // Re-select the same shape index if it still exists
    // Small delay to ensure geometry is added
    // Update drawing dimensions
    // Store the current selection info to avoid race conditions
    // Delete shape from OpenCascade collection using stored selection
    // Update project state
    // Refresh visualization
    // Function to update drawing dimensions
    // Function to collect and update layer information
    // Collect layer statistics from the geometries
    // Get current layer visibility states to preserve them
    // Convert to LayerInfo array, preserving existing visibility states
    // Preserve existing visibility, default to true for new layers
    // Sort layers alphabetically
    // Handle layer visibility toggle
    // Initialize shape modifier
    // Expose viewer to window for testing
    // Load geometry if file is available
    // ShapeModifier cleanup if needed
    // Check if we're in the browser
    // Initialize OpenCascade first
    // TODO: Implement proper SVG to OpenCascade conversion
    // For now, show a placeholder
    // Step 1: Convert DXF to OpenCascade shapes with unit detection
    // Handle units according to new specification:
    // - If units are defined in DXF (high/medium confidence), use them and lock units
    // - If no units in DXF (low confidence), default to mm and allow user to change
    // File has defined units - use them and lock the setting
    // File has no units - default to mm but allow user to change
    // Update application settings
    // Step 2: Convert OpenCascade shapes to Three.js geometries
    // Clear previous geometry
    // Convert to the format expected by the viewer
    // Add all geometries to the viewer
    // Pass file units only if they were actually defined in the file
    // Units are never locked - user can always override
    // Update drawing dimensions
    // Update layer information
    // Store OpenCascade shapes and units in project for CAD operations
    // Update the viewer with new units when user changes the setting
    // Update drawing dimensions when units change
    // Revert the dropdown to the correct value
    store_get($$store_subs ??= {}, "$project", project).importedFile
  ) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<span class="file-name svelte-59hy2x">File: ${escape_html(store_get($$store_subs ??= {}, "$project", project).importedFile.name)}</span>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div> <div class="content svelte-59hy2x"><div class="layer-panel svelte-59hy2x">`);
  LayerMenu($$payload);
  $$payload.out.push(`<!----></div> <div class="viewer-panel svelte-59hy2x">`);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> <div class="viewer-container svelte-59hy2x"></div></div> <div class="properties-panel svelte-59hy2x"><div class="card svelte-59hy2x"><h3 class="svelte-59hy2x">Settings</h3> <div class="property-group svelte-59hy2x"><label class="svelte-59hy2x">Units: <select${attr("disabled", unitsLocked, true)} class="svelte-59hy2x">`);
  $$payload.select_value = store_get($$store_subs ??= {}, "$applicationSettings", applicationSettings).units;
  $$payload.out.push(`<option value="mm"${maybe_selected($$payload, "mm")} class="svelte-59hy2x">Millimeters (mm)</option><option value="inches"${maybe_selected($$payload, "inches")} class="svelte-59hy2x">Inches (in)</option>`);
  $$payload.select_value = void 0;
  $$payload.out.push(`</select></label> `);
  if (store_get($$store_subs ??= {}, "$project", project).units) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<small class="units-info svelte-59hy2x">DXF file units: ${escape_html(store_get($$store_subs ??= {}, "$project", project).units)} `);
    {
      $$payload.out.push("<!--[!-->");
      if (store_get($$store_subs ??= {}, "$project", project).units !== store_get($$store_subs ??= {}, "$applicationSettings", applicationSettings).units) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<span class="warning svelte-59hy2x">⚠️ Display units differ from file</span>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]-->`);
    }
    $$payload.out.push(`<!--]--></small>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div></div> <div class="card svelte-59hy2x"><h3 class="svelte-59hy2x">Properties</h3> `);
  if (store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo)) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="selected-shape-editor svelte-59hy2x"><h4 class="svelte-59hy2x">Selected Shape Properties</h4> <div class="property-group svelte-59hy2x"><strong class="svelte-59hy2x">Type:</strong> <span class="svelte-59hy2x">${escape_html(store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo).type)}</span></div> `);
    if (store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo).layer) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<div class="property-group svelte-59hy2x"><strong class="svelte-59hy2x">Layer:</strong> <span class="svelte-59hy2x">${escape_html(store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo).layer)}</span></div>`);
    } else {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]--> `);
    if (store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo).startPoint && store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo).endPoint) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<div class="property-group svelte-59hy2x"><label class="svelte-59hy2x">Start Point:</label> <div class="point-inputs svelte-59hy2x"><input type="number" step="0.001" placeholder="X"${attr("value", editedStartX)} class="svelte-59hy2x"/> <input type="number" step="0.001" placeholder="Y"${attr("value", editedStartY)} class="svelte-59hy2x"/></div></div> <div class="property-group svelte-59hy2x"><label class="svelte-59hy2x">End Point:</label> <div class="point-inputs svelte-59hy2x"><input type="number" step="0.001" placeholder="X"${attr("value", editedEndX)} class="svelte-59hy2x"/> <input type="number" step="0.001" placeholder="Y"${attr("value", editedEndY)} class="svelte-59hy2x"/></div></div>`);
    } else {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]--> <div class="property-group svelte-59hy2x"><label class="svelte-59hy2x">Origin:</label> <div class="point-inputs svelte-59hy2x"><input type="number" step="0.001" placeholder="X"${attr("value", editedOriginX)} class="svelte-59hy2x"/> <input type="number" step="0.001" placeholder="Y"${attr("value", editedOriginY)} class="svelte-59hy2x"/></div></div></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
    if (store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo)) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<div class="hover-info svelte-59hy2x"><h4 class="svelte-59hy2x">Hovered Shape</h4> <div class="property-group svelte-59hy2x"><strong class="svelte-59hy2x">Type:</strong> <span class="svelte-59hy2x">${escape_html(store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo).type)}</span></div> `);
      if (store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo).layer) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<div class="property-group svelte-59hy2x"><strong class="svelte-59hy2x">Layer:</strong> <span class="svelte-59hy2x">${escape_html(store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo).layer)}</span></div>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--> <div class="property-group svelte-59hy2x"><strong class="svelte-59hy2x">Origin:</strong> <span class="svelte-59hy2x">X: ${escape_html((store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo).origin || store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo).position).x.toFixed(3))}, Y: ${escape_html((store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo).origin || store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo).position).y.toFixed(3))}</span></div> `);
      if (store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo).startPoint && store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo).endPoint) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<div class="property-group svelte-59hy2x"><strong class="svelte-59hy2x">Start Point:</strong> <span class="start-point svelte-59hy2x">X: ${escape_html(store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo).startPoint.x.toFixed(3))}, Y: ${escape_html(store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo).startPoint.y.toFixed(3))}</span></div> <div class="property-group svelte-59hy2x"><strong class="svelte-59hy2x">End Point:</strong> <span class="end-point svelte-59hy2x">X: ${escape_html(store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo).endPoint.x.toFixed(3))}, Y: ${escape_html(store_get($$store_subs ??= {}, "$hoveredShapeInfo", hoveredShapeInfo).endPoint.y.toFixed(3))}</span></div>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--> <p class="instruction svelte-59hy2x">Click to select this shape for editing</p></div>`);
    } else {
      $$payload.out.push("<!--[!-->");
      $$payload.out.push(`<p class="svelte-59hy2x">Click on shapes in the viewer to select and edit their properties.</p>`);
    }
    $$payload.out.push(`<!--]-->`);
  }
  $$payload.out.push(`<!--]--> <div class="actions svelte-59hy2x"><button class="btn btn-danger svelte-59hy2x"${attr("disabled", !store_get($$store_subs ??= {}, "$selectedShapeInfo", selectedShapeInfo), true)}>Delete Selected</button></div></div></div></div></div>`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _page as default
};
