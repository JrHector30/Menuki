# Menuki - Plataforma Multi-Tenant de Catálogos y Pedidos por WhatsApp

Plataforma de alta velocidad para negocios locales peruanos: catálogo público ultraligero (Server Components, carga < 1s), checkout optimizado para conversión móvil con redirección directa a WhatsApp, panel administrativo con RLS real, cálculo comercial en hora de Perú (`America/Lima`) y procesamiento de imágenes a WebP en el navegador.

---

## 1. Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto tomando como base las siguientes claves:

```env
# Supabase Conexión Pública
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role (SOLO servidor - jamás exponer en el cliente)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# URL base de la aplicación (para generar enlaces de alta)
NEXT_PUBLIC_APP_URL=https://menuki.pe

# Slug de demostración para la página de inicio (opcional)
NEXT_PUBLIC_DEMO_SLUG=cafe-altomayo-lima

# Upstash Redis Rate Limiting (Opcional - sin ellos opera en bypass permisivo)
UPSTASH_REDIS_REST_URL=https://tu-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...

# Sentry Monitoreo de Errores (Opcional)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
```

---

## 2. Orden de Ejecución del SQL

Ejecuta el script [`supabase-schema.sql`](file:///c:/Users/JrHector/Documents/Menuki/supabase-schema.sql) en el **SQL Editor** del dashboard de Supabase en este orden secuencial:

1. **Extensiones y Enums:** `uuid-ossp`, `pgcrypto`, `delivery_type`, `payment_method`, `order_status`, `store_role`.
2. **Tablas e Índices Base:** `stores`, `store_members`, `categories`, `products`, `orders` (con `client_request_id` para idempotencia).
3. **Funciones Security Definer:** `is_store_member(store_id)`, `is_store_admin(store_id)`.
4. **RPC de Pedidos:** `create_order_secure` con validación de precios en servidor, recálculo de snapshots e idempotencia. Ejecutable exclusivamente por `service_role`.
5. **RPC de Alta:** `create_store` con validación de slug y creación atómica de tienda + membresía owner.
6. **Políticas RLS y Grants:** Column-level grants en `stores` (protege `id` y `slug`), RLS estricto en catálogo y pedidos.
7. **Supabase Storage:** Creación del bucket público `store-assets` (2 MB, JPEG/PNG/WebP) y políticas RLS acotadas por store_id.
8. **Datos Semilla (Seed):** Cafetería de especialidad con 4 categorías y 12 productos reales de Perú.

---

## 3. Alta de Nueva Tienda en 5 Minutos

Ejecuta el script interactivo CLI desde la terminal:

```bash
npm run tsx scripts/create-store.ts
```

O pasa los parámetros directamente por línea de comandos:

```bash
npx tsx scripts/create-store.ts --slug sangucheria-el-cholo --name "Sanguchería El Cholo" --whatsapp 987654321 --email admin@elcholo.pe
```

**Resultado:**
- Crea el usuario en Supabase Auth con una contraseña temporal segura de 12 caracteres (si el usuario no existe).
- Llama a `create_store` RPC creando la tienda y la membresía `owner`.
- Imprime la URL pública (`/sangucheria-el-cholo`), la URL admin (`/sangucheria-el-cholo/admin`) y las credenciales de acceso.

---

## 4. Despliegue en Vercel

1. **Importar Repositorio:** Conecta el repositorio de GitHub en Vercel.
2. **Configuración del Proyecto:**
   - Framework Preset: `Next.js`
   - Build Command: `next build`
   - Output Directory: `.next`
3. **Región del Servidor (Serverless Function Region):**
   - Selecciona la región de Vercel más cercana a tu base de datos Supabase:
     - Si Supabase está en **São Paulo (`sa-east-1`)**, usa **`gru1`** (São Paulo) en Vercel.
     - Si Supabase está en **US East (`us-east-1`)**, usa **`iad1`** (Washington D.C.).
   - *Beneficio:* Reduce la latencia de las Server Actions y consultas a la base de datos a < 15 ms.
4. **Variables de Entorno:** Copia y pega las variables de `.env.local` en la sección *Environment Variables* de Vercel.

---

## 5. Pruebas Manuales en Entornos Móviles y WebViews

Realiza las siguientes verificaciones en dispositivos físicos reales:

### A. iOS Safari
- [ ] **Bypass del bloqueador de ventanas emergentes en WhatsApp:** Al presionar "Confirmar y pedir por WhatsApp", la pestaña debe abrirse inmediatamente sin que Safari muestre el aviso de "Permitir ventana emergente" (logrado mediante `window.open('', '_blank')` síncrono previo a la promesa).
- [ ] **Viewport dinámico y Safe Area:** Verifica que el contenedor principal use `min-h-dvh` y que la barra flotante inferior respete `env(safe-area-inset-bottom)` sin sobreponerse con la barra de navegación táctil de iOS.

### B. Android Chrome
- [ ] **Teclado virtual:** Al enfocar los campos de dirección o teléfono en el Drawer de checkout, la barra inferior y los campos del formulario deben reposicionarse suavemente sin desbordar el viewport ni ocultar el botón de envío.
- [ ] **Compresión WebP:** En el panel admin de productos, selecciona una fotografía de cámara de 8 MB. Comprueba que el Canvas en cliente la reduzca a < 150 KB (800 px WebP) en menos de 500 ms antes de subirla.

### C. Navegador Interno de WhatsApp (In-App Browser)
- [ ] Abre un enlace de catálogo `https://tu-dominio.pe/cafe-altomayo-lima` directamente desde un chat de WhatsApp.
- [ ] Navega entre categorías: la barra adhesiva debe deslizar suavemente con CSS nativo (`scroll-margin-top: 5rem`).
- [ ] Agrega productos al carrito, abre el checkout y completa el flujo: debe saltar nuevamente al hilo de conversación del negocio con el mensaje estructurado pre-cargado.

### D. Navegador Interno de Instagram (In-App Browser)
- [ ] Coloca el enlace en la biografía de Instagram o envíalo por mensaje directo (DM).
- [ ] Abre el catálogo dentro del WebView de Instagram: el carrito persistido en `localStorage` no debe perderse si el usuario minimiza o cambia de app.
- [ ] Comprueba que el diálogo nativo `<dialog>` se renderice adecuadamente sin romper el layout restringido de Instagram.
