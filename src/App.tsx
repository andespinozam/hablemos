import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChildProfile } from './lib/db';
import { listProfiles } from './lib/profiles';
import { go, useRoute } from './lib/router';
import { AdultGate } from './screens/AdultGate';
import { AdultZone } from './screens/AdultZone';
import { ChildHome } from './screens/ChildHome';
import { ProfileForm } from './screens/ProfileForm';
import { ProfilePicker } from './screens/ProfilePicker';

export function App() {
  const route = useRoute();
  const [profiles, setProfiles] = useState<ChildProfile[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // La zona de adultos queda desbloqueada solo mientras se permanece en ella.
  const [unlocked, setUnlocked] = useState(false);

  const reload = useCallback(async () => {
    try {
      setProfiles(await listProfiles());
      setLoadError(false);
    } catch {
      setLoadError(true);
      setProfiles([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const inAdultArea = route === 'adultos' || route.startsWith('adultos/');
  // Se vuelve a bloquear solo al SALIR de la zona (no mientras el hash aún no cambia tras la puerta).
  const wasInAdultArea = useRef(false);
  useEffect(() => {
    if (wasInAdultArea.current && !inAdultArea) setUnlocked(false);
    wasInAdultArea.current = inAdultArea;
  }, [inAdultArea]);

  // Entrar a la zona de adultos por URL directa exige pasar por la puerta.
  useEffect(() => {
    if (inAdultArea && !unlocked) go('puerta');
  }, [inAdultArea, unlocked]);

  if (profiles === null) {
    return (
      <main className="screen screen--center" aria-busy="true">
        <p className="avatar bob" aria-hidden="true">
          🗣️
        </p>
      </main>
    );
  }

  const active = profiles.find((p) => p.id === activeId) ?? null;

  if (route === 'puerta') {
    return (
      <AdultGate
        onPass={() => {
          setUnlocked(true);
          go('adultos');
        }}
        onCancel={() => go('')}
      />
    );
  }

  if (inAdultArea && unlocked) {
    if (route === 'adultos/nuevo') {
      return <ProfileForm onDone={() => void reload().then(() => go('adultos'))} />;
    }
    if (route.startsWith('adultos/editar/')) {
      const profile = profiles.find((p) => p.id === route.slice('adultos/editar/'.length));
      if (!profile) {
        go('adultos');
        return null;
      }
      return <ProfileForm profile={profile} onDone={() => void reload().then(() => go('adultos'))} />;
    }
    return (
      <AdultZone
        profiles={profiles}
        loadError={loadError}
        onChanged={reload}
        onExit={() => go('')}
      />
    );
  }

  if (route === 'inicio' && active) {
    return <ChildHome profile={active} onExit={() => go('')} />;
  }

  return (
    <ProfilePicker
      profiles={profiles}
      onPick={(id) => {
        setActiveId(id);
        go('inicio');
      }}
      onAdults={() => go('puerta')}
    />
  );
}
