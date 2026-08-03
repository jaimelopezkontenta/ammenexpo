// Navegación del prototipo: [data-go="id"] muestra la .screen#id del mismo .phone
document.addEventListener("click", (e) => {
  const trigger = e.target.closest("[data-go]");
  if (!trigger) return;
  e.preventDefault();
  const phone = trigger.closest(".phone");
  const id = trigger.getAttribute("data-go");
  const target = (phone || document).querySelector(
    '.screen[data-id="' + id + '"]',
  );
  if (!target) return;
  (phone || document)
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  target.classList.add("active");
  // sync stage-nav
  document.querySelectorAll(".stage-nav [data-go]").forEach((b) => {
    b.classList.toggle("on", b.getAttribute("data-go") === id);
  });
});

// ===== Paletas de naranja =====
// CONGELADA el 2026-08-03: "melocoton". Las otras tres se quedan como comparador
// del hub, pero el contrato es TOKENS.md y la app va con melocotón.
// Fondos "light": el durazno de cada paleta es un rubor pálido, nunca un naranja pleno.
// `accent` es decorativo (nunca lleva texto); `accentInk` es el que sí se lee.
// Solo el par de melocotón está medido: 2,85:1 y 4,85:1 sobre crema.
const PALETTES = {
  original: {
    label: "Original (JPG)",
    ember: "#FDA35E",
    pale: "#FFE0BA",
    accent: "#F45517",
    accentInk: "#B23A0F",
    peach: "#FCD9AE",
    peachMid: "#FEECD4",
  },
  melocoton: {
    label: "Melocotón suave ★",
    ember: "#F2A578",
    pale: "#FBDFC2",
    accent: "#E2703F",
    accentInk: "#B24A22",
    peach: "#F9DBBF",
    peachMid: "#FCEBD8",
  },
  terracota: {
    label: "Terracotta editorial",
    ember: "#DE9068",
    pale: "#F4D5BC",
    accent: "#BC5B33",
    accentInk: "#A24A28",
    peach: "#F3DCC8",
    peachMid: "#F8EADC",
  },
  ambar: {
    label: "Ámbar dorado",
    ember: "#F0B25F",
    pale: "#FAE3B8",
    accent: "#D98324",
    accentInk: "#9A5A12",
    peach: "#FAE3C1",
    peachMid: "#FCEFDA",
  },
};
function applyPalette(name) {
  const p = PALETTES[name];
  if (!p) return;
  const r = document.documentElement.style;
  r.setProperty("--ember", p.ember);
  r.setProperty("--ember-pale", p.pale);
  r.setProperty("--accent", p.accent);
  r.setProperty("--accent-ink", p.accentInk);
  r.setProperty("--peach", p.peach);
  r.setProperty("--peach-mid", p.peachMid);
  localStorage.setItem("ammen-palette", name);
  document
    .querySelectorAll("[data-palette]")
    .forEach((b) =>
      b.classList.toggle("on", b.getAttribute("data-palette") === name),
    );
}
applyPalette(localStorage.getItem("ammen-palette") || "melocoton");
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-palette]");
  if (t) applyPalette(t.getAttribute("data-palette"));
});

// Toggle simple de fuente en el hub (General Sans vs Satoshi)
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-font]");
  if (!t) return;
  document.body.classList.toggle(
    "font-satoshi",
    t.getAttribute("data-font") === "satoshi",
  );
  document
    .querySelectorAll("[data-font]")
    .forEach((b) => b.classList.toggle("on", b === t));
});

// Iconos Lucide inline (subset), uso: <i data-ico="home"></i>
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22H20v-2.5"/>',
  users:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  share:
    '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 7L22 7"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  eye: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M1 1l22 22"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>',
  heart:
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  chev: '<polyline points="9 18 15 12 9 6"/>',
  back: '<polyline points="15 18 9 12 15 6"/>',
  pray: '<path d="M12 3c1.5 3 1.5 6 0 9m0-9c-1.5 3-1.5 6 0 9m-4.5 9c1-4 2.5-6.5 4.5-9 2 2.5 3.5 5 4.5 9z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
};
document.querySelectorAll("i[data-ico]").forEach((el) => {
  const paths = ICONS[el.getAttribute("data-ico")];
  if (!paths) return;
  const size = el.getAttribute("data-size") || 22;
  el.outerHTML =
    '<svg viewBox="0 0 24 24" width="' +
    size +
    '" height="' +
    size +
    '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    paths +
    "</svg>";
});
