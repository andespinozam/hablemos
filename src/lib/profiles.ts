import { ageInYears } from './age';
import { getDb, type ChildProfile } from './db';
import { newId } from './ids';
import { deleteProgress } from './progress';

export const AVATARS = ['🐻', '🐰', '🐱', '🐶', '🦊', '🐼', '🦁', '🐸', '🐵', '🐯', '🐨', '🦄'];
export const MAX_NAME_LENGTH = 20;
export const MIN_AGE = 2;
export const MAX_AGE = 7;

export interface ProfileInput {
  name: string;
  birthDate: string;
  avatar: string;
}

export type ProfileErrors = Partial<Record<keyof ProfileInput, string>>;

export function validateProfile(input: ProfileInput, today: Date): ProfileErrors {
  const errors: ProfileErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = 'Escribe un nombre o apodo.';
  else if (name.length > MAX_NAME_LENGTH) errors.name = `Máximo ${MAX_NAME_LENGTH} letras.`;

  const age = ageInYears(input.birthDate, today);
  if (age === null) errors.birthDate = 'Elige una fecha de nacimiento válida.';
  else if (age < MIN_AGE || age > MAX_AGE)
    errors.birthDate = `La app es para niños de ${MIN_AGE} a ${MAX_AGE} años.`;

  if (!AVATARS.includes(input.avatar)) errors.avatar = 'Elige un avatar.';
  return errors;
}

export async function listProfiles(): Promise<ChildProfile[]> {
  const db = await getDb();
  const all = await db.getAll('profiles');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getProfile(id: string): Promise<ChildProfile | undefined> {
  return (await getDb()).get('profiles', id);
}

/** Crea o actualiza (si trae `id`). Lanza si los datos no son válidos. */
export async function saveProfile(
  input: ProfileInput,
  options: { id?: string; today?: Date; now?: number } = {},
): Promise<ChildProfile> {
  const today = options.today ?? new Date();
  const errors = validateProfile(input, today);
  if (Object.keys(errors).length > 0) throw new Error(Object.values(errors).join(' '));

  const db = await getDb();
  const existing = options.id ? await db.get('profiles', options.id) : undefined;
  const profile: ChildProfile = {
    id: existing?.id ?? options.id ?? newId(),
    name: input.name.trim(),
    birthDate: input.birthDate,
    avatar: input.avatar,
    createdAt: existing?.createdAt ?? options.now ?? Date.now(),
  };
  await db.put('profiles', profile);
  return profile;
}

/** Elimina el perfil y todo su progreso (sesiones, resultados y niveles). */
export async function deleteProfile(id: string): Promise<void> {
  await deleteProgress(id);
  await (await getDb()).delete('profiles', id);
}
