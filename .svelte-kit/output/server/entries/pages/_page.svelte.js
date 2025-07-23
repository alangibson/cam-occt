import { I as store_get, K as unsubscribe_stores } from "../../chunks/index.js";
import { c as currentStage } from "../../chunks/stores.js";
import _page$1 from "./import/_page.svelte.js";
import _page$2 from "./modify/_page.svelte.js";
import _page$3 from "./program/_page.svelte.js";
import _page$4 from "./export/_page.svelte.js";
function _page($$payload) {
  var $$store_subs;
  if (store_get($$store_subs ??= {}, "$currentStage", currentStage) === "import") {
    $$payload.out.push("<!--[-->");
    _page$1($$payload);
  } else {
    $$payload.out.push("<!--[!-->");
    if (store_get($$store_subs ??= {}, "$currentStage", currentStage) === "modify") {
      $$payload.out.push("<!--[-->");
      _page$2($$payload);
    } else {
      $$payload.out.push("<!--[!-->");
      if (store_get($$store_subs ??= {}, "$currentStage", currentStage) === "program") {
        $$payload.out.push("<!--[-->");
        _page$3($$payload);
      } else {
        $$payload.out.push("<!--[!-->");
        if (store_get($$store_subs ??= {}, "$currentStage", currentStage) === "export") {
          $$payload.out.push("<!--[-->");
          _page$4($$payload);
        } else {
          $$payload.out.push("<!--[!-->");
        }
        $$payload.out.push(`<!--]-->`);
      }
      $$payload.out.push(`<!--]-->`);
    }
    $$payload.out.push(`<!--]-->`);
  }
  $$payload.out.push(`<!--]-->`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
}
export {
  _page as default
};
