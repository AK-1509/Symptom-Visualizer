import { expect, test, type Page } from '@playwright/test';

/** The selectable card for an active drug. */
const card = (page: Page, name: string, pressed?: boolean) =>
  page.getByRole('region', { name: 'Active drugs' }).getByRole('button', { name: new RegExp(`^${name}`, 'i'), pressed });

async function addDrug(page: Page, query: string, name: string) {
  const search = page.getByRole('combobox');
  await search.fill(query);
  await page.getByRole('option', { name: new RegExp(name, 'i') }).first().click();
  await expect(card(page, name, true)).toBeVisible();
}

async function dragPillTo(page: Page, drugName: string, regionSelector: string) {
  const pill = page.getByRole('img', { name: `Drag ${drugName} onto the body` });
  const from = (await pill.boundingBox())!;
  const to = (await page.locator(`${regionSelector} .fill`).first().boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await expect(page.locator(regionSelector)).toHaveClass(/is-drop/);
  await page.mouse.up();
}

test('core journey: search, highlight, click, drag, switch, remove', async ({ page }) => {
  await page.goto('/');
  const details = page.getByRole('complementary', { name: 'Details' });

  // Body renders immediately with addressable regions.
  await expect(page.locator('svg.body #stomach')).toBeVisible();
  await expect(page.locator('svg.body #brain')).toBeVisible();

  // AMAB / AFAB and age.
  await page.getByRole('radio', { name: 'AFAB' }).click();
  await expect(page.locator('svg.body')).toHaveClass(/body-afab/);
  await page.getByRole('radio', { name: 'AMAB' }).click();
  await page.getByRole('slider').fill('52');
  await expect(page.getByText('Age 52')).toBeVisible();

  // Search by generic-name prefix; the drug becomes active and selected.
  await addDrug(page, 'sema', 'Semaglutide');
  await expect(page.getByRole('region', { name: 'Active drugs' }).getByText('Semaglutide')).toBeVisible();

  // Mapped regions are highlighted.
  await expect(page.locator('#stomach')).toHaveClass(/is-affected/);
  expect(await page.locator('svg.body .region.is-affected').count()).toBeGreaterThan(3);

  // Click the stomach: label information with its source appears.
  await page.locator('#stomach').click();
  await expect(details.getByRole('heading', { name: 'Stomach' })).toBeVisible();
  await expect(details.getByText('Adverse reactions', { exact: true })).toBeVisible();
  await expect(details.getByText(/nausea/i).first()).toBeVisible();
  await expect(details.getByRole('link', { name: /FDA Prescribing Information/ })).toHaveAttribute('href', /dailymed\.nlm\.nih\.gov/);

  // Close, then drag the pill onto the stomach: the same information appears.
  await details.getByRole('button', { name: 'Close details' }).click();
  await expect(details.getByRole('heading', { name: 'Stomach' })).toHaveCount(0);
  await dragPillTo(page, 'Semaglutide', '#stomach');
  await expect(details.getByRole('heading', { name: 'Stomach' })).toBeVisible();
  await expect(details.getByText(/nausea/i).first()).toBeVisible();

  // Add a second drug via brand name and switch between them.
  await addDrug(page, 'lipit', 'Atorvastatin');
  await expect(page.locator('#musculoskeletal')).toHaveClass(/is-affected/);
  await card(page, 'Semaglutide').click();
  await expect(card(page, 'Semaglutide', true)).toBeVisible();
  await expect(details.getByText('Semaglutide', { exact: true })).toBeVisible();

  // Adding an active drug again does not duplicate it.
  await page.getByRole('combobox').fill('ozempic');
  await page.getByRole('option', { name: /Semaglutide/ }).click();
  await expect(card(page, 'Semaglutide')).toHaveCount(1);

  // Remove a drug.
  await page.getByRole('button', { name: 'Remove Semaglutide' }).click();
  await expect(card(page, 'Semaglutide')).toHaveCount(0);
  await expect(card(page, 'Atorvastatin', true)).toBeVisible();
});

test('keyboard only: search, select and open a region', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox').focus();
  await page.keyboard.type('metf');
  await page.keyboard.press('Enter');
  await expect(card(page, 'Metformin', true)).toBeVisible();
  await page.locator('#blood').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Details' }).getByRole('heading', { name: 'Blood & vessels' })).toBeVisible();
});

test('graceful states: no drug found, unmapped region', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox').fill('qqqzzz');
  await expect(page.getByText(/No drug or label text found/)).toBeVisible();
  await addDrug(page, 'sildenafil', 'Sildenafil');
  await page.locator('#thyroid').click();
  await expect(page.getByText(/No effect is mapped to the thyroid/)).toBeVisible();
});

test('layout: body, search and details stay usable at narrow widths', async ({ page }) => {
  await page.goto('/');
  await addDrug(page, 'sema', 'Semaglutide');
  await page.locator('#stomach').click();
  await expect(page.getByRole('complementary', { name: 'Details' })).toBeVisible();
  const body = (await page.locator('svg.body').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(body.width).toBeGreaterThan(300);
  expect(body.x + body.width).toBeLessThanOrEqual(viewport.width + 1);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
});

test('full-text search: a label-text result adds the drug and opens the region', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox').fill('hepatotoxicity');
  await expect(page.getByText('In label text')).toBeVisible();
  await page.getByRole('option', { name: /Acetaminophen · Liver/ }).click();
  await expect(card(page, 'Acetaminophen', true)).toBeVisible();
  const details = page.getByRole('complementary', { name: 'Details' });
  await expect(details.getByRole('heading', { name: 'Liver' })).toBeVisible();
  await expect(details.getByText('Hepatotoxicity').first()).toBeVisible();

  // Classes are searchable too.
  await page.getByRole('combobox').fill('ssri');
  await expect(page.getByRole('option', { name: /Sertraline.*Selective serotonin reuptake inhibitor/ })).toBeVisible();
});

test('sex: label statements and notes follow AMAB / AFAB', async ({ page }) => {
  await page.goto('/');
  await addDrug(page, 'viagra', 'Sildenafil');
  // The Viagra label's indication is worded for men.
  await expect(page.locator('#reproductive')).toHaveClass(/is-therapeutic/);
  await page.getByRole('radio', { name: 'AFAB' }).click();
  await expect(page.locator('#reproductive')).not.toHaveClass(/is-therapeutic/);
  await page.locator('#reproductive').click();
  await expect(page.getByText(/statements? for another age group or sex/)).toBeVisible();

  // AFAB shows the label's pregnancy and lactation text.
  await addDrug(page, 'sema', 'Semaglutide');
  const details = page.getByRole('complementary', { name: 'Details' });
  await details.getByRole('button', { name: 'Close details' }).click();
  await card(page, 'Semaglutide').click();
  await expect(details.getByText('AFAB label notes')).toBeVisible();
  await expect(details.getByText(/^Pregnancy/).first()).toBeVisible();
  await page.getByRole('radio', { name: 'AMAB' }).click();
  await expect(details.getByText('AFAB label notes')).toHaveCount(0);
});
