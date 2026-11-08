import { useState, type FormEvent } from 'react';
import { toYMD } from '../lib/age';
import type { ChildProfile } from '../lib/db';
import { AVATARS, MAX_NAME_LENGTH, saveProfile, validateProfile, type ProfileErrors } from '../lib/profiles';

interface Props {
  /** Si viene, se edita; si no, se crea. */
  profile?: ChildProfile;
  onDone: () => void;
}

export function ProfileForm({ profile, onDone }: Props) {
  const [name, setName] = useState(profile?.name ?? '');
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATARS[0]);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = { name, birthDate, avatar };
    const found = validateProfile(input, new Date());
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setSaveError('');
    try {
      await saveProfile(input, { id: profile?.id });
      onDone();
    } catch {
      setSaveError('No se pudo guardar. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <main className="screen">
      <h1>{profile ? 'Editar perfil' : 'Nuevo perfil'}</h1>
      <form className="card" onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label htmlFor="name">Nombre o apodo</label>
          <input
            id="name"
            className="input"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && (
            <p id="name-error" className="error-text" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="birth">Fecha de nacimiento</label>
          <input
            id="birth"
            type="date"
            className="input"
            value={birthDate}
            max={toYMD(new Date())}
            onChange={(e) => setBirthDate(e.target.value)}
            aria-invalid={!!errors.birthDate}
            aria-describedby={errors.birthDate ? 'birth-error' : undefined}
          />
          {errors.birthDate && (
            <p id="birth-error" className="error-text" role="alert">
              {errors.birthDate}
            </p>
          )}
        </div>

        <fieldset className="field avatar-picker">
          <legend>Avatar</legend>
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              className="avatar-option"
              aria-pressed={avatar === a}
              aria-label={`Avatar ${a}`}
              onClick={() => setAvatar(a)}
            >
              {a}
            </button>
          ))}
        </fieldset>

        {saveError && (
          <p className="error-text" role="alert">
            {saveError}
          </p>
        )}

        <div className="row" style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn--good" disabled={saving}>
            💾 Guardar
          </button>
          <button type="button" className="btn btn--ghost" onClick={onDone}>
            Cancelar
          </button>
        </div>
      </form>
    </main>
  );
}
