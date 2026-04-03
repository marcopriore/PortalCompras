import { config } from "dotenv"
import { defineConfig, devices } from "@playwright/test"

config({ path: ".env.local" })

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: "**/critical-flows.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "critical-flows",
      testMatch: "**/critical-flows.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        actionTimeout: 15000,
      },
    },
  ],
})
