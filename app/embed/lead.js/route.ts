import { NextResponse } from "next/server";

/**
 * Embeddable lead-capture JS. Drop this into any website with:
 *
 *   <script src="https://app.sandiegoconcrete.ai/embed/lead.js" async></script>
 *   <div data-rose-lead-form></div>
 *
 * Renders a minimal form; on submit, POSTs to /api/public/lead with the
 * shared secret baked in via an env-driven config script (admins embed the
 * secret into a partial they own — we do NOT ship it in this file).
 *
 * The form is namespaced and unstyled beyond a few sensible defaults so it
 * inherits the host page's typography. If Ronnie wants to customize look,
 * he can target `.rose-lead-form` in his site CSS.
 */

const SCRIPT = `
(function () {
  if (window.__roseLeadFormLoaded) return;
  window.__roseLeadFormLoaded = true;

  var API = (window.ROSE_LEAD_API || "APP_BASE_URL_PLACEHOLDER") + "/api/public/lead";
  var SECRET = window.ROSE_LEAD_SECRET || "";

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    (children || []).forEach(function (c) {
      if (typeof c === "string") el.appendChild(document.createTextNode(c));
      else if (c) el.appendChild(c);
    });
    return el;
  }

  function mount(container) {
    if (container.getAttribute("data-rose-mounted")) return;
    container.setAttribute("data-rose-mounted", "1");
    container.classList.add("rose-lead-form");

    var form = h("form", { novalidate: "" }, [
      h("label", {}, ["Name", h("input", { name: "name", required: "", type: "text" })]),
      h("label", {}, ["Phone", h("input", { name: "phone", required: "", type: "tel" })]),
      h("label", {}, ["Email", h("input", { name: "email", type: "email" })]),
      h("label", {}, ["Address of project", h("input", { name: "address", type: "text" })]),
      h("label", {}, ["What do you need?", (function () {
        var sel = h("select", { name: "service_type" }, [
          h("option", { value: "" }, ["Select a service"]),
          h("option", { value: "driveway" }, ["Driveway"]),
          h("option", { value: "stamped_driveway" }, ["Stamped concrete driveway"]),
          h("option", { value: "patio" }, ["Patio"]),
          h("option", { value: "sidewalk" }, ["Sidewalk"]),
          h("option", { value: "rv_pad" }, ["RV pad"]),
          h("option", { value: "pickleball_court" }, ["Pickleball court"]),
          h("option", { value: "repair" }, ["Repair"]),
          h("option", { value: "other" }, ["Other / not sure"])
        ]);
        return sel;
      })()]),
      h("label", {}, ["Tell us a bit more", h("textarea", { name: "message", rows: "4" })]),
      h("button", { type: "submit" }, ["Request a quote"])
    ]);

    var status = h("p", { class: "rose-lead-status", role: "status" }, []);

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      status.textContent = "Sending...";
      var fd = new FormData(form);
      var body = {};
      fd.forEach(function (v, k) { body[k] = v; });
      body.source = body.source || (location.hostname || "web");

      fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rose-secret": SECRET
        },
        body: JSON.stringify(body)
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j.ok) {
            status.textContent = "Thanks! Ronnie will reach out shortly.";
            form.reset();
            // Fire Google Ads conversion pixel if wired.
            if (typeof window.gtag === "function" && window.ROSE_GADS_CONVERSION) {
              window.gtag("event", "conversion", { send_to: window.ROSE_GADS_CONVERSION });
            }
          } else {
            status.textContent = "Sorry — something went wrong. Please call (619) 555-ROSE.";
          }
        })
        .catch(function () {
          status.textContent = "Sorry — something went wrong. Please call (619) 555-ROSE.";
        });
    });

    container.appendChild(form);
    container.appendChild(status);
  }

  function init() {
    document.querySelectorAll("[data-rose-lead-form]").forEach(mount);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
`;

export async function GET() {
  const base = process.env.APP_BASE_URL ?? "";
  const script = SCRIPT.replace("APP_BASE_URL_PLACEHOLDER", base);
  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
