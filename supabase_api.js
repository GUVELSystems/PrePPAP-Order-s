import { supabase } from "./supabase.js";
import { CONFIG } from "./config.js";
import { taskDefinitions, folderDefinitions } from "./data.js";

export const MAX_FILE_BYTES=50*1024;
const n=v=>Number(v||0);

export async function getSession(){const {data,error}=await supabase.auth.getSession();if(error)throw error;return data.session;}
export async function signIn(email,password){const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;return data.session;}
export async function signOut(){await supabase.auth.signOut();}

export async function listOrders(){
  const {data,error}=await supabase.from("preppap_orders").select("*").order("created_at",{ascending:false});
  if(error)throw error;if(!data?.length)return [];
  const ids=data.map(x=>x.id);
  const [{data:tasks,error:te},{data:balances,error:be},{data:docs,error:de}]=await Promise.all([
    supabase.from("preppap_tasks").select("*").in("order_id",ids),
    supabase.from("preppap_compensations").select("*").in("order_id",ids),
    supabase.from("preppap_documents").select("*").in("order_id",ids)
  ]);
  if(te)throw te;if(be)throw be;if(de)throw de;
  return data.map(mapOrder(tasks||[],balances||[],docs||[]));
}
const mapOrder=(tasks,balances,docs)=>(o)=>({
  ...o,id:o.order_number,dbId:o.id,qtyRequested:n(o.qty_requested),qtyShipped:n(o.qty_shipped),
  qtyInvoiced:n(o.qty_invoiced),customerPOQty:n(o.customer_po_qty),mesPOQty:n(o.mes_po_qty),
  mwsInvoiceQty:n(o.mws_invoice_qty),customerPO:o.customer_po,prePPAPRequest:o.preppap_request,
  mesPO:o.mes_po,mwsInvoice:o.mws_invoice,shippingMethod:o.shipping_method,requiredDate:o.required_date,
  requestDate:o.request_date,folderPath:o.folder_path,balances:balances.filter(x=>x.order_id===o.id),
  tasks:tasks.filter(x=>x.order_id===o.id),documents:docs.filter(x=>x.order_id===o.id)
});

export async function createOrder(input){
  const {data:userData}=await supabase.auth.getUser();const user=userData.user;if(!user)throw new Error("You must sign in first.");
  const {data:rpcOrder,error:rpcError}=await supabase.rpc("next_preppap_order_number");if(rpcError)throw rpcError;
  const orderNumber=rpcOrder,folderPath=storageOrderFolder(orderNumber,input.customer,input.partNumber);
  const payload={order_number:orderNumber,customer:input.customer,part_number:input.partNumber,revision:input.revision||null,
    purpose:input.purpose,request_date:input.requestDate||null,required_date:input.requiredDate||null,qty_requested:n(input.qtyRequested),
    qty_shipped:n(input.qtyShipped),qty_invoiced:n(input.qtyInvoiced),priority:input.priority,owner:input.owner,
    shipping_method:input.shippingMethod,customer_po:input.customerPO||null,customer_po_qty:n(input.customerPOQty),
    preppap_request:input.prePPAPRequest||null,mes_po:input.mesPO||null,mes_po_qty:n(input.mesPOQty),
    mws_invoice:input.mwsInvoice||null,mws_invoice_qty:n(input.mwsInvoiceQty),fedex:input.fedex||null,
    folder_path:folderPath,comments:input.comments||null,created_by:user.id};
  const {data:order,error}=await supabase.from("preppap_orders").insert(payload).select().single();if(error)throw error;
  try{
    const taskRows=taskDefinitions.map(t=>({order_id:order.id,task_code:t[0],task_name:t[1],from_party:t[2],to_party:t[3],status:"Not Started",due_date:input.requiredDate||null}));
    const {error:taskError}=await supabase.from("preppap_tasks").insert(taskRows);if(taskError)throw taskError;
    if(n(input.mesPOQty)>n(input.qtyShipped)){
      const {error:e}=await supabase.from("preppap_compensations").insert({order_id:order.id,po_type:"MES PO to MWS",po_number:input.mesPO||null,
        ordered_qty:n(input.mesPOQty),delivered_qty:n(input.qtyShipped),status:"Open",comments:"Automatically created from partial quantity."});
      if(e)throw e;
    }
    await initializeFolders(folderPath);
  }catch(e){await supabase.from("preppap_orders").delete().eq("id",order.id);throw e;}
  return orderNumber;
}
function sanitize(v){return String(v||"").normalize("NFKD").replace(/[\/:*?"<>|#%{}~&\[\]();,'`]/g,"-").replace(/\s+/g," ").replace(/-+/g,"-").replace(/^[-. ]+|[-. ]+$/g,"").slice(0,120);}
function storageOrderFolder(orderNumber,customer,partNumber){return [orderNumber,customer,partNumber].map(sanitize).filter(Boolean).join("-");}
async function initializeFolders(folderPath){for(const [,folder] of folderDefinitions){const path=`${folderPath}/${folder}/.keep`;const {error}=await supabase.storage.from(CONFIG.STORAGE_BUCKET).upload(path,new Blob(["GUVEL PREPPAP FOLDER"],{type:"text/plain"}),{upsert:true,contentType:"text/plain"});if(error)throw new Error(`Storage folder ${folder}: ${error.message}`);}}

function validateFile(file){if(!file)throw new Error("Selecciona un archivo.");if(file.size>MAX_FILE_BYTES)throw new Error(`El archivo supera el máximo de 50 KB. Tamaño actual: ${(file.size/1024).toFixed(1)} KB.`);if(file.size===0)throw new Error("El archivo está vacío.");}
function safeFileName(name){return String(name||"file").normalize("NFKD").replace(/[\/:*?"<>|#%{}~&\[\]();,'`]/g,"-").replace(/\s+/g,"_").replace(/-+/g,"-").slice(0,150);}
export async function uploadTaskDocument(dbOrderId,taskCode,file,orderFolder){
  validateFile(file);const path=`${orderFolder}/${taskCode}/${Date.now()}_${safeFileName(file.name)}`;
  const {error}=await supabase.storage.from(CONFIG.STORAGE_BUCKET).upload(path,file,{upsert:false,contentType:file.type||"application/octet-stream"});if(error)throw error;
  const {data:userData}=await supabase.auth.getUser();
  const {data,error:de}=await supabase.from("preppap_documents").insert({order_id:dbOrderId,task_code:taskCode,document_name:file.name,storage_path:path,content_type:file.type,size_bytes:file.size,uploaded_by:userData.user?.id||null}).select().single();
  if(de){await supabase.storage.from(CONFIG.STORAGE_BUCKET).remove([path]);throw de;}return data;
}
export async function cancelOrder(orderId){
  const {data,error}=await supabase.from("preppap_orders").update({status:"Cancelled"}).eq("id",orderId).select().single();
  if(error)throw error;
  return data;
}
export async function updateTask(taskId,payload){const {data,error}=await supabase.from("preppap_tasks").update(payload).eq("id",taskId).select().single();if(error)throw error;return data;}
export async function completeTask(taskId,orderId,taskCode,details){
  const {count,error}=await supabase.from("preppap_documents").select("id",{count:"exact",head:true}).eq("order_id",orderId).eq("task_code",taskCode);
  if(error)throw error;if(!count)throw new Error("No puedes completar esta etapa sin subir al menos un archivo de evidencia.");
  return updateTask(taskId,{status:"Completed",completed_at:new Date().toISOString(),reference:details.reference||null,details:details.details||null});
}
export async function reopenTask(taskId){return updateTask(taskId,{status:"In Progress",completed_at:null});}
export async function updateCompensation(dbOrderId,idx,payload,existingId){
  const result=existingId?await supabase.from("preppap_compensations").update(payload).eq("id",existingId):await supabase.from("preppap_compensations").insert({...payload,order_id:dbOrderId});
  if(result.error)throw result.error;
}
export async function getDocumentUrl(path){const {data,error}=await supabase.storage.from(CONFIG.STORAGE_BUCKET).createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;}
