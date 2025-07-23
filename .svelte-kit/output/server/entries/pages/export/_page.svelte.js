import { G as escape_html, I as store_get, O as attr, K as unsubscribe_stores, D as pop, z as push } from "../../../chunks/index.js";
import { p as project } from "../../../chunks/stores.js";
function _page($$payload, $$props) {
  push();
  var $$store_subs;
  $$payload.out.push(`<div class="export-page svelte-n0rr9g"><h2 class="svelte-n0rr9g">Export G-code</h2> <div class="content svelte-n0rr9g"><div class="controls-panel"><div class="card"><h3>Export Settings</h3> <div class="project-info svelte-n0rr9g"><p class="svelte-n0rr9g"><strong>Project:</strong> ${escape_html(store_get($$store_subs ??= {}, "$project", project).name)}</p> `);
  if (store_get($$store_subs ??= {}, "$project", project).material) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<p class="svelte-n0rr9g"><strong>Material:</strong> ${escape_html(store_get($$store_subs ??= {}, "$project", project).material.name)}</p> <p class="svelte-n0rr9g"><strong>Thickness:</strong> ${escape_html(store_get($$store_subs ??= {}, "$project", project).material.thickness)}mm</p>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> <p class="svelte-n0rr9g"><strong>Cut Paths:</strong> ${escape_html(store_get($$store_subs ??= {}, "$project", project).cutPaths.length)}</p></div> <div class="actions svelte-n0rr9g"><button class="btn"${attr("disabled", store_get($$store_subs ??= {}, "$project", project).cutPaths.length === 0, true)}>${escape_html("Generate G-code")}</button> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div> `);
  if (store_get($$store_subs ??= {}, "$project", project).cutPaths.length === 0) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="warning svelte-n0rr9g"><p class="svelte-n0rr9g">⚠️ No cut paths available. Please go back to the Program stage and generate cut paths first.</p></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div></div> <div class="preview-panel"><div class="card"><h3>G-code Preview</h3> `);
  {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<div class="no-gcode svelte-n0rr9g"><p>Click "Generate G-code" to preview the output</p></div>`);
  }
  $$payload.out.push(`<!--]--></div></div></div></div>`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _page as default
};
