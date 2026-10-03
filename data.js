// Definición central del flujo de 7 etapas.
// IMPORTANTE: `code`, `folder`, `name`, `from` y `to` se guardan en la base de datos
// y en Storage; no los cambies si ya tienes órdenes creadas.

export const SHIPPING = {
  MTY: "Monterrey → Customer",
  MWS: "MWS → Customer"
};

export const GATES = [
  {
    code: "Quote", folder: "01_Cotizacion_Metrics_Mexico_Customer",
    name: "Cotización Metrics Mexico → Customer",
    title: "Cotización al cliente", short: "Cotización",
    from: "Metrics Mexico", to: "Customer",
    refLabel: "Número de cotización", refCol: null
  },
  {
    code: "CustomerPO", folder: "02_PO_Customer_Metrics_Mexico",
    name: "PO Customer → Metrics Mexico",
    title: "PO del cliente", short: "PO cliente",
    from: "Customer", to: "Metrics Mexico",
    refLabel: "Número de PO del cliente", refCol: "customer_po",
    qtyLabel: "Cantidad autorizada (pzas)", qtyCol: "customer_po_qty", qtyRequired: false
  },
  {
    code: "PrePPAPRequest", folder: "03_PrePPAP_Order_Request",
    name: "PrePPAP Order Request",
    title: "Solicitud de orden PrePPAP", short: "Solicitud",
    from: "MWS", to: "MES",
    refLabel: "Número de solicitud MWS → MES", refCol: "preppap_request"
  },
  {
    code: "MESPO", folder: "04_PO_Metrics_Mexico_Metrics_Works",
    name: "PO Metrics México → Metrics Works",
    title: "PO a Metrics Works", short: "PO a MWS",
    from: "Metrics México", to: "Metrics Works",
    refLabel: "Número de PO a Metrics Works", refCol: "mes_po",
    qtyLabel: "Cantidad solicitada (pzas)", qtyCol: "mes_po_qty", qtyRequired: true
  },
  {
    code: "MWSInvoice", folder: "05_Invoice_Metrics_Works_Metrics_Mexico",
    name: "Invoice Metrics Works → Metrics México",
    title: "Factura de Metrics Works", short: "Factura MWS",
    from: "Metrics Works", to: "Metrics México",
    refLabel: "", refCol: null,
    // Las facturas (parciales o totales) son registros propios: ver preppap_invoices.
    reconcile: true
  },
  {
    code: "Shipment", folder: "06_Shipment_Process",
    name: "Metrics Mexico Shipment Process / Metrics Works Shipment Process",
    title: "Envío al cliente", short: "Envío",
    from: "Metrics Mexico", to: "Customer",
    refLabel: "Guía o referencia de envío", refCol: null,
    qtyLabel: "Cantidad enviada (pzas)", qtyCol: "qty_shipped", qtyRequired: false
  },
  {
    code: "MESInvoice", folder: "07_Invoice_Metrics_Mexico_Customer",
    name: "Invoice Metrics México → Customer",
    title: "Factura al cliente", short: "Factura cliente",
    from: "Metrics México", to: "Customer",
    refLabel: "Número de factura al cliente", refCol: null,
    qtyLabel: "Cantidad facturada (pzas)", qtyCol: "qty_invoiced", qtyRequired: false
  }
];

export const gateByCode = code => GATES.find(g => g.code === code);

// El título del envío depende del método elegido al crear la orden.
export const gateTitle = (gate, order) =>
  gate.code === "Shipment"
    ? (order?.shipping_method === SHIPPING.MTY ? "Envío desde Metrics México" : "Envío desde Metrics Works")
    : gate.title;

export const PURPOSES = ["Prototype", "Validation", "Pre-Production", "PPAP", "Sample", "Other"];
export const PRIORITIES = ["Normal", "Low", "High", "Critical"];
export const OWNERS = ["Quality", "Engineering", "Purchasing", "Logistics", "Finance", "MES", "MWS"];
export const COMP_ACTIONS = ["Ship with next PrePPAP order", "Ship separately", "Credit", "Cancel", "Transfer to another PO"];
