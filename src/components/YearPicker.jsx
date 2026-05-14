function getYearOptions(activeYear) {
  return Array.from({ length: 6 }, (_, index) => activeYear - 2 + index);
}

export function YearPicker({ activeYear, draft, error, onChange, onClose, onSelectYear, onSubmit }) {
  return (
    <div className="year-picker-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="year-picker-sheet"
        aria-label="Alterar ano financeiro"
        aria-modal="true"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="year-picker-handle" aria-hidden="true" />
        <div className="year-picker-heading">
          <span className="eyebrow">Periodo</span>
          <h2>Alterar ano</h2>
          <p>Escolha um ano financeiro para visualizar seus meses e lancamentos.</p>
        </div>

        <div className="year-picker-options" aria-label="Anos proximos">
          {getYearOptions(activeYear).map((year) => (
            <button
              className={year === activeYear ? "active" : ""}
              key={year}
              type="button"
              onClick={() => onSelectYear(year)}
            >
              {year}
            </button>
          ))}
        </div>

        <form className="year-picker-form" onSubmit={onSubmit}>
          <label>
            Informar outro ano
            <input
              autoFocus
              inputMode="numeric"
              value={draft}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="year-picker-actions">
            <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
            <button className="primary-button" type="submit">Aplicar</button>
          </div>
        </form>
      </section>
    </div>
  );
}
