import { CONFIG } from "./config.js";
import { GATES, gateByCode, gateTitle, SHIPPING, PURPOSES, PRIORITIES, OWNERS, COMP_ACTIONS } from "./data.js";
import {
  getSession, signIn, signOut, onAuthChange, listOrders, createOrder, setOrderStatus,
  uploadDocument, deleteDocument, getDocumentUrl, completeGate, saveGate, reopenGate,
  addInvoice, addInvoiceFiles, deleteInvoice, saveCompensation, friendly, isAuthError
} from "./api.js";
import { $, $$, esc, icon, toast, openDialog, askConfirm, openInNewTab, fmtSize, fmtDate, fmtDateTime, fmtNum, todayISO } from "./utils.js";

const app = $("#app");

/* =========================================================
   Estado y cálculos derivados
   ========================================================= */
const S = {
  session: null, orders: [], route: { view: "dashboard" },
  q: "", status: "all", flowStatus: "open", flowGate: "all", lastKey: ""
};
const VIEWS = { dashboard: "Resumen", orders: "Órdenes PrePPAP", flow: "Etapas", balances: "Balances de PO", shipments: "Envíos" };
const STATUS_ES = { Completed: "Completada", "In Progress": "En curso", "Not Started": "Sin iniciar", Cancelled: "Cancelada", Open: "Abierto", Partial: "Parcial", Closed: "Cerrado" };
const pill = s => `<span class="pill ${String(s).toLowerCase().replace(/\s+/g, "-")}">${esc(STATUS_ES[s] || s)}</span>`;

const taskOf = (o, code) => o.tasks.find(t => t.task_code === code);
const isCancelled = o => o.status === "Cancelled";
const doneCount = o => GATES.filter(g => taskOf(o, g.code)?.status === "Completed").length;
const progress = o => Math.round(doneCount(o) / GATES.length * 100);
const orderState = o => isCancelled(o) ? "Cancelled" : progress(o) === 100 ? "Completed" : doneCount(o) > 0 ? "In Progress" : "Not Started";
const nextGate = o => GATES.find(g => taskOf(o, g.code)?.status !== "Completed");
// Faltante = piezas del PO a Metrics Works que aún no se han facturado.
const faltante = o => Math.max(0, o.mesPOQty - o.mwsInvoiceQty);
const openBalance = o => o.balances.find(b => b.status !== "Closed") || null;
const hasOpenBalance = o => !isCancelled(o) && !!openBalance(o);
const ageDays = t => { const d = Math.floor((Date.now() - new Date(t)) / 864e5); return Number.isFinite(d) ? Math.max(0, d) : 0; };
const sumInvoices = o => o.invoices.reduce((s, i) => s + Number(i.qty || 0), 0);
const pendingShip = o => Math.max(0, o.qtyRequested - o.qtyShipped);
const activeOrders = () => S.orders.filter(o => !isCancelled(o));
const isLate = o => !isCancelled(o) && progress(o) < 100 && o.required_date && o.required_date < todayISO();
const findOrder = id => S.orders.find(o => o.id === id);

const pipe = (o, lg = false) => `<span class="pipe${lg ? " lg" : ""}" role="img" aria-label="${doneCount(o)} de ${GATES.length} etapas completadas">${GATES.map(g => {
  const s = taskOf(o, g.code)?.status;
  return `<i class="${s === "Completed" ? "done" : s === "In Progress" ? "open" : ""}" title="${esc(gateTitle(g, o))}"></i>`;
}).join("")}</span>`;

/* =========================================================
   Rutas (hash) — permiten botón Atrás, recargar y compartir enlaces
   #/dashboard · #/orders · #/orders/PP-2026-001 · #/orders/PP-2026-001/Quote
   ========================================================= */
function parseRoute() {
  const [view, id, gate] = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  return { view: VIEWS[view] ? view : "dashboard", id: id || null, gate: gate || null };
}
const go = path => { location.hash = `#/${path}`; };
const quietRoute = path => history.replaceState(null, "", `#/${path}`);

function route() {
  if (!S.session) return;
  S.route = parseRoute();
  const key = `${S.route.view}/${S.route.id || ""}`;
  const y = key === S.lastKey ? window.scrollY : 0;
  S.lastKey = key;
  renderView();
  window.scrollTo(0, y);
  if (S.route.view === "orders" && S.route.id && S.route.gate) {
    const o = findOrder(S.route.id);
    if (!o) { quietRoute("orders"); return; }
    if (!gateDlg || gateDlg._key !== `${o.id}/${S.route.gate}`) openGateDialog(o, S.route.gate);
  } else if (gateDlg) closeGateDialog();
}
window.addEventListener("hashchange", route);
// Evita que soltar un archivo fuera de la zona abra el archivo y destruya la sesión de trabajo.
["dragover", "drop"].forEach(ev => window.addEventListener(ev, e => e.preventDefault()));

/* =========================================================
   Carga
   ========================================================= */
async function reload() {
  try { S.orders = await listOrders(); }
  catch (e) { if (isAuthError(e)) return showLogin(friendly(e)); toast(friendly(e), "error"); return; }
  route();
}

async function boot() {
  app.innerHTML = `<div class="loading">Cargando…</div>`;
  if (CONFIG.DEMO_MODE) return showLogin("El modo demo está desactivado. Conecta el portal a Supabase.");
  try { S.session = await getSession(); } catch (e) { return fatal(friendly(e)); }
  onAuthChange(ev => {
    if (ev === "SIGNED_OUT" && S.session) { S.session = null; S.orders = []; closeGateDialog(); showLogin("Tu sesión terminó. Inicia sesión de nuevo."); }
  });
  if (!S.session) return showLogin();
  await start();
}
async function start() {
  app.innerHTML = `<div class="loading">Cargando órdenes…</div>`;
  try { S.orders = await listOrders(); }
  catch (e) { if (isAuthError(e)) return showLogin(friendly(e)); return fatal(friendly(e)); }
  if (!location.hash) quietRoute("dashboard");
  route();
}

function fatal(msg) {
  app.innerHTML = `<div class="fatal"><div class="fatal-card"><h2>No pudimos conectar con Supabase</h2><p class="muted">${esc(msg)}</p>
    <p class="muted">Revisa <code>config.js</code>, las políticas RLS y que las migraciones de <code>db/</code> estén aplicadas.</p>
    <div class="row"><button class="btn primary" data-act="retry">Reintentar</button><button class="btn" data-act="signout">Cerrar sesión</button></div></div></div>`;
}

/* =========================================================
   Inicio de sesión
   ========================================================= */
function showLogin(message = "") {
  closeGateDialog();
  app.innerHTML = `<div class="login">
    <section class="login-art">
      <div class="brand"><span class="gmark">G</span><div><strong>GUVEL</strong><small>Smarter quality solutions</small></div></div>
      <div><h1>Cada PrePPAP, siete etapas, evidencia en cada una.</h1>
        <p>Sigue la orden desde la cotización hasta la factura al cliente y concilia el PO contra la factura.</p></div>
      <ol class="route" aria-label="Etapas del flujo">${GATES.map(g => `<li><i></i>${esc(g.short)}</li>`).join("")}</ol>
    </section>
    <section class="login-card"><form id="loginForm">
      <h2>Iniciar sesión</h2><p class="muted">Usa tu cuenta autorizada de la empresa.</p>
      <label class="f"><span>Correo</span><input name="email" type="email" autocomplete="username" placeholder="nombre@empresa.com" required></label>
      <label class="f"><span>Contraseña</span><input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn primary" id="loginBtn" style="min-height:42px">Entrar</button>
      <div id="loginMsg" class="login-msg" role="status">${esc(message)}</div>
    </form></section></div>`;
  $("#loginForm").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), msg = $("#loginMsg"), btn = $("#loginBtn");
    btn.disabled = true; btn.textContent = "Entrando…"; msg.className = "login-msg"; msg.textContent = "";
    try {
      await signIn(String(f.get("email")).trim(), f.get("password"));
      S.session = await getSession();
      if (!S.session) throw new Error("Supabase no devolvió una sesión activa.");
      await start();
    } catch (err) {
      let m = err.message || "No se pudo iniciar sesión.";
      if (/email not confirmed/i.test(m)) m = "Correo sin confirmar. Confírmalo en Supabase → Authentication → Users.";
      else if (/invalid login credentials/i.test(m)) m = "Correo o contraseña incorrectos.";
      else m = friendly(err);
      msg.className = "login-msg err"; msg.textContent = m; btn.disabled = false; btn.textContent = "Entrar";
    }
  };
}

/* =========================================================
   Estructura general
   ========================================================= */
function navItem(view, ico) {
  const badge = view === "balances" ? activeOrders().filter(hasOpenBalance).length : 0;
  return `<a class="nav ${S.route.view === view ? "active" : ""}" href="#/${view}" ${S.route.view === view ? 'aria-current="page"' : ""}>${icon(ico, 18)}<span>${VIEWS[view]}</span>${badge ? `<span class="count" title="Balances abiertos">${badge}</span>` : ""}</a>`;
}
function renderView() {
  const v = S.route.view;
  const extra = v === "orders" ? `<button class="btn" data-act="export-all">${icon("download")}<span class="lbl">Exportar ZIP</span></button>`
    : "";
  const content = { dashboard, orders: ordersView, flow: flowView, balances: balancesView, shipments: shipmentsView }[v]();
  app.innerHTML = `<div class="app">
    <aside class="rail"><div class="brand"><span class="gmark">G</span><div><strong>GUVEL</strong><small>Control de PrePPAP</small></div></div>
      <nav aria-label="Principal">${navItem("dashboard", "dashboard")}${navItem("orders", "orders")}${navItem("flow", "flow")}${navItem("balances", "balances")}${navItem("shipments", "shipments")}</nav>
      <div class="rail-foot"><div class="who" title="${esc(S.session?.user?.email)}">${esc(S.session?.user?.email || "")}</div><button data-act="signout">${icon("logout")}<span>Cerrar sesión</span></button></div></aside>
    <div class="main"><header class="topbar"><h1>${VIEWS[v]}</h1><div class="actions">${extra}<button class="btn primary" data-act="new-order">${icon("plus")}<span class="lbl">Nueva orden</span></button></div></header>
    <div class="page" id="page">${content}</div></div></div>`;
  document.title = `${VIEWS[v]}${S.route.id ? ` · ${S.route.id}` : ""} — GUVEL PrePPAP`;
  if (v === "orders") fillOrderList();
  if (v === "flow") fillFlow();
}

/* =========================================================
   Resumen
   ========================================================= */
function orderRow(o, selected = false) {
  const n = nextGate(o);
  const info = isCancelled(o) ? "Orden cancelada" : n ? `Siguiente: ${gateTitle(n, o)}` : "Todas las etapas completas";
  const due = o.required_date && !isCancelled(o) && progress(o) < 100 ? `<span class="due ${isLate(o) ? "late" : ""}">${isLate(o) ? "Vencida " : "Entrega "}${fmtDate(o.required_date)}</span>` : "";
  return `<a class="orow ${selected ? "sel" : ""}" href="#/orders/${encodeURIComponent(o.id)}">
    <div class="t1"><b>${esc(o.id)}</b><span>${esc(o.customer)} — ${esc(o.part_number)}</span></div>${pill(orderState(o))}
    <div class="t2">${pipe(o)}<span class="next">${esc(info)}</span>${due}</div></a>`;
}
function openBalanceList() {
  const list = activeOrders().filter(hasOpenBalance).sort((a, b) => new Date(openBalance(a).created_at) - new Date(openBalance(b).created_at));
  if (!list.length) return `<div class="empty"><strong>Sin balances abiertos</strong>Todos los PO tienen sus piezas facturadas.</div>`;
  return list.map(o => { const b = openBalance(o);
    return `<div class="bal-item"><div><b>${esc(o.id)}</b><small>${esc(o.customer)} — ${esc(o.part_number)}</small>
      <small>${b.action ? esc(b.action) : "Sin acción definida"}</small><small>Abierto hace ${ageDays(b.created_at)} días${b.resolution_date ? `, compromiso ${fmtDate(b.resolution_date)}` : ""}</small></div>
      <div><div class="diff">${fmtNum(faltante(o))}<small> pzas</small></div><button class="btn sm" data-act="edit-balance" data-order="${esc(o.id)}" data-bid="${esc(b.id)}">Dar seguimiento</button></div></div>`; }).join("");
}
function dashboard() {
  const act = activeOrders();
  const running = act.filter(o => progress(o) < 100).sort((a, b) => (a.required_date || "9999").localeCompare(b.required_date || "9999"));
  const stats = [
    [act.length, "Órdenes activas"], [act.filter(o => progress(o) === 100).length, "Completadas"],
    [fmtNum(act.reduce((s, o) => s + pendingShip(o), 0)), "Piezas por enviar"],
    [act.filter(hasOpenBalance).length, "Balances abiertos", "alert"],
    [act.reduce((s, o) => s + o.documents.length, 0), "Archivos de evidencia"]
  ];
  return `<div class="stats">${stats.map(([n, l, c]) => `<div class="stat ${c && n ? c : ""}"><b>${n}</b><span>${l}</span></div>`).join("")}</div>
  <div class="cols">
    <section class="panel"><div class="panel-head"><div><h2>Órdenes en curso</h2><p>Ordenadas por fecha de entrega.</p></div><a class="btn sm" href="#/orders">Ver todas</a></div>
      ${running.slice(0, 8).map(o => orderRow(o)).join("") || `<div class="empty"><strong>No hay órdenes en curso</strong>Crea una orden para empezar a registrar evidencia.</div>`}</section>
    <section class="panel"><div class="panel-head"><div><h2>Balances abiertos</h2><p>Piezas del PO que faltan por facturar, de más antiguo a más reciente.</p></div></div>${openBalanceList()}</section>
  </div>`;
}

/* =========================================================
   Órdenes (lista + detalle)
   ========================================================= */
function ordersView() {
  const has = !!S.route.id, o = has ? findOrder(S.route.id) : null;
  const detailCol = !has ? `<div class="panel empty"><strong>Selecciona una orden</strong>Aquí verás sus 7 etapas, la evidencia y las cantidades.</div>`
    : !o ? `<div class="panel empty"><strong>No encontramos la orden ${esc(S.route.id)}</strong><a class="btn" href="#/orders" style="margin-top:12px">Volver a órdenes</a></div>` : detail(o);
  return `<div class="split ${has ? "has-detail" : ""}">
    <section class="panel split-list" aria-label="Lista de órdenes">
      <div class="filters"><label class="search"><span class="sr">Buscar</span>${icon("search")}<input id="q" type="search" placeholder="Buscar orden, cliente o parte" value="${esc(S.q)}" autocomplete="off"></label>
        <select id="statusFilter" aria-label="Filtrar por estado">${[["all", "Todas"], ["Not Started", "Sin iniciar"], ["In Progress", "En curso"], ["Completed", "Completadas"], ["Cancelled", "Canceladas"]].map(([v, l]) => `<option value="${v}" ${S.status === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="list-meta" id="listMeta"></div><div id="orderList"></div></section>
    <section class="detail-col">${detailCol}</section></div>`;
}
function fillOrderList() {
  const box = $("#orderList"); if (!box) return;
  const q = S.q.trim().toLowerCase();
  const list = S.orders.filter(o => (S.status === "all" || orderState(o) === S.status) &&
    (!q || [o.id, o.customer, o.part_number, o.purpose].join(" ").toLowerCase().includes(q)));
  $("#listMeta").textContent = `${list.length} de ${S.orders.length} órdenes`;
  box.innerHTML = list.map(o => orderRow(o, o.id === S.route.id)).join("") || `<div class="empty"><strong>Sin resultados</strong>Prueba con otro texto o cambia el filtro.</div>`;
}
function detail(o) {
  const cancelled = isCancelled(o), pend = hasOpenBalance(o), nxt = nextGate(o);
  const fact = (l, v, warn) => `<div class="fact ${warn ? "warn" : ""}"><span>${l}</span><b>${v}</b></div>`;
  return `<article class="panel">
    <div class="detail-head"><div><a class="btn sm back" href="#/orders">${icon("back")}Órdenes</a>
      <h2>${esc(o.id)} ${pill(orderState(o))}</h2>
      <p class="sub">${esc(o.customer)} — ${esc(o.part_number)}${o.revision ? ` rev. ${esc(o.revision)}` : ""}</p></div>
      <div class="pct"><small>${doneCount(o)} de ${GATES.length} etapas</small>${pipe(o, true)}</div></div>
    <div class="facts c3">${fact("Propósito", esc(o.purpose))}${fact("Solicitada", fmtDate(o.request_date))}
      ${fact("Fecha requerida", `${fmtDate(o.required_date)}${isLate(o) ? " (vencida)" : ""}`, isLate(o))}
      ${fact("Método de envío", esc(o.shipping_method || "—"))}${fact("Responsable", esc(o.owner || "—"))}${fact("Prioridad", esc(o.priority))}</div>
    <div class="facts c3">${fact("Solicitadas en la orden", `${fmtNum(o.qtyRequested)} pzas`)}${fact("PO a Metrics Works", o.mesPOQty ? `${fmtNum(o.mesPOQty)} pzas` : "Sin capturar")}
      ${fact("Facturadas por Metrics Works", `${fmtNum(o.mwsInvoiceQty)} pzas`)}${fact("Faltan del PO", `${fmtNum(faltante(o))} pzas`, pend)}
      ${fact("Enviadas al cliente", `${fmtNum(o.qtyShipped)} pzas`)}${fact("Por enviar al cliente", `${fmtNum(pendingShip(o))} pzas`, pendingShip(o) > 0 && progress(o) === 100)}</div>
    ${cancelled ? `<div class="banner danger">${icon("alert")}<div><b>Orden cancelada.</b> Sale de los tableros activos. Los documentos y el historial se conservan.</div></div>` : ""}
    ${pend ? `<div class="banner warn">${icon("alert")}<div><b>Balance abierto: faltan ${fmtNum(faltante(o))} pzas del PO.</b> Registra las facturas de reposición en <a class="linkbtn" href="#/orders/${encodeURIComponent(o.id)}/MWSInvoice">Factura de Metrics Works</a> o da seguimiento en <a class="linkbtn" href="#/balances">Balances de PO</a>.</div></div>` : ""}
    <div class="gates-wrap"><h3>Etapas</h3><p>${cancelled ? "Consulta la evidencia de cada etapa." : "Abre una etapa para subir evidencia y completarla."}</p>
      <ol class="gates">${GATES.map((g, i) => {
        const t = taskOf(o, g.code), st = t?.status || "Not Started", done = st === "Completed";
        const n = o.documents.filter(d => d.task_code === g.folder).length, isNext = !cancelled && nxt?.code === g.code;
        return `<li class="gate ${done ? "done" : ""} ${isNext ? "next" : ""}"><span class="mark">${done ? icon("check", 15) : i + 1}</span>
          <a class="gate-btn" href="#/orders/${encodeURIComponent(o.id)}/${g.code}"><div><b>${esc(gateTitle(g, o))}</b><small>${esc(g.from)} → ${esc(g.to)}${g.reconcile && o.mesPOQty ? ` — ${fmtNum(o.mwsInvoiceQty)} de ${fmtNum(o.mesPOQty)} pzas facturadas` : ""}</small></div>
          <span class="ev" title="Archivos de evidencia">${icon("file", 14)}${n}</span>${pill(st)}${icon("chevron")}</a></li>`;
      }).join("")}</ol></div>
    <div class="detail-foot"><button class="btn" data-act="export-order" data-order="${esc(o.id)}">${icon("download")}Descargar evidencia (ZIP)</button>
      ${cancelled ? `<button class="btn" data-act="reactivate" data-order="${esc(o.id)}">Reactivar orden</button>` : `<button class="btn danger" data-act="cancel-order" data-order="${esc(o.id)}">Cancelar orden</button>`}</div>
  </article>`;
}

/* =========================================================
   Etapas, balances y envíos
   ========================================================= */
function flowView() {
  return `<section class="panel"><div class="toolbar">
    <label class="f" style="display:contents"><span class="sr">Estado</span><select id="flowStatus"><option value="open" ${S.flowStatus === "open" ? "selected" : ""}>Pendientes</option><option value="done" ${S.flowStatus === "done" ? "selected" : ""}>Completadas</option><option value="all" ${S.flowStatus === "all" ? "selected" : ""}>Todas</option></select></label>
    <label class="f" style="display:contents"><span class="sr">Etapa</span><select id="flowGate"><option value="all">Todas las etapas</option>${GATES.map(g => `<option value="${g.code}" ${S.flowGate === g.code ? "selected" : ""}>${esc(g.title)}</option>`).join("")}</select></label>
    <span class="muted" id="flowMeta"></span></div>
    <div class="tablewrap"><table><thead><tr><th>Orden</th><th>Etapa</th><th class="r">Archivos</th><th>Vence</th><th>Estado</th></tr></thead><tbody id="flowBody"></tbody></table></div></section>`;
}
function fillFlow() {
  const body = $("#flowBody"); if (!body) return;
  const rows = activeOrders().flatMap(o => GATES.map(g => ({ o, g, t: taskOf(o, g.code) })))
    .filter(r => r.t && (S.flowGate === "all" || r.g.code === S.flowGate) &&
      (S.flowStatus === "all" || (S.flowStatus === "done") === (r.t.status === "Completed")));
  $("#flowMeta").textContent = `${rows.length} etapas`;
  body.innerHTML = rows.map(({ o, g, t }) => `<tr class="click" tabindex="0" data-href="orders/${encodeURIComponent(o.id)}/${g.code}">
    <td><b>${esc(o.id)}</b><small>${esc(o.customer)} — ${esc(o.part_number)}</small></td><td>${esc(gateTitle(g, o))}</td>
    <td class="r num">${o.documents.filter(d => d.task_code === g.folder).length}</td>
    <td class="${t.status !== "Completed" && t.due_date && t.due_date < todayISO() ? "due late" : ""}">${fmtDate(t.due_date)}</td><td>${pill(t.status)}</td></tr>`).join("")
    || `<tr><td colspan="5" class="empty"><strong>Nada por aquí</strong>No hay etapas con este filtro.</td></tr>`;
}
// Cifras de un balance: abierto = en vivo (PO vs facturas); cerrado = las que quedaron al cerrarse.
const balNums = (o, b) => { const po = b.status === "Closed" ? Number(b.ordered_qty) : o.mesPOQty, inv = b.status === "Closed" ? Number(b.delivered_qty) : o.mwsInvoiceQty; return { po, inv, falta: Math.max(0, po - inv) }; };
function balancesView() {
  const rows = S.orders.flatMap(o => o.balances.map(b => ({ o, b })))
    .sort((x, y) => (x.b.status === "Closed") - (y.b.status === "Closed") || new Date(x.b.created_at) - new Date(y.b.created_at));
  return `<section class="panel"><div class="panel-head"><div><h2>Seguimiento de balances</h2><p>Un balance se abre solo cuando la factura de Metrics Works no cubre todo el PO, y se cierra al llegar a la cantidad total.</p></div></div>
    <div class="tablewrap"><table><thead><tr><th>Orden</th><th>PO a MWS</th><th class="r">Facturado</th><th class="r">Faltan</th><th>Acción</th><th>Fecha compromiso</th><th class="r">Antigüedad</th><th>Estado</th><th></th></tr></thead><tbody>
    ${rows.map(({ o, b }) => { const n = balNums(o, b), closed = b.status === "Closed"; return `<tr><td><a href="#/orders/${encodeURIComponent(o.id)}"><b>${esc(o.id)}</b></a><small>${esc(o.customer)} — ${esc(o.part_number)}</small></td>
      <td class="num">${fmtNum(n.po)} pzas${b.po_number ? `<small>${esc(b.po_number)}</small>` : ""}</td><td class="r num">${fmtNum(n.inv)}</td><td class="r num ${n.falta && !closed ? "red" : ""}">${fmtNum(n.falta)}</td>
      <td>${esc(b.action || "Sin definir")}${b.related_po ? `<small>PO relacionado ${esc(b.related_po)}</small>` : ""}</td><td>${fmtDate(b.resolution_date)}</td>
      <td class="r num">${closed ? "—" : `${ageDays(b.created_at)} días`}</td><td>${pill(b.status || "Open")}</td>
      <td><button class="btn sm" data-act="edit-balance" data-order="${esc(o.id)}" data-bid="${esc(b.id)}">${closed ? "Ver" : "Dar seguimiento"}</button></td></tr>`; }).join("")
      || `<tr><td colspan="9" class="empty"><strong>Sin balances</strong>Cuando completes la factura de Metrics Works con piezas faltantes, el balance aparece aquí.</td></tr>`}
    </tbody></table></div></section>`;
}
function shipmentsView() {
  const list = activeOrders();
  return `<section class="panel"><div class="tablewrap"><table><thead><tr><th>Orden</th><th>Parte</th><th>Método</th><th>Etapa de envío</th><th class="r">Solicitadas</th><th class="r">Enviadas</th><th class="r">Por enviar</th></tr></thead><tbody>
    ${list.map(o => { const t = taskOf(o, "Shipment"); return `<tr class="click" tabindex="0" data-href="orders/${encodeURIComponent(o.id)}/Shipment"><td><b>${esc(o.id)}</b><small>${esc(o.customer)}</small></td><td>${esc(o.part_number)}</td>
      <td>${esc(o.shipping_method || "—")}</td><td>${pill(t?.status || "Not Started")}</td><td class="r num">${fmtNum(o.qtyRequested)}</td><td class="r num">${fmtNum(o.qtyShipped)}</td>
      <td class="r num ${pendingShip(o) ? "red" : ""}">${fmtNum(pendingShip(o))}</td></tr>`; }).join("")
      || `<tr><td colspan="7" class="empty"><strong>Sin envíos</strong>Cuando crees una orden aparecerá aquí.</td></tr>`}</tbody></table></div></section>`;
}

/* =========================================================
   Eventos globales (delegación: sobreviven a cada re-render)
   ========================================================= */
app.addEventListener("click", async e => {
  const row = e.target.closest("[data-href]");
  if (row && !e.target.closest("a,button")) return go(row.dataset.href);
  const el = e.target.closest("[data-act]"); if (!el) return;
  const o = el.dataset.order ? findOrder(el.dataset.order) : null;
  switch (el.dataset.act) {
    case "retry": return boot();
    case "signout": S.session = null; S.orders = []; closeGateDialog(); try { await signOut(); } catch {} return showLogin();
    case "new-order": return newOrderDialog();
    case "export-all": return exportZip(S.orders, "PrePPAP", el);
    case "export-order": return o && exportZip([o], o.id, el);
    case "edit-balance": return o && balanceDialog(o, o.balances.find(b => b.id === el.dataset.bid));
    case "cancel-order": {
      if (!o || !await askConfirm(`¿Cancelar ${o.id}?`, "La orden sale de los tableros activos. Los documentos, etapas e historial se conservan y puedes reactivarla.", { ok: "Cancelar orden", danger: true })) return;
      try { await setOrderStatus(o.dbId, "Cancelled"); toast(`${o.id} cancelada.`); await reload(); } catch (err) { toast(friendly(err), "error"); }
      return;
    }
    case "reactivate":
      try { await setOrderStatus(o.dbId, "Active"); toast(`${o.id} reactivada.`); await reload(); } catch (err) { toast(friendly(err), "error"); }
  }
});
app.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("tr[data-href]")) go(e.target.dataset.href); });
app.addEventListener("input", e => { if (e.target.id === "q") { S.q = e.target.value; fillOrderList(); } });
app.addEventListener("change", e => {
  if (e.target.id === "statusFilter") { S.status = e.target.value; fillOrderList(); }
  if (e.target.id === "flowStatus") { S.flowStatus = e.target.value; fillFlow(); }
  if (e.target.id === "flowGate") { S.flowGate = e.target.value; fillFlow(); }
});

/* =========================================================
   Diálogo: nueva orden
   ========================================================= */
const opts = (list, sel) => list.map(v => `<option ${v === sel ? "selected" : ""}>${esc(v)}</option>`).join("");

function newOrderDialog() {
  let dirty = false, busy = false;
  const dlg = openDialog(`<form class="dlg-body" id="orderForm" novalidate>
    <header class="dlg-head"><div><p class="crumb">Nueva orden</p><h2>Crear orden PrePPAP</h2><p class="parties">El número se asigna solo y las 7 etapas se crean sin iniciar.</p></div><button type="button" class="btn icon-only" data-close aria-label="Cerrar">${icon("x")}</button></header>
    <div class="dlg-scroll"><div class="grid2">
      <label class="f"><span>Cliente</span><input name="customer" required autocomplete="off"></label>
      <label class="f"><span>Número de parte</span><input name="partNumber" required autocomplete="off"></label>
      <label class="f"><span>Revisión <em>(opcional)</em></span><input name="revision" autocomplete="off"></label>
      <label class="f"><span>Propósito</span><select name="purpose">${opts(PURPOSES, "Pre-Production")}</select></label>
      <label class="f"><span>Fecha de solicitud</span><input name="requestDate" type="date" value="${todayISO()}" required></label>
      <label class="f"><span>Fecha requerida <em>(opcional)</em></span><input name="requiredDate" type="date"></label>
      <label class="f"><span>Cantidad solicitada (pzas)</span><input name="qtyRequested" type="number" min="1" step="1" inputmode="numeric" required></label>
      <label class="f"><span>Prioridad</span><select name="priority">${opts(PRIORITIES, "Normal")}</select></label>
      <label class="f"><span>Responsable</span><select name="owner">${opts(OWNERS, "Quality")}</select></label>
      <label class="f"><span>Método de envío</span><select name="shippingMethod">${opts(Object.values(SHIPPING), SHIPPING.MTY)}</select></label>
      <div class="hint full" id="shipHint"></div></div><div id="formErr"></div></div>
    <footer class="dlg-foot"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary" id="submitBtn">Crear orden</button></footer></form>`,
    { guard: () => busy ? false : (!dirty || confirm("Tienes datos sin guardar. ¿Cerrar de todos modos?")) });
  const form = $("#orderForm", dlg);
  const hint = () => { $("#shipHint", dlg).textContent = form.shippingMethod.value === SHIPPING.MTY
    ? "Desde Monterrey: la etapa de envío se marca como completada automáticamente." : "Desde MWS: la etapa de envío requiere evidencia."; };
  form.addEventListener("input", () => { dirty = true; }); form.shippingMethod.addEventListener("change", hint); hint();
  form.customer.focus();
  form.onsubmit = async e => {
    e.preventDefault(); if (busy) return;
    const v = Object.fromEntries(new FormData(form)), err = $("#formErr", dlg);
    const bad = !v.customer.trim() ? "Escribe el cliente." : !v.partNumber.trim() ? "Escribe el número de parte."
      : !(Number(v.qtyRequested) > 0) ? "La cantidad solicitada debe ser mayor a 0."
      : v.requiredDate && v.requestDate && v.requiredDate < v.requestDate ? "La fecha requerida no puede ser anterior a la solicitud." : "";
    if (bad) { err.innerHTML = `<div class="form-error">${icon("alert")}<span>${esc(bad)}</span></div>`; return; }
    busy = true; $("#submitBtn", dlg).disabled = true; $("#submitBtn", dlg).textContent = "Creando…"; err.innerHTML = "";
    try {
      const num = await createOrder(v); dirty = false; dlg.close(); toast(`${num} creada.`);
      S.orders = await listOrders(); go(`orders/${encodeURIComponent(num)}`); route();
    } catch (ex) {
      busy = false; $("#submitBtn", dlg).disabled = false; $("#submitBtn", dlg).textContent = "Crear orden";
      err.innerHTML = `<div class="form-error">${icon("alert")}<span>${esc(friendly(ex))}</span></div>`;
    }
  };
}

/* =========================================================
   Diálogo: etapa (evidencia + datos)
   ========================================================= */
let gateDlg = null;
function closeGateDialog() { if (gateDlg?.open) { gateDlg._silent = true; gateDlg.close(); } gateDlg = null; }

function openGateDialog(order, code) {
  const gate = gateByCode(code);
  if (!gate || !taskOf(order, code)) { toast("Esta etapa no existe para la orden.", "error"); quietRoute(`orders/${encodeURIComponent(order.id)}`); return; }
  closeGateDialog();
  const idx = GATES.indexOf(gate), ro = isCancelled(order), rec = !!gate.reconcile;
  const auto = gate.code === "Shipment" && order.shipping_method === SHIPPING.MTY;
  let busy = false, dirty = false, invFiles = [], attachTo = null;
  const task0 = taskOf(order, code);
  const isDone = () => taskOf(order, code)?.status === "Completed";
  const docs = () => order.documents.filter(d => d.task_code === gate.folder && !d.invoice_id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const dis = ro ? "disabled" : "";
  const nz = n => Number(n) > 0 ? Number(n) : "";
  const ref = task0.reference ?? (gate.refCol ? order[gate.refCol] : "") ?? "";
  const notes = `<label class="f"><span>Notas <em>(opcional)</em></span><textarea name="details" ${dis}>${esc(task0.details || "")}</textarea></label>`;

  const dataFields = rec
    ? `<div class="recon"><label class="f"><span>PO a Metrics Works</span><input value="${esc(order.mes_po || "Sin capturar")}" readonly></label>
        <label class="f"><span>Cantidad total del PO (pzas)</span><input name="mesPOQty" type="number" min="1" step="1" inputmode="numeric" required value="${nz(order.mesPOQty)}" ${dis}></label></div>${notes}`
    : `<label class="f"><span>${gate.refLabel}</span><input name="reference" value="${esc(ref)}" autocomplete="off" ${dis}></label>
       ${gate.qtyCol ? `<label class="f"><span>${gate.qtyLabel}${gate.qtyRequired ? "" : " <em>(opcional)</em>"}</span><input name="qty" type="number" min="0" step="1" inputmode="numeric" ${gate.qtyRequired ? "required" : ""} value="${nz(order[gate.qtyCol])}" ${dis}></label>` : ""}${notes}`;

  const evidenceSection = `<section class="sec"><h3>Evidencia</h3><p>${auto ? "Opcional en esta etapa." : "Sube al menos un archivo para poder completar la etapa."} Máximo 2 MB por archivo.</p>
    ${ro ? "" : `<div class="drop" id="drop"><input id="fileInput" type="file" multiple hidden>${icon("upload", 22)}<b>Arrastra archivos aquí</b><small>o</small><button type="button" class="btn sm" id="pickBtn">Elegir archivos</button></div>`}
    <div class="upmsg" id="upMsg" role="status"></div><div class="files" id="files"></div></section>`;

  const invoiceSection = `<section class="sec"><h3>Facturas de Metrics Works</h3><p>Registra cada factura, parcial o total, con su archivo. El PO se cumple cuando la suma llega a la cantidad total.</p>
    <div id="invSum"></div><div class="inv-list" id="invList"></div>
    ${ro ? "" : `<div class="inv-add"><b>Agregar factura</b><div class="inv-grid">
      <label class="f"><span>Número de factura</span><input id="invNum" autocomplete="off"></label>
      <label class="f"><span>Piezas</span><input id="invQty" type="number" min="1" step="1" inputmode="numeric"></label>
      <label class="f"><span>Fecha</span><input id="invDate" type="date" value="${todayISO()}"></label></div>
      <div class="inv-file"><input id="invFile" type="file" multiple hidden><input id="invAttach" type="file" multiple hidden>
        <button type="button" class="btn sm" id="invPick">${icon("upload")}Adjuntar archivo</button><span id="invFileName" class="muted"></span></div>
      <div class="upmsg" id="invMsg" role="status"></div><button type="button" class="btn primary" id="invSave">Agregar factura</button></div>`}</section>`;

  const dataSection = `<form class="sec" id="gateForm" novalidate><h3>${rec ? "Cantidad del PO" : "Datos de la etapa"}</h3><p>${rec ? "Es la cantidad total que Metrics México pidió a Metrics Works." : "Lo que captures aquí se guarda en la orden."}</p>
    <div class="fields">${dataFields}</div><div id="gateErr" style="margin-top:12px"></div></form>`;

  const dlg = gateDlg = openDialog(`<div class="dlg-body">
    <header class="dlg-head"><div><p class="crumb">${esc(order.id)} · etapa ${idx + 1} de ${GATES.length}</p><h2>${esc(gateTitle(gate, order))}</h2><p class="parties">${esc(gate.from)} → ${esc(gate.to)} ${pill(task0.status)}</p></div>
      <button type="button" class="btn icon-only" data-close aria-label="Cerrar">${icon("x")}</button></header>
    <div class="dlg-scroll">
      ${auto ? `<div class="hint good">${icon("check")}<span>Envío desde Monterrey: esta etapa se completó automáticamente y no requiere evidencia.</span></div>` : ""}
      ${ro ? `<div class="hint warn">${icon("alert")}<span>La orden está cancelada: solo puedes consultar.</span></div>` : ""}
      ${rec ? dataSection + invoiceSection : evidenceSection + dataSection}</div>
    <footer class="dlg-foot">${ro ? `<button class="btn" data-close>Cerrar</button>` : isDone()
      ? `<button class="btn spacer" id="reopenBtn" type="button">Reabrir etapa</button><button class="btn" data-close>Cerrar</button><button class="btn primary" id="saveBtn" type="button">Guardar cambios</button>`
      : `<button class="btn" data-close>Cerrar</button><button class="btn primary" id="completeBtn" type="button">Completar etapa</button>`}</footer></div>`,
    { wide: true, backdrop: false, guard: () => busy ? false : (!dirty || confirm("Tienes cambios sin guardar. ¿Cerrar de todos modos?")) });
  dlg._key = `${order.id}/${code}`;
  const form = $("#gateForm", dlg), upMsg = $("#upMsg", dlg);

  const fileRow = (d, canDel) => `<div class="file"><button type="button" class="open" data-open="${esc(d.id)}">${icon("file", 18)}<div><b>${esc(d.document_name)}</b><small>${fmtSize(d.size_bytes || 0)} · ${fmtDateTime(d.created_at)}</small></div></button>
    ${canDel ? `<button type="button" class="del" data-del="${esc(d.id)}" aria-label="Eliminar ${esc(d.document_name)}">${icon("trash")}</button>` : `<span></span>`}</div>`;
  const sortedInvoices = () => [...order.invoices].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const renderInvoices = () => {
    const po = Number(form.mesPOQty?.value) || order.mesPOQty || 0, inv = sumInvoices(order), falta = Math.max(0, po - inv), pct = po ? Math.min(100, Math.round(inv / po * 100)) : 0;
    const state = !po ? "" : falta ? "warn" : "good";
    const verdict = !po ? "Captura la cantidad del PO" : falta ? `faltan <b>${fmtNum(falta)}</b>` : inv > po ? `excede el PO por <b>${fmtNum(inv - po)}</b>` : "PO completo";
    $("#invSum", dlg).innerHTML = `<div class="inv-sum ${state}"><div class="inv-nums"><span><b>${fmtNum(inv)}</b> facturadas</span><span>de <b>${po ? fmtNum(po) : "—"}</b> del PO</span><span class="falta">${verdict}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>${po && falta && order.invoices.length && !isDone() && !ro ? `<p class="inv-note">Si completas la etapa ahora, se abre un balance por ${fmtNum(falta)} pzas ligado a esta orden. Las facturas de reposición lo irán cerrando.</p>` : ""}</div>`;
    const legacy = docs();
    $("#invList", dlg).innerHTML = sortedInvoices().map(i => `<div class="inv"><div class="inv-head"><div><b>${esc(i.invoice_number)}</b><small>${fmtDate(i.invoice_date)}</small></div><span class="inv-qty">${fmtNum(i.qty)} pzas</span>
      ${ro ? "" : `<button type="button" class="btn sm" data-inv-add="${esc(i.id)}">Adjuntar archivo</button><button type="button" class="del" data-inv-del="${esc(i.id)}" aria-label="Eliminar factura ${esc(i.invoice_number)}">${icon("trash")}</button>`}</div>
      <div class="files">${order.documents.filter(d => d.invoice_id === i.id).map(d => fileRow(d, !ro)).join("") || `<div class="muted" style="font-size:13px">Sin archivos</div>`}</div></div>`).join("")
      + (legacy.length ? `<div class="inv"><div class="inv-head"><div><b>Archivos anteriores</b><small>Cargados antes de registrar facturas por separado</small></div></div><div class="files">${legacy.map(d => fileRow(d, !ro && !isDone())).join("")}</div></div>` : "")
      || `<div class="muted" style="font-size:13px">Aún no hay facturas registradas.</div>`;
  };
  const updateComplete = () => {
    const c = $("#completeBtn", dlg); if (!c) return;
    c.disabled = busy || (rec ? order.invoices.length === 0 : (!auto && !docs().length));
  };
  const renderFiles = () => {
    if (rec) { renderInvoices(); updateComplete(); return; }
    const list = docs(), canDel = !ro && !isDone();
    $("#files", dlg).innerHTML = list.length ? list.map(d => fileRow(d, canDel)).join("") : `<div class="muted" style="font-size:13px">Aún no hay archivos en esta etapa.</div>`;
    updateComplete();
  };
  const setBusy = b => { busy = b; $$("button", dlg).forEach(x => { if (!x.hasAttribute("data-close")) x.disabled = b; }); renderFiles(); };
  const showErr = m => { $("#gateErr", dlg).innerHTML = m ? `<div class="form-error">${icon("alert")}<span>${esc(m)}</span></div>` : ""; };
  const read = () => Object.fromEntries(new FormData(form));
  const validate = (v, mode) => {
    const n = k => v[k] === "" || v[k] == null ? null : Number(v[k]);
    if (rec) {
      if (n("mesPOQty") === null || !(n("mesPOQty") > 0)) return "Captura la cantidad total del PO (mayor a 0).";
      if (mode === "complete" && !order.invoices.length) return "Registra al menos una factura de Metrics Works antes de completar la etapa.";
      return "";
    }
    if (gate.qtyRequired && n("qty") === null) return "Captura la cantidad de piezas.";
    if (n("qty") !== null && (!Number.isFinite(n("qty")) || n("qty") < 0)) return "La cantidad debe ser un número mayor o igual a 0.";
    return "";
  };
  form.addEventListener("input", () => { dirty = true; showErr(""); if (rec) renderInvoices(); });
  form.addEventListener("submit", e => e.preventDefault());
  renderFiles();

  // Recarga datos del servidor sin cerrar el diálogo (el balance lo recalcula la base de datos).
  const refresh = async () => { await reload(); const fresh = findOrder(order.id); if (fresh) Object.assign(order, fresh); renderFiles(); };
  const finish = async msg => {
    dirty = false; dlg._silent = true; dlg.close(); gateDlg = null;
    quietRoute(`orders/${encodeURIComponent(order.id)}`); toast(msg); await reload();
  };
  const submit = async mode => {
    const v = read(), bad = validate(v, mode); if (bad) return showErr(bad);
    setBusy(true); showErr("");
    try { mode === "complete" ? await completeGate(order, gate, v) : await saveGate(order, gate, v); await finish(mode === "complete" ? "Etapa completada." : "Cambios guardados."); }
    catch (ex) { setBusy(false); showErr(friendly(ex)); }
  };
  $("#completeBtn", dlg)?.addEventListener("click", () => submit("complete"));
  $("#saveBtn", dlg)?.addEventListener("click", () => submit("save"));
  $("#reopenBtn", dlg)?.addEventListener("click", async () => {
    if (!await askConfirm("¿Reabrir la etapa?", "Volverá a estado «En curso». Si ya generó un balance, ese balance se conserva.", { ok: "Reabrir" })) return;
    setBusy(true);
    try { await reopenGate(order, gate); await finish("Etapa reabierta."); } catch (ex) { setBusy(false); showErr(friendly(ex)); }
  });

  // --- Evidencia general (etapas que no son de facturas)
  const input = $("#fileInput", dlg), drop = $("#drop", dlg);
  async function handleFiles(list) {
    const files = [...(list || [])]; if (busy || !files.length) return;
    setBusy(true); upMsg.className = "upmsg"; upMsg.textContent = ""; const errs = []; let ok = 0;
    for (const [i, f] of files.entries()) {
      upMsg.textContent = `Subiendo ${i + 1} de ${files.length}: ${f.name}…`;
      try { order.documents.push(await uploadDocument(order, gate, f)); ok++; renderFiles(); }
      catch (ex) { errs.push(`${f.name}: ${friendly(ex)}`); }
    }
    setBusy(false);
    if (errs.length) { upMsg.className = "upmsg err"; upMsg.innerHTML = errs.map(esc).join("<br>"); } else upMsg.textContent = "";
    if (ok) toast(ok === 1 ? "Archivo subido." : `${ok} archivos subidos.`);
  }
  $("#pickBtn", dlg)?.addEventListener("click", () => input.click());
  input?.addEventListener("change", () => { const f = [...input.files]; input.value = ""; handleFiles(f); });
  if (drop) {
    ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", e => handleFiles(e.dataTransfer?.files));
  }

  // --- Facturas de Metrics Works
  const invMsg = $("#invMsg", dlg), setInvMsg = (t, err) => { if (invMsg) { invMsg.className = `upmsg${err ? " err" : ""}`; invMsg.textContent = t; } };
  if (rec && !ro) {
    $("#invPick", dlg).addEventListener("click", () => $("#invFile", dlg).click());
    $("#invFile", dlg).addEventListener("change", e => { invFiles = [...e.target.files]; e.target.value = ""; $("#invFileName", dlg).textContent = invFiles.map(f => f.name).join(", "); dirty = true; });
    $("#invSave", dlg).addEventListener("click", async () => {
      const number = $("#invNum", dlg).value.trim(), qty = Number($("#invQty", dlg).value), date = $("#invDate", dlg).value;
      if (!number) return setInvMsg("Escribe el número de factura.", true);
      if (!(qty > 0)) return setInvMsg("Escribe las piezas de la factura (mayor a 0).", true);
      if (!invFiles.length) return setInvMsg("Adjunta el archivo de la factura.", true);
      setBusy(true); setInvMsg("Guardando factura…");
      try {
        await addInvoice(order, { number, qty, date }, invFiles);
        $("#invNum", dlg).value = ""; $("#invQty", dlg).value = ""; $("#invFileName", dlg).textContent = ""; invFiles = [];
        await refresh(); setBusy(false); setInvMsg(""); toast("Factura registrada.");
      } catch (ex) { setBusy(false); setInvMsg(friendly(ex), true); }
    });
    $("#invAttach", dlg).addEventListener("change", async e => {
      const files = [...e.target.files]; e.target.value = ""; const inv = order.invoices.find(i => i.id === attachTo); if (!inv || !files.length) return;
      setBusy(true);
      try { order.documents.push(...await addInvoiceFiles(order, inv, files)); toast("Archivo adjuntado."); } catch (ex) { toast(friendly(ex), "error"); }
      setBusy(false);
    });
  }

  dlg.addEventListener("click", async e => {
    const open = e.target.closest("[data-open]"), del = e.target.closest("[data-del]"), invDel = e.target.closest("[data-inv-del]"), invAdd = e.target.closest("[data-inv-add]");
    if (open) {
      const d = order.documents.find(x => x.id === open.dataset.open);
      try { await openInNewTab(() => getDocumentUrl(d.storage_path)); } catch (ex) { toast(friendly(ex), "error"); }
    } else if (del && !busy) {
      const d = order.documents.find(x => x.id === del.dataset.del);
      if (!await askConfirm("¿Eliminar archivo?", d.document_name, { ok: "Eliminar", danger: true })) return;
      setBusy(true);
      try { await deleteDocument(d); order.documents.splice(order.documents.indexOf(d), 1); toast("Archivo eliminado."); }
      catch (ex) { toast(friendly(ex), "error"); }
      setBusy(false);
    } else if (invAdd && !busy) { attachTo = invAdd.dataset.invAdd; $("#invAttach", dlg).click(); }
    else if (invDel && !busy) {
      const inv = order.invoices.find(i => i.id === invDel.dataset.invDel);
      if (!await askConfirm(`¿Eliminar la factura ${inv.invoice_number}?`, `Se eliminan sus archivos y las ${fmtNum(inv.qty)} pzas dejan de contar como facturadas: el faltante del PO se recalcula.`, { ok: "Eliminar factura", danger: true })) return;
      setBusy(true);
      try { await deleteInvoice(order, inv); await refresh(); toast("Factura eliminada."); } catch (ex) { toast(friendly(ex), "error"); }
      setBusy(false);
    }
  });
  dlg.addEventListener("close", () => {
    if (gateDlg === dlg) gateDlg = null;
    if (!dlg._silent) { quietRoute(`orders/${encodeURIComponent(order.id)}`); route(); }
  });
}

/* =========================================================
   Balances: seguimiento
   ========================================================= */
function balanceDialog(order, bal) {
  if (!bal) return;
  const n = balNums(order, bal), closed = bal.status === "Closed", pct = n.po ? Math.min(100, Math.round(n.inv / n.po * 100)) : 0;
  const actions = bal.action && !COMP_ACTIONS.includes(bal.action) ? [...COMP_ACTIONS, bal.action] : COMP_ACTIONS;
  const invs = [...order.invoices].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  let busy = false;
  const dlg = openDialog(`<form class="dlg-body" id="balForm" novalidate>
    <header class="dlg-head"><div><p class="crumb">${esc(order.id)}</p><h2>Seguimiento del balance</h2><p class="parties">${esc(order.customer)} — ${esc(order.part_number)} ${pill(bal.status)}</p></div><button type="button" class="btn icon-only" data-close aria-label="Cerrar">${icon("x")}</button></header>
    <div class="dlg-scroll">
      <div class="inv-sum ${n.falta ? "warn" : "good"}"><div class="inv-nums"><span><b>${fmtNum(n.inv)}</b> facturadas</span><span>de <b>${fmtNum(n.po)}</b> del PO</span><span class="falta">${n.falta ? `faltan <b>${fmtNum(n.falta)}</b>` : "PO completo"}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>
      <section class="sec"><h3>Facturas recibidas</h3><div class="inv-list">${invs.map(i => `<div class="inv"><div class="inv-head"><div><b>${esc(i.invoice_number)}</b><small>${fmtDate(i.invoice_date)}</small></div><span class="inv-qty">${fmtNum(i.qty)} pzas</span></div></div>`).join("") || `<div class="muted" style="font-size:13px">Sin facturas registradas.</div>`}</div>
        ${closed ? "" : `<a class="btn" data-nav-close href="#/orders/${encodeURIComponent(order.id)}/MWSInvoice" style="margin-top:10px">${icon("plus")}Registrar factura de reposición</a>`}</section>
      <section class="sec"><h3>Plan para reponer</h3><p>El estado y las cantidades se actualizan solos con cada factura. Aquí defines cómo y cuándo se cumple el resto.</p><div class="grid2">
        <label class="f full"><span>Acción</span><select name="action"><option value="">Sin definir</option>${opts(actions, bal.action)}</select></label>
        <label class="f"><span>PO relacionado <em>(opcional)</em></span><input name="related_po" value="${esc(bal.related_po || "")}" autocomplete="off"></label>
        <label class="f"><span>Fecha compromiso <em>(opcional)</em></span><input name="resolution_date" type="date" value="${esc(bal.resolution_date || "")}"></label>
        <label class="f"><span>Estado</span><select name="status">${["Open", "Partial", "Closed"].map(s => `<option value="${s}" ${bal.status === s ? "selected" : ""}>${STATUS_ES[s]}</option>`).join("")}</select></label>
        <label class="f full"><span>Comentarios <em>(obligatorio si cierras sin reponer)</em></span><textarea name="comments">${esc(bal.comments || "")}</textarea></label></div><div id="balErr" style="margin-top:12px"></div></section></div>
    <footer class="dlg-foot"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary" id="balSave">Guardar seguimiento</button></footer></form>`);
  dlg.addEventListener("click", e => { if (e.target.closest("[data-nav-close]")) dlg.close(); });
  const form = $("#balForm", dlg);
  form.onsubmit = async e => {
    e.preventDefault(); if (busy) return;
    const f = Object.fromEntries(new FormData(form)), err = $("#balErr", dlg);
    const hasReason = f.comments.trim() && !/^Generado autom/i.test(f.comments.trim()); // el texto automático no cuenta como justificación
    if (f.status === "Closed" && n.falta > 0 && !hasReason) { err.innerHTML = `<div class="form-error">${icon("alert")}<span>Faltan ${fmtNum(n.falta)} pzas. Explica en comentarios por qué cierras el balance sin reponerlas.</span></div>`; return; }
    const payload = { action: f.action || null, related_po: f.related_po?.trim() || null, resolution_date: f.resolution_date || null, status: f.status, comments: f.comments?.trim() || null };
    if (!closed) { payload.ordered_qty = n.po; payload.delivered_qty = n.inv; }
    busy = true; $("#balSave", dlg).disabled = true;
    try { await saveCompensation(order.dbId, payload, bal.id); dlg.close(); toast("Seguimiento guardado."); await reload(); }
    catch (ex) { busy = false; $("#balSave", dlg).disabled = false; err.innerHTML = `<div class="form-error">${icon("alert")}<span>${esc(friendly(ex))}</span></div>`; }
  };
}

/* =========================================================
   Exportar evidencia (ZIP)
   ========================================================= */
let exporting = false;
async function exportZip(list, label, btn) {
  if (exporting) return;
  const jobs = list.flatMap(o => o.documents.map(doc => ({ o, doc })));
  if (!jobs.length) return toast("No hay archivos de evidencia para exportar.", "error");
  exporting = true; const original = btn?.innerHTML; if (btn) btn.disabled = true;
  const say = t => { if (btn) btn.textContent = t; };
  try {
    say("Preparando…");
    const { default: JSZip } = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
    const zip = new JSZip(), used = new Set(), failed = []; let done = 0;
    const queue = [...jobs];
    const worker = async () => {
      for (let job; (job = queue.shift());) {
        const { o, doc } = job;
        try {
          const res = await fetch(await getDocumentUrl(doc.storage_path));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const clean = String(doc.document_name || "archivo").replace(/[\\/:*?"<>|]/g, "-");
          const dot = clean.lastIndexOf("."), base = dot > 0 ? clean.slice(0, dot) : clean, ext = dot > 0 ? clean.slice(dot) : "";
          const dir = `${o.id}/${doc.task_code || "Evidencia"}`;
          let path = `${dir}/${clean}`, n = 1;
          while (used.has(path)) path = `${dir}/${base} (${++n})${ext}`;
          used.add(path); zip.file(path, await res.blob());
        } catch (e) { failed.push(`${o.id}/${doc.document_name}: ${e.message}`); }
        say(`Descargando ${++done}/${jobs.length}…`);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    if (failed.length) zip.file("ERRORES.txt", `No se pudieron descargar ${failed.length} archivo(s):\n\n${failed.join("\n")}\n`);
    say("Comprimiendo…");
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${label}-evidencia-${todayISO()}.zip`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    failed.length ? toast(`ZIP listo, pero ${failed.length} archivo(s) fallaron (ver ERRORES.txt).`, "error") : toast(`ZIP listo con ${jobs.length} archivo(s).`);
  } catch (e) { toast(`No se pudo exportar: ${friendly(e)}`, "error"); }
  finally { exporting = false; if (btn) { btn.innerHTML = original; btn.disabled = false; } }
}

boot();
