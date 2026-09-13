import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'demo1234'

async function signIn(page: Page, email: string, locale = 'es') {
  await page.goto(`/${locale}/login`)
  await page.getByLabel(/correo|email|correio/i).fill(email)
  await page.getByLabel(/contraseña|password|palavra/i).fill(PASSWORD)
  await page.getByRole('button', { name: /entrar|sign in/i }).click()
  await page.waitForURL(new RegExp(`/${locale}/(projects|p/)`))
}

async function openDemoProject(page: Page) {
  await signIn(page, 'ana@demo.test')
  await page.goto('/es/projects')
  await page.getByRole('link', { name: /Edificio Corporativo Alameda/ }).click()
  await page.waitForURL(/\/p\/[^/]+$/)
  return page.url().match(/\/p\/([^/?]+)/)![1]!
}

/**
 * The invitation link is built from NEXT_PUBLIC_APP_URL, which is the public
 * address in production and not where these tests run, so navigate by path.
 */
function invitePath(url: string): string {
  return new URL(url).pathname
}

async function openInviteForm(page: Page, projectId: string) {
  await page.goto(`/es/p/${projectId}/team`)
  const email = page.locator('#invite-email')
  if (!(await email.isVisible().catch(() => false))) {
    await page.locator('summary', { hasText: 'Invitar al proyecto' }).click()
  }
  await expect(email).toBeVisible()
}

/** Invite an address and return the link the interface offers. */
async function createInvitation(
  page: Page,
  projectId: string,
  email: string,
  role = 'BIM_COORDINATOR',
) {
  await openInviteForm(page, projectId)
  await page.locator('#invite-email').fill(email)
  await page.locator('#invite-role').selectOption(role)
  await page.getByRole('button', { name: 'Invitar al proyecto' }).click()

  const link = page.locator('p.font-mono', { hasText: '/invite/' })
  await expect(link).toBeVisible()
  return (await link.textContent())!.trim()
}

test.describe('working across companies', () => {
  test('invites somebody outside the organisation and lets them join that project only', async ({
    page,
    context,
  }) => {
    const projectId = await openDemoProject(page)
    const email = `externo-${Date.now()}@otraempresa.test`

    const inviteUrl = await createInvitation(page, projectId, email)
    expect(inviteUrl).toContain('/es/invite/')

    // The guest arrives with no account and no company of their own.
    const guest = await context.browser()!.newPage()
    await guest.goto(invitePath(inviteUrl))

    await expect(guest.getByText('Edificio Corporativo Alameda')).toBeVisible()
    await expect(guest.getByText(/No pasas a formar parte de Estudio Seborga/)).toBeVisible()

    await guest.getByRole('link', { name: 'Crear cuenta y aceptar' }).click()
    await guest.locator('#name').fill('Colaborador Externo')
    await guest.locator('#email').fill(email)
    await guest.locator('#password').fill(PASSWORD)
    // The organisation field is optional now, and left empty on purpose.
    await guest.getByRole('button', { name: 'Crear cuenta' }).click()

    // Registration returns to the invitation rather than dropping them on a
    // projects page they cannot use yet.
    await guest.waitForURL(/\/invite\//)
    await guest.getByRole('button', { name: 'Aceptar invitación' }).click()
    await guest.waitForURL(new RegExp(`/p/${projectId}$`))

    await expect(guest.getByRole('heading', { name: 'Edificio Corporativo Alameda' })).toBeVisible()

    // They see this project and nothing else of the organisation.
    await guest.goto('/es/projects')
    await expect(guest.getByRole('link', { name: /Edificio Corporativo Alameda/ })).toHaveCount(1)
    await expect(guest.getByText('Todavía no tienes organización')).toBeVisible()
    await expect(guest.getByRole('link', { name: 'Nuevo proyecto' })).toHaveCount(0)

    await guest.close()

    // And the team page marks them as external.
    await page.goto(`/es/p/${projectId}/team`)
    await expect(page.getByRole('row', { name: new RegExp(email) })).toContainText('Externo')
  })

  test('refuses an invitation opened from the wrong account', async ({ page, context }) => {
    const projectId = await openDemoProject(page)
    const email = `otro-${Date.now()}@otraempresa.test`
    const inviteUrl = await createInvitation(page, projectId, email, 'VIEWER')

    const other = await context.browser()!.newPage()
    await signIn(other, 'bruno@demo.test')
    await other.goto(invitePath(inviteUrl))

    await expect(other.getByText(new RegExp(`Esta invitación es para ${email}`))).toBeVisible()
    await expect(other.getByRole('button', { name: 'Aceptar invitación' })).toHaveCount(0)
    await other.close()
  })

  test('revokes a pending invitation', async ({ page, context }) => {
    const projectId = await openDemoProject(page)
    const email = `anulado-${Date.now()}@otraempresa.test`
    const inviteUrl = await createInvitation(page, projectId, email, 'VIEWER')

    await page.goto(`/es/p/${projectId}/team`)
    await page
      .getByRole('row', { name: new RegExp(email) })
      .getByRole('button', { name: 'Anular' })
      .click()
    await expect(page.getByRole('row', { name: new RegExp(email) })).toHaveCount(0)

    const guest = await context.browser()!.newPage()
    await guest.goto(invitePath(inviteUrl))
    await expect(guest.getByText('Esta invitación no es válida o ha sido anulada.')).toBeVisible()
    await guest.close()
  })

  test('refuses to invite the same address twice', async ({ page }) => {
    const projectId = await openDemoProject(page)
    const email = `duplicado-${Date.now()}@otraempresa.test`

    await createInvitation(page, projectId, email, 'VIEWER')

    await openInviteForm(page, projectId)
    await page.locator('#invite-email').fill(email)
    await page.getByRole('button', { name: 'Invitar al proyecto' }).click()

    await expect(page.getByText('Esa persona ya tiene una invitación pendiente.')).toBeVisible()
  })

  test('adds a colleague from the organisation straight away', async ({ page }) => {
    const projectId = await openDemoProject(page)

    await openInviteForm(page, projectId)
    await page.locator('#invite-email').fill('interna@demo.test')
    await page.getByRole('button', { name: 'Invitar al proyecto' }).click()

    await expect(page.getByText('Añadido al proyecto: ya pertenece a tu organización.')).toBeVisible()
    await expect(page.getByRole('row', { name: /Marta Ruiz/ })).toBeVisible()
  })
})

test.describe('project visibility', () => {
  test('a colleague sees an open project and is kept out of a members-only one', async ({
    page,
    context,
  }) => {
    const projectId = await openDemoProject(page)

    // Lucía belongs to the organisation but not to the project, and no other
    // test touches her, so this case cannot be spoiled from elsewhere.
    const colleague = await context.browser()!.newPage()
    await signIn(colleague, 'observadora@demo.test')
    await colleague.goto(`/es/p/${projectId}`)
    await expect(
      colleague.getByRole('heading', { name: 'Edificio Corporativo Alameda' }),
    ).toBeVisible()

    await page.goto(`/es/p/${projectId}/settings`)
    await page.locator('#settings-visibility').selectOption('MEMBERS_ONLY')
    await page.getByRole('button', { name: /^Guardar$/ }).click()
    await expect(page.getByText('Guardado')).toBeVisible()

    await colleague.goto(`/es/p/${projectId}`)
    await expect(colleague.getByText('No encontrado')).toBeVisible()

    // And it disappears from their project list, not just from the page.
    await colleague.goto('/es/projects')
    await expect(
      colleague.getByRole('link', { name: /Edificio Corporativo Alameda/ }),
    ).toHaveCount(0)

    // Restore, so the suite leaves the demo as it found it.
    await page.goto(`/es/p/${projectId}/settings`)
    await page.locator('#settings-visibility').selectOption('ORGANISATION')
    await page.getByRole('button', { name: /^Guardar$/ }).click()
    await expect(page.getByText('Guardado')).toBeVisible()
    await colleague.close()
  })
})

test.describe('federated sign-in', () => {
  test('offers no provider buttons when none is configured', async ({ page }) => {
    await page.goto('/es/login')
    await expect(page.getByRole('link', { name: /Continuar con/ })).toHaveCount(0)
  })

  test('explains that an unconfigured provider is unavailable', async ({ page }) => {
    await page.goto('/api/auth/google/start?locale=es')
    await page.waitForURL(/\/es\/login/)
    await expect(page.getByText('no está configurado en este servidor')).toBeVisible()
  })

  test('rejects an unknown provider', async ({ page }) => {
    const response = await page.request.get('/api/auth/nope/start?locale=es')
    expect(response.status()).toBe(404)
  })

  test('refuses a callback with no pending sign-in', async ({ page }) => {
    await page.goto('/api/auth/google/callback?code=abc&state=xyz')
    await page.waitForURL(/\/es\/login/)
    await expect(page.getByText('La sesión de acceso ha caducado')).toBeVisible()
  })
})
