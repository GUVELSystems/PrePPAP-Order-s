export const taskDefinitions=[
  ['Quote','Cotización MES → Cliente','MES','Cliente'],
  ['CustomerPO','PO Cliente → MES','Cliente','MES'],
  ['PrePPAPRequest','PrePPAP Order Request','MWS','MES'],
  ['MESPO','PO MES → MWS','MES','MWS'],
  ['MWSInvoice','Factura MWS → MES','MWS','MES'],
  ['Shipping','Método de Envío','Logistics','Cliente'],
  ['Monterrey','Monterrey → Cliente: Proceso de MES','MES','Cliente'],
  ['FedEx','Guía FedEx / Referencias','MWS','Cliente'],
  ['MESInvoice','Factura MES → Cliente','MES','Cliente']
];

export const folderDefinitions=[
  ['Quote','01_Cotizacion_MES_Cliente','Cotización MES a Cliente'],
  ['CustomerPO','02_PO_Cliente_MES','PO Cliente a MES'],
  ['PrePPAPRequest','03_PrePPAP_Order_Request_MWS_MES','PrePPAP Order Request MWS a MES'],
  ['MESPO','04_PO_MES_MWS','PO MES a MWS'],
  ['MWSInvoice','05_Factura_MWS_MES','Factura MWS a MES'],
  ['Shipping','06_Metodo_de_Envio','Método de Envío'],
  ['Monterrey','07_Monterrey_Cliente','Monterrey a Cliente: Proceso de MES'],
  ['FedEx','08_MWS_Cliente','MWS a Cliente: Guía de FedEx con Referencias'],
  ['MESInvoice','09_Factura_MES_Cliente','Factura MES a Cliente']
];
