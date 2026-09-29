import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import {
  BIBLE_VERSION_STORAGE_KEY,
  parseBibleVersion,
  resolveBibleVersion,
} from "./versionChoice";
import type { BibleVersion } from "./versions";

/**
 * La elección de versión, una sola para toda la app y sin provider.
 *
 * Un `useState` por pantalla no vale: la pestaña Biblia sigue montada detrás
 * del lector, y cambiar a la WEB en un capítulo dejaba el buscador buscando en
 * la RVR hasta el siguiente arranque. Un almacén de módulo con
 * `useSyncExternalStore` avisa a todas a la vez.
 */
export type BibleVersionChoice = {
  /** Lo que eligió la persona; null si nunca tocó el selector. */
  choice: BibleVersion | null;
  /**
   * Si ya se leyó el almacén. Antes de eso la versión es una suposición (la
   * del idioma), y pedir un capítulo con ella podía pintar un instante la
   * Biblia equivocada si el disco tardaba más que la red.
   */
  ready: boolean;
};

const UNKNOWN: BibleVersionChoice = { choice: null, ready: false };

let state: BibleVersionChoice = UNKNOWN;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const load = () => {
  // Una lectura por arranque; los cambios posteriores pasan por
  // `setBibleVersion`. El `Promise.resolve()` delante recoge también un fallo
  // síncrono del almacén (localStorage bloqueado en web), no solo el rechazo.
  loading ??= Promise.resolve()
    .then(() => AsyncStorage.getItem(BIBLE_VERSION_STORAGE_KEY))
    .then(parseBibleVersion, () => null)
    .then((stored) => {
      // Quien eligió mientras se leía el disco eligió después de guardar lo
      // que hay en él: gana su elección.
      if (state.ready) return;
      state = { choice: stored, ready: true };
      emit();
    });

  return loading;
};

export const subscribeBibleVersion = (listener: () => void) => {
  listeners.add(listener);
  void load();

  return () => {
    listeners.delete(listener);
  };
};

export const getBibleVersionChoice = () => state;

/**
 * Cambia la versión en todas las pantallas a la vez y la recuerda en el
 * dispositivo. Si el almacén falla (modo privado, permisos), la elección dura
 * lo que dure la app abierta y ya.
 */
export const setBibleVersion = (version: BibleVersion) => {
  state = { choice: version, ready: true };
  emit();

  void Promise.resolve()
    .then(() => AsyncStorage.setItem(BIBLE_VERSION_STORAGE_KEY, version))
    .catch(() => {});
};

/**
 * La Biblia que se lee ahora: la elegida o, sin elección, la del idioma de la
 * interfaz (cambiar la app a inglés sin haber elegido pasa a la WEB).
 *
 * `ready` es false solo hasta leer el almacén, unos milisegundos del primer
 * montaje: las lecturas de texto esperan a tenerlo.
 */
export const useBibleVersion = () => {
  const { i18n } = useTranslation();
  const { choice, ready } = useSyncExternalStore(
    subscribeBibleVersion,
    getBibleVersionChoice,
    // En el render estático de web no hay almacén: se hidrata como «aún no
    // se sabe» y se corrige al montar.
    () => UNKNOWN,
  );

  return {
    version: resolveBibleVersion(
      choice,
      i18n.resolvedLanguage ?? i18n.language,
    ),
    ready,
    setVersion: setBibleVersion,
  };
};
