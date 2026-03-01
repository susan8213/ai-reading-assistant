import { expect, test, chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const extensionPath = process.env.EXTENSION_PATH ?? resolve(process.cwd(), '.output/chrome-mv3')
const shouldRunE2E = process.env.EXTENSION_E2E === '1'
const backendUrl = process.env.BACKEND_URL ?? 'http://127.0.0.1:8000/health'

const launchContext = () =>
  chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  })

const getExtensionId = async (context: Awaited<ReturnType<typeof launchContext>>) => {
  let [serviceWorker] = context.serviceWorkers()

  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker')
  }

  return new URL(serviceWorker.url()).host
}

const isBackendHealthy = async () => {
  try {
    const response = await fetch(backendUrl)
    return response.ok
  } catch {
    return false
  }
}

test.describe('Extension E2E', () => {
  test.skip(!shouldRunE2E, 'Set EXTENSION_E2E=1 to run extension E2E tests')
  test.skip(!existsSync(extensionPath), `Extension build not found at ${extensionPath}`)

  test('loads extension and opens sidepanel page', async () => {
    const context = await launchContext()

    try {
      const extensionId = await getExtensionId(context)
      const page = await context.newPage()

      await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)
      await expect(page.getByText('AI Reading Assistant')).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test('highlights text on article page via runtime message', async () => {
    const context = await launchContext()

    try {
      let [serviceWorker] = context.serviceWorkers()
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker')
      }

      const page = await context.newPage()
      const articleUrl = 'https://en.wikipedia.org/wiki/Transformer_(deep_learning_architecture)'

      await page.goto(articleUrl)
      await page.bringToFront()

      await serviceWorker.evaluate(async ({ text }) => {
          const tabs = await chrome.tabs.query({})
          const tab = tabs.find((item) => {
            const url = item.url ?? ''
            return url.startsWith('http://') || url.startsWith('https://')
          })
          if (!tab?.id) {
            throw new Error('No target article tab found')
          }

          await chrome.tabs.sendMessage(tab.id, {
            action: 'highlight',
            text,
          })
        },
        {
          text: 'attention mechanism',
        },
      )

      await expect(page.locator('mark.ai-highlight').first()).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test('isolates content scripts between different tabs', async () => {
    const context = await launchContext()

    try {
      let [serviceWorker] = context.serviceWorkers()
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker')
      }

      const tabOneUrl = 'https://example.com/?tab=one'
      const tabTwoUrl = 'https://example.com/?tab=two'

      const tabOne = await context.newPage()
      await tabOne.goto(tabOneUrl)
      await tabOne.evaluate(() => {
        document.body.innerHTML = '<main>tab one unique phrase</main>'
      })

      const tabTwo = await context.newPage()
      await tabTwo.goto(tabTwoUrl)
      await tabTwo.evaluate(() => {
        document.body.innerHTML = '<main>tab two unique phrase</main>'
      })

      await serviceWorker.evaluate(async ({ tabOneUrl, text }) => {
        const tabs = await chrome.tabs.query({})
        const tab = tabs.find((item) => (item.url ?? '').startsWith(tabOneUrl))
        if (!tab?.id) {
          throw new Error('No target tab found for tab one')
        }

        await chrome.tabs.sendMessage(tab.id, {
          action: 'highlight',
          text,
        })
      }, {
        tabOneUrl,
        text: 'tab one unique phrase',
      })

      await expect(tabOne.locator('mark.ai-highlight').first()).toBeVisible()
      await expect(tabTwo.locator('mark.ai-highlight')).toHaveCount(0)
    } finally {
      await context.close()
    }
  })

  test('isolates content scripts between different tabs (reverse direction)', async () => {
    const context = await launchContext()

    try {
      let [serviceWorker] = context.serviceWorkers()
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker')
      }

      const tabOneUrl = 'https://example.com/?tab=one-reverse'
      const tabTwoUrl = 'https://example.com/?tab=two-reverse'

      const tabOne = await context.newPage()
      await tabOne.goto(tabOneUrl)
      await tabOne.evaluate(() => {
        document.body.innerHTML = '<main>tab one reverse unique phrase</main>'
      })

      const tabTwo = await context.newPage()
      await tabTwo.goto(tabTwoUrl)
      await tabTwo.evaluate(() => {
        document.body.innerHTML = '<main>tab two reverse unique phrase</main>'
      })

      await serviceWorker.evaluate(async ({ tabTwoUrl, text }) => {
        const tabs = await chrome.tabs.query({})
        const tab = tabs.find((item) => (item.url ?? '').startsWith(tabTwoUrl))
        if (!tab?.id) {
          throw new Error('No target tab found for tab two')
        }

        await chrome.tabs.sendMessage(tab.id, {
          action: 'highlight',
          text,
        })
      }, {
        tabTwoUrl,
        text: 'tab two reverse unique phrase',
      })

      await expect(tabTwo.locator('mark.ai-highlight').first()).toBeVisible()
      await expect(tabOne.locator('mark.ai-highlight')).toHaveCount(0)
    } finally {
      await context.close()
    }
  })

  test('sends chat from sidepanel and receives assistant reply', async () => {
    test.skip(!(await isBackendHealthy()), `Backend is not reachable at ${backendUrl}`)

    const context = await launchContext()

    try {
      const extensionId = await getExtensionId(context)
      const articlePage = await context.newPage()
      await articlePage.goto('https://en.wikipedia.org/wiki/Transformer_(deep_learning_architecture)')
      await articlePage.bringToFront()

      const panelPage = await context.newPage()
      await panelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`)

      await panelPage.getByPlaceholder('Ask about this page...').fill('Summarize this page in 3 points.')
      await panelPage.getByRole('button', { name: 'Send' }).click()

      await expect(
        panelPage.locator('.message.assistant p').last(),
      ).not.toHaveText('', { timeout: 20000 })
    } finally {
      await context.close()
    }
  })
})
