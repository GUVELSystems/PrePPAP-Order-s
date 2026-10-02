# GUVEL PrePPAP — SharePoint Model

This package defines the SharePoint structure before connecting the GitHub Pages frontend.

## Recommended site

`GUVEL PrePPAP`

## Lists

1. PrePPAP Orders — parent order
2. PrePPAP Tasks — workflow milestones
3. PO Balances — partial POs and compensation
4. Shipments — shipment-level tracking

## Document library

`PrePPAP Orders`

Each order receives a folder:

`PP-YYYY-###`

Recommended subfolders:

- 01_Quote
- 02_Customer_PO
- 03_PrePPAP_Request
- 04_MES_PO_to_MWS
- 05_MWS_Invoice
- 06_Shipping
- 07_MES_Invoice
- 08_Compensation

## Key design decision

The lists use `PrePPAPID` as the business key rather than depending on SharePoint item IDs. This makes the data portable and keeps the relationship understandable in GUVEL.

## Relationship

```text
PrePPAP Orders
       |
       +---- PrePPAP Tasks
       |
       +---- PO Balances
       |
       +---- Shipments
       |
       +---- Document Library / PrePPAPID folder
```

## Next integration step

After the structure is approved:

1. Create the SharePoint site.
2. Create the four lists with these columns.
3. Create the document library.
4. Register GUVEL as an SPA in Microsoft Entra ID.
5. Add the GitHub Pages redirect URI.
6. Define Graph permissions with IT.
7. Obtain Site ID + List IDs + Drive ID.
8. Populate `config.js`.
9. Replace demo/local data calls with Graph calls.
