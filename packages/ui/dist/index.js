import { jsx as e, jsxs as t, Fragment as i } from "react/jsx-runtime";
const v = {
  neutral: "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
  accent: "bg-[var(--accent-soft)] text-[var(--text-accent)] border-[var(--border-accent)]",
  success: "bg-[var(--success-soft)] text-[var(--success-text)] border-transparent",
  warning: "bg-[var(--warning-soft)] text-[var(--warning-text)] border-transparent",
  danger: "bg-[var(--danger-soft)] text-[var(--danger-text)] border-transparent"
};
function g({ tone: r = "neutral", children: a }) {
  return /* @__PURE__ */ e(
    "span",
    {
      className: `inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-[var(--sp-4)] py-[var(--sp-1)] text-[length:var(--fs-caption)] font-medium leading-none ${v[r]}`,
      children: a
    }
  );
}
const l = {
  sm: "h-[var(--h-control-sm)] px-[var(--sp-5)] text-[length:var(--fs-body-sm)]",
  md: "h-[var(--h-control)] px-[var(--sp-6)] text-[length:var(--fs-body)]",
  lg: "h-[var(--h-control-lg)] px-[var(--sp-7)] text-[length:var(--fs-body)]"
}, u = {
  primary: "border border-transparent bg-accent text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] hover:shadow-[var(--glow-soft)] active:bg-[var(--accent-press)] active:shadow-none",
  secondary: "border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
  ghost: "border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
};
function m({
  variant: r = "primary",
  size: a = "md",
  className: n = "",
  ...s
}) {
  return /* @__PURE__ */ e(
    "button",
    {
      className: `inline-flex items-center justify-center gap-[var(--sp-3)] rounded-[var(--radius-control)] font-medium leading-none transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--ring-focus)] active:scale-[var(--press-scale)] disabled:pointer-events-none disabled:opacity-[0.42] ${l[a]} ${u[r]} ${n}`,
      ...s
    }
  );
}
const h = {
  sm: "h-[var(--h-control-sm)] w-[var(--h-control-sm)]",
  md: "h-[var(--h-control)] w-[var(--h-control)]",
  lg: "h-[var(--h-control-lg)] w-[var(--h-control-lg)]"
};
function x({
  icon: r,
  label: a,
  showLabel: n = !1,
  size: s = "md",
  className: d = "",
  ...c
}) {
  return /* @__PURE__ */ t(
    "button",
    {
      "aria-label": a,
      title: n ? void 0 : a,
      className: `inline-flex items-center justify-center gap-[var(--sp-3)] rounded-[var(--radius-control)] border border-transparent text-[var(--text-secondary)] transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:shadow-[var(--ring-focus)] active:scale-[var(--press-scale)] disabled:pointer-events-none disabled:opacity-[0.42] ${n ? "px-[var(--sp-5)]" : h[s]} ${d}`,
      ...c,
      children: [
        r,
        n && /* @__PURE__ */ e("span", { className: "text-[length:var(--fs-body-sm)]", children: a })
      ]
    }
  );
}
const p = "cursor-pointer transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:-translate-y-px hover:border-[var(--border-accent)]";
function b() {
  const r = "pointer-events-none absolute h-[10px] w-[10px] border-[var(--border-hud)]";
  return /* @__PURE__ */ t(i, { children: [
    /* @__PURE__ */ e("span", { "aria-hidden": !0, className: `${r} left-0 top-0 border-l-2 border-t-2` }),
    /* @__PURE__ */ e("span", { "aria-hidden": !0, className: `${r} right-0 top-0 border-r-2 border-t-2` }),
    /* @__PURE__ */ e("span", { "aria-hidden": !0, className: `${r} bottom-0 left-0 border-b-2 border-l-2` }),
    /* @__PURE__ */ e("span", { "aria-hidden": !0, className: `${r} bottom-0 right-0 border-b-2 border-r-2` })
  ] });
}
function A({
  variant: r = "standard",
  interactive: a = !1,
  className: n = "",
  children: s,
  ...d
}) {
  const c = a ? p : "";
  return r === "hud" ? /* @__PURE__ */ t(
    "div",
    {
      className: `relative rounded-[var(--radius-xs)] border border-[var(--border-hud)] bg-[var(--surface-1)] p-[var(--pad-card)] ${c} ${n}`,
      ...d,
      children: [
        /* @__PURE__ */ e(b, {}),
        s
      ]
    }
  ) : /* @__PURE__ */ e(
    "div",
    {
      className: `rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--pad-card)] shadow-[var(--shadow-1)] ${c} ${n}`,
      ...d,
      children: s
    }
  );
}
function Z({ selected: r = !1, className: a = "", ...n }) {
  return /* @__PURE__ */ e(
    "button",
    {
      type: "button",
      "aria-pressed": r,
      className: `inline-flex items-center gap-[var(--sp-2)] rounded-[var(--radius-pill)] border px-[var(--sp-5)] py-[var(--sp-2)] text-[length:var(--fs-body-sm)] font-medium leading-none transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--ring-focus)] ${r ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--text-accent)]" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"} ${a}`,
      ...n
    }
  );
}
function o(r = 20) {
  return {
    width: r,
    height: r,
    viewBox: "0 0 256 256",
    "aria-hidden": !0,
    focusable: !1
  };
}
function L({ size: r, ...a }) {
  return /* @__PURE__ */ t("svg", { ...o(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M215.46,216H40.54C27.92,216,20,202.79,26.13,192.09L113.59,40.22c6.3-11,22.52-11,28.82,0l87.46,151.87C236,202.79,228.08,216,215.46,216Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z" })
  ] });
}
function M({ size: r, ...a }) {
  return /* @__PURE__ */ t("svg", { ...o(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z" })
  ] });
}
function y({ size: r, ...a }) {
  return /* @__PURE__ */ t("svg", { ...o(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M216,96V208a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V96a8,8,0,0,1,8-8H208A8,8,0,0,1,216,96Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Z" })
  ] });
}
function H({ size: r, ...a }) {
  return /* @__PURE__ */ t("svg", { ...o(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M144,176a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176Zm88-48A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128ZM124,96a12,12,0,1,0-12-12A12,12,0,0,0,124,96Z" })
  ] });
}
function V({ size: r, ...a }) {
  return /* @__PURE__ */ t("svg", { ...o(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M216,56V200a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40H200A16,16,0,0,1,216,56Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" })
  ] });
}
function C({ size: r, ...a }) {
  return /* @__PURE__ */ t("svg", { ...o(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M208,96l-80,80L48,96Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M215.39,92.94A8,8,0,0,0,208,88H48a8,8,0,0,0-5.66,13.66l80,80a8,8,0,0,0,11.32,0l80-80A8,8,0,0,0,215.39,92.94ZM128,164.69,67.31,104H188.69Z" })
  ] });
}
function S({ size: r, ...a }) {
  return /* @__PURE__ */ t("svg", { ...o(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M184,120v61.65a8,8,0,0,1-2.34,5.65l-34.35,34.35a8,8,0,0,1-13.57-4.53L128,176ZM136,72H74.35a8,8,0,0,0-5.65,2.34L34.35,108.69a8,8,0,0,0,4.53,13.57L80,128ZM40,216c37.65,0,50.69-19.69,54.56-28.18L68.18,161.44C59.69,165.31,40,178.35,40,216Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M223.85,47.12a16,16,0,0,0-15-15c-12.58-.75-44.73.4-71.41,27.07L132.69,64H74.36A15.91,15.91,0,0,0,63,68.68L28.7,103a16,16,0,0,0,9.07,27.16l38.47,5.37,44.21,44.21,5.37,38.49a15.94,15.94,0,0,0,10.78,12.92,16.11,16.11,0,0,0,5.1.83A15.91,15.91,0,0,0,153,227.3L187.32,193A15.91,15.91,0,0,0,192,181.64V123.31l4.77-4.77C223.45,91.86,224.6,59.71,223.85,47.12ZM74.36,80h42.33L77.16,119.52,40,114.34Zm74.41-9.45a76.65,76.65,0,0,1,59.11-22.47,76.46,76.46,0,0,1-22.42,59.16L128,164.68,91.32,128ZM176,181.64,141.67,216l-5.19-37.17L176,139.31Zm-74.16,9.5C97.34,201,82.29,224,40,224a8,8,0,0,1-8-8c0-42.29,23-57.34,32.86-61.85a8,8,0,0,1,6.64,14.56c-6.43,2.93-20.62,12.36-23.12,38.91,26.55-2.5,36-16.69,38.91-23.12a8,8,0,1,1,14.56,6.64Z" })
  ] });
}
function $({ size: r, ...a }) {
  return /* @__PURE__ */ t("svg", { ...o(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M160,128a32,32,0,1,1-32-32A32,32,0,0,1,160,128Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M232,120h-8.34A96.14,96.14,0,0,0,136,32.34V24a8,8,0,0,0-16,0v8.34A96.14,96.14,0,0,0,32.34,120H24a8,8,0,0,0,0,16h8.34A96.14,96.14,0,0,0,120,223.66V232a8,8,0,0,0,16,0v-8.34A96.14,96.14,0,0,0,223.66,136H232a8,8,0,0,0,0-16Zm-96,87.6V200a8,8,0,0,0-16,0v7.6A80.15,80.15,0,0,1,48.4,136H56a8,8,0,0,0,0-16H48.4A80.15,80.15,0,0,1,120,48.4V56a8,8,0,0,0,16,0V48.4A80.15,80.15,0,0,1,207.6,120H200a8,8,0,0,0,0,16h7.6A80.15,80.15,0,0,1,136,207.6ZM128,88a40,40,0,1,0,40,40A40,40,0,0,0,128,88Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,152Z" })
  ] });
}
function w({ size: r, ...a }) {
  return /* @__PURE__ */ t("svg", { ...o(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M229.67,133.62l-96,96a7.94,7.94,0,0,1-11.24,0l-96-96a7.94,7.94,0,0,1,0-11.24l96.05-96a7.94,7.94,0,0,1,11.24,0l96,96.05A7.94,7.94,0,0,1,229.67,133.62Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M235.33,116.72,139.28,20.66a16,16,0,0,0-22.56,0l-96,96.06a16,16,0,0,0,0,22.56l96.05,96.06h0a16,16,0,0,0,22.56,0l96.05-96.06a16,16,0,0,0,0-22.56ZM128,224h0L32,128,128,32,224,128Z" })
  ] });
}
function N({ size: r, ...a }) {
  return /* @__PURE__ */ t("svg", { ...o(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M168.36,200.36l-30,29.35a8,8,0,0,1-11.26-.05L98.46,201a8,8,0,0,1,.08-11.4l30-29Zm-142-82.76a8,8,0,0,0,0,11.28L55,157.54a8,8,0,0,0,11.38-.06l29.18-29.92L55.77,87.77Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M207,50.25A87.46,87.46,0,0,0,144.6,24h-.33A87.48,87.48,0,0,0,82,49.81L50.11,82.11h0L20.61,112a16,16,0,0,0,.06,22.56l28.66,28.66a15.92,15.92,0,0,0,11.32,4.69h.09a16,16,0,0,0,11.36-4.82L133,100.69a16.08,16.08,0,0,1,22.41-.21,15.6,15.6,0,0,1,4.73,11.19,16.89,16.89,0,0,1-4.85,12L93,183.88a16,16,0,0,0-.17,22.79l28.66,28.66a16.06,16.06,0,0,0,22.52.12L205.81,175C240.26,140.5,240.79,84.56,207,50.25ZM60.65,151.89,32,123.24,55.8,99.12l28.52,28.52ZM132.79,224l-28.68-28.65,24.38-23.57L157,200.32Zm61.76-60.44-26.11,25.54L140,160.68l26.44-25.57.1-.09a33,33,0,0,0,9.57-23.5A31.44,31.44,0,0,0,166.47,89a32.2,32.2,0,0,0-44.9.5L95.49,116.18,67,87.74,93.35,61.09A71.51,71.51,0,0,1,144.27,40h.27a71.55,71.55,0,0,1,51.05,21.48C223.25,89.55,222.75,135.38,194.55,163.58Z" })
  ] });
}
export {
  g as Badge,
  m as Button,
  A as Card,
  C as CaretDown,
  M as CheckCircle,
  $ as Crosshair,
  w as Diamond,
  x as IconButton,
  H as Info,
  y as LockSimple,
  N as Magnet,
  S as RocketLaunch,
  Z as Tag,
  L as Warning,
  V as X,
  o as svgProps
};
