import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0.12, resizeOptions: { background: '#FFFFFF', fit: 'contain' } },
    apple: { ...preset.apple, padding: 0.12, resizeOptions: { background: '#FFFFFF', fit: 'contain' } },
  },
  images: ['public/logo.svg'],
})
