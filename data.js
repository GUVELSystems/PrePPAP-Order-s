export const taskDefinitions=[
  ['Quote','Cotización Metrics Mexico → Customer','Metrics Mexico','Customer'],
  ['CustomerPO','PO Customer → Metrics Mexico','Customer','Metrics Mexico'],
  ['PrePPAPRequest','PrePPAP Order Request','MWS','MES'],
  ['MESPO','PO Metrics México → Metrics Works','Metrics México','Metrics Works'],
  ['MWSInvoice','Invoice Metrics Works → Metrics México','Metrics Works','Metrics México'],
  ['Shipment','Metrics Mexico Shipment Process / Metrics Works Shipment Process','Metrics Mexico','Customer'],
  ['MESInvoice','Invoice Metrics México → Customer','Metrics México','Customer']
];

export const folderDefinitions=[
  ['Quote','01_Cotizacion_Metrics_Mexico_Customer','Cotización Metrics Mexico → Customer'],
  ['CustomerPO','02_PO_Customer_Metrics_Mexico','PO Customer → Metrics Mexico'],
  ['PrePPAPRequest','03_PrePPAP_Order_Request','PrePPAP Order Request'],
  ['MESPO','04_PO_Metrics_Mexico_Metrics_Works','PO Metrics México → Metrics Works'],
  ['MWSInvoice','05_Invoice_Metrics_Works_Metrics_Mexico','Invoice Metrics Works → Metrics México'],
  ['Shipment','06_Shipment_Process','Shipment Process'],
  ['MESInvoice','07_Invoice_Metrics_Mexico_Customer','Invoice Metrics México → Customer']
];

export const taskHints={
  Quote:{label:'Cotización Metrics Mexico → Customer',reference:'Número de cotización / referencia comercial',info:'Captura cualquier dato relevante de la cotización.'},
  CustomerPO:{label:'PO Customer → Metrics Mexico',reference:'Número de PO del Customer',info:'Número de PO, cantidad autorizada y cualquier condición relevante.'},
  PrePPAPRequest:{label:'PrePPAP Order Request',reference:'Número de solicitud MWS → MES',info:'Referencia de la solicitud y alcance del pedido.'},
  MESPO:{label:'PO Metrics México → Metrics Works',reference:'Número de PO Metrics México → Metrics Works',info:'Número de PO y cantidad de piezas solicitadas.'},
  MWSInvoice:{label:'Invoice Metrics Works → Metrics México',reference:'Número de factura Metrics Works',info:'Factura, cantidad facturada y observaciones.'},
  Shipment:{label:'Shipment Process',reference:'Referencia de envío / proceso',info:'El proceso depende del Shipping Method seleccionado al crear el PrePPAP.'},
  MESInvoice:{label:'Invoice Metrics México → Customer',reference:'Número de factura Metrics México',info:'Factura, cantidad facturada y observaciones.'}
};
