import { expect, test, type Page } from '@playwright/test'

const DEMO = { email: 'ana@demo.test', password: 'demo1234' }

async function signIn(page: Page, locale = 'es') {
  await page.goto(`/${locale}/login`)
  await page.getByLabel(/correo|email|correio/i).fill(DEMO.email)
  await page.getByLabel(/contraseña|password|palavra/i).fill(DEMO.password)
  await page.getByRole('button', { name: /entrar|sign in/i }).click()
  await page.waitForURL(`**/${locale}/projects`)
}

/**
 * Playwright's request context will not send a `Secure` cookie over plain HTTP,
 * so the session has to be forwarded explicitly when calling the API directly.
 */
async function sessionHeaders(page: Page) {
  const cookies = await page.context().cookies()
  return { cookie: cookies.map((entry) => `${entry.name}=${entry.value}`).join('; ') }
}

async function openDemoProject(page: Page, locale = 'es') {
  await signIn(page, locale)
  await page.getByRole('link', { name: /Edificio Corporativo Alameda/ }).click()
  await page.waitForURL(/\/p\/[^/]+$/)
  return page.url().match(/\/p\/([^/?]+)/)![1]!
}

test.describe('authentication', () => {
  test('refuses a wrong password without revealing whether the account exists', async ({ page }) => {
    await page.goto('/es/login')
    await page.getByLabel(/correo/i).fill(DEMO.email)
    await page.getByLabel(/contraseña/i).fill('not-the-password')
    await page.getByRole('button', { name: /entrar/i }).click()

    await expect(page.getByText(/incorrectos/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('sends an anonymous visitor to sign in', async ({ page }) => {
    await page.goto('/es/p/any-project-id')
    await expect(page).toHaveURL(/\/es\/login/)
  })

  test('signs in and lists the projects', async ({ page }) => {
    await signIn(page)
    await expect(page.getByRole('heading', { name: 'Proyectos' })).toBeVisible()
    await expect(page.getByText('Edificio Corporativo Alameda')).toBeVisible()
  })
})

test.describe('project dashboard', () => {
  test('reports protocol completeness and translation coverage', async ({ page }) => {
    await openDemoProject(page)

    await expect(page.getByText('Completitud del protocolo').first()).toBeVisible()
    await expect(page.getByText(/%/).first()).toBeVisible()
    await expect(page.getByText('Traducción')).toBeVisible()
  })
})

test.describe('protocol editor', () => {
  test('saves a section and keeps the text after a reload', async ({ page }) => {
    const projectId = await openDemoProject(page)
    await page.goto(`/es/p/${projectId}/protocol?section=DEFINITIONS`)

    const marker = `Comprobación e2e ${Date.now()}`
    const body = page.locator('#section-body')
    await body.fill(marker)
    await page.getByRole('button', { name: /^Guardar$/ }).click()
    await expect(page.getByText('Guardado')).toBeVisible()

    await page.reload()
    await expect(page.locator('#section-body')).toHaveValue(marker)
  })

  test('renders a generated section from live project data instead of an editor', async ({ page }) => {
    const projectId = await openDemoProject(page)
    await page.goto(`/es/p/${projectId}/protocol?section=SOFTWARE`)

    await expect(page.locator('#section-body')).toHaveCount(0)
    await expect(page.getByText('Autodesk Revit').first()).toBeVisible()
    await expect(page.getByText('Navisworks').first()).toBeVisible()
  })

  test('refuses to send an incomplete protocol to review and names what is missing', async ({
    page,
  }) => {
    const projectId = await openDemoProject(page)
    await page.goto(`/es/p/${projectId}/protocol`)

    await page.getByRole('button', { name: 'Enviar a revisión' }).click()
    await expect(page.getByText(/Faltan secciones obligatorias/)).toBeVisible()
  })

  test('lists versions', async ({ page }) => {
    const projectId = await openDemoProject(page)
    await page.goto(`/es/p/${projectId}/protocol/versions`)

    await expect(page.getByRole('heading', { name: 'Versiones' })).toBeVisible()
    await expect(page.getByText('1.0')).toBeVisible()
  })
})

test.describe('three languages', () => {
  test('translates the interface and flags untranslated content', async ({ page }) => {
    const projectId = await openDemoProject(page)

    await page.goto(`/en/p/${projectId}/protocol?section=COORDINATES`)
    await expect(page.getByText('Content', { exact: true })).toBeVisible()
    // Written in Spanish only by the seed, so English must offer the fallback.
    await expect(page.getByText(/no content in English yet/i)).toBeVisible()

    await page.goto(`/pt/p/${projectId}/protocol?section=COORDINATES`)
    await expect(page.getByText('Conteúdo', { exact: true })).toBeVisible()
  })

  test('keeps the page when switching language from the top bar', async ({ page }) => {
    const projectId = await openDemoProject(page)
    await page.goto(`/es/p/${projectId}/team`)

    await page.getByLabel('Language').selectOption('pt')
    await page.waitForURL(`**/pt/p/${projectId}/team`)
    await expect(page.getByRole('heading', { name: 'Equipa do projeto' })).toBeVisible()
  })
})

test.describe('naming', () => {
  test('validates a name live and points at the failing segment', async ({ page }) => {
    const projectId = await openDemoProject(page)
    await page.goto(`/es/p/${projectId}/naming`)

    await page.getByRole('link', { name: 'Contenedor de información' }).click()
    await expect(page.getByText('PRJ-ORG-VOL-LVL-TYP-ROL-NUM')).toBeVisible()

    const input = page.getByTestId('naming-validator-input')

    await input.fill('EDI-JSE-ZZ-00-M3-A-0001')
    await expect(page.getByTestId('naming-validator-result')).toHaveText(
      'El nombre cumple la convención',
    )

    await input.fill('EDI-JSE-99-00-M3-A-0001')
    await expect(page.getByTestId('naming-validator-result')).toHaveText(
      'El nombre no cumple la convención',
    )
    await expect(page.getByText(/no está en la tabla del campo «Volumen»/)).toBeVisible()
    await expect(page.getByText(/Valores admitidos: 01, 02, ZZ/)).toBeVisible()
  })

  test('composes a name from the code tables', async ({ page }) => {
    const projectId = await openDemoProject(page)
    await page.goto(`/es/p/${projectId}/naming`)
    await page.getByRole('link', { name: 'Contenedor de información' }).click()

    await expect(page.getByTestId('built-name')).toHaveText('EDI-JSE-ZZ-00-M3-A-0001')

    await page.locator('#build-VOL').selectOption('01')
    await expect(page.getByTestId('built-name')).toHaveText('EDI-JSE-01-00-M3-A-0001')
  })

  test('reports the naming error in the reader language', async ({ page }) => {
    const projectId = await openDemoProject(page)
    await page.goto(`/en/p/${projectId}/naming`)
    await page.getByRole('link', { name: 'Information container' }).click()

    await page.getByTestId('naming-validator-input').fill('EDI-JSE-99-00-M3-A-0001')
    await expect(page.getByText(/is not in the code table for field/i)).toBeVisible()
  })
})

test.describe('exports', () => {
  test('exports the protocol as a PDF', async ({ page }) => {
    const projectId = await openDemoProject(page)

    const response = await page.request.get(`/api/projects/${projectId}/export/pdf?locale=es`, {
      headers: await sessionHeaders(page),
      timeout: 90_000,
    })
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/pdf')

    const body = await response.body()
    expect(body.subarray(0, 5).toString()).toBe('%PDF-')
    expect(body.byteLength).toBeGreaterThan(20_000)
  })

  test('exports the protocol as a Word document', async ({ page }) => {
    const projectId = await openDemoProject(page)

    const response = await page.request.get(`/api/projects/${projectId}/export/docx?locale=en`, {
      headers: await sessionHeaders(page),
    })
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('wordprocessingml')

    const body = await response.body()
    // A .docx is a ZIP container.
    expect(body.subarray(0, 2).toString()).toBe('PK')
    expect(body.byteLength).toBeGreaterThan(5_000)
  })

  test('exports a naming convention as machine-readable JSON', async ({ page }) => {
    const projectId = await openDemoProject(page)

    await page.goto(`/es/p/${projectId}/naming`)
    await page.getByRole('link', { name: 'Contenedor de información' }).click()
    await page.waitForURL(/\/naming\/[^/]+$/)
    const conventionId = page.url().split('/').pop()!

    const response = await page.request.get(
      `/api/projects/${projectId}/naming/${conventionId}/export`,
      { headers: await sessionHeaders(page) },
    )
    expect(response.status()).toBe(200)

    const payload = await response.json()
    expect(payload.convention.key).toBe('FILE')
    expect(payload.compiled.mask).toBe('PRJ-ORG-VOL-LVL-TYP-ROL-NUM')
    expect(payload.compiled.pattern).toContain('^')
    expect(payload.examples.every((example: { agrees: boolean }) => example.agrees)).toBe(true)
  })

  test('refuses an export for a project the user cannot see', async ({ page }) => {
    await signIn(page)
    const response = await page.request.get('/api/projects/does-not-exist/export/docx', {
      headers: await sessionHeaders(page),
    })
    expect(response.status()).toBe(404)
  })
})
