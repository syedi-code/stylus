import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import './style.css'
import App from './App.vue'
import { queryClient, restoreCache } from './lib/queryClient'
import { ensureSession } from './lib/session'

// Ask for the session while the saved cache is read, not after.
ensureSession().catch(() => {})

restoreCache().finally(() => {
	createApp(App).use(VueQueryPlugin, { queryClient }).mount('#app')
})
