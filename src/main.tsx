import './styles/fonts.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import './styles/global.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadRecordingsForVoice } from './lib/recordingsStore';
import { initVoice } from './lib/voice';
import { requestPersistence } from './lib/storage';
import { installTouchGuards } from './lib/touchGuards';

installTouchGuards();
void initVoice(loadRecordingsForVoice); // clips grabados (si los hay) para la voz
void requestPersistence(); // pide que el navegador no borre los datos si falta espacio

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
