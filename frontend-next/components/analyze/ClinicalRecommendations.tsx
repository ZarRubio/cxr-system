import type { Prediction } from '@/lib/types'

export function ClinicalRecommendations({ prediction }: { prediction: Prediction }) {
  return (
    <div className="text-sm text-[var(--fg-muted)] leading-6 space-y-3">
      <p>Clase principal del modelo: <strong className="text-[var(--fg)]">{prediction.predicted_class}</strong>. Las etiquetas son categorías de entrenamiento, no un informe radiológico.</p>
      <ul className="list-disc pl-5 space-y-2">
        <li>Contrastar el resultado con la radiografía original y el contexto del estudio.</li>
        <li>Revisar también los hallazgos adicionales y las advertencias técnicas.</li>
        <li>Registrar la interpretación independiente del radiólogo y su concordancia con el resultado.</li>
      </ul>
      <p className="text-xs">El sistema no determina conducta terapéutica, dimensiones de lesiones ni gravedad clínica.</p>
    </div>
  )
}
