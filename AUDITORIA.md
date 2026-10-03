# Auditoría GUVEL PrePPAP V9 → V10

Alcance: los 23 archivos del ZIP (frontend, 7 migraciones SQL, esquema, herramientas de limpieza).
Cada hallazgo marcado **[reproducido]** se confirmó ejecutándolo; el resto se verificó leyendo el código.

## Cómo se verificó

- **SQL**: PostgreSQL 16 real con `auth` y `storage` simulados. Se cargó el esquema original + `MIGRATION_V9`, se reprodujo el fallo, y se validó `migration_v10.sql` y `schema.sql` (incluida una segunda ejecución).
- **Interfaz**: Chromium headless con Supabase simulado en memoria (que replica el trigger de evidencia y rechaza claves de Storage no ASCII). 40+ comprobaciones de extremo a extremo: login, crear orden, subir / borrar / completar, balances, filtros, Atrás, deep links, cancelar / reactivar, móvil.
- **No se probó** contra tu proyecto Supabase real, la descarga real de ZIP (carga JSZip desde CDN) ni las fuentes de Google (bloqueadas en el sandbox).

## Hallazgos críticos (causaban los errores que reportas)

| # | Problema | Efecto | Estado |
|---|---|---|---|
| 1 | **[reproducido]** El trigger de `MIGRATION_V9.sql` declara una variable `shipping_method` con el mismo nombre que la columna de `preppap_orders`. PostgreSQL responde `column reference "shipping_method" is ambiguous`. | **Completar cualquier etapa falla siempre**, aun con evidencia. | Corregido en `migration_v10.sql` |
| 2 | `sanitize()` y `safeFileName()` usaban `normalize("NFKD")` sin quitar las marcas combinantes (`é` → `e` + U+0301). Cliente, número de parte y nombre de archivo con acentos, `ñ` o símbolos terminan en la clave de Storage. | Causa probable de subidas que fallan con "Invalid key" en archivos como `Cotización final.pdf` (no verificado contra tu Supabase real). | Corregido: solo `A-Z a-z 0-9 . _ -`; el nombre original se conserva para mostrar |
| 3 | El modal calculaba `docs` como copia, y tras cada acción se re-renderizaba toda la app. Al abrir una orden, el detalle aparecía **debajo** de la tabla, fuera de pantalla. | Navegación confusa, filtros y búsqueda que se pierden, lista de archivos desactualizada. | Rediseñado: lista + detalle lado a lado, render parcial, estado en un solo lugar |

## Hallazgos altos

| # | Problema | Estado |
|---|---|---|
| 4 | Soltar un archivo fuera de la zona de arrastre hace que el navegador lo abra y se pierda la sesión de trabajo. | Corregido (se bloquea a nivel de ventana) |
| 5 | `window.open()` después de un `await` lo suelen bloquear Safari y los móviles: "Ver archivo" podía no hacer nada. | Corregido (se abre la pestaña antes de pedir la URL) |
| 6 | Editar un balance no preseleccionaba `Tipo`, `Acción` ni `Estado`; al guardar **sobrescribía** esos valores con los del primer `<option>`. | Corregido; los registros se identifican por `id`, no por índice |
| 7 | `completeTask` escribía en la orden y creaba el balance **antes** de completar la etapa; si el trigger rechazaba, quedaban datos a medias. `.maybeSingle()` además lanza error si hay más de un balance abierto. | Corregido: primero la etapa, luego los efectos, con reversión si fallan |
| 8 | `listOrders` usaba `.in("order_id", ids)`: con cientos de órdenes la URL excede el límite. PostgREST además corta en 1000 filas sin avisar. | Corregido: paginación |
| 9 | `qty_shipped` y `qty_invoiced` nunca se capturaban en ningún lado. "Piezas por enviar" siempre igualaba lo solicitado y Envíos mostraba 0. | Corregido: las etapas Envío y Factura al cliente capturan cantidad (opcional) |
| 10 | Sin `onAuthStateChange`: al expirar la sesión todo falla con errores crípticos. | Corregido: vuelve al login con mensaje |
| 11 | **[reproducido]** `CLEAN_START.sql` deja el bucket en **50 KB**. | Corregido en `tools/clean_start.sql` |
| 12 | **[reproducido]** `MIGRATION_V4.sql` tiene sintaxis inválida (`drop constraint … on tabla`). | Reemplazada por V10 |
| 13 | Al borrar evidencia se eliminaba primero el archivo y luego la fila: si fallaba la fila, quedaba un registro que apunta a la nada. | Invertido el orden |

## Hallazgos medios

- `alert()` nativo para todo, texto mezclado inglés/español, sin Esc ni clic en el fondo, ids duplicados al apilar modales. → toasts, `<dialog>`, interfaz en español.
- Sin rutas: no había Atrás, ni recarga en la misma pantalla, ni enlaces compartibles. → `#/orders/PP-2026-001/MESPO`.
- Los datos escritos se perdían al cerrar el diálogo. → aviso de cambios sin guardar.
- Export ZIP: descarga secuencial, archivos con el mismo nombre se sobrescribían en silencio, sin progreso. → 4 en paralelo, nombres únicos, `ERRORES.txt` si algo falla; también por orden.
- Las 7 "carpetas" `.keep` se subían en serie y un fallo cancelaba la orden. → en paralelo y no bloqueante.
- El trigger rechazaba guardar notas en una etapa ya completada si se había borrado evidencia. → ahora solo valida al **pasar** a Completada, y la interfaz no deja borrar evidencia de una etapa completada (primero se reabre).
- Si PO y factura vuelven a coincidir, el balance automático se cierra (antes quedaba abierto para siempre). Ya no se pisan los comentarios que el usuario escribió.
- Código muerto: `sharepoint.js`, `storage.js`, `sharepoint-model.json`, columna `fedex`, y tres versiones del esquema (`schema` + V4…V9 que se pisan entre sí). → eliminados; ahora `db/schema.sql` y `db/migration_v10.sql`.

## Seguridad — **no modificado**, requiere tu decisión

1. **Registro abierto.** Las políticas RLS dan lectura y escritura total a cualquier usuario `authenticated`, incluido borrar órdenes. Si en Supabase está activo *Allow new users to sign up*, cualquiera que cree una cuenta puede ver y modificar todo. Desactívalo en *Authentication → Providers → Email*.
2. No hay roles: todos los usuarios pueden cancelar órdenes y borrar evidencia. Si necesitas distinguir (consulta / operación / administrador), hay que añadir una tabla de roles y ajustar las políticas.
3. La clave en `config.js` es la *publishable*: es pública por diseño y está bien. La protección real es RLS.

## Cambios de comportamiento a tener en cuenta

- Interfaz completa en español. Los valores guardados en la base (`Monterrey → Customer`, códigos de etapa, nombres de carpeta) **no cambiaron**: tus órdenes y archivos existentes siguen funcionando sin migrar datos.
- Etapas con campos nuevos (opcionales): PO del cliente → cantidad autorizada; Envío → cantidad enviada; Factura al cliente → cantidad facturada.
- Las órdenes canceladas ahora pueden reactivarse.

## Cómo actualizar

1. En Supabase → SQL Editor, ejecuta `db/migration_v10.sql` (una vez; es seguro repetirla).
2. Reemplaza los archivos del repositorio por los de esta carpeta (conserva tu `config.js`).
3. Recarga con Ctrl+Shift+R para limpiar el caché de los módulos.

**Sin el paso 1, el error de "completar etapa" seguirá apareciendo**: está en la base de datos, no en el frontend.

## V11: facturas parciales y balance automático

Surgió de aclarar el proceso: una orden tiene un solo número de parte, de ella nace un PO a Metrics Works, y Metrics Works puede facturar en partes pero debe cumplir el total.

- **Antes**: una sola factura que se sobrescribía y un balance con cantidades capturadas a mano, que podían quedar desfasadas del PO real.
- **Ahora**: las facturas son registros (`preppap_invoices`) con sus archivos. Un trigger mantiene el total facturado en la orden y `sync_preppap_balance()` abre, actualiza o cierra el balance. La lógica vive en la base de datos, así que no depende de qué pantalla se use.
- **Verificado en PostgreSQL 16**: factura parcial sin etapa completada (sin balance) → completar etapa (abre balance 5/10) → reposición parcial (Parcial 7/10) → reposición final (Cerrado 10/10) → borrar una factura (abre balance nuevo) → un cierre manual sin reponer no se reabre solo → borrar la factura borra sus archivos → piezas 0 rechazadas. También la actualización desde V9 con datos antiguos: la factura que ya existía se convierte en un registro.
- Defecto encontrado y corregido durante las pruebas: el comentario automático del balance contaba como justificación al cerrarlo sin reponer.
