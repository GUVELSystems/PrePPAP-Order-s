# GUVEL PrePPAP V8

- GATE 05 creates a compensation record only when PO MES and MWS Invoice quantities differ and the gate is completed.
- Add Compensation starts with an Active PrePPAP Order picker; cancelled orders are excluded. Search works by PrePPAP number, customer, part number, or purpose.
- Compensation form displays PrePPAP Order Number instead of a visible PO Number; the existing PO number is preserved as hidden data for compatibility.
- Command Center includes Active Balances KPI.
- Migration preserves all historical compensation rows and removes the restrictive PO Type check that could conflict with legacy values.
