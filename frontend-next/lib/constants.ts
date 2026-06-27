import type { Severity } from './types'

// Clases que requieren alerta STAT (modal bloqueante antes de mostrar resultados)
export const STAT_CLASSES = new Set([
  'Pneumothorax',
  'Mass',
  'Edema',
  'Pneumonia',
])

// Diagnóstico diferencial clínico por clase (orden por frecuencia en contexto HNAL)
export const DIFFERENTIALS: Record<string, string[]> = {
  Atelectasis:        ['Obstrucción bronquial', 'Compresión extrínseca', 'Cicatriz post-TB', 'Post-quirúrgico'],
  Cardiomegaly:       ['Insuficiencia cardíaca', 'Derrame pericárdico', 'Miocardiopatía', 'Proyección AP (pseudo)'],
  Consolidation:      ['Neumonía bacteriana', 'Tuberculosis', 'Atelectasia lobar', 'Neoplasia', 'Edema focal'],
  Edema:              ['ICC (edema cardiogénico)', 'SDRA', 'Neumonía bilateral', 'Hemorragia alveolar'],
  Effusion:           ['Trasudado (ICC, cirrosis)', 'Exudado (infección, neoplasia)', 'Hemotórax', 'Empiema'],
  Emphysema:          ['EPOC', 'Asma severa', 'Hiperinsuflación compensatoria', 'Déficit de alfa-1 antitripsina'],
  Fibrosis:           ['Fibrosis pulmonar idiopática', 'Secuela de TB', 'Neumoconiosis', 'Sarcoidosis'],
  Hernia:             ['Hernia de Bochdalek', 'Hernia de Morgagni', 'Eventración diafragmática'],
  Infiltration:       ['Tuberculosis pulmonar', 'Neumonía atípica', 'Edema', 'Hemorragia alveolar'],
  Mass:               ['Neoplasia primaria (CBP)', 'Metástasis', 'Granuloma (TB/histoplasma)', 'Hamartoma', 'Absceso'],
  Nodule:             ['Granuloma calcificado (TB)', 'CBP temprano', 'Linfonodo intrapulmonar', 'Artefacto'],
  Pleural_Thickening: ['Secuela de derrame/empiema', 'Mesotelioma', 'Asbestosis', 'Tuberculosis pleural'],
  Pneumonia:          ['Neumonía bacteriana típica', 'Tuberculosis', 'Neumonía atípica (Mycoplasma)', 'Edema focal'],
  Pneumothorax:       ['Neumotórax espontáneo primario', 'Neumotórax a tensión (urgencia)', 'Neumotórax traumático'],
  'No Finding':       [],
}

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

// Recomendaciones clínicas por hallazgo — para mostrar en la UI y el PDF
export type Urgency = 'stat' | 'urgente' | 'electivo' | 'rutina'

export const URGENCY_LABELS: Record<Urgency, string> = {
  stat:     'STAT — Atención inmediata',
  urgente:  'Urgente — Evaluación < 24 h',
  electivo: 'Electivo — Evaluación dentro de la semana',
  rutina:   'Rutina — Seguimiento programado',
}

export const URGENCY_COLORS: Record<Urgency, { bg: string; text: string; border: string }> = {
  stat:     { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
  urgente:  { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  electivo: { bg: '#E0F2FE', text: '#075985', border: '#BAE6FD' },
  rutina:   { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
}

export const RECOMMENDATIONS: Record<string, { urgency: Urgency; actions: string[] }> = {
  Pneumothorax: {
    urgency: 'stat',
    actions: [
      'Evaluar clínicamente de inmediato — auscultar ambos campos pulmonares',
      'Si sospecha de neumotórax a tensión: descompresión emergente con aguja',
      'Solicitar Rx en espiración para confirmar y medir tamaño',
      'Interconsulta urgente a cirugía torácica o neumología',
      'Preparar equipo para colocación de tubo de tórax si es indicado',
    ],
  },
  Edema: {
    urgency: 'stat',
    actions: [
      'Evaluar signos de insuficiencia cardíaca descompensada',
      'Solicitar BNP/NT-proBNP, ECG y ecocardiografía de urgencia',
      'Interconsulta a cardiología de guardia',
      'Iniciar manejo según protocolo de edema pulmonar agudo si aplica',
    ],
  },
  Pneumonia: {
    urgency: 'urgente',
    actions: [
      'Solicitar hemograma, PCR, hemocultivos y cultivo de esputo',
      'Descartar tuberculosis pulmonar según protocolo HNAL (BK en esputo)',
      'Calcular índice de gravedad (PSI/CURB-65)',
      'Iniciar antibioticoterapia empírica según guía institucional',
      'Evaluar necesidad de hospitalización vs manejo ambulatorio',
    ],
  },
  Mass: {
    urgency: 'urgente',
    actions: [
      'Solicitar TAC de tórax con contraste (prioridad < 1 semana)',
      'Completar anamnesis: tabaquismo, pérdida de peso, hemoptisis, exposiciones',
      'Interconsulta a neumología u oncología torácica',
      'No diferir — lesiones > 3 cm requieren caracterización urgente',
    ],
  },
  Effusion: {
    urgency: 'urgente',
    actions: [
      'Solicitar proyección lateral y ecografía pleural para cuantificar',
      'Evaluar causas: ICC, hepatopatía, neoplasia, infección, TB pleural',
      'Si derrame significativo: considerar toracocentesis diagnóstica',
      'Interconsulta a neumología',
    ],
  },
  Consolidation: {
    urgency: 'urgente',
    actions: [
      'Correlacionar con cuadro clínico y fiebre',
      'Solicitar hemograma, PCR y cultivos',
      'Descartar tuberculosis (BK en esputo) si clínica compatible',
      'Iniciar tratamiento si cuadro clínico confirma neumonía',
    ],
  },
  Nodule: {
    urgency: 'electivo',
    actions: [
      'Solicitar TAC de tórax de alta resolución para caracterización',
      'Aplicar criterios de Fleischner para seguimiento según tamaño y riesgo',
      'Revisar radiografías previas para evaluar crecimiento',
      'Interconsulta a neumología en < 7 días si nódulo > 8 mm',
    ],
  },
  Cardiomegaly: {
    urgency: 'electivo',
    actions: [
      'Solicitar ecocardiograma transtorácico',
      'Evaluar signos de ICC: ortopnea, edema de miembros, ingurgitación yugular',
      'Verificar proyección — AP puede sobreestimar el tamaño cardíaco',
      'Interconsulta a cardiología',
    ],
  },
  Atelectasis: {
    urgency: 'electivo',
    actions: [
      'Evaluar causa: obstrucción bronquial, cuerpo extraño, compresión extrínseca',
      'Kinesioterapia respiratoria y cambios posturales si postoperado',
      'Solicitar broncoscopía si atelectasia persistente sin causa clara',
      'Seguimiento con Rx control en 4-6 semanas',
    ],
  },
  Infiltration: {
    urgency: 'electivo',
    actions: [
      'Descartar tuberculosis activa según protocolo HNAL (BK × 3)',
      'Correlacionar con síntomas: tos, fiebre, sudoración nocturna',
      'Solicitar hemograma y prueba de tuberculina si aplica',
      'Seguimiento en 2-4 semanas con Rx de control',
    ],
  },
  Emphysema: {
    urgency: 'rutina',
    actions: [
      'Solicitar espirometría con prueba broncodilatadora',
      'Confirmar antecedente de tabaquismo u otras exposiciones',
      'Interconsulta a neumología para estadificación GOLD',
      'Programa de cesación tabáquica si fumador activo',
    ],
  },
  Fibrosis: {
    urgency: 'rutina',
    actions: [
      'Solicitar TCAR (tomografía de alta resolución) para patrón fibrótico',
      'Descartar exposición ocupacional (sílice, asbestos)',
      'Interconsulta a neumología para diagnóstico diferencial de EPI',
      'Pruebas de función pulmonar completas',
    ],
  },
  Pleural_Thickening: {
    urgency: 'rutina',
    actions: [
      'Revisar antecedentes: exposición a asbesto, empiema previo, TB pleural',
      'Ecografía pleural para descartar derrame asociado',
      'Seguimiento en 6 meses con Rx si hallazgo incidental',
    ],
  },
  Hernia: {
    urgency: 'rutina',
    actions: [
      'Confirmar con TAC de tórax para caracterizar contenido herniado',
      'Evaluar síntomas gastrointestinales asociados',
      'Interconsulta a cirugía general o torácica',
    ],
  },
  'No Finding': {
    urgency: 'rutina',
    actions: [
      'No se requieren acciones basadas en este estudio de imagen',
      'Continuar manejo clínico según cuadro del paciente',
      'Repetir estudio si la clínica evoluciona o aparecen nuevos síntomas',
    ],
  },
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
