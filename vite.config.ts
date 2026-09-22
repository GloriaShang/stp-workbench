import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base 用相对路径，方便以后直接部署到 GitHub Pages 的子路径
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
