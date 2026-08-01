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

Rehace la base desde las migraciones. **Borra todos los datos locales**, incluidas
las cuentas de prueba.

```bash
npx supabase db reset
```

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
