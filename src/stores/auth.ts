// src/stores/auth.ts - 登录态与当前账号权限。
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import { setTokenGetter, setAuthCallbacks } from '@/api/request'
import type { UserInfo } from '@/types'

const ACCESS_KEY = 'wdm_sales_access'
const REFRESH_KEY = 'wdm_sales_refresh'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string>(uni.getStorageSync(ACCESS_KEY) || '')
  const refreshToken = ref<string>(uni.getStorageSync(REFRESH_KEY) || '')
  const user = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!accessToken.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const permissions = computed(() => user.value?.permissions ?? [])
  const userInitial = computed(() => {
    const name = user.value?.real_name || user.value?.username || 'S'
    return name.charAt(0).toUpperCase()
  })

  function can(code: string): boolean {
    return permissions.value.includes('*') || permissions.value.includes(code)
  }

  function setTokens(access: string, refresh?: string) {
    accessToken.value = access
    uni.setStorageSync(ACCESS_KEY, access)
    if (refresh) {
      refreshToken.value = refresh
      uni.setStorageSync(REFRESH_KEY, refresh)
    }
  }

  function clearSession() {
    accessToken.value = ''
    refreshToken.value = ''
    user.value = null
    uni.removeStorageSync(ACCESS_KEY)
    uni.removeStorageSync(REFRESH_KEY)
  }

  function bindRequestAuth() {
    setTokenGetter(() => accessToken.value)
    setAuthCallbacks({
      getRefreshToken: () => refreshToken.value,
      onTokensRefreshed: setTokens,
      onUnauthorized: clearSession,
    })
  }

  function restore() {
    bindRequestAuth()
    if (accessToken.value && !user.value) {
      fetchMe().catch(() => logout())
    }
  }

  async function login(phone: string, password: string) {
    const tokens = await authApi.login(phone, password)
    accessToken.value = tokens.access_token
    refreshToken.value = tokens.refresh_token
    uni.setStorageSync(ACCESS_KEY, tokens.access_token)
    uni.setStorageSync(REFRESH_KEY, tokens.refresh_token)
    bindRequestAuth()
    try {
      await fetchMe()
    } catch (error) {
      await logout()
      throw error
    }
  }

  async function fetchMe() {
    user.value = await authApi.me()
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      /* 后端不可用时也要能退出 */
    }
    clearSession()
  }

  return {
    accessToken,
    refreshToken,
    user,
    isLoggedIn,
    isAdmin,
    permissions,
    userInitial,
    can,
    login,
    logout,
    restore,
    fetchMe,
    setTokens,
    clearSession,
  }
})
