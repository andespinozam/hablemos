interface Props {
  onRepeat: () => void;
}

/** "🔊 Repetir": siempre visible durante el juego. */
export function RepeatButton({ onRepeat }: Props) {
  return (
    <button type="button" className="btn btn--accent" onClick={onRepeat} aria-label="Repetir la instrucción">
      <span aria-hidden="true">🔊</span> Repetir
    </button>
  );
}
