import type { Prediction } from './types'
import { DESCRIPTIONS, BADGES, SEVERITY_MAP, SEVERITY_LABELS, CLASSES_INFO } from './constants'

export interface StudyMeta {
  studyId:            string
  projection:         string
  clinicalIndication: string
  radiologistName?:   string   // tomado de la sesión NextAuth
  radiologistCmp?:    string   // tomado de la sesión NextAuth
}

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

// Line heights per font size — 1.6–1.7× ratio to avoid any overlap
const LH: Record<number, number> = {
  6.5: 10,
  7:   11,
  7.5: 13,
  8:   14,
  8.5: 15,
  9:   16,
  9.5: 17,
}

function scoreLabel(pct: number): string {
  if (pct >= 85) return 'Score alto'
  if (pct >= 70) return 'Score moderado'
  if (pct >= 50) return 'Score bajo'
  return 'Score muy bajo'
}

function scoreInterpretation(pct: number): string {
  if (pct >= 85)
    return 'El modelo identifica patrones muy consistentes con esta patología. Resultado robusto para apoyo diagnóstico.'
  if (pct >= 70)
    return 'Hallazgos sugestivos de la patología indicada. Se recomienda correlación con la clínica del paciente.'
  if (pct >= 50)
    return 'Hallazgos inespecíficos. La predicción es poco concluyente; se recomienda revisión por especialista.'
  return 'Resultado no concluyente. No utilizar como base diagnóstica sin evaluación clínica completa.'
}

export async function buildPdf(
  filename: string,
  originalBytes: Uint8Array,
  prediction: Prediction,
  notes?: string,
  meta?: StudyMeta,
): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf')
  const doc  = new jsPDF({ format: 'a4', unit: 'pt' })
  const W    = 595
  const H    = 842
  const M    = 40    // left/right margin
  const COL  = 170   // key column width
  const FOOT = 56    // footer reserved height

  const severity = SEVERITY_MAP[prediction.predicted_class] ?? 'normal'
  const sevRgb   = SEVERITY_RGB[severity]
  const sevBg    = SEVERITY_BG_RGB[severity]
  const confPct  = prediction.confidence * 100
  const now      = new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })

  // ── Core helpers ──────────────────────────────────────────────────────────

  /** Move to next page if `needed` pt won't fit before footer */
  const pb = (y: number, needed: number): number =>
    y + needed > H - FOOT ? (doc.addPage(), 56) : y

  /**
   * Draw each line of `lines` manually at exact y positions.
   * Returns the y of the BASELINE of the last line drawn.
   */
  const drawLines = (lines: string[], x: number, startY: number, lineH: number): number => {
    lines.forEach((line, i) => doc.text(line, x, startY + i * lineH))
    return startY + (lines.length - 1) * lineH
  }

  /**
   * Section header: teal bold label + colored rule.
   * Returns y of first content line (22 pt below label baseline).
   */
  const sectionHeader = (label: string, y: number): number => {
    y = pb(y, 34)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(8, 145, 178)
    doc.text(label.toUpperCase(), M, y)
    doc.setDrawColor(8, 145, 178)
    doc.setLineWidth(0.75)
    doc.line(M, y + 7, W - M, y + 7)
    return y + 24
  }

  /**
   * Key-value row. Returns y of next row.
   * Both label and first value line share the same baseline.
   */
  const kvRow = (label: string, value: string, y: number): number => {
    y = pb(y, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(100, 116, 139)
    doc.text(label, M + 6, y)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    const lines = doc.splitTextToSize(value, W - M - (M + COL) - 4)
    drawLines(lines, M + COL, y, LH[8.5])
    return y + lines.length * LH[8.5] + 2
  }

  // ── 1. Header bar ─────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 74, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Reporte de Análisis CXR', M, 32)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Sistema de apoyo diagnóstico por IA — Hospital Nacional Arzobispo Loayza · HNAL 2026', M, 48)
  doc.text(`Generado: ${now}`, W - M, 48, { align: 'right' })

  if (prediction.model_version) {
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(`Modelo: ${prediction.model_version}`, W - M, 62, { align: 'right' })
  }

  let y = 94

  // ── 2. Main finding banner ─────────────────────────────────────────────────
  const BANNER_H = 62
  doc.setFillColor(...sevBg)
  doc.roundedRect(M, y, W - M * 2, BANNER_H, 5, 5, 'F')
  doc.setDrawColor(...sevRgb)
  doc.setLineWidth(0.5)
  doc.roundedRect(M, y, W - M * 2, BANNER_H, 5, 5, 'S')
  doc.setFillColor(...sevRgb)
  doc.roundedRect(M, y, 6, BANNER_H, 3, 3, 'F')

  // Severity chip
  doc.setFillColor(...sevRgb)
  doc.roundedRect(M + 14, y + 10, 70, 16, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  doc.text(SEVERITY_LABELS[severity].toUpperCase(), M + 49, y + 21, { align: 'center' })

  // Finding name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...sevRgb)
  const badgeLabel = prediction.predicted_class === 'No Finding'
    ? 'Sin hallazgos patológicos'
    : (BADGES[prediction.predicted_class] ?? prediction.predicted_class)
  doc.text(badgeLabel, M + 14, y + 47)

  // Score badge (right side)
  const BADGE_W = 86
  const BADGE_X = W - M - BADGE_W - 6
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(BADGE_X, y + 8, BADGE_W, 44, 4, 4, 'F')
  doc.setDrawColor(...sevRgb)
  doc.setLineWidth(0.75)
  doc.roundedRect(BADGE_X, y + 8, BADGE_W, 44, 4, 4, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...sevRgb)
  doc.text(`${confPct.toFixed(1)}%`, BADGE_X + BADGE_W / 2, y + 34, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  doc.text('SCORE IA', BADGE_X + BADGE_W / 2, y + 47, { align: 'center' })

  y += BANNER_H + 20

  // ── 3. Study metadata ──────────────────────────────────────────────────────
  y = sectionHeader('Datos del estudio', y)
  if (meta?.studyId)            y = kvRow('ID de estudio',       meta.studyId, y)
  if (meta?.projection)         y = kvRow('Proyección',          meta.projection, y)
  if (meta?.clinicalIndication) y = kvRow('Indicación clínica',  meta.clinicalIndication, y)
  y = kvRow('Fecha del informe', now, y)
  y = kvRow('Archivo de imagen', filename, y)
  y = kvRow('Modelo IA',         prediction.model_version ?? 'CXR-Ensemble (DenseNet121 + ViT)', y)
  y = kvRow('Tiempo de proceso', `${prediction.processing_time_ms.toFixed(0)} ms`, y)
  if (prediction.image_hash) y = kvRow('Hash imagen', `${prediction.image_hash.slice(0, 40)}…`, y)
  y += 14

  // ── 4. Positive findings ───────────────────────────────────────────────────
  if (prediction.positive_findings && prediction.positive_findings.length > 0) {
    y = sectionHeader('Hallazgos sobre umbral diagnóstico', y)

    const primary    = prediction.predicted_class
    const secondary  = prediction.positive_findings.filter((f) => f !== primary)
    const allInOrder = [primary, ...secondary]

    for (const finding of allInOrder) {
      const isPrimary = finding === primary
      const rowH      = isPrimary ? 34 : 22
      y = pb(y, rowH)

      const prob    = prediction.probabilities[finding]
      const probStr = prob !== undefined ? `${(prob * 100).toFixed(1)}%` : ''
      const label   = BADGES[finding] ?? finding
      const clsInfo = CLASSES_INFO[finding] ?? ''
      const fs      = isPrimary ? 9.5 : 8.5

      // Dot marker — centered at text cap height
      doc.setFillColor(...SEVERITY_RGB[SEVERITY_MAP[finding] ?? 'normal'])
      doc.circle(M + 10, y - 4, isPrimary ? 4 : 3, 'F')

      // Finding label
      doc.setFont('helvetica', isPrimary ? 'bold' : 'normal')
      doc.setFontSize(fs)
      doc.setTextColor(15, 23, 42)
      doc.text(label, M + 20, y)

      // Short description (same baseline)
      if (clsInfo) {
        const descX = M + 20 + doc.getTextWidth(label) + 4
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(107, 114, 128)
        doc.text(`(${clsInfo})`, descX, y)
      }

      // Probability right
      if (probStr) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(...SEVERITY_RGB[SEVERITY_MAP[finding] ?? 'normal'])
        doc.text(probStr, W - M - 6, y, { align: 'right' })
      }

      // "Hallazgo principal" tag on second line
      if (isPrimary) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7)
        doc.setTextColor(107, 114, 128)
        doc.text('Hallazgo principal', M + 20, y + 14)
      }

      y += rowH
    }
    y += 10
  }

  // ── 5. Score interpretation ────────────────────────────────────────────────
  y = sectionHeader('Interpretación del score IA', y)

  // Chip — top at y, bottom at y + CHIP_H
  const CHIP_H = 20
  doc.setFillColor(...sevBg)
  doc.setDrawColor(...sevRgb)
  doc.setLineWidth(0.4)
  doc.roundedRect(M + 6, y, 112, CHIP_H, 3, 3, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...sevRgb)
  // Baseline at vertical center of chip (y + CHIP_H*0.65)
  doc.text(scoreLabel(confPct), M + 62, y + 13, { align: 'center' })

  y += CHIP_H + 12  // below chip + gap

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(55, 65, 81)
  const interpLines = doc.splitTextToSize(scoreInterpretation(confPct), W - M * 2 - 12)
  drawLines(interpLines, M + 6, y, LH[9])
  y += interpLines.length * LH[9] + 10

  y += 12

  // ── 6. Images ──────────────────────────────────────────────────────────────
  y = pb(y, 250)
  y = sectionHeader('Imágenes del estudio', y)

  const toDataUrl = (bytes: Uint8Array): Promise<string> =>
    new Promise((resolve, reject) => {
      const blob   = new Blob([bytes.buffer as ArrayBuffer])
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

  const IMG_W = Math.floor((W - M * 2 - 16) / 2)
  const IMG_H = Math.round(IMG_W * 0.95)

  try {
    const origUrl = await toDataUrl(originalBytes)

    // Column labels
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(75, 85, 99)
    doc.text('Radiografía original', M, y)
    doc.text(
      prediction.gradcam_class
        ? `Mapa de activación — ${BADGES[prediction.gradcam_class] ?? prediction.gradcam_class}`
        : 'Mapa de activación (Grad-CAM)',
      M + IMG_W + 16, y,
    )
    y += 12  // gap between label baseline and image top

    doc.addImage(origUrl, 'PNG', M, y, IMG_W, IMG_H)

    if (prediction.gradcam_image) {
      const camUrl = prediction.gradcam_image.includes(',')
        ? prediction.gradcam_image
        : `data:image/png;base64,${prediction.gradcam_image}`
      doc.addImage(camUrl, 'PNG', M + IMG_W + 16, y, IMG_W, IMG_H)
    } else {
      doc.setFillColor(240, 244, 248)
      doc.roundedRect(M + IMG_W + 16, y, IMG_W, IMG_H, 4, 4, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text('Grad-CAM no disponible', M + IMG_W + 16 + IMG_W / 2, y + IMG_H / 2, { align: 'center' })
    }

    y += IMG_H + 14

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.setTextColor(107, 114, 128)
    const caption  = 'El mapa de activación (Grad-CAM) resalta las regiones que mayor peso tuvieron en la predicción. Rojo/amarillo = alta activación; verde/azul = baja activación.'
    const capLines = doc.splitTextToSize(caption, W - M * 2)
    drawLines(capLines, M, y, LH[7.5])
    y += capLines.length * LH[7.5] + 14
  } catch {
    y += 8
  }

  // ── 8. Clinical description ────────────────────────────────────────────────
  const desc = DESCRIPTIONS[prediction.predicted_class]
  if (desc) {
    y = pb(y, 50)
    y = sectionHeader('Descripción clínica del hallazgo', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(55, 65, 81)
    const descLines = doc.splitTextToSize(desc, W - M * 2 - 12)
    y = pb(y, descLines.length * LH[9] + 4)
    drawLines(descLines, M + 6, y, LH[9])
    y += descLines.length * LH[9] + 14
  }

  // ── 9. Model explanation ───────────────────────────────────────────────────
  const exp = prediction.explanation
  if (exp && (exp.summary || exp.visual || exp.clinical)) {
    y = pb(y, 40)
    y = sectionHeader('Explicación generada por el modelo', y)

    for (const [label, text] of [
      ['Resumen',          exp.summary],
      ['Región visual',    exp.visual],
      ['Contexto clínico', exp.clinical],
    ] as [string, string | undefined][]) {
      if (!text) continue
      y = pb(y, 34)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(100, 116, 139)
      doc.text(`${label}:`, M + 6, y)
      y += LH[8.5]  // one full line height between bold label and content

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(15, 23, 42)
      const lines = doc.splitTextToSize(text, W - M * 2 - 12)
      y = pb(y, lines.length * LH[9])
      drawLines(lines, M + 6, y, LH[9])
      y += lines.length * LH[9] + 14
    }
  }

  // ── 10. Image quality warnings ─────────────────────────────────────────────
  if (prediction.image_warnings && prediction.image_warnings.length > 0) {
    y = pb(y, 40)
    y = sectionHeader('Advertencias de calidad de imagen', y)
    for (const warn of prediction.image_warnings) {
      y = pb(y, 24)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(217, 119, 6)
      doc.text('[!]', M + 6, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(55, 65, 81)
      const wLines = doc.splitTextToSize(warn, W - M * 2 - 28)
      drawLines(wLines, M + 24, y, LH[8.5])
      y += Math.max(wLines.length * LH[8.5], 20)
    }
    y += 10
  }

  // ── 11. Observaciones e impresión diagnóstica ─────────────────────────────
  y = pb(y, 80)
  y = sectionHeader('Impresión diagnóstica', y)

  const NOTE_LINE_H = 18
  const impressionText = notes && notes.trim()
    ? notes.trim()
    : `Estudio compatible con ${
        prediction.predicted_class === 'No Finding'
          ? 'hallazgos dentro de límites normales. No se identifican opacidades, consolidaciones ni masas evidentes.'
          : `${BADGES[prediction.predicted_class] ?? prediction.predicted_class} (Score IA ${confPct.toFixed(1)}%). ${DESCRIPTIONS[prediction.predicted_class] ?? ''} Se recomienda correlación con la clínica del paciente y criterio del radiólogo certificado.`
      }`

  const impLines = doc.splitTextToSize(impressionText, W - M * 2 - 24)
  const impBoxH  = impLines.length * NOTE_LINE_H + 32
  y = pb(y, impBoxH + 10)

  doc.setFillColor(240, 253, 250)
  doc.roundedRect(M, y, W - M * 2, impBoxH, 4, 4, 'F')
  doc.setFillColor(8, 145, 178)
  doc.roundedRect(M, y, 4, impBoxH, 2, 2, 'F')
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.5)
  doc.roundedRect(M, y, W - M * 2, impBoxH, 4, 4, 'S')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(55, 65, 81)
  drawLines(impLines, M + 12, y + 18, NOTE_LINE_H)
  y += impBoxH + 20

  // ── 12. Signature block ────────────────────────────────────────────────────
  y = pb(y, 80)
  const SIG_Y    = y
  const SIG_W    = (W - M * 2 - 20) / 2
  const SIG_H    = 54

  // Left: radiologist signature
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.5)
  doc.roundedRect(M, SIG_Y, SIG_W, SIG_H, 3, 3, 'S')

  doc.setDrawColor(100, 116, 139)
  doc.setLineWidth(0.4)
  doc.line(M + 10, SIG_Y + 34, M + SIG_W - 10, SIG_Y + 34)  // signature line

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(15, 23, 42)
  doc.text(
    meta?.radiologistName ? meta.radiologistName : 'Médico radiólogo',
    M + SIG_W / 2, SIG_Y + 43, { align: 'center' }
  )
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(
    meta?.radiologistCmp ? `CMP ${meta.radiologistCmp}` : 'CMP ______',
    M + SIG_W / 2, SIG_Y + 52, { align: 'center' }
  )
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text('Firma y sello del informante', M + SIG_W / 2, SIG_Y + 10, { align: 'center' })

  // Right: system info box
  const BOX2_X = M + SIG_W + 20
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.5)
  doc.roundedRect(BOX2_X, SIG_Y, SIG_W, SIG_H, 3, 3, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text('Sistema de apoyo diagnóstico IA', BOX2_X + SIG_W / 2, SIG_Y + 12, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(107, 114, 128)
  const sysLines = [
    `Estudio: ${meta?.studyId ?? '—'}`,
    `Informe: ${now}`,
    'CXR-Ensemble v1 · HNAL 2026',
    'Resultado sujeto a validación clínica',
  ]
  sysLines.forEach((line, i) => {
    doc.text(line, BOX2_X + SIG_W / 2, SIG_Y + 22 + i * 9, { align: 'center' })
  })

  y += SIG_H + 20

  // ── 13. Methodology ────────────────────────────────────────────────────────
  y = pb(y, 90)
  y = sectionHeader('Metodología del sistema', y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(107, 114, 128)
  const methText =
    'El sistema utiliza un ensemble de red neuronal convolucional DenseNet121 y Vision Transformer (ViT) con ' +
    '4 bloques y 8 cabezas de atención. Las predicciones se combinan por promedio ponderado sobre 14 clases patológicas. ' +
    'La explicabilidad visual se genera con Grad-CAM sobre la última capa convolucional. ' +
    'Los umbrales de clasificación fueron optimizados por clase sobre el conjunto de validación.'
  const methLines = doc.splitTextToSize(methText, W - M * 2 - 12)
  drawLines(methLines, M + 6, y, LH[8])

  // ── Footer on all pages ────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.5)
    doc.line(M, H - FOOT + 4, W - M, H - FOOT + 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text('Hospital Nacional Arzobispo Loayza · Sistema CXR — Apoyo diagnóstico IA · No constituye diagnóstico independiente', M, H - FOOT + 17)
    doc.text(`Pág. ${p} / ${totalPages}`, W - M, H - FOOT + 17, { align: 'right' })
    if (p === totalPages) {
      const discl = prediction.disclaimer
        ?? 'USO ACADÉMICO. Este sistema no reemplaza el criterio clínico del radiólogo certificado.'
      doc.setFont('helvetica', 'bolditalic')
      doc.setFontSize(7.5)
      doc.setTextColor(107, 114, 128)
      const dl = doc.splitTextToSize(discl, W - M * 2)
      drawLines(dl, M, H - FOOT + 31, LH[7.5])
    }
  }

  return new Uint8Array(doc.output('arraybuffer') as unknown as ArrayBuffer)
}
