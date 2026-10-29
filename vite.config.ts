import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: command === 'build' ? {
    'process.env.NODE_ENV': JSON.stringify('production'),
  } : {},
  server: {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    watch: {
      usePolling: true,
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'TiamoImageEditor',
      fileName: (format) => `my-image-editor.${format}.js`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      // 零框架依赖独立打包：将 React、ReactDOM 和 Lucide 图标全部打入独立单文件 SDK
      external: [],
      output: {
        exports: 'named',
        globals: {},
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
}));
