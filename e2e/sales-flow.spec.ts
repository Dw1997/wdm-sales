import { expect, test, type Page } from '@playwright/test'

const E2E_SALES_PHONE = process.env.E2E_SALES_PHONE || '13800000002'
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'e2e123456'

function watchPageErrors(page: Page) {
  const pageErrors: string[] = []
  const serverErrors: string[] = []

  page.on('pageerror', (err) => pageErrors.push(err.message))
  page.on('response', (res) => {
    if (res.url().includes('/api/') && res.status() >= 500) {
      serverErrors.push(`${res.status()} ${res.url()}`)
    }
  })

  return {
    assertNoErrors() {
      expect(pageErrors, `移动端页面存在未捕获异常: ${pageErrors.join('; ')}`).toEqual([])
      expect(serverErrors, `移动端存在后端 5xx 接口错误: ${serverErrors.join('; ')}`).toEqual([])
    },
  }
}

test.describe('销售移动端 H5 核心流程', () => {
  test('销售手机号登录 → 进入首页 → 客户列表仅展示归属客户 → 核心 Tab 正常切换', async ({ page }) => {
    const watcher = watchPageErrors(page)

    await page.goto('/#/pages/auth/login')
    await expect(page.locator('body')).toContainText('账号登录')

    // uni-app H5 中 <input> 渲染为原生 input
    const phoneInput = page.locator('input').nth(0)
    const pwdInput = page.locator('input').nth(1)
    await phoneInput.fill(E2E_SALES_PHONE)
    await pwdInput.fill(E2E_PASSWORD)

    // 精准点击登录按钮（避免命中标题文本“账号登录”）
    await page.getByText('登录', { exact: true }).click()

    // 登录成功后进入工作台，校验销售身份展示
    await expect(page.locator('body')).toContainText('E2E销售甲', { timeout: 15_000 })
    await page.waitForLoadState('networkidle')

    // 点击底部 Tab「客户」，校验数据范围隔离（仅见 E2E测试客户A，不可见 E2E测试客户B）
    await page.locator('.uni-tabbar').getByText('客户', { exact: true }).click()
    await expect(page.locator('body')).toContainText('E2E测试客户A')
    await expect(page.locator('body')).not.toContainText('E2E测试客户B')

    // 依次点击底部 Tab「出车」「我的」「工作台」，校验页面均可正常渲染且无 5xx
    for (const tabText of ['出车', '我的', '工作台']) {
      await page.locator('.uni-tabbar').getByText(tabText, { exact: true }).click()
      await page.waitForLoadState('networkidle')
    }

    watcher.assertNoErrors()
  })
})
