import type { Prediction } from '@/lib/types'

/**
 * Orientación de lectura (US24). Cuando el backend envía la explicación de la clase principal
 * (constants/clinical_text.py) se muestra tal cual: describe la etiqueta y qué revisar, sin
 * diagnósticos ni conductas. Los registros abiertos desde el historial no la traen.
 */
export function ClinicalRecommendations({ prediction }: { prediction: Prediction }) {
  const explanation = prediction.explanation
  const items = explanation
    ? [
        { label: 'Qué puede estar captando el modelo', text: explanation.summary },
        { label: 'Qué revisar en el mapa de calor', text: explanation.visual },
        { label: 'Antes de interpretar', text: explanation.clinical },
      ].filter((item): item is { label: string; text: string } => Boolean(item.text))
    : []
  return (
    <div className="text-sm text-[var(--fg-muted)] leading-6 space-y-3">
      <p>Clase principal del modelo: <strong className="text-[var(--fg)]">{prediction.predicted_class}</strong>. Las etiquetas son categorías de entrenamiento, no un informe radiológico.</p>
      {items.length > 0 && (
        <dl className="space-y-2" aria-label={`Orientación para ${prediction.predicted_class}`}>
          {items.map(({ label, text }) => (
            <div key={label}>
              <dt className="text-xs font-semibold text-[var(--fg)]">{label}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      )}
      <ul className="list-disc pl-5 space-y-2">
        <li>Contrastar el resultado con la radiografía original y el contexto del estudio.</li>
        <li>Revisar también los hallazgos adicionales y las advertencias técnicas.</li>
        <li>Registrar la interpretación independiente del radiólogo y su concordancia con el resultado.</li>
      </ul>
      <p className="text-xs">El sistema no determina conducta terapéutica, dimensiones de lesiones ni gravedad clínica.</p>
    </div>
  )
}
