import { expect, test, type Page } from '@playwright/test'
import {
  apiErrorSchema,
  auditRunCreatedSchema,
  auditRunDetailSchema,
  auditRunListSchema,
  connectionSchema,
  namingValidateResponseSchema,
  standardDocumentSchema,
} from '@/server/revit/apiSchemas'

const PASSWORD = 'demo1234'

async function openDemoProjectSettings(page: Page) {
  await page.goto('/es/login')
  await page.getByLabel(/correo|email|correio/i).fill('ana@demo.test')
  await page.getByLabel(/contraseña|password|palavra/i).fill(PASSWORD)
  await page.getByRole('button', { name: /entrar|sign in/i }).click()
  await page.waitForURL(/\/es\/(projects|p\/)/)
  await page.goto('/es/projects')
  await page.getByRole('link', { name: /Edificio Corporativo Alameda/ }).click()
  await page.waitForURL(/\/p\/[^/]+$/)
  const projectId = page.url().match(/\/p\/([^/?]+)/)![1]!
  await page.goto(`/es/p/${projectId}/settings`)
  return projectId
}

/** Create a key through the settings screen and return the value shown once. */
async function createKey(page: Page, name: string, scopes: { audit: boolean }) {
  await page.locator('#token-name').fill(name)
  await page.locator('#token-expiry').selectOption('30')
  const audit = page.locator('input[name="scopes"][value="audit:write"]')
  if (!scopes.audit) await audit.uncheck()
  await page.getByRole('button', { name: 'Crear clave de API' }).click()
  const shown = page.getByTestId('new-api-token')
  await expect(shown).toBeVisible()
  return (await shown.textContent())!.trim()
}

test.describe('connecting an external tool with an API key', () => {
  test('creates a key, uses it on every endpoint, and revoking it closes the door', async ({
    page,
    request,
  }) => {
    const projectId = await openDemoProjectSettings(page)
    const keyName = `Integración e2e ${Date.now()}`
    const key = await createKey(page, keyName, { audit: true })

    expect(key).toMatch(/^pbim_[A-Za-z0-9]{8}_[A-Za-z0-9_-]{32,}$/)
    // The screen offers ready-to-paste commands that already carry the key.
    await expect(page.locator('pre', { hasText: 'Invoke-RestMethod' })).toContainText(key)
    await expect(page.locator('pre', { hasText: 'curl' })).toContainText('/api/v1/connection')

    const withKey = { 'X-API-Key': key }
    const withBearer = { Authorization: `Bearer ${key}` }

    // Connection: both header forms work and name the project.
    for (const headers of [withKey, withBearer]) {
      const response = await request.get('/api/v1/connection', { headers })
      expect(response.status()).toBe(200)
      const connection = connectionSchema.parse(await response.json())
      expect(connection.project.id).toBe(projectId)
      expect(connection.token.name).toBe(keyName)
    }

    // Standard, with a conditional re-fetch.
    const standardResponse = await request.get(`/api/v1/projects/${projectId}/standard`, { headers: withKey })
    expect(standardResponse.status()).toBe(200)
    const standard = standardDocumentSchema.parse(await standardResponse.json())
    expect(standard.naming.conventions.length).toBeGreaterThan(0)
    const etag = standardResponse.headers().etag!
    const again = await request.get(`/api/v1/projects/${projectId}/standard`, {
      headers: { ...withKey, 'If-None-Match': etag },
    })
    expect(again.status()).toBe(304)

    // Shared parameter file, as Revit writes it: UTF-16 LE with a BOM.
    const file = await request.get(`/api/v1/projects/${projectId}/shared-parameters.txt`, { headers: withKey })
    expect(file.status()).toBe(200)
    const bytes = await file.body()
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xfe])

    // Name check without recording anything.
    const validate = await request.post(`/api/v1/projects/${projectId}/naming/validate?locale=en`, {
      headers: withKey,
      data: { items: [{ target: 'SHEET', name: 'A-101' }] },
    })
    expect(validate.status()).toBe(200)
    const verdicts = namingValidateResponseSchema.parse(await validate.json())
    expect(verdicts.locale).toBe('en')
    expect(verdicts.results[0]!.valid).toBe(false)
    expect(verdicts.results[0]!.messages[0]).toMatch(/segment/)

    // An audit, then reading it back one by one and in the list.
    const modelTitle = `EDI-JSE-ZZ-XX-M3-A-${String(Date.now()).slice(-4)}`
    const created = await request.post(`/api/v1/projects/${projectId}/audit-runs`, {
      headers: withKey,
      data: {
        model: { title: modelTitle, isWorkshared: true, revitVersion: '2026' },
        ruleSetVersion: standard.ruleSet.version,
        names: [
          { target: 'SHEET', name: 'A-101', elementId: '1001', category: 'OST_Sheets' },
          { target: 'WORKSET', name: 'ARC_General' },
        ],
        worksets: ['ARC_General'],
        projectInformation: { name: standard.project.name, number: standard.project.code, clientName: null },
      },
    })
    expect(created.status()).toBe(201)
    const run = auditRunCreatedSchema.parse(await created.json())
    expect(run.run.rulesChangedSinceSync).toBe(false)
    expect(run.summary.errors).toBeGreaterThan(0)
    expect(created.headers().location).toBe(`/api/v1/projects/${projectId}/audit-runs/${run.run.id}`)

    const detail = await request.get(`/api/v1/projects/${projectId}/audit-runs/${run.run.id}`, { headers: withKey })
    expect(auditRunDetailSchema.parse(await detail.json()).run.modelName).toBe(modelTitle)

    const list = await request.get(`/api/v1/projects/${projectId}/audit-runs?limit=5`, { headers: withKey })
    expect(auditRunListSchema.parse(await list.json()).runs[0]!.id).toBe(run.run.id)

    // A key opens its own project only; any other answers as if it did not exist.
    const elsewhere = await request.get('/api/v1/projects/cm0000000000000000000000/standard', { headers: withKey })
    expect(elsewhere.status()).toBe(404)

    // The audit is on the quality page of the project.
    await page.goto(`/es/p/${projectId}/quality`)
    await expect(page.getByText(modelTitle)).toBeVisible()

    // Revoke from the settings screen: the key stops working at once.
    await page.goto(`/es/p/${projectId}/settings`)
    const row = page.locator('tr', { hasText: keyName })
    await row.getByRole('button', { name: 'Anular' }).click()
    await expect(row.getByText('Anulado')).toBeVisible()

    const refused = await request.get('/api/v1/connection', { headers: withKey })
    expect(refused.status()).toBe(401)
    expect(apiErrorSchema.parse(await refused.json()).error).toBe('invalid_token')
  })

  test('a read-only key can read the standard but cannot submit audits', async ({ page, request }) => {
    const projectId = await openDemoProjectSettings(page)
    const key = await createKey(page, `Solo lectura ${Date.now()}`, { audit: false })

    const read = await request.get(`/api/v1/projects/${projectId}/standard`, { headers: { 'X-API-Key': key } })
    expect(read.status()).toBe(200)

    const write = await request.post(`/api/v1/projects/${projectId}/audit-runs`, {
      headers: { 'X-API-Key': key },
      data: { model: { title: 'x' }, names: [] },
    })
    expect(write.status()).toBe(403)
    expect(apiErrorSchema.parse(await write.json()).error).toBe('insufficient_scope')
  })

  test('refuses anonymous calls and unknown keys, and publishes its contract', async ({ request }) => {
    const anonymous = await request.get('/api/v1/connection')
    expect(anonymous.status()).toBe(401)
    expect(anonymous.headers()['www-authenticate']).toContain('Bearer')

    const unknown = await request.get('/api/v1/connection', {
      headers: { 'X-API-Key': 'pbim_AAAAAAAA_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    })
    expect(unknown.status()).toBe(401)

    // The contract is public, so tools can import it without a key.
    const spec = await request.get('/api/v1/openapi.json')
    expect(spec.status()).toBe(200)
    expect((await spec.json()).openapi).toBe('3.1.0')
  })
})
