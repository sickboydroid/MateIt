/**
 * Global Configuration and Mutable State.
 * Imported by UI (to update) and App (to read).
 */
export const CONFIG = {
  STARTUP_DELAY: 1500,

  // SVG Styles
  ARROW_COLOR: "#ed3f62ff",
  ARROW_OPACITY: "0.9",
};

export const STATE = {
  mode: "off", // "off", "white", "black"
  limitType: "depth", // "depth" or "time"
  depthVal: 12,
  timeVal: 2000,
  isCollapsed: false,
};
