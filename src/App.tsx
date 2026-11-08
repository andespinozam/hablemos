import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChildProfile } from './lib/db';
import { listProfiles } from './lib/profiles';
import { go, parseAdultRoute, useRoute } from './lib/router';
import { setZoomLocked } from './lib/touchGuards';
import { AdultGate } from './screens/AdultGate';
import { AlertsScreen } from './screens/AlertsScreen';
import { AssessmentHome } from './screens/AssessmentHome';
import { AssessmentLauncher } from './screens/AssessmentLauncher';
import { Backup } from './screens/Backup';
import { AdultZone } from './screens/AdultZone';
import { ChildHome } from './screens/ChildHome';
import { ProfileForm } from './screens/ProfileForm';
import { ProfilePicker } from './screens/ProfilePicker';
import { Progress } from './screens/Progress';
import { Report } from './screens/Report';
import { SessionRunner } from './screens/SessionRunner';

/** Título de la pestaña según la pantalla (también lo anuncian los lectores de pantalla). */
export function titleFor(route: string): string {
  if (route === 'puerta') return 'Zona de adultos · Hablemos';
  if (route === 'inicio') return 'Inicio · Hablemos';
  if (route === 'jugar') return 'Jugando · Hablemos';
  const adult = parseAdultRoute(route);
  if (adult) {
    const names: Record<string, string> = {
      home: 'Zona de adultos',
      nuevo: 'Nuevo perfil',
      editar: 'Editar perfil',
      seguimiento: 'Seguimiento',
      evaluacion: 'Evaluación',
      evaluar: 'Evaluando',
      reporte: 'Reporte',
      respaldo: 'Respaldo',
      alertas: 'Señales de alerta',
      desconocida: 'Zona de adultos',
    };
    return `${names[adult.name]} · Hablemos`;
  }
  return 'Hablemos';
}

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

  // Al cambiar de pantalla: título nuevo y foco en el contenido (lectores de pantalla y teclado).
  useEffect(() => {
    document.title = titleFor(route);
    const id = window.requestAnimationFrame(() => {
      const main = document.querySelector('main');
      if (main) {
        main.setAttribute('tabindex', '-1');
        main.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [route]);

  const adultRoute = parseAdultRoute(route);
  const inAdultArea = adultRoute !== null;

  // Zoom bloqueado para el niño; permitido en la zona de adultos (accesibilidad para baja visión).
  useEffect(() => {
    setZoomLocked(!inAdultArea);
  }, [inAdultArea]);
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

  if (adultRoute && unlocked) {
    const backToZone = () => void reload().then(() => go('adultos'));
    const profileOf = (id: string) => profiles.find((p) => p.id === id);
    switch (adultRoute.name) {
      case 'nuevo':
        return <ProfileForm onDone={backToZone} />;
      case 'editar': {
        const profile = profileOf(adultRoute.id);
        if (!profile) break;
        return <ProfileForm profile={profile} onDone={backToZone} />;
      }
      case 'seguimiento': {
        const profile = profileOf(adultRoute.id);
        if (!profile) break;
        return <Progress profile={profile} />;
      }
      case 'evaluacion': {
        const profile = profileOf(adultRoute.id);
        if (!profile) break;
        return <AssessmentHome profile={profile} />;
      }
      case 'evaluar': {
        const profile = profileOf(adultRoute.id);
        if (!profile) break;
        return <AssessmentLauncher key={adultRoute.kind} profile={profile} kind={adultRoute.kind} />;
      }
      case 'reporte': {
        const profile = profileOf(adultRoute.id);
        if (!profile) break;
        return <Report profile={profile} />;
      }
      case 'respaldo':
        return <Backup onImported={reload} />;
      case 'alertas':
        return <AlertsScreen />;
      case 'home':
        return <AdultZone profiles={profiles} loadError={loadError} onChanged={reload} onExit={() => go('')} />;
    }
    // Ruta desconocida o niño que ya no existe: se vuelve a la zona de adultos.
    go('adultos');
    return null;
  }

  if (route === 'inicio' && active) {
    return <ChildHome profile={active} onPlay={() => go('jugar')} onExit={() => go('')} />;
  }

  if (route === 'jugar' && active) {
    return <SessionRunner profile={active} onExit={() => go('inicio')} />;
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
