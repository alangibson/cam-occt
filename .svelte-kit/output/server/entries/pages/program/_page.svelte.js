import { E as ensure_array_like, O as attr, R as maybe_selected, G as escape_html, I as store_get, K as unsubscribe_stores, D as pop, z as push } from "../../../chunks/index.js";
import { p as project } from "../../../chunks/stores.js";
function _page($$payload, $$props) {
  push();
  var $$store_subs;
  let selectedMaterial = {
    name: "Mild Steel",
    thickness: 3,
    feedRate: 2e3,
    cutHeight: 1.5
  };
  let materials = [
    {
      name: "Mild Steel",
      thickness: 3,
      feedRate: 2e3,
      cutHeight: 1.5
    },
    {
      name: "Stainless Steel",
      thickness: 3,
      feedRate: 1500,
      cutHeight: 2
    },
    {
      name: "Aluminum",
      thickness: 3,
      feedRate: 3e3,
      cutHeight: 1
    }
  ];
  const each_array = ensure_array_like(materials);
  $$payload.out.push(`<div class="program-page svelte-1t7r3rk"><h2 class="svelte-1t7r3rk">Program Cutting Operations</h2> <div class="content svelte-1t7r3rk"><div class="settings-panel"><div class="card"><h3>Material Settings</h3> <div class="form-group svelte-1t7r3rk"><label for="material" class="svelte-1t7r3rk">Material Type:</label> <select id="material" class="svelte-1t7r3rk">`);
  $$payload.select_value = selectedMaterial;
  $$payload.out.push(`<!--[-->`);
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let material = each_array[$$index];
    $$payload.out.push(`<option${attr("value", material)}${maybe_selected($$payload, material)}>${escape_html(material.name)}</option>`);
  }
  $$payload.out.push(`<!--]-->`);
  $$payload.select_value = void 0;
  $$payload.out.push(`</select></div> <div class="form-group svelte-1t7r3rk"><label for="thickness" class="svelte-1t7r3rk">Thickness (mm):</label> <input id="thickness" type="number"${attr("value", selectedMaterial.thickness)} min="0.1" step="0.1" class="svelte-1t7r3rk"/></div> <div class="form-group svelte-1t7r3rk"><label for="feedRate" class="svelte-1t7r3rk">Feed Rate (mm/min):</label> <input id="feedRate" type="number"${attr("value", selectedMaterial.feedRate)} min="100" step="100" class="svelte-1t7r3rk"/></div> <div class="form-group svelte-1t7r3rk"><label for="cutHeight" class="svelte-1t7r3rk">Cut Height (mm):</label> <input id="cutHeight" type="number"${attr("value", selectedMaterial.cutHeight)} min="0.5" step="0.1" class="svelte-1t7r3rk"/></div> <button class="btn">Generate Cut Paths</button></div></div> <div class="preview-panel"><div class="card"><h3>Cut Path Preview</h3> `);
  if (store_get($$store_subs ??= {}, "$project", project).cutPaths.length > 0) {
    $$payload.out.push("<!--[-->");
    const each_array_1 = ensure_array_like(store_get($$store_subs ??= {}, "$project", project).cutPaths);
    $$payload.out.push(`<div class="cut-paths-list svelte-1t7r3rk"><!--[-->`);
    for (let index = 0, $$length = each_array_1.length; index < $$length; index++) {
      let cutPath = each_array_1[index];
      $$payload.out.push(`<div class="cut-path-item svelte-1t7r3rk"><h4 class="svelte-1t7r3rk">Path ${escape_html(index + 1)}</h4> <p class="svelte-1t7r3rk">Feed Rate: ${escape_html(cutPath.feedRate)} mm/min</p> <p class="svelte-1t7r3rk">Cut Height: ${escape_html(cutPath.cutHeight)} mm</p></div>`);
    }
    $$payload.out.push(`<!--]--></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<p class="no-paths svelte-1t7r3rk">No cut paths generated yet. Configure material settings and click "Generate Cut Paths".</p>`);
  }
  $$payload.out.push(`<!--]--></div></div></div></div>`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _page as default
};
