export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

export const fmtSize = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;
export const fmtDate = d => d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = t => t ? new Date(t).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—";
export const fmtNum = n => Number(n || 0).toLocaleString("es-MX");
export const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

const I = {
  dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  orders: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
  flow: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8M13 12h8M13 18h8"/>',
  balances: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  shipments: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'
};
export const icon = (n, size = 16) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ""}</svg>`;

/* ---------- Toasts ---------- */
export function toast(msg, type = "ok", ms = 4200) {
  let box = $("#toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("aria-live", "polite"); document.body.append(box); }
  const el = document.createElement("div"); el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === "error" ? "alert" : "check")}<span>${esc(msg)}</span>`;
  while (box.children.length >= 3) box.firstChild.remove();
  box.append(el); setTimeout(() => el.remove(), type === "error" ? Math.max(ms, 6500) : ms);
}

/* ---------- Diálogos ---------- */
// guard(): devuelve false para impedir el cierre (p. ej. cambios sin guardar).
export function openDialog(html, { wide = false, guard = null, backdrop = true } = {}) {
  const dlg = document.createElement("dialog");
  dlg.className = `dlg${wide ? " wide" : ""}`; dlg.innerHTML = html; document.body.append(dlg);
  const tryClose = () => { if (guard && guard() === false) return; dlg.close(); };
  dlg.tryClose = tryClose;
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("cancel", e => { e.preventDefault(); tryClose(); });
  let down = false;
  dlg.addEventListener("mousedown", e => { down = e.target === dlg; });
  dlg.addEventListener("click", e => { if (backdrop && down && e.target === dlg) tryClose(); down = false; });
  dlg.addEventListener("click", e => { if (e.target.closest("[data-close]")) tryClose(); });
  dlg.showModal();
  return dlg;
}
export function askConfirm(title, message, { ok = "Confirmar", danger = false } = {}) {
  return new Promise(resolve => {
    const dlg = openDialog(`<div class="dlg-body small"><div class="dlg-pad"><h2>${esc(title)}</h2><p class="muted">${esc(message)}</p></div>
      <footer class="dlg-foot"><button class="btn" data-close type="button">Cancelar</button><button class="btn ${danger ? "danger-fill" : "primary"}" id="okBtn" type="button">${esc(ok)}</button></footer></div>`);
    let result = false;
    $("#okBtn", dlg).addEventListener("click", () => { result = true; dlg.close(); });
    dlg.addEventListener("close", () => resolve(result));
    $("#okBtn", dlg).focus();
  });
}

/* ---------- Abrir archivos sin que el navegador bloquee la ventana ---------- */
export async function openInNewTab(getUrl) {
  const w = window.open("", "_blank");
  try { const url = await getUrl(); if (w) { w.opener = null; w.location.href = url; } else location.href = url; }
  catch (e) { w?.close(); throw e; }
}
