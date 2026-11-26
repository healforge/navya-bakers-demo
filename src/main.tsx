import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { UpdatePrompt } from '@/components/pwa/UpdatePrompt'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { initPersistence } from '@/store/persistence'
import { useDbStore } from '@/store/db'
import './index.css'

initPersistence(useDbStore)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <App />
        <Toaster richColors position="top-center" />
        <UpdatePrompt />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
)
