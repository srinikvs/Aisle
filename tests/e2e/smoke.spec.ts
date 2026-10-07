import { expect, test } from "@playwright/test";
import { openFresh, signUpLocalGuest } from "./helpers";

test("local guest loads the version and adds a grocery item", async ({ page }) => {
  await openFresh(page);
  await signUpLocalGuest(page);

  await page.getByRole("button", { name: /^Grocery\b/ }).click();
  await expect(page.getByRole("heading", { name: "Grocery" })).toBeVisible();
  await expect(page.getByText(/Nothing here yet/)).toBeVisible();

  const addForm = page.locator("form.type-box");
  await addForm.getByPlaceholder(/Add to grocery/i).fill("milk");
  await addForm.getByRole("button", { name: "Add" }).click();

  const dialog = page.getByRole("dialog", { name: "Confirm the sort" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Add to lists" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Milk", { exact: true })).toBeVisible();
});
