import type { ComponentType } from 'react';
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
  /** Área si difiere de la de la actividad. */
  area?: Area;
  /** Fonema objetivo, si aplica. */
  phoneme?: string;
  /** Datos propios de la actividad. */
  data?: Record<string, unknown>;
}

export interface ItemViewProps {
  item: Item;
  /** Dice un texto en voz alta (cancela lo que suene). */
  say: (text: string) => void;
  /**
   * Cierra el ítem con una calificación. Las actividades que califican solas
   * (p. ej. señalar) la llaman; en las que califica el adulto la llama su panel.
   */
  submit: (rating: Rating) => void;
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
  buildItems(level: number, count: number, rng: Rng): Item[];
  ItemView: ComponentType<ItemViewProps>;
}
