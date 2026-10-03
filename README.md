# GUVEL PrePPAP

Portal de control de órdenes PrePPAP: 7 etapas por orden, evidencia obligatoria en cada una
y conciliación PO vs factura. Sitio estático (GitHub Pages) + Supabase (Auth, Postgres, Storage).

## Puesta en marcha

1. **Base de datos**
   - Proyecto nuevo → ejecuta `db/schema.sql` completo en *Supabase → SQL Editor*.
   - Proyecto que ya tiene datos (V9 o anterior) → ejecuta **solo** `db/migration_v10.sql`.
2. **Autenticación** → *Authentication → Users*: crea los usuarios.
   Desactiva *Allow new users to sign up* (ver `AUDITORIA.md`, hallazgo de seguridad).
3. **Conexión** → edita `config.js` con tu `SUPABASE_URL` y tu clave pública (anon / publishable).
4. **Publicar** → sube esta carpeta a GitHub Pages. No hay paso de compilación.

Para probarlo en local: `python3 -m http.server 8000` y abre `http://localhost:8000`.

## Estructura

| Archivo | Qué hace |
|---|---|
| `index.html`, `styles.css` | Entrada y sistema de diseño |
| `app.js` | Vistas, rutas, diálogos |
| `api.js` | Toda la comunicación con Supabase (lectura, escritura, Storage) |
| `data.js` | Definición de las 7 etapas (códigos, carpetas, campos) |
| `utils.js` | Íconos, toasts, diálogos, helpers |
| `config.js`, `supabase.js` | Conexión |
| `db/schema.sql` | Esquema completo (instalación nueva) |
| `db/migration_v10.sql` | Actualización desde V9 o anterior |
| `tools/` | Reinicio de datos (`clean_start.sql` + `clean-storage.html`), solo uso manual |

## Reglas de negocio

- Cada etapa necesita ≥ 1 archivo (máx. 2 MB) para completarse. Lo aplican la app **y** un trigger en la base.
- **Envío**: *Monterrey → Customer* se completa solo; *MWS → Customer* exige evidencia.
- **Factura de Metrics Works**: si cantidad de PO ≠ cantidad facturada se crea un registro en *Balances de PO*.
  Si luego coinciden, el registro automático se cierra. Un balance ya registrado deja de contar como "por resolver".
- Los datos de cada etapa se guardan en la orden: PO cliente y cantidad autorizada, PO a MWS y cantidad,
  factura MWS y cantidad, cantidad enviada, cantidad facturada al cliente.

## Enlaces directos

La app usa rutas con `#`, así que el botón Atrás funciona y puedes compartir enlaces:
`#/orders/PP-2026-001` (orden) · `#/orders/PP-2026-001/MESPO` (abre esa etapa).
