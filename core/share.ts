import { Platform, Share } from "react-native";

/**
 * Base URL for shareable links. In production this is the domain that also
 * serves the deep-link association files; in local development it falls back to
 * wherever the web build is being served, so links are testable end to end.
 */
export const appUrl = () => {
  const configured = process.env.EXPO_PUBLIC_APP_URL;

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }

  return "https://ammen.app";
};

/**
 * Por dónde entró alguien. Va en el enlace porque es lo único que viaja con él.
 *
 * **Hay que etiquetar antes de repartir**: un enlace que ya está en un grupo de
 * WhatsApp no se puede reetiquetar después. Es de las pocas cosas donde llegar
 * tarde no se arregla trabajando más.
 */
export type ShareSource = "plan" | "imagen" | "invitacion" | "circulo";

export const buildShareUrl = (path: string, source?: ShareSource) => {
  const base = `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  // `de` y no `utm_source`: es un enlace que la gente ve y a veces lee en voz
  // alta, y las cinco letras de un UTM no dicen nada a nadie fuera del marketing.
  return source ? `${base}?de=${source}` : base;
};

export type ShareOutcome = "shared" | "copied" | "failed";

type WebNavigator = {
  share?: (data: { text?: string; url?: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

/**
 * Native gets the OS share sheet; web tries the Web Share API and otherwise
 * copies the link. The caller shows different feedback for each outcome, so a
 * user who ends up with a copied link knows to paste it.
 */
export const shareOrCopy = async (
  message: string,
  url: string,
): Promise<ShareOutcome> => {
  if (Platform.OS === "web") {
    const nav = (globalThis as { navigator?: WebNavigator }).navigator;

    if (nav?.share) {
      try {
        await nav.share({ text: message, url });
        return "shared";
      } catch {
        // Cancelled or unsupported — fall through to copying.
      }
    }

    if (nav?.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(url);
        return "copied";
      } catch {
        return "failed";
      }
    }

    return "failed";
  }

  try {
    await Share.share({ message: `${message}\n${url}` });
    return "shared";
  } catch {
    return "failed";
  }
};
