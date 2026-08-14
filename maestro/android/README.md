# Maestro Android — SCAFFOLDED, no ejecutado

> Estado: **SCAFFOLDED / PENDING**. ADB y Maestro no están instalados en este
> host (constraint explícito del entorno). Ninguno de estos flows se ha
> corrido ni una vez. No se marcan PASS bajo ninguna circunstancia hasta que
> corran de verdad sobre un build preview/release y un dispositivo/emulador
> real — RDY-12 del plan.

## Qué falta antes de poder ejecutar esto

1. Instalar Android SDK Platform Tools (`adb`) y verificar `adb devices`.
2. Instalar Maestro CLI (`curl -Ls "https://get.maestro.mobile.dev" | bash`,
   o el instalador Windows equivalente) y `maestro --version`.
3. Un build preview/release identificable — `eas build --profile preview
   --platform android` una vez haya login de EAS, que hoy tampoco existe en
   este entorno.
4. Un emulador Android arrancado o un dispositivo físico con depuración USB.

## Cómo se ejecutarían, una vez lo anterior exista

```powershell
maestro test maestro/android/auth.yaml
maestro test maestro/android/share-and-pray.yaml
```

## Flows de este directorio

| Archivo | Cubre | Blocker |
|---|---|---|
| `auth.yaml` | alta, login, logout | B3 |
| `share-and-pray.yaml` | compartir → canjear → orar → permiso de push | B2, B4 |

Cada flow usa rol/label como selector primario (`tapOn: text` o
`accessibilityLabel`), y solo cae a un `id` cuando la pantalla es ambigua —
regla §2.14 del plan.
