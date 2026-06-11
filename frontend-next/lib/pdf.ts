import type { Prediction } from './types'
import { DESCRIPTIONS, BADGES, SEVERITY_MAP, SEVERITY_LABELS, CLASSES_INFO } from './constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

type RGB = [number, number, number]

const SEVERITY_RGB: Record<string, RGB> = {
  critical: [220, 38,  38],
  high:     [217, 119,  6],
  moderate: [  8, 145, 178],
  normal:   [ 22, 163,  74],
}

const SEVERITY_BG_RGB: Record<string, RGB> = {
  critical: [254, 226, 226],
  high:     [254, 243, 199],
  moderate: [224, 242, 254],
  normal:   [220, 252, 231],
}

function confidenceLabel(pct: number): string {
  if (pct >= 85) return 'Alta confianza'
  if (pct >= 70) return 'Confianza moderada'
  if (pct >= 50) return 'Confianza baja'
  return 'Confianza muy baja'
}

function confidenceInterpretation(pct: number): string {
  if (pct >= 85)
    return 'El modelo identifica patrones muy consistentes con esta patología. Resultado robusto para apoyo diagnóstico.'
  if (pct >= 70)
    return 'Hallazgos sugestivos de la patología indicada. Se recomienda correlación con la clínica del paciente.'
  if (pct >= 50)
    return 'Hallazgos inespecíficos. La predicción es poco concluyente; se recomienda revisión por especialista.'
  return 'Resultado no concluyente. No utilizar como base diagnóstica sin evaluación clínica completa.'
}

// ── PDF builder ───────────────────────────────────────────────────────────────

export async function buildPdf(
  filename: string,
  originalBytes: Uint8Array,
  prediction: Prediction,
  notes?: string,
): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ format: 'a4', unit: 'pt' })
  const W = 595
  const H = 842
  const MARGIN = 42
  const COL2 = 220  // second column x for key-value rows

  const severity    = SEVERITY_MAP[prediction.predicted_class] ?? 'normal'
  const severityRgb = SEVERITY_RGB[severity]
  const severityBg  = SEVERITY_BG_RGB[severity]
  const confPct     = prediction.confidence * 100
  const now         = new Date().toLocaleString('es-PE')

  // Adds a new page and resets y, returns new y
  const newPage = (): number => { doc.addPage(); return 50 }
  const pageBreakIfNeeded = (y: number, needed: number): number =>
    y + needed > H - 60 ? newPage() : y

  // Section header helper
  const sectionHeader = (label: string, y: number): number => {
    y = pageBreakIfNeeded(y, 24)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(15, 23, 42)
    doc.text(label, MARGIN, y)
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.5)
    doc.line(MARGIN, y + 4, W - MARGIN, y + 4)
    return y + 16
  }

  // ── 1. Header bar ──────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 68, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(17)
  doc.setFont('helvetica', 'bold')
  doc.text('Reporte CXR Classifier', MARGIN, 28)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('Sistema de apoyo diagnóstico por IA — HNAL 2026', MARGIN, 44)
  doc.text(now, W - MARGIN, 44, { align: 'right' })
  if (prediction.model_version) {
    doc.setTextColor(148, 163, 184)
    doc.setFontSize(7.5)
    doc.text(`Modelo: ${prediction.model_version}`, W - MARGIN, 56, { align: 'right' })
  }

  let y = 84

  // ── 2. Severity alert banner ───────────────────────────────────────────────
  doc.setFillColor(...severityBg)
  doc.roundedRect(MARGIN, y, W - MARGIN * 2, 44, 4, 4, 'F')
  doc.setDrawColor(...severityRgb)
  doc.setLineWidth(0.5)
  doc.roundedRect(MARGIN, y, W - MARGIN * 2, 44, 4, 4, 'S')
  // Left colored stripe
  doc.setFillColor(...severityRgb)
  doc.roundedRect(MARGIN, y, 5, 44, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...severityRgb)
  const badgeLabel = BADGES[prediction.predicted_class] ?? prediction.predicted_class
  doc.text(badgeLabel, MARGIN + 14, y + 17)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(55, 65, 81)
  const severityText = `${SEVERITY_LABELS[severity]} · Confianza: ${confPct.toFixed(1)}% · ${confidenceLabel(confPct)}`
  doc.text(severityText, MARGIN + 14, y + 32)

  // Confidence badge top-right
  doc.setFillColor(...severityRgb)
  doc.roundedRect(W - MARGIN - 60, y + 10, 54, 20, 4, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`${confPct.toFixed(1)}%`, W - MARGIN - 33, y + 24, { align: 'center' })

  y += 56

  // ── 3. Summary ─────────────────────────────────────────────────────────────
  y = sectionHeader('Datos del estudio', y)
  doc.setFontSize(9)

  const summaryRows: [string, string][] = [
    ['Archivo',               filename],
    ['Modelo',                prediction.model_version ?? 'CXR-Ensemble (DenseNet121 + ViT)'],
    ['Tiempo de proceso',     `${prediction.processing_time_ms.toFixed(0)} ms`],
    ...(prediction.cached     ? [['Resultado', 'Obtenido desde caché (imagen ya procesada)'] as [string, string]] : []),
    ...(prediction.image_hash ? [['Hash SHA-256', `${prediction.image_hash.slice(0, 32)}…`]  as [string, string]] : []),
  ]

  for (const [label, value] of summaryRows) {
    y = pageBreakIfNeeded(y, 14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(75, 85, 99)
    doc.text(`${label}:`, MARGIN + 8, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    const labelW = doc.getTextWidth(`${label}:`)
    const valueX = Math.max(MARGIN + 8 + labelW + 6, COL2)
    const wrappedVal = doc.splitTextToSize(value, W - MARGIN - valueX - 8)
    doc.text(wrappedVal, valueX, y)
    y += Math.max(wrappedVal.length * 11, 13)
  }
  y += 8

  // ── 4. Positive findings ───────────────────────────────────────────────────
  if (prediction.positive_findings && prediction.positive_findings.length > 0) {
    y = sectionHeader('Hallazgos positivos detectados', y)
    doc.setFontSize(9)
    for (const finding of prediction.positive_findings) {
      y = pageBreakIfNeeded(y, 14)
      const isPrimary = finding === prediction.predicted_class
      doc.setFillColor(...severityRgb)
      doc.circle(MARGIN + 12, y - 2.5, 2.5, 'F')
      doc.setFont('helvetica', isPrimary ? 'bold' : 'normal')
      doc.setTextColor(15, 23, 42)
      const label = BADGES[finding] ?? finding
      const prob  = prediction.probabilities[finding]
      const probStr = prob !== undefined ? ` — ${(prob * 100).toFixed(1)}%` : ''
      const hint  = CLASSES_INFO[finding] ? `  (${CLASSES_INFO[finding]})` : ''
      doc.text(`${label}${probStr}${hint}`, MARGIN + 20, y)
      y += 14
    }
    y += 6
  }

  // ── 5. Confidence interpretation ──────────────────────────────────────────
  y = sectionHeader('Interpretación de la confianza', y)
  doc.setFontSize(9)

  // Badge
  doc.setFillColor(...severityBg)
  doc.setDrawColor(...severityRgb)
  doc.setLineWidth(0.4)
  doc.roundedRect(MARGIN + 8, y - 8, 110, 14, 3, 3, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...severityRgb)
  doc.text(confidenceLabel(confPct), MARGIN + 63, y, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(55, 65, 81)
  const interpLines = doc.splitTextToSize(confidenceInterpretation(confPct), W - MARGIN * 2 - 16)
  y += 10
  doc.text(interpLines, MARGIN + 8, y)
  y += interpLines.length * 12 + 4

  // Uncertainty if available
  if (prediction.uncertainty_std) {
    const topUncert = Object.entries(prediction.uncertainty_std)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
    if (topUncert.length > 0) {
      y = pageBreakIfNeeded(y, 18)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(107, 114, 128)
      const uncertParts = topUncert.map(([cls, std]) =>
        `${BADGES[cls] ?? cls}: ±${(std * 100).toFixed(1)}%`
      ).join(' · ')
      doc.text(`Incertidumbre (MC Dropout): ${uncertParts}`, MARGIN + 8, y)
      y += 14
    }
  }
  y += 4

  // ── 6. Images ─────────────────────────────────────────────────────────────
  const toDataUrl = (bytes: Uint8Array): Promise<string> =>
    new Promise((resolve, reject) => {
      const blob   = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' })
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

  y = pageBreakIfNeeded(y, 200)
  y = sectionHeader('Imágenes del estudio', y)

  try {
    const origDataUrl = await toDataUrl(originalBytes)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(75, 85, 99)
    doc.text('Imagen original', MARGIN, y)
    doc.addImage(origDataUrl, 'PNG', MARGIN, y + 4, 175, 165)

    if (prediction.gradcam_image) {
      const camUrl = prediction.gradcam_image.includes(',')
        ? prediction.gradcam_image
        : `data:image/png;base64,${prediction.gradcam_image}`
      const camTitle = prediction.gradcam_class
        ? `Grad-CAM — ${BADGES[prediction.gradcam_class] ?? prediction.gradcam_class}`
        : 'Mapa de calor (Grad-CAM)'
      doc.text(camTitle, 252, y)
      doc.addImage(camUrl, 'PNG', 252, y + 4, 175, 165)
    }
    y += 176

    // Grad-CAM caption
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.setTextColor(107, 114, 128)
    const camCaption = prediction.gradcam_image
      ? 'El mapa de calor (Grad-CAM) resalta las regiones de la imagen que mayor peso tuvieron en la predicción del modelo. Zonas en rojo/amarillo indican alta activación; azul/verde, baja activación.'
      : 'Grad-CAM no disponible para este análisis.'
    const captionLines = doc.splitTextToSize(camCaption, W - MARGIN * 2)
    doc.text(captionLines, MARGIN, y)
    y += captionLines.length * 10 + 8
  } catch (_) { /* images failed — continue */ }

  // ── 7. Differential probabilities with visual bars ─────────────────────────
  y = pageBreakIfNeeded(y, 30)
  y = sectionHeader('Diagnósticos diferenciales — probabilidades', y)

  const sorted      = Object.entries(prediction.probabilities).sort(([, a], [, b]) => b - a)
  const BAR_X       = MARGIN + 160
  const BAR_MAX_W   = W - MARGIN - BAR_X - 55
  const BAR_H       = 6

  doc.setFontSize(8.5)
  for (const [cls, prob] of sorted) {
    y = pageBreakIfNeeded(y, 16)
    const pct        = prob * 100
    const isPrimary  = cls === prediction.predicted_class
    const clsSev     = SEVERITY_MAP[cls] ?? 'normal'
    const barColor   = SEVERITY_RGB[clsSev]

    // Class name
    doc.setFont('helvetica', isPrimary ? 'bold' : 'normal')
    doc.setTextColor(isPrimary ? 15 : 75, isPrimary ? 23 : 85, isPrimary ? 42 : 99)
    doc.text(BADGES[cls] ?? cls, MARGIN + 8, y)

    // Visual bar background
    doc.setFillColor(226, 232, 240)
    doc.roundedRect(BAR_X, y - BAR_H + 1, BAR_MAX_W, BAR_H, 2, 2, 'F')
    // Fill
    if (pct > 0) {
      doc.setFillColor(...barColor)
      doc.roundedRect(BAR_X, y - BAR_H + 1, BAR_MAX_W * pct / 100, BAR_H, 2, 2, 'F')
    }

    // Percentage label
    doc.setFont('helvetica', isPrimary ? 'bold' : 'normal')
    doc.setTextColor(15, 23, 42)
    doc.text(`${pct.toFixed(1)}%`, W - MARGIN - 8, y, { align: 'right' })

    y += 14
  }
  y += 6

  // ── 8. Clinical description ────────────────────────────────────────────────
  const desc = DESCRIPTIONS[prediction.predicted_class]
  if (desc) {
    y = pageBreakIfNeeded(y, 50)
    y = sectionHeader('Descripción clínica del hallazgo', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(55, 65, 81)
    const descLines = doc.splitTextToSize(desc, W - MARGIN * 2 - 16)
    y = pageBreakIfNeeded(y, descLines.length * 12 + 4)
    doc.text(descLines, MARGIN + 8, y)
    y += descLines.length * 12 + 8
  }

  // ── 9. Explanation fields from backend ────────────────────────────────────
  const exp = prediction.explanation
  if (exp && (exp.summary || exp.visual || exp.clinical)) {
    y = pageBreakIfNeeded(y, 40)
    y = sectionHeader('Explicación generada por el modelo', y)
    doc.setFontSize(9)

    const expRows: [string, string | undefined][] = [
      ['Resumen',         exp.summary],
      ['Región visual',   exp.visual],
      ['Contexto clínico',exp.clinical],
    ]
    for (const [label, text] of expRows) {
      if (!text) continue
      y = pageBreakIfNeeded(y, 16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(75, 85, 99)
      doc.text(`${label}:`, MARGIN + 8, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(15, 23, 42)
      const lines = doc.splitTextToSize(text, W - MARGIN * 2 - 16)
      y += 11
      doc.text(lines, MARGIN + 8, y)
      y += lines.length * 11 + 6
    }
    y += 4
  }

  // ── 10. Image warnings ─────────────────────────────────────────────────────
  if (prediction.image_warnings && prediction.image_warnings.length > 0) {
    y = pageBreakIfNeeded(y, 40)
    y = sectionHeader('Advertencias de calidad de imagen', y)
    doc.setFontSize(9)
    for (const warn of prediction.image_warnings) {
      y = pageBreakIfNeeded(y, 14)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(217, 119, 6)
      doc.text('⚠', MARGIN + 8, y)
      doc.setTextColor(55, 65, 81)
      doc.text(warn, MARGIN + 20, y)
      y += 13
    }
    y += 4
  }

  // ── 11. Clinical notes ─────────────────────────────────────────────────────
  if (notes && notes.trim()) {
    y = pageBreakIfNeeded(y, 60)
    y = sectionHeader('Notas clínicas del radiólogo', y)

    doc.setFillColor(240, 253, 250)
    const noteLines = doc.splitTextToSize(notes.trim(), W - MARGIN * 2 - 24)
    const boxH      = noteLines.length * 12 + 18
    y = pageBreakIfNeeded(y, boxH + 10)
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, boxH, 4, 4, 'F')
    doc.setDrawColor(8, 145, 178)
    doc.setLineWidth(0.5)
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, boxH, 4, 4, 'S')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(55, 65, 81)
    doc.text(noteLines, MARGIN + 10, y + 12)
    y += boxH + 12
  }

  // ── 12. Methodology ────────────────────────────────────────────────────────
  y = pageBreakIfNeeded(y, 70)
  y = sectionHeader('Metodología del sistema', y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(107, 114, 128)
  const methText =
    'El sistema utiliza un modelo ensemble compuesto por una red neuronal convolucional DenseNet121 ' +
    'y un Vision Transformer (ViT) con 4 bloques y 8 cabezas de atención. Las predicciones de ambas ' +
    'arquitecturas se combinan mediante promedio ponderado sobre 14 clases patológicas. ' +
    'La explicabilidad visual se genera mediante Grad-CAM (Gradient-weighted Class Activation Mapping), ' +
    'que pondera los gradientes de la clase predicha sobre el mapa de características de la última capa convolucional. ' +
    'Todos los umbrales de clasificación por clase fueron optimizados sobre el conjunto de validación.'
  const methLines = doc.splitTextToSize(methText, W - MARGIN * 2 - 16)
  doc.text(methLines, MARGIN + 8, y)
  y += methLines.length * 11 + 8

  // ── 13. Disclaimer (pinned to bottom of last page) ─────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'bolditalic')
    doc.setFontSize(7.5)
    doc.setTextColor(107, 114, 128)
    const discl = p === totalPages
      ? (prediction.disclaimer ?? 'USO ACADÉMICO. Este sistema no reemplaza el criterio clínico del radiólogo certificado.')
      : ''
    if (discl) {
      const disclLines = doc.splitTextToSize(discl, W - MARGIN * 2)
      doc.text(disclLines, MARGIN, H - 42)
    }
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Página ${p} de ${totalPages} · Documento generado automáticamente · No constituye diagnóstico médico independiente`,
      W / 2, H - 18, { align: 'center' }
    )
  }

  return new Uint8Array(doc.output('arraybuffer') as unknown as ArrayBuffer)
}
