# GUVEL PrePPAP

Portal de control de órdenes PrePPAP: 7 etapas por orden, evidencia obligatoria en cada una
y conciliación PO vs factura. Sitio estático (GitHub Pages) + Supabase (Auth, Postgres, Storage).

## Puesta en marcha

1. **Base de datos**
   - Proyecto nuevo → ejecuta `db/schema.sql` completo en *Supabase → SQL Editor* (ya incluye V10 y V11).
   - Proyecto que ya tiene datos (V9 o anterior) → ejecuta en este orden `db/migration_v10.sql` y luego `db/migration_v11.sql`.
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
| `db/migration_v10.sql` | Corrige el trigger de evidencia y el límite de 2 MB (desde V9 o anterior) |
| `db/migration_v11.sql` | Facturas parciales y balance automático |
| `tools/` | Reinicio de datos (`clean_start.sql` + `clean-storage.html`), solo uso manual |

## Reglas de negocio

- Cada etapa necesita ≥ 1 archivo (máx. 2 MB) para completarse. Lo aplican la app **y** un trigger en la base.
- **Envío**: *Monterrey → Customer* se completa solo; *MWS → Customer* exige evidencia.
- **PO a Metrics Works**: nace de la orden PrePPAP (un solo número de parte) y fija la cantidad total que se debe cumplir.
- **Facturas de Metrics Works**: pueden ser parciales. Cada una se registra con número, piezas, fecha y su archivo. Facturado = suma de facturas; faltan = PO − facturado.
- **Balance**: al completar la etapa de factura con piezas faltantes se abre solo un balance ligado a la orden. Cada factura de reposición lo pasa a *Parcial* y lo cierra cuando la suma alcanza el PO. En *Balances de PO* se define la acción, el PO relacionado y la fecha compromiso. Cerrar un balance sin reponer exige comentarios. Si se borra una factura y vuelve a faltar, se abre un balance nuevo.
- Los datos de cada etapa se guardan en la orden: PO cliente y cantidad autorizada, PO a MWS y cantidad, cantidad enviada, cantidad facturada al cliente.

## Enlaces directos

La app usa rutas con `#`, así que el botón Atrás funciona y puedes compartir enlaces:
`#/orders/PP-2026-001` (orden) · `#/orders/PP-2026-001/MESPO` (abre esa etapa).
