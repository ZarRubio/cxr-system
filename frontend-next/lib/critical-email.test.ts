import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAnalysisRecord } from './data/analysis'

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(), close: vi.fn(), getUsers: vi.fn(), claimEmailAlert: vi.fn(), setEmailAlert: vi.fn(), getAnalysis: vi.fn(),
}))
vi.mock('cxr-smtp', () => ({ default: { createTransport: () => ({ sendMail: mocks.sendMail, close: mocks.close }) } }))
vi.mock('./data/store', () => ({ getDataStore: () => mocks }))
import { alertText, notifyCriticalAnalysis } from './critical-email'

const record = () => buildAnalysisRecord({ id: 'radio', name: 'Radiólogo de prueba' }, {
  predicted_class: 'Effusion', confidence: 0.9, positive_findings: ['Effusion', 'Pneumothorax'],
  probabilities: { Effusion: 0.9, Pneumothorax: 0.7 }, processing_time_ms: 10,
}, { filename: 'private-patient-name.png', studyId: 'EST-123', clinicalIndication: 'private indication' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SMTP_USER', 'sender@example.com')
  vi.stubEnv('SMTP_PASSWORD', 'test-only')
  vi.stubEnv('AUTH_URL', 'https://cxr.example.com')
  mocks.getUsers.mockResolvedValue([
    { id: 'admin', role: 'admin', active: true, email: 'admin@example.com' },
    { id: 'radio', role: 'radiologist', active: true, email: null },
  ])
  mocks.claimEmailAlert.mockResolvedValue(true)
  mocks.sendMail.mockResolvedValue({ accepted: ['ok'] })
  mocks.setEmailAlert.mockResolvedValue(undefined)
})

describe('critical email', () => {
  it('detects a secondary critical finding and informs admin when radio has no email', async () => {
    const study = record()
    expect(study.severity).toBe('critical')
    const alert = await notifyCriticalAnalysis(study)
    expect(alert?.admin.status).toBe('sent')
    expect(alert?.radiologist.status).toBe('pending_email')
    expect(mocks.sendMail).toHaveBeenCalledTimes(1)
    const mail = mocks.sendMail.mock.calls[0][0]
    expect(mail.to).toBe('admin@example.com')
    expect(mail.text).toContain('EST-123')
    expect(mail.text).toContain('Pneumothorax: 70.0%')
    expect(mail.text).toContain('Radiólogo de prueba')
    expect(mail.text).not.toContain('private')
  })

  it('sends separately to admin and radiologist', async () => {
    mocks.getUsers.mockResolvedValue([
      { id: 'admin', role: 'admin', active: true, email: 'admin@example.com' },
      { id: 'radio', role: 'radiologist', active: true, email: 'radio@example.com' },
    ])
    const alert = await notifyCriticalAnalysis(record())
    expect(alert?.radiologist.status).toBe('sent')
    expect(mocks.sendMail).toHaveBeenCalledTimes(2)
  })

  it('does not send twice to a shared email', async () => {
    mocks.getUsers.mockResolvedValue([
      { id: 'admin', role: 'admin', active: true, email: 'same@example.com' },
      { id: 'radio', role: 'radiologist', active: true, email: 'same@example.com' },
    ])
    await notifyCriticalAnalysis(record())
    expect(mocks.sendMail).toHaveBeenCalledTimes(1)
  })

  it('does not send when another worker already claimed this study', async () => {
    mocks.claimEmailAlert.mockResolvedValue(false)
    mocks.getAnalysis.mockResolvedValue({ emailAlert: { admin: { status: 'sent' } } })
    await notifyCriticalAnalysis(record())
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })

  it('does not send for noncritical studies', async () => {
    await notifyCriticalAnalysis({ ...record(), positiveFindings: ['Effusion'] })
    expect(mocks.claimEmailAlert).not.toHaveBeenCalled()
  })

  it('persists SMTP failure without throwing away the analysis', async () => {
    mocks.sendMail.mockRejectedValue(new Error('SMTP rejected'))
    const alert = await notifyCriticalAnalysis(record())
    expect(alert?.admin.status).toBe('failed')
    expect(mocks.setEmailAlert).toHaveBeenCalled()
  })

  it('records missing server configuration without pretending to send', async () => {
    vi.stubEnv('SMTP_PASSWORD', '')
    expect((await notifyCriticalAnalysis(record()))?.admin.status).toBe('not_configured')
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })

  it('uses analysis ID when no study ID was entered', () => {
    const study = { ...record(), studyId: null }
    const text = alertText(study, 'https://cxr.example.com', false)
    expect(text).toContain(`ID de estudio: ${study.id}`)
    expect(text).toContain(`q=${study.id}`)
  })
})
