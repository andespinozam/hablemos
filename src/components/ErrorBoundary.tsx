import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
}

/** Si una pantalla falla, se muestra un mensaje amable en lugar de dejar la pantalla en blanco. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="screen screen--center" role="alert">
        <p className="avatar" aria-hidden="true">
          🙈
        </p>
        <h1>Algo salió mal</h1>
        <p>No pasa nada: tu progreso está guardado. Pide ayuda a un adulto.</p>
        <button
          type="button"
          className="btn btn--good btn--big"
          onClick={() => {
            window.location.hash = '/';
            window.location.reload();
          }}
        >
          🔄 Volver a empezar
        </button>
      </main>
    );
  }
}
