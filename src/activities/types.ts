import type { ComponentType } from 'react';
import type { PhonemeStat } from '../lib/phonemeStats';
import type { Rng } from '../lib/random';
import type { Rating } from '../lib/scoring';

/** Áreas de lenguaje para el seguimiento (Fase 6). */
export type Area =
  | 'receptivo'
  | 'expresivo'
  | 'ordenes'
  | 'conceptos'
  | 'frases'
  | 'fonemas'
  | 'discriminacion'
  | 'praxias'
  | 'narrativa';

/** Un ejercicio dentro de una actividad. */
export interface Item {
  id: string;
  /** Palabra, frase u objetivo: lo que ve el adulto en su panel. */
  target: string;
  /** Instrucción que se dice en voz alta y se muestra en texto breve. */
  prompt: string;
  /** Lo que se dice al repetir el modelo con calma tras un "Aún no" (por defecto, `target`). */
  model?: string;
  /** Área si difiere de la de la actividad. */
  area?: Area;
  /** Fonema objetivo, si aplica. */
  phoneme?: string;
  /** Datos propios de la actividad. */
  data?: Record<string, unknown>;
}

export interface ItemViewProps {
  item: Item;
  /** Dice un texto en voz alta (cancela lo que suene). `rate` más bajo = más lento. */
  say: (text: string, rate?: number) => void;
  /**
   * Cierra el ítem con una calificación. Las actividades que califican solas
   * (p. ej. señalar) la llaman; en las que califica el adulto la llama su panel.
   */
  submit: (rating: Rating) => void;
}

/** Lo que el motor sabe del niño al armar los ítems. */
export interface BuildContext {
  /** Edad en años cumplidos. */
  age: number;
  /** Resumen por fonema de lo practicado (id de fonema → estadística). */
  phonemes: Record<string, PhonemeStat>;
}

export interface Activity {
  id: string;
  title: string;
  icon: string;
  area: Area;
  /** Edad mínima en años. */
  minAge: number;
  /** Niveles disponibles (1..maxLevel). */
  maxLevel: number;
  /** Se dice y se muestra al empezar la actividad. */
  intro: string;
  /** true: el adulto califica con su panel. false: la actividad califica con `submit`. */
  adultRated: boolean;
  /** Ítems por sesión (por defecto `ITEMS_PER_ACTIVITY`). */
  itemCount?: number;
  buildItems(level: number, count: number, rng: Rng, ctx?: BuildContext): Item[];
  ItemView: ComponentType<ItemViewProps>;
}
