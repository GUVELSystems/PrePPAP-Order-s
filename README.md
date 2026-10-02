# GUVEL PrePPAP Tracker V1

GitHub Pages-ready prototype for PrePPAP Orders.

## Current architecture
GitHub Pages → Vanilla JS → localStorage (demo) / SharePoint adapter → Microsoft Graph.

The UI is already separated from the data layer. `sharepoint.js` contains the Graph adapter, so connecting SharePoint does not require rebuilding the interface.

## Demo
Open `index.html` through a static web server. Example:

`python -m http.server 8080`

Then browse to `http://localhost:8080`.

## GitHub Pages
Upload the folder contents to a repository and enable Pages from the `main` branch root.

## SharePoint phase
1. Register a SPA in Microsoft Entra ID.
2. Add the GitHub Pages URL as the SPA redirect URI.
3. Put the Application (client) ID in `config.js`.
4. Create SharePoint lists for Orders, Tasks, PO Balances and Shipments.
5. Put the site/list IDs in `config.js`.
6. Set `DEMO_MODE:false`.

Suggested lists:
- PrePPAP Orders
- PrePPAP Tasks
- PO Balances
- Shipments

The production source of truth should be SharePoint; localStorage should only keep UI preferences/cache.

## Important V1 limitation
The compensation screen currently calculates and displays the remaining quantity. The next implementation step should add a persistent compensation record with: Action, Related PO, Resolution Date, Status and Evidence Link.
