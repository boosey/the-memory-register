import { test, expect, waitForInventory, clickCardByTitle } from "./fixtures";

test("any artifact's scope + content reachable in <=2 clicks", async ({ page }) => {
  await waitForInventory(page);
  // Click: 1
  await clickCardByTitle(page, /demo-skill/);
  // Side panel should show the structured editor with name + description visible
  await expect(page.getByText(/demo-skill/i).first()).toBeVisible();
  await expect(page.getByText(/Demo skill/i).first()).toBeVisible();
  // Scope indicator: appears in either the panel header, column, or card. Accept any.
  await expect(page.locator("text=/global|Global/i").first()).toBeVisible();
});
