import { test, expect, waitForInventory } from "./fixtures";

test("ghost slug panel visible when a slug's project dir is missing", async ({ page }) => {
  await waitForInventory(page);
  await expect(page.getByText(/ghost slugs/i).first()).toBeVisible();
  // Fixture intentionally contains -tmp-fx-proj (path /tmp/fx-proj which doesn't exist locally).
  await expect(page.getByText(/-tmp-fx-proj/i).first()).toBeVisible();
});

test("dead @import is visually indicated on the importing card or in connection overlay", async ({
  page,
}) => {
  await waitForInventory(page);
  // Either a red indicator on the card, or a dead-import count in the connection overlay.
  // Accept either signal for v1.5; tightness is a v2 concern.
  const hasCardWarning = await page.locator("text=/dead.*import/i").count();
  const hasOverlay = await page.locator("text=/dead imports:/i").count();
  expect(hasCardWarning + hasOverlay).toBeGreaterThan(0);
});
