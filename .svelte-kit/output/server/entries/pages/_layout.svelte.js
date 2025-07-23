import { E as ensure_array_like, F as attr_class, G as escape_html, I as store_get, J as slot, K as unsubscribe_stores, D as pop, z as push } from "../../chunks/index.js";
import { s as stages, c as currentStage, v as viewerZoomLevel, d as drawingDimensions } from "../../chunks/stores.js";
function _layout($$payload, $$props) {
  push();
  var $$store_subs;
  const each_array = ensure_array_like(stages);
  $$payload.out.push(`<div class="app svelte-xncayu"><header class="tools svelte-xncayu"><nav class="breadcrumb svelte-xncayu"><!--[-->`);
  for (let index = 0, $$length = each_array.length; index < $$length; index++) {
    let stage = each_array[index];
    $$payload.out.push(`<button${attr_class("stage-button svelte-xncayu", void 0, {
      "active": store_get($$store_subs ??= {}, "$currentStage", currentStage) === stage.id
    })}><span class="stage-number svelte-xncayu">${escape_html(index + 1)}</span> <span class="stage-name">${escape_html(stage.name)}</span></button> `);
    if (index < stages.length - 1) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<span class="separator svelte-xncayu">→</span>`);
    } else {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]-->`);
  }
  $$payload.out.push(`<!--]--></nav></header> <main class="body svelte-xncayu"><!---->`);
  slot($$payload, $$props, "default", {});
  $$payload.out.push(`<!----></main> <footer class="footer svelte-xncayu">`);
  if (store_get($$store_subs ??= {}, "$currentStage", currentStage) === "modify") {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="footer-info svelte-xncayu"><div class="zoom-display svelte-xncayu">Zoom: ${escape_html((store_get($$store_subs ??= {}, "$viewerZoomLevel", viewerZoomLevel) * 100).toFixed(0))}%</div> `);
    if (store_get($$store_subs ??= {}, "$drawingDimensions", drawingDimensions)) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<div class="dimensions-display svelte-xncayu">Drawing: ${escape_html(store_get($$store_subs ??= {}, "$drawingDimensions", drawingDimensions).width.toFixed(2))} × ${escape_html(store_get($$store_subs ??= {}, "$drawingDimensions", drawingDimensions).height.toFixed(2))} ${escape_html(store_get($$store_subs ??= {}, "$drawingDimensions", drawingDimensions).units)}</div>`);
    } else {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]--></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></footer></div>`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _layout as default
};
