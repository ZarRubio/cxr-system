import type { Severity } from './types'

export const SEVERITY_MAP: Record<string, Severity> = {
  Pneumothorax:       'critical',
  Mass:               'critical',
  Pneumonia:          'critical',
  Cardiomegaly:       'critical',
  Edema:              'critical',
  Effusion:           'high',
  Infiltration:       'high',
  Consolidation:      'high',
  Nodule:             'high',
  Atelectasis:        'moderate',
  Emphysema:          'moderate',
  Fibrosis:           'moderate',
  Hernia:             'moderate',
  Pleural_Thickening: 'moderate',
  'No Finding':       'normal',
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Revisión prioritaria IA',
  high:     'Revisión recomendada IA',
  moderate: 'Hallazgo IA',
  normal:   'Sin alerta',
}

export const SEVERITY_COLORS: Record<Severity, { bar: string; text: string; bg: string; border: string }> = {
  critical: { bar: '#DC2626', text: '#991B1B', bg: '#FEE2E2', border: '#FCA5A5' },
  high:     { bar: '#D97706', text: '#92400E', bg: '#FEF3C7', border: '#FCD34D' },
  moderate: { bar: '#0E7490', text: '#075985', bg: '#E0F2FE', border: '#BAE6FD' },
  normal:   { bar: '#16A34A', text: '#166534', bg: '#DCFCE7', border: '#86EFAC' },
}

export const BADGES: Record<string, string> = {
  Atelectasis:        'ATELECTASIA',
  Cardiomegaly:       'CARDIOMEGALIA',
  Consolidation:      'CONSOLIDACIÓN',
  Edema:              'EDEMA',
  Effusion:           'DERRAME PLEURAL',
  Emphysema:          'ENFISEMA',
  Fibrosis:           'FIBROSIS',
  Hernia:             'HERNIA',
  Infiltration:       'INFILTRADO',
  Mass:               'MASA',
  Nodule:             'NÓDULO',
  Pleural_Thickening: 'ENGROS. PLEURAL',
  Pneumonia:          'NEUMONÍA',
  Pneumothorax:       'NEUMOTÓRAX',
  'No Finding':       'SIN HALLAZGOS SOBRE UMBRAL',
}

export const DESCRIPTIONS: Record<string, string> = {
  Atelectasis:
    'Etiqueta asociada a pérdida de volumen o colapso de una parte del pulmón.',
  Cardiomegaly:
    'Etiqueta asociada a un aumento aparente de la silueta cardíaca. La proyección AP puede sobrestimar su tamaño.',
  Consolidation:
    'Etiqueta asociada a ocupación del espacio alveolar, por ejemplo por líquido o material inflamatorio.',
  Edema:
    'Etiqueta asociada a patrones de acumulación de líquido en el pulmón.',
  Effusion:
    'Etiqueta asociada a líquido en el espacio pleural, como el borramiento del seno costodiafragmático.',
  Emphysema:
    'Etiqueta asociada a hiperinsuflación pulmonar.',
  Fibrosis:
    'Etiqueta asociada a patrones de cicatrización o engrosamiento del tejido pulmonar.',
  Hernia:
    'Etiqueta asociada a una hernia a través del diafragma. Es una de las categorías con menos casos en los datos.',
  Infiltration:
    'Etiqueta amplia asociada a opacidades pulmonares de distinto origen. En la evaluación interna fue una de las clases con menor especificidad.',
  Mass:
    'Resultado para la categoría Mass del conjunto de entrenamiento. El clasificador no mide lesiones ni confirma su presencia o naturaleza.',
  Nodule:
    'Resultado para la categoría Nodule del conjunto de entrenamiento. El clasificador no mide lesiones ni establece una conducta de seguimiento.',
  Pleural_Thickening:
    'Etiqueta asociada a engrosamiento de la pleura.',
  Pneumonia:
    'Etiqueta tomada de los informes del conjunto NIH; la imagen por sí sola no permite confirmar una neumonía. En la evaluación interna su valor predictivo positivo fue muy bajo.',
  Pneumothorax:
    'Etiqueta asociada a aire en el espacio pleural.',
  'No Finding':
    'Ninguna clase superó el umbral del modelo. Este resultado no confirma normalidad ni excluye enfermedad.',
}

/** Nota común a todas las etiquetas: se muestra junto a la descripción del hallazgo. */
export const FINDING_NOTE =
  'Las etiquetas del conjunto NIH provienen de informes, no de una revisión experta. El score no confirma el hallazgo: requiere confirmación profesional en la imagen original.'

export const CLASSES_INFO: Record<string, string> = {
  Atelectasis:        'Pérdida de volumen pulmonar',
  Cardiomegaly:       'Silueta cardíaca aumentada',
  Consolidation:      'Ocupación alveolar',
  Edema:              'Patrón de edema pulmonar',
  Effusion:           'Líquido pleural',
  Emphysema:          'Hiperinsuflación pulmonar',
  Fibrosis:           'Patrón fibrótico',
  Hernia:             'Hernia diafragmática',
  Infiltration:       'Opacidad pulmonar (etiqueta amplia)',
  Mass:               'Categoría Mass (no mide lesiones)',
  Nodule:             'Categoría Nodule (no mide lesiones)',
  Pleural_Thickening: 'Engrosamiento pleural',
  Pneumonia:          'Etiqueta de neumonía (VPP interno bajo)',
  Pneumothorax:       'Aire en el espacio pleural',
}

/** Comparar (US43): contraste puntual que no crea estudios ni envía alertas. */
export const COMPARE_NOT_SAVED_MESSAGE = 'Resultado de comparación: no se guardó en el historial ni generó alertas por correo.'
