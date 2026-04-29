import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      lib: {
        entry: 'src/ui/main.ts',
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        input: 'src/ui/preload.ts',
        external: ['electron'],
        output: {
          format: 'cjs',
          entryFileNames: 'preload.js',
        },
      },
    },
  },
  renderer: {
    root: 'src/ui/renderer',
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: 'src/ui/renderer/index.html',
      },
    },
    plugins: [
      react(),
      tailwindcss(),
    ],
  },
})
