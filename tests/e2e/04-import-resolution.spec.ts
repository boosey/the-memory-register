import { test, expect, waitForInventory, switchToGraph } from "./fixtures";

test("CLAUDE.md @import is visible as a relationship in graph view", async ({ page }) => {
  await waitForInventory(page);
  await switchToGraph(page);

  // React Flow renders nodes as .react-flow__node; edges as .react-flow__edge
  const nodes = page.locator(".react-flow__node");
  const edges = page.locator(".react-flow__edge");
  await expect(nodes.first()).toBeVisible();
  expect(await edges.count()).toBeGreaterThan(0);
});

test("imports-demo target is discoverable in inventory without reading markdown", async ({ page }) => {
  await waitForInventory(page);
  // The imports-demo.md target should appear as its own artifact card
  await expect(
    page.getByText(/Imported content|imports-demo/i).first(),
  ).toBeVisible();
});
