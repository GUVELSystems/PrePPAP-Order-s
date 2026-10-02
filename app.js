import { CONFIG } from "./config.js";
import { taskDefinitions, folderDefinitions } from "./data.js";
import { getSession, signIn, signOut, signUp, listOrders, createOrder, updateCompensation, getDocumentUrl, uploadDocument } from "./supabase_api.js";

const app=document.querySelector("#app");
let orders=[], selectedId=null, view="dashboard", session=null;

const esc=v=>String(v??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]));
const bal=o=>({ship:Math.max(0,(+o.qtyRequested||0)-(+o.qtyShipped||0)),invoice:Math.max(0,(+o.qtyRequested||0)-(+o.qtyInvoiced||0))});
const stat=o=>{const b=bal(o);return b.ship===0&&b.invoice===0?"Completed":(+o.qtyShipped||0)>0||(+o.qtyInvoiced||0)>0?"In Progress":"Not Started"};
const pill=s=>`<span class="pill ${String(s).toLowerCase().replaceAll(" ","-")}">${esc(s)}</span>`;
const nav=(id,t,i)=>`<button class="nav ${view===id?"active":""}" data-nav="${id}"><span>${i}</span>${t}</button>`;

async function boot(){
  if(CONFIG.DEMO_MODE){ showLogin("Demo mode is disabled in this migration package."); return; }
  try{ session=await getSession(); }catch(e){ showError(e.message); return; }
  if(!session){ showLogin(); return; }
  await refresh();
}
async function refresh(){
  try{
    orders=await listOrders();
    selectedId=selectedId && orders.some(o=>o.id===selectedId)?selectedId:(orders[0]?.id||null);
    render();
  }catch(e){ showError(e.message); }
}
function showError(msg){ app.innerHTML=`<div class="panel error"><h2>GUVEL connection error</h2><p>${esc(msg)}</p><p>Check <b>config.js</b>, Supabase SQL/RLS and your logged-in user.</p></div>`; }
function showLogin(message=""){
  app.innerHTML=`<div class="login-wrap"><section class="panel login"><div class="brandmark">G</div><small>GUVEL SYSTEMS</small><h1>PrePPAP Tracker</h1><p>${esc(message||"Sign in to access the PrePPAP database.")}</p><form id="loginForm"><label>Email<input name="email" type="email" required></label><label>Password<input name="password" type="password" required></label><button class="primary">Sign in</button></form><button class="link" id="signup">Create account</button><div id="loginMsg"></div></section></div>`;
  document.querySelector("#loginForm").onsubmit=async e=>{
    e.preventDefault(); const f=new FormData(e.target); const msg=document.querySelector("#loginMsg");
    try{await signIn(f.get("email"),f.get("password")); session=await getSession(); await refresh();}
    catch(err){msg.textContent=err.message;}
  };
  document.querySelector("#signup").onclick=async()=>{
    const email=prompt("Email"); const password=prompt("Password (minimum 6 characters)");
    if(!email||!password)return;
    try{await signUp(email,password);alert("Account created. If email confirmation is enabled in Supabase, confirm the email and then sign in.");}
    catch(err){alert(err.message);}
  };
}
function render(){
  app.innerHTML=`<div class="shell"><aside><div class="brand"><b>G</b><div><strong>GUVEL</strong><small>PrePPAP</small></div></div><nav>${nav("dashboard","Dashboard","▦")}${nav("orders","PrePPAP Orders","◫")}${nav("tasks","Tasks","✓")}${nav("balances","PO Balance","↔")}${nav("shipments","Shipments","⌁")}</nav><div class="sidefoot"><small>SUPABASE</small><button id="auth">Sign out</button></div></aside><main><header><div><small>GUVEL SYSTEMS</small><h1>${({dashboard:"PrePPAP Control",orders:"PrePPAP Orders",tasks:"Task Tracker",balances:"PO Balance & Compensation",shipments:"Shipment Control"})[view]}</h1></div><div class="actions"><span class="connection"><i></i>Supabase</span><button class="primary" id="new">+ New PrePPAP</button></div></header><section class="content">${content()}</section></main></div>`;
  bind();
}
function content(){if(view==="dashboard")return dashboard();if(view==="orders")return ordersPage();if(view==="tasks")return tasksPage();if(view==="balances")return balancesPage();return shipmentsPage();}
function dashboard(){
 const c=orders.filter(o=>stat(o)==="Completed").length,q=orders.reduce((s,o)=>s+bal(o).ship,0),i=orders.reduce((s,o)=>s+bal(o).invoice,0),b=orders.reduce((s,o)=>s+(o.balances||[]).filter(x=>x.status!=="Closed").length,0);
 return `<div class="metrics"><div><small>Total Orders</small><strong>${orders.length}</strong><em>All PrePPAP orders</em></div><div><small>Completed</small><strong>${c}</strong><em>No quantity balance</em></div><div><small>Open Ship Qty</small><strong>${q}</strong><em>Pieces remaining</em></div><div><small>Open Compensation</small><strong>${b}</strong><em>Balance records</em></div></div><div class="twocol"><section class="panel"><div class="head"><div><h2>Active Orders</h2><p>Commercial and shipment flow</p></div><button class="link" data-nav="orders">View all →</button></div>${orders.slice(0,5).map(row).join("")||`<div class="empty">No PrePPAP orders yet.</div>`}</section><section class="panel"><div class="head"><div><h2>Control Rules</h2><p>V2 operating logic</p></div></div>${[["01","Every order has a unique PrePPAP ID and Storage folder."],["02","Partial POs create an explicit remaining quantity."],["03","An order is not complete while quantity remains."],["04","MWS → Customer requires FedEx + Part Number + Purpose." ]].map(x=>`<div class="rule"><b>${x[0]}</b><span>${x[1]}</span></div>`).join("")}</section></div>`;
}
function row(o){const b=bal(o);return `<button class="orderrow" data-order="${esc(o.id)}"><div><b>${esc(o.id)}</b><span>${esc(o.customer)} · ${esc(o.partNumber)}</span></div><strong>${o.qtyRequested} pcs ${b.ship?`<small>· ${b.ship} open</small>`:""}</strong><div>${pill(stat(o))}</div></button>`;}
function ordersPage(){return `<div class="toolbar"><input id="search" placeholder="Search PrePPAP, customer, part number..."><select id="filter"><option>All Status</option><option>Completed</option><option>In Progress</option><option>Not Started</option></select></div><section class="panel table"><table><thead><tr><th>PrePPAP</th><th>Customer</th><th>Part</th><th>Purpose</th><th>Qty</th><th>Open</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table></section>${selectedId?detail(orders.find(x=>x.id===selectedId)):``}`;}
function fill(){const body=document.querySelector("#rows");if(!body)return;const s=document.querySelector("#search")?.value||"",f=document.querySelector("#filter")?.value||"All Status";body.innerHTML=orders.filter(o=>[o.id,o.customer,o.partNumber,o.purpose].join(" ").toLowerCase().includes(s.toLowerCase())&&(f==="All Status"||stat(o)===f)).map(o=>{const b=bal(o);return `<tr data-order="${esc(o.id)}"><td><b>${esc(o.id)}</b></td><td>${esc(o.customer)}</td><td>${esc(o.partNumber)}</td><td>${esc(o.purpose)}</td><td>${o.qtyRequested}</td><td class="${b.ship?"red":""}">${b.ship}</td><td>${pill(stat(o))}</td></tr>`}).join("")||`<tr><td colspan="7" class="empty">No orders found.</td></tr>`;}
function detail(o){
 if(!o)return "";
 const b=bal(o);
 return `<section class="panel detail"><div class="detailhead"><div><small>${esc(o.id)}</small><h2>${esc(o.customer)} · ${esc(o.partNumber)}</h2><p>${esc(o.purpose)} · Required ${esc(o.requiredDate||"—")}</p></div><div>${pill(stat(o))}</div></div><div class="qtygrid"><div><small>Requested</small><b>${o.qtyRequested} pcs</b></div><div><small>Shipped</small><b>${o.qtyShipped} pcs</b></div><div class="${b.ship?"warn":""}"><small>Remaining to Ship</small><b>${b.ship} pcs</b></div><div class="${b.invoice?"warn":""}"><small>Remaining to Invoice</small><b>${b.invoice} pcs</b></div></div><div class="detailcols"><div><h3>Workflow</h3>${taskDefinitions.map(t=>{const task=o.tasks?.find(x=>x.task_code===t[0]);return `<div class="taskline"><span class="check ${task?.status==="Completed"?"done":""}">${task?.status==="Completed"?"✓":"○"}</span><span>${t[1]}</span><small>${t[2]} → ${t[3]}</small></div>`}).join("")}</div><div><h3>Documents</h3><div class="doc-actions"><input type="file" id="docFile" hidden><button class="secondary" id="uploadBtn">Upload document</button></div>${(o.documents||[]).map(x=>`<button class="doc" data-doc="${esc(x.storage_path)}"><span>▣</span>${esc(x.document_name)}<em>↗</em></button>`).join("")||`<div class="empty">No documents uploaded.</div>`}</div></div>${b.ship?`<div class="alert"><b>⚠ ${b.ship} pc pending.</b> Go to PO Balance to define the compensation action.</div>`:""}<div class="detail-actions"><span>Storage: ${esc(o.folderPath||"PrePPAP")}</span></div></section>`;
}
function tasksPage(){return `<section class="panel table"><table><thead><tr><th>PrePPAP</th><th>Task</th><th>From</th><th>To</th><th>Due</th><th>Status</th></tr></thead><tbody>${orders.flatMap(o=>(o.tasks||[]).map(t=>`<tr><td><b>${esc(o.id)}</b></td><td>${esc(t.task_name)}</td><td>${esc(t.from_party)}</td><td>${esc(t.to_party)}</td><td>${esc(t.due_date||"—")}</td><td>${pill(t.status)}</td></tr>`)).join("")||`<tr><td colspan="6" class="empty">No tasks.</td></tr>`}</tbody></table></section>`;}
function balancesPage(){return `<div class="balancebar"><div><h2>PO Balance & Compensation</h2><p>Every quantity mismatch must have an explicit disposition.</p></div><button class="primary" id="addBalance">+ Add Compensation</button></div><section class="panel table"><table><thead><tr><th>PrePPAP</th><th>PO</th><th>Ordered</th><th>Delivered</th><th>Remaining</th><th>Action</th><th>Related PO</th><th>Resolution</th><th>Status</th><th></th></tr></thead><tbody>${orders.flatMap(o=>(o.balances||[]).map((x,i)=>`<tr><td><b>${esc(o.id)}</b></td><td>${esc(x.po_number)}</td><td>${x.ordered_qty}</td><td>${x.delivered_qty}</td><td class="red"><b>${Math.max(0,x.ordered_qty-x.delivered_qty)}</b></td><td>${esc(x.action||"—")}</td><td>${esc(x.related_po||"—")}</td><td>${esc(x.resolution_date||"—")}</td><td>${pill(x.status||"Open")}</td><td><button class="mini" data-edit-balance="${esc(o.id)}" data-bi="${i}">Edit</button></td></tr>`)).join("")||`<tr><td colspan="10" class="empty">No compensation records.</td></tr>`}</tbody></table></section><div class="panel explainer"><b>Example:</b> MES PO = 5 pcs, delivered = 4 pcs → Remaining = <strong>1 pc</strong>.</div>`;}
function shipmentsPage(){return `<section class="panel table"><table><thead><tr><th>PrePPAP</th><th>Method</th><th>Part</th><th>Purpose</th><th>Qty</th><th>FedEx</th><th>References</th></tr></thead><tbody>${orders.map(o=>`<tr><td><b>${esc(o.id)}</b></td><td>${esc(o.shippingMethod||"")}</td><td>${esc(o.partNumber)}</td><td>${esc(o.purpose)}</td><td>${o.qtyShipped}</td><td>${esc(o.fedex||"—")}</td><td>${o.shippingMethod==="MWS → Customer"?esc(o.partNumber)+" · "+esc(o.purpose):"MES process"}</td></tr>`).join("")||`<tr><td colspan="7" class="empty">No shipments.</td></tr>`}</tbody></table></section>`;}

function modal(html){document.body.insertAdjacentHTML("beforeend",`<div class="modalbg" id="modal"><div class="modal">${html}</div></div>`);document.querySelectorAll("#modal .close").forEach(x=>x.addEventListener("click",()=>document.querySelector("#modal").remove()));}
function newOrder(){
 modal(`<div class="modalhead"><div><small>NEW RECORD</small><h2>Create PrePPAP Order</h2></div><button class="close">×</button></div><form id="orderForm"><div class="formgrid"><label>Customer<input name="customer" required></label><label>Part Number<input name="partNumber" required></label><label>Revision<input name="revision"></label><label>Purpose<select name="purpose"><option>Prototype</option><option>Validation</option><option>Pre-Production</option><option>PPAP</option><option>Sample</option><option>Other</option></select></label><label>Request Date<input name="requestDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Required Date<input name="requiredDate" type="date"></label><label>Qty Requested<input name="qtyRequested" type="number" min="0" required></label><label>Priority<select name="priority"><option>Normal</option><option>Low</option><option>High</option><option>Critical</option></select></label><label>Owner<select name="owner"><option>Quality</option><option>Engineering</option><option>Purchasing</option><option>Logistics</option><option>Finance</option><option>MES</option><option>MWS</option></select></label><label>Shipping Method<select name="shippingMethod"><option>Monterrey → Customer</option><option>MWS → Customer</option></select></label><label>Customer PO #<input name="customerPO"></label><label>Customer PO Qty<input name="customerPOQty" type="number" min="0"></label><label>PrePPAP Request #<input name="prePPAPRequest"></label><label>MES PO #<input name="mesPO"></label><label>MES PO Qty<input name="mesPOQty" type="number" min="0"></label><label>MWS Invoice #<input name="mwsInvoice"></label><label>MWS Invoice Qty<input name="mwsInvoiceQty" type="number" min="0"></label><label>FedEx / Tracking<input name="fedex"></label><label>Qty Shipped<input name="qtyShipped" type="number" min="0" value="0"></label><label>Qty Invoiced<input name="qtyInvoiced" type="number" min="0" value="0"></label><label class="full">Comments<textarea name="comments"></textarea></label></div><div class="modalactions"><button type="button" class="secondary close">Cancel</button><button class="primary">Create Order</button></div></form></div>`);
 document.querySelector("#orderForm").onsubmit=async e=>{
  e.preventDefault();const f=Object.fromEntries(new FormData(e.target));
  try{await createOrder(f);document.querySelector("#modal").remove();await refresh();view="orders";render();}
  catch(err){alert(err.message);}
 };
}
function balanceModal(order,idx=-1){
 const x=idx>=0?order.balances[idx]:{po_type:"MES PO to MWS",po_number:order.mesPO||"",ordered_qty:order.mesPOQty||0,delivered_qty:order.qtyShipped||0,action:"",related_po:"",resolution_date:"",status:"Open",comments:""};
 modal(`<div class="modalhead"><div><small>${esc(order.id)}</small><h2>${idx>=0?"Edit":"Add"} Compensation</h2></div><button class="close">×</button></div><form id="balanceForm"><div class="formgrid"><label>PO Type<select name="po_type"><option>MES PO to MWS</option><option>Customer PO to MES</option><option>Other</option></select></label><label>PO Number<input name="po_number" value="${esc(x.po_number)}"></label><label>Ordered Qty<input name="ordered_qty" type="number" min="0" value="${x.ordered_qty}" required></label><label>Delivered / Shipped Qty<input name="delivered_qty" type="number" min="0" value="${x.delivered_qty}" required></label><label class="full">Compensation Action<select name="action"><option value="">Select action</option><option>Ship with next PrePPAP order</option><option>Ship separately</option><option>Credit</option><option>Cancel</option><option>Transfer to another PO</option></select></label><label>Related PO<input name="related_po" value="${esc(x.related_po)}"></label><label>Resolution Date<input name="resolution_date" type="date" value="${esc(x.resolution_date)}"></label><label>Status<select name="status"><option>Open</option><option>Partial</option><option>Closed</option></select></label><label class="full">Comments<textarea name="comments">${esc(x.comments)}</textarea></label></div><div class="balancepreview">Remaining quantity: <strong id="remainingPreview">${Math.max(0,(x.ordered_qty||0)-(x.delivered_qty||0))} pcs</strong></div><div class="modalactions"><button type="button" class="secondary close">Cancel</button><button class="primary">Save Compensation</button></div></form></div>`);
 const form=document.querySelector("#balanceForm"), update=()=>{document.querySelector("#remainingPreview").textContent=Math.max(0,(+form.ordered_qty.value||0)-(+form.delivered_qty.value||0))+" pcs"};
 form.ordered_qty.oninput=update;form.delivered_qty.oninput=update;
 form.onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(form));f.ordered_qty=+f.ordered_qty;f.delivered_qty=+f.delivered_qty;if(f.ordered_qty===f.delivered_qty)f.status="Closed";try{await updateCompensation(order.dbId,idx,f,idx>=0?order.balances[idx].id:null);document.querySelector("#modal").remove();await refresh();view="balances";render();}catch(err){alert(err.message);}};
}
function bind(){
 document.querySelectorAll("[data-nav]").forEach(x=>x.onclick=()=>{view=x.dataset.nav;render()});
 document.querySelectorAll("[data-order]").forEach(x=>x.onclick=()=>{selectedId=x.dataset.order;view="orders";render()});
 document.querySelector("#new")?.addEventListener("click",newOrder);
 document.querySelector("#auth")?.addEventListener("click",async()=>{await signOut();session=null;showLogin()});
 document.querySelector("#search")?.addEventListener("input",fill);
 document.querySelector("#filter")?.addEventListener("change",fill);
 fill();
 document.querySelector("#addBalance")?.addEventListener("click",()=>{const o=orders.find(x=>x.id===selectedId)||orders[0];if(o)balanceModal(o)});
 document.querySelectorAll("[data-edit-balance]").forEach(x=>x.onclick=()=>{const o=orders.find(a=>a.id===x.dataset.editBalance);balanceModal(o,+x.dataset.bi)});
 document.querySelector("#uploadBtn")?.addEventListener("click",()=>document.querySelector("#docFile").click());
 document.querySelector("#docFile")?.addEventListener("change",async e=>{
   const file=e.target.files[0]; if(!file)return; const o=orders.find(x=>x.id===selectedId); if(!o)return;
   try{await uploadDocument(o.dbId,"09_Factura_MES_Cliente",file,o.folderPath);alert("Document uploaded.");await refresh();view="orders";render();}catch(err){alert(err.message);}
 });
 document.querySelectorAll("[data-doc]").forEach(x=>x.onclick=async()=>{try{window.open(await getDocumentUrl(x.dataset.doc),"_blank");}catch(e){alert(e.message);}});
}
boot();
