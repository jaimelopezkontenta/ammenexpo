# Ammen

App de oración en español. El plan lo escribe la IA y se recorre día a día; el
corazón es el bucle social: cuando alguien ora por tu día, tú te enteras.

Una sola base de Expo para **Android, iOS y web**.

---

## El entorno local

Todo corre en Docker, en tu máquina, sin tocar nada en la nube. `supabase start`
levanta la pila entera:

| Contenedor | Qué es | Puerto |
|---|---|---|
| `supabase_db` | Postgres, con todo el esquema y las policies | `54422` |
| `supabase_kong` | La puerta de entrada — todo pasa por aquí | **`54421`** |
| `supabase_auth` | Cuentas, sesiones, recuperación de contraseña | vía Kong |
| `supabase_rest` | La API sobre las tablas (PostgREST) | vía Kong |
| `supabase_realtime` | Los mensajes del chat en vivo | vía Kong |
| `supabase_storage` | Los ficheros: hoy, los avatares | vía Kong |
| `supabase_edge_runtime` | La función que genera los planes con Claude | vía Kong |
| `supabase_studio` | Panel para mirar la base a mano | `54423` |
| `supabase_inbucket` | **Buzón de correo falso**: aquí llegan los emails de alta y de recuperación, sin mandar nada a nadie | `54424` |

No hay ninguna dependencia de un proveedor de nube: lo que corre aquí es lo
mismo que corre en producción, con las mismas migraciones y las mismas policies.

### El emulador Android

El `.env` usa `http://127.0.0.1:54421`, que vale para web. En el emulador
Android, `127.0.0.1` es el emulador mismo, no el host. Sin más, la app no
alcanza Supabase y el login muestra "Algo salió mal".

La solución es `adb reverse`, que redirige el puerto del emulador al host sin
tocar el `.env`:

```bash
adb reverse tcp:54421 tcp:54421
```

Así `127.0.0.1:54421` funciona igual en web que en el emulador. Solo afecta
al desarrollo local; en staging y producción la URL apunta al Supabase remoto.

### Arrancar

```bash
npx supabase start
```

```bash
npm run dev
```

### El estado de todo

```bash
npx supabase status
```

### Empezar de cero

Rehace la base desde las migraciones y vuelve a sembrar la cuenta de prueba.
**Borra todo lo demás.**

```bash
npx supabase db reset
```

### La cuenta de prueba

`supabase/seed.sql` se ejecuta después de cada `db reset` —y `npm run verify` hace
nueve—, así que la cuenta siempre está ahí:

```
prueba@ammen.local  ·  ammen1234
```

Viene con el onboarding hecho, los términos aceptados, un plan de catorce días
empezado hace tres, alguien que ya ha orado por el día de hoy y un círculo con
dos personas: sin datos, las cinco pestañas salen vacías y una pantalla vacía no
sirve para revisar un diseño.

Es **solo local**. `db reset` no se ejecuta jamás contra producción —allí se hace
`db push`, que no toca los seeds—, pero esa contraseña está escrita en el
repositorio: no debe existir una cuenta con ella en ningún otro sitio.

---

## Verificar

```bash
npm run verify
```

Encadena, en este orden: `typecheck`, `lint`, los tests de JavaScript y **ocho
suites de assertions SQL** que se ejecutan cada una contra una base recién
reseteada — `rls`, `flows`, `streak`, `timezone`, `bible`, `circles`, `plans` y
`storage`.

Nada se commitea sin esto en verde.

Aparte, `npm run test:chunks` prueba la generación por tramos contra la Edge
Function servida; no va en `verify` porque necesita `supabase functions serve`
levantado.

---

## Los secretos

`supabase/functions/.env` **está en `.gitignore` y no se sube nunca**. Guarda la
clave de Anthropic para el desarrollo local.

En producción no hay fichero: la clave se pone con

```bash
npx supabase secrets set ANTHROPIC_API_KEY=...
```

La clave `service_role` no se usa jamás desde el cliente.

---

## Cómo está organizado

```
app/          Las pantallas. El enrutado es por sistema de ficheros (Expo Router).
components/   Lo compartido entre pantallas.
core/         Las consultas, el estado y la lógica pura — agrupado por dominio.
supabase/
  migrations/ El esquema. Nunca se edita una migración ya aplicada: se añade otra.
  functions/  La generación del plan, en Deno.
  tests/      Las assertions SQL.
translation/  es.json y en.json. Las dos tienen que tener exactamente las mismas claves.
```

### Dos reglas que ya costaron depuración

1. **Una policy de SELECT tiene que poder decidir con las columnas de su propia
   fila.** Si consulta su propia tabla, rompe los `insert ... returning`, y
   Postgres lo reporta igual que un fallo de `WITH CHECK`. Toda tabla nueva
   necesita su assertion de regresión.
2. **Los GRANT son una capa distinta de RLS.** "permission denied for table X"
   no es RLS: es que falta el GRANT.
