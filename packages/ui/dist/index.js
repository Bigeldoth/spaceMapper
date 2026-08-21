import { jsx as e, jsxs as n, Fragment as v } from "react/jsx-runtime";
const i = {
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
      className: `inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-[var(--sp-4)] py-[var(--sp-1)] text-[length:var(--fs-caption)] font-medium leading-none ${i[r]}`,
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
function x({
  variant: r = "primary",
  size: a = "md",
  className: t = "",
  ...o
}) {
  return /* @__PURE__ */ e(
    "button",
    {
      className: `inline-flex items-center justify-center gap-[var(--sp-3)] rounded-[var(--radius-control)] font-medium leading-none transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--ring-focus)] active:scale-[var(--press-scale)] disabled:pointer-events-none disabled:opacity-[0.42] ${l[a]} ${u[r]} ${t}`,
      ...o
    }
  );
}
const p = {
  sm: "h-[var(--h-control-sm)] w-[var(--h-control-sm)]",
  md: "h-[var(--h-control)] w-[var(--h-control)]",
  lg: "h-[var(--h-control-lg)] w-[var(--h-control-lg)]"
};
function m({
  icon: r,
  label: a,
  showLabel: t = !1,
  size: o = "md",
  className: d = "",
  ...c
}) {
  return /* @__PURE__ */ n(
    "button",
    {
      "aria-label": a,
      title: t ? void 0 : a,
      className: `inline-flex items-center justify-center gap-[var(--sp-3)] rounded-[var(--radius-control)] border border-transparent text-[var(--text-secondary)] transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:shadow-[var(--ring-focus)] active:scale-[var(--press-scale)] disabled:pointer-events-none disabled:opacity-[0.42] ${t ? "px-[var(--sp-5)]" : p[o]} ${d}`,
      ...c,
      children: [
        r,
        t && /* @__PURE__ */ e("span", { className: "text-[length:var(--fs-body-sm)]", children: a })
      ]
    }
  );
}
const b = "cursor-pointer transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:-translate-y-px hover:border-[var(--border-accent)]";
function h() {
  const r = "pointer-events-none absolute h-[10px] w-[10px] border-[var(--border-hud)]";
  return /* @__PURE__ */ n(v, { children: [
    /* @__PURE__ */ e("span", { "aria-hidden": !0, className: `${r} left-0 top-0 border-l-2 border-t-2` }),
    /* @__PURE__ */ e("span", { "aria-hidden": !0, className: `${r} right-0 top-0 border-r-2 border-t-2` }),
    /* @__PURE__ */ e("span", { "aria-hidden": !0, className: `${r} bottom-0 left-0 border-b-2 border-l-2` }),
    /* @__PURE__ */ e("span", { "aria-hidden": !0, className: `${r} bottom-0 right-0 border-b-2 border-r-2` })
  ] });
}
function y({
  variant: r = "standard",
  interactive: a = !1,
  className: t = "",
  children: o,
  ...d
}) {
  const c = a ? b : "";
  return r === "hud" ? /* @__PURE__ */ n(
    "div",
    {
      className: `relative rounded-[var(--radius-xs)] border border-[var(--border-hud)] bg-[var(--surface-1)] p-[var(--pad-card)] ${c} ${t}`,
      ...d,
      children: [
        /* @__PURE__ */ e(h, {}),
        o
      ]
    }
  ) : /* @__PURE__ */ e(
    "div",
    {
      className: `rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--pad-card)] shadow-[var(--shadow-1)] ${c} ${t}`,
      ...d,
      children: o
    }
  );
}
function A({ selected: r = !1, className: a = "", ...t }) {
  return /* @__PURE__ */ e(
    "button",
    {
      type: "button",
      "aria-pressed": r,
      className: `inline-flex items-center gap-[var(--sp-2)] rounded-[var(--radius-pill)] border px-[var(--sp-5)] py-[var(--sp-2)] text-[length:var(--fs-body-sm)] font-medium leading-none transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--ring-focus)] ${r ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--text-accent)]" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"} ${a}`,
      ...t
    }
  );
}
function s(r = 20) {
  return {
    width: r,
    height: r,
    viewBox: "0 0 256 256",
    "aria-hidden": !0,
    focusable: !1
  };
}
function Z({ size: r, ...a }) {
  return /* @__PURE__ */ n("svg", { ...s(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M215.46,216H40.54C27.92,216,20,202.79,26.13,192.09L113.59,40.22c6.3-11,22.52-11,28.82,0l87.46,151.87C236,202.79,228.08,216,215.46,216Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z" })
  ] });
}
function M({ size: r, ...a }) {
  return /* @__PURE__ */ n("svg", { ...s(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z" })
  ] });
}
function S({ size: r, ...a }) {
  return /* @__PURE__ */ n("svg", { ...s(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M216,96V208a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V96a8,8,0,0,1,8-8H208A8,8,0,0,1,216,96Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Z" })
  ] });
}
function $({ size: r, ...a }) {
  return /* @__PURE__ */ n("svg", { ...s(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M144,176a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176Zm88-48A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128ZM124,96a12,12,0,1,0-12-12A12,12,0,0,0,124,96Z" })
  ] });
}
function w({ size: r, ...a }) {
  return /* @__PURE__ */ n("svg", { ...s(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M216,56V200a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40H200A16,16,0,0,1,216,56Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" })
  ] });
}
function H({ size: r, ...a }) {
  return /* @__PURE__ */ n("svg", { ...s(r), ...a, children: [
    /* @__PURE__ */ e("path", { d: "M208,96l-80,80L48,96Z", opacity: 0.2 }),
    /* @__PURE__ */ e("path", { d: "M215.39,92.94A8,8,0,0,0,208,88H48a8,8,0,0,0-5.66,13.66l80,80a8,8,0,0,0,11.32,0l80-80A8,8,0,0,0,215.39,92.94ZM128,164.69,67.31,104H188.69Z" })
  ] });
}
export {
  g as Badge,
  x as Button,
  y as Card,
  H as CaretDown,
  M as CheckCircle,
  m as IconButton,
  $ as Info,
  S as LockSimple,
  A as Tag,
  Z as Warning,
  w as X,
  s as svgProps
};
