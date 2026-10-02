const TASKS = [
  ["Cotización MES a Cliente","01_Cotizacion_MES_Cliente"],
  ["PO Cliente a MES (MWS utilizará la PO directa de cliente)","02_PO_Cliente_MES"],
  ["PrePPAP Order Request MWS a MES","03_PrePPAP_Order_Request_MWS_MES"],
  ["PO MES a MWS","04_PO_MES_MWS"],
  ["Factura MWS a MES","05_Factura_MWS_MES"],
  ["Método de Envío","06_Metodo_de_Envio"],
  ["Monterrey a Cliente: Proceso de MES","07_Monterrey_Cliente"],
  ["MWS a Cliente: Guía de FedEx con Referencias (Número de parte + Propósito)","08_MWS_Cliente"],
  ["Factura MES a Cliente","09_Factura_MES_Cliente"]
];

const KEY="guvel_preppap_v2";
let state=JSON.parse(localStorage.getItem(KEY)||'{"orders":[]}');
let currentView="dashboard";

function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function money(n){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n)||0);}

function folderTree(order){
  return TASKS.map((t,i)=>`<div class="folder-row"><span class="folder-num">${String(i+1).padStart(2,"0")}</span><span class="folder-icon">▰</span><span>${esc(t[0])}</span><span class="folder-path">${esc(t[1])}</span></div>`).join("");
}

function renderDashboard(){
  const o=state.orders;
  const total=o.reduce((a,x)=>a+Number(x.poQty||0),0);
  const shipped=o.reduce((a,x)=>a+Number(x.shippedQty||0),0);
  const remaining=o.reduce((a,x)=>a+Math.max(Number(x.poQty||0)-Number(x.shippedQty||0),0),0);
  document.getElementById("app").innerHTML=`
    <div class="cards">
      <div class="card"><span>PrePPAP Orders</span><strong>${o.length}</strong></div>
      <div class="card"><span>PO Qty</span><strong>${total}</strong></div>
      <div class="card"><span>Shipped</span><strong>${shipped}</strong></div>
      <div class="card alert"><span>Pending / Compensation</span><strong>${remaining}</strong></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>Recent Orders</h2><button class="secondary" onclick="setView('orders')">View all</button></div>
      ${o.length?o.slice(-6).reverse().map(orderRow).join(""):'<div class="empty">No PrePPAP orders yet. Create the first one.</div>'}
    </div>`;
}

function orderRow(o){
  const rem=Math.max(Number(o.poQty||0)-Number(o.shippedQty||0),0);
  return `<div class="order-row">
    <div><b>${esc(o.reference)}</b><span>${esc(o.customer)} · ${esc(o.partNumber)}</span></div>
    <div class="qty">${o.poQty} pcs</div>
    <div class="${rem?'warning':'ok'}">${rem?rem+" pending":"Complete"}</div>
    <button class="link" onclick="showOrder('${o.id}')">Open</button>
  </div>`;
}

function renderOrders(){
  document.getElementById("app").innerHTML=`
    <div class="panel">
      <div class="panel-head"><h2>PrePPAP Orders</h2><button class="primary" onclick="openModal()">+ New PrePPAP</button></div>
      ${state.orders.length?state.orders.map(orderRow).join(""):'<div class="empty">No orders created.</div>'}
    </div>`;
}

function renderComp(){
  const rows=state.orders.map(o=>{
    const po=Number(o.poQty||0), ship=Number(o.shippedQty||0), rem=Math.max(po-ship,0);
    return `<div class="comp-row"><div><b>${esc(o.reference)}</b><span>${esc(o.customer)} · ${esc(o.partNumber)}</span></div>
      <div>PO <strong>${po}</strong></div><div>Shipped <strong>${ship}</strong></div>
      <div class="${rem?'warning':'ok'}">Remaining <strong>${rem}</strong></div>
      <button class="secondary" onclick="updateQty('${o.id}')">Update</button></div>`;
  }).join("");
  document.getElementById("app").innerHTML=`<div class="panel"><div class="panel-head"><h2>PO Balance & Compensation</h2></div>
  <div class="notice">GUVEL calculates the unfulfilled quantity from PO MES → MWS. A remaining quantity stays open until it is resolved by shipment, credit/compensation, or another defined action.</div>
  ${rows||'<div class="empty">No orders yet.</div>'}</div>`;
}

function showOrder(id){
  const o=state.orders.find(x=>x.id===id); if(!o)return;
  const rem=Math.max(Number(o.poQty||0)-Number(o.shippedQty||0),0);
  document.getElementById("pageTitle").textContent=o.reference;
  document.getElementById("app").innerHTML=`
    <button class="back" onclick="setView('orders')">← Back to Orders</button>
    <div class="hero"><div><div class="eyebrow">${esc(o.customer)}</div><h2>${esc(o.partNumber)}</h2><p>${esc(o.reference)} · PO ${o.poQty} pcs</p></div>
    <div class="hero-stat"><span>Remaining</span><strong class="${rem?'warning':'ok'}">${rem} pcs</strong></div></div>
    <div class="panel"><div class="panel-head"><h2>SharePoint Folder Structure</h2><span class="badge">READY TO SYNC</span></div>
      <div class="root-path">${esc(GUVEL_CONFIG.sharePoint.rootPath)}/${esc(o.folderName)}</div>
      ${folderTree(o)}
    </div>
    <div class="panel"><div class="panel-head"><h2>Order Data</h2></div>
      <div class="detail-grid">
        <div><span>Customer</span><b>${esc(o.customer)}</b></div>
        <div><span>Part Number</span><b>${esc(o.partNumber)}</b></div>
        <div><span>PO Qty</span><b>${o.poQty}</b></div>
        <div><span>Shipped Qty</span><b>${o.shippedQty}</b></div>
        <div><span>Due Date</span><b>${esc(o.dueDate||"-")}</b></div>
        <div><span>Created</span><b>${new Date(o.createdAt).toLocaleString()}</b></div>
      </div>
      <div class="actions"><button class="secondary" onclick="updateQty('${o.id}')">Update Shipment Qty</button>
      <button class="danger" onclick="deleteOrder('${o.id}')">Delete Order</button></div>
    </div>`;
}

function updateQty(id){
  const o=state.orders.find(x=>x.id===id); if(!o)return;
  const v=prompt("Shipped quantity for "+o.reference, o.shippedQty||0);
  if(v===null)return;
  const n=Math.max(0,Number(v)||0);
  o.shippedQty=n;
  if(n < Number(o.poQty||0)){
    o.compensation={status:"OPEN",remaining:Number(o.poQty||0)-n};
  }else{o.compensation={status:"RESOLVED",remaining:0};}
  save(); render();
}

function deleteOrder(id){
  if(!confirm("Delete this PrePPAP order from the DEMO database?"))return;
  state.orders=state.orders.filter(x=>x.id!==id); save(); render();
}

function openModal(){
  document.getElementById("newTasks").innerHTML=TASKS.map((t,i)=>`<label class="check"><input type="checkbox" checked disabled><span>${i+1}. ${esc(t[0])}</span></label>`).join("");
  document.getElementById("modal").classList.remove("hidden");
}
function closeModal(){document.getElementById("modal").classList.add("hidden");}
function createOrder(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const ref=f.get("reference").trim(), customer=f.get("customer").trim(), part=f.get("partNumber").trim();
  const folder=f.get("folderName").trim() || `${ref} | ${customer} | ${part}`;
  const o={id:crypto.randomUUID(),reference:ref,customer,partNumber:part,poQty:Number(f.get("poQty")||0),shippedQty:0,dueDate:f.get("dueDate"),folderName:folder,notes:f.get("notes"),createdAt:new Date().toISOString(),compensation:{status:"OPEN",remaining:Number(f.get("poQty")||0)}};
  state.orders.push(o);save();closeModal();e.target.reset();showOrder(o.id);
}
function setView(v){currentView=v;render();}
function render(){
  document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===currentView));
  document.getElementById("pageTitle").textContent=currentView==="dashboard"?"Dashboard":currentView==="orders"?"PrePPAP Orders":"Compensation";
  currentView==="dashboard"?renderDashboard():currentView==="orders"?renderOrders():renderComp();
}
document.querySelectorAll(".nav").forEach(x=>x.onclick=()=>setView(x.dataset.view));
document.getElementById("newOrderBtn").onclick=openModal;
document.getElementById("closeModal").onclick=closeModal;
document.getElementById("cancelModal").onclick=closeModal;
document.getElementById("orderForm").onsubmit=createOrder;
render();