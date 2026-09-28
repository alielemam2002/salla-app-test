import logger from "../../utils/logger.js";

const SDK_TYPES_URL = "/types/salla-embedded-sdk.d.ts";
const SDK_TYPES_LIB =
  "file:///node_modules/@types/salla-embedded-sdk/index.d.ts";

const WINDOW_GLOBAL = `
declare global {
  interface Window {
    salla: {
      embedded: EmbeddedApp;
    };
  }
}
export {};
`;

/**
 * Monaco `onMount` handler: loads the synced SDK declarations so
 * `window.salla.embedded.*` gets IntelliSense. Returns whether types loaded.
 */
export async function loadSdkTypes(_editor, monaco) {
  try {
    const response = await fetch(SDK_TYPES_URL);
    if (!response.ok) return false;
    const sdkTypes = (await response.text()) + WINDOW_GLOBAL;
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      sdkTypes,
      SDK_TYPES_LIB,
    );
    return true;
  } catch (e) {
    logger.warn("Could not load SDK types, using inline types", e);
    return false;
  }
}
