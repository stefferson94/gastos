import { formatMoney } from "../domain/money.js";

export function MetricCard({ label, value, kind, helper }) {
  return (
    <article className={`metric metric-${kind}`}>
      <span>{label}</span>
      <strong>{formatMoney(value)}</strong>
      <small>{helper}</small>
    </article>
  );
}

export function EditableMetricCard({ label, value, kind, helper, isEditing, draftValue, onStartEdit, onChange, onSave }) {
  return (
    <article className={`metric metric-${kind} editable-metric`}>
      <div className="metric-title-row">
        <span>{label}</span>
      </div>
      {isEditing ? (
        <form id="income-edit-form" className="metric-inline-edit" onSubmit={onSave}>
          <input
            aria-label="Rendimento liquido"
            inputMode="decimal"
            value={draftValue}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onSave}
            autoFocus
          />
        </form>
      ) : (
        <>
          <strong role="button" tabIndex={0} onClick={onStartEdit} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onStartEdit();
          }}>
            {formatMoney(value)}
          </strong>
          <small>{helper}</small>
        </>
      )}
      {isEditing && <small>{helper}</small>}
    </article>
  );
}
