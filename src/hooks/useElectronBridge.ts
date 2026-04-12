// Safe bridge to the Electron main process.
// Returns null for all methods when running in a regular browser.

type ElectronAPI = {
  platform: string;
  getAutoStart: () => Promise<boolean>;
  setAutoStart: (enabled: boolean) => Promise<void>;
  hideWindow: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
};

function getAPI(): ElectronAPI | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI ?? null;
}

export function useElectronBridge() {
  const api = getAPI();
  const isElectron = api !== null;

  return {
    isElectron,
    platform: api?.platform ?? null,
    getAutoStart: api?.getAutoStart ?? (() => Promise.resolve(false)),
    setAutoStart: api?.setAutoStart ?? (() => Promise.resolve()),
    hideWindow: api?.hideWindow ?? (() => Promise.resolve()),
    openExternal: api?.openExternal ?? ((url: string) => { window.open(url, "_blank"); return Promise.resolve(); }),
  };
}
