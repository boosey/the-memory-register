import { test, expect, waitForInventory } from "./fixtures";

test("first-run has no setup screen, inventory is the root", async ({ page }) => {
  await page.goto("/");
  // No "Welcome" or "Setup" wizard
  await expect(page.getByText(/welcome|setup|get started/i)).toHaveCount(0);
  // Inventory is the immediate content
  await waitForInventory(page);
  await expect(page.getByText(/Global/i).first()).toBeVisible();
});
