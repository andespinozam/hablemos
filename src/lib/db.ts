import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Item } from '../activities/types';
import type { Rating } from './scoring';

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

/** 'practice' (por defecto, sin campo) o una evaluación. */
export type SessionKind = 'practice' | 'baseline' | 'reassessment';

export interface SessionRecord {
  id: string;
  profileId: string;
  startedAt: number;
  endedAt?: number;
  activityIds: string[];
  /** Ausente = práctica normal. Las evaluaciones no alteran los niveles automáticos. */
  kind?: SessionKind;
}

/** Un ítem de una evaluación, guardado completo para repetirlo igual en la reevaluación. */
export interface AssessmentItem {
  /** Área de la evaluación (ver `ASSESSMENT_AREAS`). */
  area: string;
  activityId: string;
  level: number;
  item: Item;
}

export interface AssessmentRecord {
  id: string;
  profileId: string;
  kind: 'baseline' | 'reassessment';
  createdAt: number;
  /** Se llena al terminar todos los ítems; una evaluación a medias no cuenta. */
  completedAt?: number;
  sessionId: string;
  /** Edad (años) del niño al evaluar. */
  ageYears: number;
  items: AssessmentItem[];
  /** Nivel recomendado por actividad (solo la evaluación inicial lo aplica). */
  recommendedLevels?: Record<string, number>;
}

export interface ResultRecord {
  id: string;
  sessionId: string;
  profileId: string;
  activityId: string;
  itemId: string;
  /** Palabra u objetivo trabajado. */
  target: string;
  /** Área de lenguaje (para el seguimiento por área). */
  area: string;
  /** Fonema objetivo, si lo hay (para el seguimiento por fonema). */
  phoneme?: string;
  /** Nivel de la actividad al momento de jugar. */
  level: number;
  rating: Rating;
  /** 1, 0.5 o 0 según la calificación. */
  score: number;
  at: number;
}

export interface LevelRecord {
  /** `${profileId}:${activityId}` */
  key: string;
  profileId: string;
  activityId: string;
  level: number;
  updatedAt: number;
}

interface HablemosDB extends DBSchema {
  profiles: { key: string; value: ChildProfile };
  sessions: { key: string; value: SessionRecord; indexes: { byProfile: string } };
  results: { key: string; value: ResultRecord; indexes: { byProfile: string } };
  levels: { key: string; value: LevelRecord; indexes: { byProfile: string } };
  assessments: { key: string; value: AssessmentRecord; indexes: { byProfile: string } };
}

export type HablemosDatabase = IDBPDatabase<HablemosDB>;

export const DB_NAME = 'hablemos';
/** Al cambiar el esquema: subir este número y agregar un bloque `if (oldVersion < N)`. Nunca editar los anteriores. */
export const DB_VERSION = 3;

let dbPromise: Promise<HablemosDatabase> | null = null;

export function getDb(): Promise<HablemosDatabase> {
  if (!dbPromise) {
    dbPromise = openDB<HablemosDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
          db.createObjectStore('results', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
          db.createObjectStore('levels', { keyPath: 'key' }).createIndex('byProfile', 'profileId');
        }
        if (oldVersion < 3) {
          db.createObjectStore('assessments', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
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
