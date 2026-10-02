# GUVEL PrePPAP Tracker V2

## Added in this version

### 1. New PrePPAP Order
A full form captures:
- Customer
- Part Number / Revision
- Purpose
- Request / Required dates
- Requested quantity
- Priority / Owner
- Shipping method
- Customer PO and quantity
- PrePPAP Request
- MES PO and quantity
- MWS Invoice and quantity
- FedEx / tracking
- Shipped / invoiced quantities
- SharePoint folder link
- Comments

### 2. Compensation Management
A dedicated PO Balance screen supports:
- PO type
- PO number
- Ordered quantity
- Delivered/shipped quantity
- Automatic remaining quantity
- Compensation action
- Related PO
- Resolution date
- Open / Partial / Closed status
- Comments

Example: 5 ordered, 4 delivered = 1 remaining. The balance stays visible until dispositioned.

## Run
Use a local static server because the project uses ES modules:
`python -m http.server 8080`

## GitHub Pages
Upload all files to a repository and enable GitHub Pages from the root of `main`.

## SharePoint
Set `DEMO_MODE=false` in `config.js`, then configure the Microsoft Entra SPA client ID and SharePoint site/list IDs. `sharepoint.js` contains the Microsoft Graph adapter. SharePoint becomes the source of truth; localStorage remains only a prototype/UI fallback.
