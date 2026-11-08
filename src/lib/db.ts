import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface ChildProfile {
  id: string;
  /** Nombre o apodo. */
  name: string;
  /** `YYYY-MM-DD`, hora local. */
  birthDate: string;
  /** Emoji del avatar. */
  avatar: string;
  createdAt: number;
}

interface HablemosDB extends DBSchema {
  profiles: {
    key: string;
    value: ChildProfile;
  };
}

export const DB_NAME = 'hablemos';
/** Al cambiar el esquema: subir este número y agregar un bloque `if (oldVersion < N)`. Nunca editar los anteriores. */
export const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<HablemosDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<HablemosDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HablemosDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
      },
    });
    // Si falla la apertura, permitir reintentar.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/** Solo para pruebas: cierra y olvida la conexión. */
export async function resetDbConnection(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise.catch(() => null);
    db?.close();
  }
  dbPromise = null;
}
