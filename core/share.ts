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

export const buildShareUrl = (path: string) =>
  `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;

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

    try {
      await nav?.clipboard?.writeText(url);
      return "copied";
    } catch {
      return "failed";
    }
  }

  try {
    await Share.share({ message: `${message}\n${url}` });
    return "shared";
  } catch {
    return "failed";
  }
};
