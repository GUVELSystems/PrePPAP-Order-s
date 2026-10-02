export const taskDefinitions=[
  ['Quote','Cotización MES → Cliente','MES','Cliente'],
  ['CustomerPO','PO Cliente → MES','Cliente','MES'],
  ['PrePPAPRequest','PrePPAP Order Request','MWS','MES'],
  ['MESPO','PO MES → MWS','MES','MWS'],
  ['MWSInvoice','Factura MWS → MES','MWS','MES'],
  ['Shipping','Método de Envío','Logística','Cliente'],
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

export const taskHints={
  Quote:{label:'Cotización MES → Cliente',reference:'Número de cotización / referencia comercial',info:'Captura cualquier dato relevante de la cotización.'},
  CustomerPO:{label:'PO Cliente → MES',reference:'Número de PO del cliente',info:'Número de PO, cantidad autorizada y cualquier condición relevante.'},
  PrePPAPRequest:{label:'PrePPAP Order Request',reference:'Número de solicitud MWS → MES',info:'Referencia de la solicitud y alcance del pedido.'},
  MESPO:{label:'PO MES → MWS',reference:'Número de PO MES → MWS',info:'PO, cantidad solicitada y condiciones de entrega.'},
  MWSInvoice:{label:'Factura MWS → MES',reference:'Número de factura MWS',info:'Factura, cantidad facturada y observaciones.'},
  Shipping:{label:'Método de Envío',reference:'Guía / referencia logística',info:'Método, transportista y cualquier dato de embarque.'},
  Monterrey:{label:'Monterrey → Cliente: Proceso de MES',reference:'Referencia del proceso / envío',info:'Información del proceso realizado en Monterrey.'},
  FedEx:{label:'Guía FedEx / Referencias',reference:'Número de guía FedEx',info:'Debe contener la referencia de número de parte + propósito.'},
  MESInvoice:{label:'Factura MES → Cliente',reference:'Número de factura MES',info:'Factura, cantidad facturada y observaciones.'}
};
