// src/stores/auth.ts - Auth store backed by uni storage.
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import { setTokenGetter } from '@/api/request'
import type { UserInfo } from '@/types'

const ACCESS_KEY = 'wdm_sales_access'
const REFRESH_KEY = 'wdm_sales_refresh'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string>(uni.getStorageSync(ACCESS_KEY) || '')
  const refreshToken = ref<string>(uni.getStorageSync(REFRESH_KEY) || '')
  const user = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!accessToken.value)
  const userInitial = computed(() => {
    const name = user.value?.real_name || user.value?.username || 'S'
    return name.charAt(0).toUpperCase()
  })

  function restore() {
    setTokenGetter(() => accessToken.value)
    if (accessToken.value) {
      fetchMe().catch(() => {
        // Token expired
        logout()
      })
    }
  }

  async function login(phone: string, password: string) {
    const tokens = await authApi.login(phone, password)
    accessToken.value = tokens.access_token
    refreshToken.value = tokens.refresh_token
    uni.setStorageSync(ACCESS_KEY, tokens.access_token)
    uni.setStorageSync(REFRESH_KEY, tokens.refresh_token)
    setTokenGetter(() => accessToken.value)
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
      /* ignore */
    }
    accessToken.value = ''
    refreshToken.value = ''
    user.value = null
    uni.removeStorageSync(ACCESS_KEY)
    uni.removeStorageSync(REFRESH_KEY)
  }

  return { accessToken, refreshToken, user, isLoggedIn, userInitial, login, logout, restore, fetchMe }
})
