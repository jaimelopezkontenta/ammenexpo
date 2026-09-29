import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { STORAGE_KEYS } from "@/core/storage/keys";
import { getItemMigrating } from "@/core/storage/storage";

/**
 * La letra del lector, del dispositivo y no de la cuenta: quien lee con la
 * letra grande en su teléfono no necesita que su portátil lo sepa. En web
 * AsyncStorage es localStorage; en nativo, disco. Si el almacén falla (modo
 * privado, permisos), la preferencia vive lo que viva la pantalla y ya.
 */

// Antes `ammen:reader-font`: la primera lectura lo pasa a este nombre.
const KEY = STORAGE_KEYS.readerFont;

export const FONT_STEPS = ["sm", "md", "lg"] as const;
export type ReaderFontStep = (typeof FONT_STEPS)[number];

/**
 * Las clases del versículo por paso, PARA `variant="bodySerif"` (`text-base
 * leading-6`, la letra más pequeña). `md` es la medida de siempre (la de la
 * variante `reading`). Entre dos clases de la misma familia gana la que va después
 * en la hoja de Tailwind, no en el `className`: por eso la base tiene que ser la
 * pequeña y los pasos mayores solo la superan. Con `reading` (`text-lg`) de base,
 * el paso `sm` (`text-base`) no ganaba nunca y A− no hacía nada.
 */
export const FONT_CLASSES: Record<ReaderFontStep, string> = {
  sm: "leading-7",
  md: "text-lg leading-reading",
  lg: "text-xl leading-9",
};

const isStep = (value: unknown): value is ReaderFontStep =>
  typeof value === "string" &&
  (FONT_STEPS as readonly string[]).includes(value);

export const useReaderFontStep = () => {
  const [step, setStep] = useState<ReaderFontStep>("md");

  useEffect(() => {
    let alive = true;
    getItemMigrating(KEY)
      .then((stored) => {
        if (alive && isStep(stored)) setStep(stored);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const set = (next: ReaderFontStep) => {
    setStep(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  };

  return [step, set] as const;
};
