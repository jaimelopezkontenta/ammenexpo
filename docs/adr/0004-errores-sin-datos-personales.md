# 0004 · Los reportes de error no llevan datos personales

**Estado:** aceptada · 2026-09-29

## Contexto

La app no tenía ErrorBoundary ni reporte de errores: un render que reventaba
dejaba la pantalla en blanco, y un fallo de red o de base solo lo sufría quien lo
tenía. Los mensajes de error pueden citar texto de oración (un `check` violado
cita el valor). Eso es dato de creencias, categoría especial (Art. 9 RGPD), y no
puede salir a un tercero.

## Decisión

- `captureError(error, { source, key })` es el único punto de entrada de errores.
  Por construcción solo deja salir la clase, un código, el status y la raíz de la
  clave de la query (`"todayDay"`, nunca ids ni parámetros); el mensaje y el
  objeto original nunca llegan al reporter (`toErrorReport`).
- Sin proveedor externo por ahora (decisión del propietario): en desarrollo va a
  la consola; el enchufe queda listo en `observability.configureErrors`.
- `QueryCache` y `MutationCache` reportan todo fallo; `AppErrorBoundary` cubre el
  render, en la raíz y en cada pestaña, con reintento.

## Consecuencias

- Elegir un proveedor exige antes resolver consentimiento, encargados y región
  (Art. 9), y comprobar que no recibe nada que este módulo no deje salir.
- `classifyError` decide el texto («sin conexión» o «algo salió mal»)
  mirando el mensaje de cada plataforma; `navigator.onLine` no existe en nativo.
