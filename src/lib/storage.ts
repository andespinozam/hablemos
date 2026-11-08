/**
 * Los datos viven solo en el dispositivo, así que se pide al navegador que no los borre por
 * falta de espacio ("almacenamiento persistente"). No es una garantía: el respaldo sigue siendo
 * la protección real.
 */

interface StorageLike {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
}

export interface StorageStatus {
  /** El navegador ofrece la API. */
  supported: boolean;
  /** Los datos están protegidos contra el borrado automático. */
  persistent: boolean;
  /** Bytes usados, si el navegador lo informa. */
  usage?: number;
}

/** Pide almacenamiento persistente (sin molestar al usuario). Nunca lanza. */
export async function requestPersistence(storage: StorageLike | undefined = globalThis.navigator?.storage): Promise<boolean> {
  if (!storage?.persist) return false;
  try {
    if (storage.persisted && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}

export async function storageStatus(storage: StorageLike | undefined = globalThis.navigator?.storage): Promise<StorageStatus> {
  if (!storage) return { supported: false, persistent: false };
  let persistent = false;
  let usage: number | undefined;
  try {
    persistent = storage.persisted ? await storage.persisted() : false;
  } catch {
    persistent = false;
  }
  try {
    usage = (await storage.estimate?.())?.usage;
  } catch {
    usage = undefined;
  }
  return { supported: typeof storage.persist === 'function', persistent, usage };
}

/** "12 KB", "3,4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
