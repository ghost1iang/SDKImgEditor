import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

function terminalLauncherPlugin(): Plugin {
  return {
    name: 'terminal-launcher',
    configureServer(server) {
      server.middlewares.use('/api/launch-terminal', async (req, res) => {
        if (req.method === 'POST') {
          const cwd = process.cwd();
          
          // 在 macOS 下拉起 Terminal 并激活到当前工程根目录
          exec(`open -a Terminal "${cwd}" && osascript -e 'tell application "Terminal" to activate'`, (err) => {
            if (err) {
              console.warn('[Terminal Launcher] Failed to activate Terminal:', err.message);
              exec(`open -a Terminal "${cwd}"`);
            }
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            cwd,
            command: `cd "${cwd}" && npm run publish:sdk`,
            shortCommand: 'npm run publish:sdk',
          }));
          return;
        }
        res.statusCode = 404;
        res.end();
      });

      server.middlewares.use('/api/sdk-info', (req, res) => {
        const cwd = process.cwd();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          cwd,
          command: `cd "${cwd}" && npm run publish:sdk`,
          shortCommand: 'npm run publish:sdk',
        }));
      });
    },
  };
}

function distTimestampPlugin(): Plugin {
  return {
    name: 'dist-timestamp',
    transformIndexHtml(html) {
      try {
        const umdPath = path.resolve(process.cwd(), 'dist/tiamo-image-editor.umd.js');
        if (fs.existsSync(umdPath)) {
          const stat = fs.statSync(umdPath);
          const timestamp = Math.floor(stat.mtimeMs || stat.ctimeMs);
          return html.replace(
            /(['"]\.\/dist\/tiamo-image-editor\.umd\.js)(\?t=\d+)?(['"])/g,
            `$1?t=${timestamp}$3`
          );
        }
      } catch (e) {
        console.warn('[distTimestampPlugin] Failed to read mtime:', e);
      }
      return html;
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), terminalLauncherPlugin(), distTimestampPlugin()],
  define: {
    ...(command === 'build' ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {}),
    '__PROJECT_CWD__': JSON.stringify(process.cwd()),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
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
      fileName: (format) => `tiamo-image-editor.${format}.js`,
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
