import { supabase } from "./supabase.js";
import { CONFIG } from "./config.js";
import { GATES, gateByCode, SHIPPING } from "./data.js";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const num = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

/* ---------- Errores legibles ---------- */
export function friendly(e) {
  const m = String(e?.message || e || "");
  if (/PREPPAP_EVIDENCE_REQUIRED/i.test(m)) return "La etapa necesita al menos un archivo de evidencia antes de completarse.";
  if (/ambiguous/i.test(m) && /shipping_method/i.test(m)) return "La base de datos tiene el trigger antiguo de V9. Ejecuta db/migration_v10.sql en Supabase.";
  if (/invalid key|invalid characters/i.test(m)) return "El nombre del archivo o de la carpeta contiene caracteres que Storage no acepta.";
  if (/row-level security|violates row-level|not authorized|permission denied/i.test(m)) return "Tu usuario no tiene permiso para esta acción (revisa las políticas RLS).";
  if (/jwt|token.*expired|not authenticated/i.test(m)) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (/failed to fetch|networkerror|load failed/i.test(m)) return "No hay conexión con Supabase. Revisa tu red e inténtalo de nuevo.";
  if (/duplicate key.*order_number/i.test(m)) return "El número de PrePPAP ya existe. Ejecuta db/migration_v10.sql y vuelve a intentarlo.";
  return m || "Ocurrió un error inesperado.";
}
export const isAuthError = e => /jwt|token.*expired|not authenticated|invalid refresh/i.test(String(e?.message || e || ""));

/* ---------- Sesión ---------- */
export async function getSession() { const { data, error } = await supabase.auth.getSession(); if (error) throw error; return data.session; }
export async function signIn(email, password) { const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; return data.session; }
export async function signOut() { await supabase.auth.signOut(); }
export const onAuthChange = cb => supabase.auth.onAuthStateChange((event, session) => cb(event, session));

/* ---------- Lectura ---------- */
// PostgREST devuelve máximo 1000 filas por consulta: paginamos para no perder datos.
async function fetchAll(table, newestFirst = false) {
  const size = 1000; let from = 0; const out = [];
  for (;;) {
    const { data, error } = await supabase.from(table).select("*")
      .order("created_at", { ascending: !newestFirst }).order("id").range(from, from + size - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < size) break;
    from += size;
  }
  return out;
}
const groupBy = (rows, key) => { const m = new Map(); for (const r of rows) { const k = r[key]; (m.get(k) || m.set(k, []).get(k)).push(r); } return m; };

export async function listOrders() {
  const [orders, tasks, balances, docs] = await Promise.all([
    fetchAll("preppap_orders", true), fetchAll("preppap_tasks"), fetchAll("preppap_compensations"), fetchAll("preppap_documents")
  ]);
  const T = groupBy(tasks, "order_id"), B = groupBy(balances, "order_id"), D = groupBy(docs, "order_id");
  return orders.map(o => ({
    ...o,
    id: o.order_number, dbId: o.id,
    qtyRequested: num(o.qty_requested), qtyShipped: num(o.qty_shipped), qtyInvoiced: num(o.qty_invoiced),
    mesPOQty: num(o.mes_po_qty), mwsInvoiceQty: num(o.mws_invoice_qty),
    tasks: T.get(o.id) || [], balances: B.get(o.id) || [], documents: D.get(o.id) || []
  }));
}

/* ---------- Nombres seguros para Storage ---------- */
const stripAccents = s => String(s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
export const slug = (s, max = 60) => stripAccents(s).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-._]+|[-._]+$/g, "").slice(0, max);
export function safeFileName(name) {
  const raw = stripAccents(name || "file"); const dot = raw.lastIndexOf(".");
  const base = (dot > 0 ? raw.slice(0, dot) : raw).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^[_.-]+|[_.-]+$/g, "").slice(0, 100) || "file";
  const ext = dot > 0 ? raw.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").slice(0, 10) : "";
  return ext ? `${base}.${ext}` : base;
}
const rand = () => (crypto.randomUUID?.() || Math.random().toString(16).slice(2)).replace(/-/g, "").slice(0, 8);

/* ---------- Órdenes ---------- */
export async function createOrder(input) {
  const { data: u } = await supabase.auth.getUser(); const user = u?.user;
  if (!user) throw new Error("Not authenticated");
  const { data: orderNumber, error: re } = await supabase.rpc("next_preppap_order_number"); if (re) throw re;
  const folderPath = [orderNumber, input.customer, input.partNumber].map(s => slug(s)).filter(Boolean).join("-");
  const { data: order, error } = await supabase.from("preppap_orders").insert({
    order_number: orderNumber, customer: input.customer.trim(), part_number: input.partNumber.trim(),
    revision: input.revision?.trim() || null, purpose: input.purpose,
    request_date: input.requestDate || null, required_date: input.requiredDate || null,
    qty_requested: num(input.qtyRequested), priority: input.priority, owner: input.owner,
    shipping_method: input.shippingMethod, folder_path: folderPath, created_by: user.id
  }).select().single();
  if (error) throw error;
  try {
    const auto = input.shippingMethod === SHIPPING.MTY, now = new Date().toISOString();
    const rows = GATES.map(g => {
      const done = g.code === "Shipment" && auto;
      return { order_id: order.id, task_code: g.code, task_name: g.name, from_party: g.from, to_party: g.to,
        status: done ? "Completed" : "Not Started", completed_at: done ? now : null, due_date: input.requiredDate || null };
    });
    const { error: te } = await supabase.from("preppap_tasks").insert(rows); if (te) throw te;
  } catch (e) { await supabase.from("preppap_orders").delete().eq("id", order.id); throw e; }
  // Las "carpetas" de Storage son solo cosméticas: si fallan, la orden sigue siendo válida.
  await Promise.allSettled(GATES.map(g => supabase.storage.from(CONFIG.STORAGE_BUCKET)
    .upload(`${folderPath}/${g.folder}/.keep`, new Blob(["GUVEL PREPPAP FOLDER"], { type: "text/plain" }), { upsert: true, contentType: "text/plain" })));
  return orderNumber;
}
export async function setOrderStatus(dbId, status) {
  const { error } = await supabase.from("preppap_orders").update({ status }).eq("id", dbId); if (error) throw error;
}

/* ---------- Evidencia ---------- */
export function validateFile(file) {
  if (!file) throw new Error("Selecciona un archivo.");
  if (file.size === 0) throw new Error("El archivo está vacío.");
  if (file.size > MAX_FILE_BYTES) throw new Error(`Supera el máximo de 2 MB (pesa ${(file.size / 1048576).toFixed(2)} MB).`);
}
export async function uploadDocument(order, gate, file) {
  validateFile(file);
  const path = `${order.folder_path}/${gate.folder}/${Date.now()}_${rand()}_${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from(CONFIG.STORAGE_BUCKET).upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (error) {
    // El archivo ya pasó nuestra validación de 2 MB: si Storage lo rechaza por tamaño, el límite está en el bucket.
    if (/exceeded|too large|maximum allowed/i.test(error.message || ""))
      throw new Error(`Supabase rechazó el archivo (${(file.size / 1024).toFixed(0)} KB) por el límite de tamaño del bucket, que es menor a 2 MB. Ejecuta db/migration_v10.sql en el SQL Editor de Supabase.`);
    throw error;
  }
  const { data: u } = await supabase.auth.getUser();
  const { data, error: de } = await supabase.from("preppap_documents").insert({
    order_id: order.dbId, task_code: gate.folder, document_name: file.name, storage_path: path,
    content_type: file.type || null, size_bytes: file.size, uploaded_by: u?.user?.id || null
  }).select().single();
  if (de) { await supabase.storage.from(CONFIG.STORAGE_BUCKET).remove([path]); throw de; }
  return data;
}
export async function deleteDocument(doc) {
  // Primero la fila: si Storage falla queda un archivo huérfano (inofensivo), nunca una fila rota.
  const { error } = await supabase.from("preppap_documents").delete().eq("id", doc.id); if (error) throw error;
  const { error: se } = await supabase.storage.from(CONFIG.STORAGE_BUCKET).remove([doc.storage_path]);
  if (se) console.warn("Storage no pudo borrar el archivo", doc.storage_path, se);
}
export async function getDocumentUrl(path) {
  const { data, error } = await supabase.storage.from(CONFIG.STORAGE_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error; return data.signedUrl;
}

/* ---------- Etapas ---------- */
const taskOf = (order, code) => order.tasks.find(t => t.task_code === code);
async function updateTask(id, payload) {
  const { data, error } = await supabase.from("preppap_tasks").update(payload).eq("id", id).select().single();
  if (error) throw error; return data;
}

// Escribe en la orden los datos capturados en la etapa y sincroniza el balance.
async function applyGateData(order, gate, v) {
  const patch = {};
  if (gate.refCol) patch[gate.refCol] = (v.reference || "").trim() || null;
  if (gate.qtyCol && v.qty !== "" && v.qty != null) patch[gate.qtyCol] = num(v.qty);
  if (gate.reconcile) patch.mes_po_qty = num(v.mesPOQty);
  if (Object.keys(patch).length) {
    const { error } = await supabase.from("preppap_orders").update(patch).eq("id", order.dbId); if (error) throw error;
  }
  if (gate.reconcile) await syncCompensation(order, num(v.mesPOQty), num(v.qty));
}

// Crea/actualiza el registro de balance solo si PO y factura difieren; lo cierra si ya coinciden.
async function syncCompensation(order, poQty, invQty) {
  const { data: rows, error } = await supabase.from("preppap_compensations").select("id,status")
    .eq("order_id", order.dbId).in("status", ["Open", "Partial"]).order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  const existing = rows?.[0], diff = Math.abs(poQty - invQty);
  const base = { po_type: invQty < poQty ? "PO vs Invoice" : "Invoice vs PO", po_number: order.mes_po || null, ordered_qty: poQty, delivered_qty: invQty };
  let res;
  if (diff > 0) {
    res = existing
      ? await supabase.from("preppap_compensations").update(base).eq("id", existing.id)
      : await supabase.from("preppap_compensations").insert({ ...base, order_id: order.dbId, status: "Open",
          comments: `Generado al completar la factura de Metrics Works. PO: ${poQty} pzas, factura: ${invQty} pzas, diferencia: ${diff} pzas.` });
  } else if (existing) {
    res = await supabase.from("preppap_compensations").update({ ...base, status: "Closed" }).eq("id", existing.id);
  }
  if (res?.error) throw res.error;
}

export async function completeGate(order, gate, v) {
  const task = taskOf(order, gate.code); if (!task) throw new Error("La etapa no existe para esta orden.");
  const optional = gate.code === "Shipment" && order.shipping_method === SHIPPING.MTY;
  if (!optional) {
    const { count, error } = await supabase.from("preppap_documents").select("id", { count: "exact", head: true })
      .eq("order_id", order.dbId).eq("task_code", gate.folder);
    if (error) throw error;
    if (!count) throw new Error("PREPPAP_EVIDENCE_REQUIRED");
  }
  await updateTask(task.id, { status: "Completed", completed_at: new Date().toISOString(), reference: v.reference?.trim() || null, details: v.details?.trim() || null });
  try { await applyGateData(order, gate, v); }
  catch (e) { await updateTask(task.id, { status: "In Progress", completed_at: null }).catch(() => {}); throw e; }
}
export async function saveGate(order, gate, v) {
  const task = taskOf(order, gate.code);
  await updateTask(task.id, { reference: v.reference?.trim() || null, details: v.details?.trim() || null });
  await applyGateData(order, gate, v);
}
export async function reopenGate(order, gate) {
  await updateTask(taskOf(order, gate.code).id, { status: "In Progress", completed_at: null });
}

/* ---------- Balances ---------- */
export async function saveCompensation(orderDbId, payload, id) {
  const res = id
    ? await supabase.from("preppap_compensations").update(payload).eq("id", id)
    : await supabase.from("preppap_compensations").insert({ ...payload, order_id: orderDbId });
  if (res.error) throw res.error;
}
