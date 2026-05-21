/**
 * Electron-builder output directory (must match package.json → build.directories.output).
 * Kept out of legacy `dist-desktop/` so a Windows/OneDrive-locked tree cannot block rebuilds.
 */
export const DESKTOP_ELECTRON_OUT_DIR = "dist-electron-out";
