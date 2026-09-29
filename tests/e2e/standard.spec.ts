import { expect, test, type Page } from '@playwright/test'

async function openParameters(page: Page) {
  await page.goto('/es/login')
  await page.getByLabel(/correo|email|correio/i).fill('ana@demo.test')
  await page.getByLabel(/contraseña|password|palavra/i).fill('demo1234')
  await page.getByRole('button', { name: /entrar|sign in/i }).click()
  await page.waitForURL(/\/es\/(projects|p\/)/)
  await page.goto('/es/projects')
  await page.getByRole('link', { name: /Edificio Corporativo Alameda/ }).click()
  await page.waitForURL(/\/p\/[^/]+$/)
  const projectId = page.url().match(/\/p\/([^/?]+)/)![1]!
  await page.goto(`/es/p/${projectId}/parameters`)
  return projectId
}

test.describe('the project Revit standard', () => {
  test('edits a shared parameter in place and keeps its GUID', async ({ page }) => {
    await openParameters(page)
    const row = page.locator('tr', { hasText: 'GEN_Originador' })
    const guid = await row.getByTestId('parameter-guid').getAttribute('title')
    expect(guid).toBe('7668ad9f-7aa3-47a1-ad54-32c4d1626dbd')

    await row.getByRole('link', { name: 'Editar' }).click()
    await expect(page.getByRole('heading', { name: 'Editar «GEN_Originador»' })).toBeVisible()
    // The name identifies the parameter, so it cannot be changed here.
    await expect(page.locator('#edit-parameter-name')).toHaveAttribute('readonly', '')

    const description = `Parte responsable (editado ${Date.now()})`
    await page.locator('#edit-parameter-description').fill(description)
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByText('Guardado')).toBeVisible()

    const edited = page.locator('tr', { hasText: 'GEN_Originador' })
    await expect(edited).toContainText(description)
    await expect(edited.getByTestId('parameter-guid')).toHaveAttribute('title', guid!)
  })

  test('keeps what was typed when a new parameter is refused', async ({ page }) => {
    await openParameters(page)
    await page.locator('summary', { hasText: 'Añadir parámetro' }).click()
    await page.locator('#parameter-name').fill('mal nombre')
    await page.locator('#parameter-description').fill('Se conserva al rechazar')
    await page.getByRole('checkbox', { name: 'Muros', exact: true }).check()
    await page.locator('button', { hasText: 'Añadir parámetro' }).click()

    await expect(page.getByText('El nombre no cumple la convención del proyecto:')).toBeVisible()
    await expect(page.getByTestId('naming-details')).toBeVisible()
    await expect(page.locator('#parameter-name')).toHaveValue('mal nombre')
    await expect(page.locator('#parameter-description')).toHaveValue('Se conserva al rechazar')
    await expect(page.getByRole('checkbox', { name: 'Muros', exact: true })).toBeChecked()
  })
})
