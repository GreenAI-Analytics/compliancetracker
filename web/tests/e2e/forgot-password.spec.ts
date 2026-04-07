import { expect, test } from "@playwright/test";

test("forgot-password request form shows success state", async ({ page }) => {
  await page.route("**/auth/v1/recover**", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.goto("/login");

  const forgotPasswordLink = page.getByRole("link", { name: "Forgot password?" });
  await expect(forgotPasswordLink).toBeVisible();
  await expect(forgotPasswordLink).toHaveAttribute("href", "/reset-password");

  await page.goto("/reset-password");

  await page.locator('input[type="email"]').fill("owner@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(
    page.getByText("If an account exists for this email, a password reset link has been sent.")
  ).toBeVisible();
});
