# GUVEL PrePPAP Tracker V2

## What changed
- Complete New PrePPAP Order form.
- Automatic generation of the 9-folder SharePoint structure as a logical order template.
- PO quantity vs shipped quantity.
- Automatic remaining quantity / compensation status.
- Order detail view.
- SharePoint root configured for:
  Engineering-Saltillo / Shared Documents / 0.1 New Product Development / PrePPAP Order's

## Current mode
DEMO mode uses localStorage. No SharePoint data is written yet.

This is intentional: before enabling Microsoft Graph, the process and folder model can be validated without risking company data.

## Folder structure generated per order
01_Cotizacion_MES_Cliente
02_PO_Cliente_MES
03_PrePPAP_Order_Request_MWS_MES
04_PO_MES_MWS
05_Factura_MWS_MES
06_Metodo_de_Envio
07_Monterrey_Cliente
08_MWS_Cliente
09_Factura_MES_Cliente

## Next SharePoint phase
The browser application will require Microsoft Entra ID + Microsoft Graph delegated authentication to create folders and open SharePoint documents securely. The exact tenant/site/drive identifiers and approved permissions should be supplied by the company's Microsoft 365 administrator.
