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
  critical: 'Crítico',
  high:     'Alto',
  moderate: 'Moderado',
  normal:   'Normal',
}

export const SEVERITY_COLORS: Record<Severity, { bar: string; text: string; bg: string; border: string }> = {
  critical: { bar: '#DC2626', text: '#991B1B', bg: '#FEE2E2', border: '#FCA5A5' },
  high:     { bar: '#D97706', text: '#92400E', bg: '#FEF3C7', border: '#FCD34D' },
  moderate: { bar: '#0891B2', text: '#075985', bg: '#E0F2FE', border: '#BAE6FD' },
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
  'No Finding':       'NORMAL',
}

export const DESCRIPTIONS: Record<string, string> = {
  Atelectasis:
    'Colapso pulmonar parcial o total de uno o más lóbulos. Frecuente en postoperados, pacientes encamados o con obstrucción bronquial.',
  Cardiomegaly:
    'Posible aumento de la silueta cardíaca (ICT > 0.5). Puede asociarse a insuficiencia cardíaca o derrame pericárdico. Correlación clínica recomendada.',
  Consolidation:
    'Ocupación alveolar por líquido o tejido. Considerar neumonía bacteriana; correlacionar con fiebre y clínica.',
  Edema:
    'Edema pulmonar. Evaluar insuficiencia cardíaca o causas no cardiogénicas. Patrón típico: opacidades perihiliares bilaterales.',
  Effusion:
    'Posible derrame pleural con opacidad basal o borramiento del seno costodiafragmático. Se recomienda proyección lateral o ecografía complementaria.',
  Emphysema:
    'Hiperinsuflación y destrucción alveolar. Correlacionar con espirometría y antecedentes tabáquicos o de exposición.',
  Fibrosis:
    'Patrón fibrótico pulmonar. Considerar fibrosis intersticial. Correlacionar con antecedentes y TCAR de alta resolución.',
  Hernia:
    'Posible hernia diafragmática. Confirmar con tomografía computada; evaluar contenido herniado.',
  Infiltration:
    'Posible infiltrado pulmonar compatible con consolidación, neumonía o proceso inflamatorio. En contexto HNAL Lima: considerar tamizaje de tuberculosis según protocolo local.',
  Mass:
    'Lesión mayor de 3 cm detectada. Requiere estudio tomográfico urgente para caracterización y estadificación.',
  Nodule:
    'Lesión focal menor de 3 cm. Seguimiento según protocolo de nódulo pulmonar; considerar TC para caracterización.',
  Pleural_Thickening:
    'Engrosamiento pleural. Correlacionar con antecedentes de exposición, derrame previo o infección.',
  Pneumonia:
    'Compatible con consolidación neumónica. Correlación clínica recomendada. En contexto HNAL Lima: descartar tuberculosis según protocolo local.',
  Pneumothorax:
    'Posible neumotórax: ausencia de trama vascular en periferia del campo pulmonar. Verificar línea pleural en radiografía en espiración. Urgencia si es a tensión.',
  'No Finding':
    'No se detectaron hallazgos patológicos significativos. Campos pulmonares, silueta cardíaca y mediastino dentro de parámetros normales para el modelo.',
}

export const CLASSES_INFO: Record<string, string> = {
  Atelectasis:        'Colapso pulmonar parcial/total',
  Cardiomegaly:       'Posible cardiomegalia',
  Consolidation:      'Ocupación alveolar',
  Edema:              'Edema pulmonar',
  Effusion:           'Posible derrame pleural',
  Emphysema:          'Hiperinsuflación alveolar',
  Fibrosis:           'Patrón fibrótico pulmonar',
  Hernia:             'Hernia diafragmática',
  Infiltration:       'Infiltrado / TB / neumonía',
  Mass:               'Lesión > 3 cm',
  Nodule:             'Lesión focal < 3 cm',
  Pleural_Thickening: 'Engrosamiento pleural',
  Pneumonia:          'Consolidación neumónica',
  Pneumothorax:       'Posible neumotórax',
}
