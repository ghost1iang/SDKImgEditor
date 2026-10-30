#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export function syncHtmlTimestamp() {
  const distFile = path.resolve(projectRoot, 'dist/tiamo-image-editor.umd.js');
  const indexHtml = path.resolve(projectRoot, 'index.html');

  if (!fs.existsSync(distFile)) {
    console.warn('[sync-html-timestamp] dist/tiamo-image-editor.umd.js 不存在，跳过同步');
    return null;
  }
  if (!fs.existsSync(indexHtml)) {
    console.warn('[sync-html-timestamp] index.html 不存在，跳过同步');
    return null;
  }

  const stat = fs.statSync(distFile);
  const timestamp = Math.floor(stat.mtimeMs || stat.ctimeMs);
  const formattedTime = new Date(timestamp).toLocaleString();

  let content = fs.readFileSync(indexHtml, 'utf-8');

  // 匹配形如 ./dist/tiamo-image-editor.umd.js 或 ./dist/tiamo-image-editor.umd.js?t=...
  const regex = /(['"]\.\/dist\/tiamo-image-editor\.umd\.js)(\?t=\d+)?(['"])/g;
  if (regex.test(content)) {
    content = content.replace(regex, `$1?t=${timestamp}$3`);
    fs.writeFileSync(indexHtml, content, 'utf-8');
    console.log(`[sync-html-timestamp] ✅ 已更新 index.html 时间戳为文件修改时间: ?t=${timestamp} (${formattedTime})`);
    return timestamp;
  } else {
    console.warn('[sync-html-timestamp] ⚠️ 未在 index.html 中匹配到 dist/tiamo-image-editor.umd.js 引入脚本');
    return null;
  }
}

// 直接以 CLI 运行时执行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncHtmlTimestamp();
}

