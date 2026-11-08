import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Item } from '../activities/types';
import type { Position } from './phonemes';
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

export type PronunciationMode = 'espontanea' | 'repetida';
export type PronunciationStatus = 'correcta' | 'sustituida' | 'omitida' | 'distorsionada';

/** Una palabra de la evaluación de pronunciación, guardada completa para repetirla igual. */
export interface PronunciationItem {
  /** `fonema/palabra` o `proceso-xxx/palabra`. */
  id: string;
  /** Fonema evaluado (ausente en la mini revisión de procesos). */
  phonemeId?: string;
  /** Proceso de la mini revisión: sílabas átonas o grupos consonánticos. */
  process?: 'silabas' | 'grupos';
  word: string;
  syllables: string[];
  emoji: string;
  position: Position;
  /** Fonema opcional (de la edad siguiente o avanzado). */
  optional: boolean;
}

export interface PronunciationResponse {
  itemId: string;
  /** Si el niño la dijo solo (espontánea) o después de escuchar al adulto (repetida). */
  mode: PronunciationMode;
  status: PronunciationStatus;
  /** Sonido que dijo en su lugar, si la marca fue "sustituida". */
  substitution?: string;
  at: number;
}

/** Evaluación de pronunciación. No cuenta para niveles, rachas ni la práctica. */
export interface PronunciationRecord {
  id: string;
  profileId: string;
  kind: 'baseline' | 'reassessment';
  createdAt: number;
  /** Se llena al responder todos los ítems; una a medias se puede retomar. */
  completedAt?: number;
  ageYears: number;
  items: PronunciationItem[];
  responses: PronunciationResponse[];
}

/** Estado de la escalera de un sonido: en práctica, en espera (máx. 3 a la vez) o terminada. */
export type LadderState = 'active' | 'queued' | 'done';

/** Escalera de pronunciación de un sonido para un niño (clave `perfil:fonema`). */
export interface LadderRecord {
  /** `${profileId}:${phonemeId}` */
  key: string;
  profileId: string;
  phonemeId: string;
  state: LadderState;
  /** Posición en el orden de trabajo (menor = antes). */
  order: number;
  /** Escalón actual, 0 a 5 (ver `LADDER_STEPS`). */
  step: number;
  /** Sesiones distintas con "Lo logró" en el escalón actual. */
  successSessions: string[];
  /** Sustitución observada (sonido que dice en lugar de este), para el reporte y los pares mínimos. */
  substitution?: string;
  substitutionSource?: 'evaluacion' | 'adulto';
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

/** Grabación de voz del adulto para un texto (clave `audioKey`). Vive solo en el dispositivo. */
export interface RecordingRecord {
  key: string;
  text: string;
  mime: string;
  /** Bytes del audio (ArrayBuffer: más fiable que Blob en Safari antiguo). */
  data: ArrayBuffer;
  at: number;
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
  pronunciation: { key: string; value: PronunciationRecord; indexes: { byProfile: string } };
  ladders: { key: string; value: LadderRecord; indexes: { byProfile: string } };
  recordings: { key: string; value: RecordingRecord };
}

export type HablemosDatabase = IDBPDatabase<HablemosDB>;

export const DB_NAME = 'hablemos';
/** Al cambiar el esquema: subir este número y agregar un bloque `if (oldVersion < N)`. Nunca editar los anteriores. */
export const DB_VERSION = 6;

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
        if (oldVersion < 4) {
          db.createObjectStore('pronunciation', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        }
        if (oldVersion < 5) {
          db.createObjectStore('ladders', { keyPath: 'key' }).createIndex('byProfile', 'profileId');
        }
        if (oldVersion < 6) {
          db.createObjectStore('recordings', { keyPath: 'key' });
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
