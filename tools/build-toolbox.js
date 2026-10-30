#!/usr/bin/env node
'use strict';

/*
 * 把 timesheet.html 与 diff-viewer.html 内联进单个 toolbox.html。
 * 用法：node tools/build-toolbox.js
 * 产物：toolbox.html（自包含，可单独分发）
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const sources = {
  timesheet: 'timesheet.html',
  diff: 'diff-viewer.html'
};

const template = read('shell.template.html');
const bundle = {};
const manifest = [];

for (const [key, file] of Object.entries(sources)) {
  const code = read(file);
  bundle[key] = code;
  manifest.push({
    key,
    file,
    bytes: Buffer.byteLength(code),
    sha256: crypto.createHash('sha256').update(code, 'utf8').digest('hex').slice(0, 16)
  });
}

if (!template.includes('__BUNDLE__')) {
  throw new Error('模板缺少 __BUNDLE__ 占位符');
}
if (template.split('__BUNDLE__').length !== 2) {
  throw new Error('模板中 __BUNDLE__ 必须唯一');
}

/* 转义 <、U+2028、U+2029，避免 JSON 内容截断 script 标签或破坏解析 */
const json = JSON.stringify(bundle)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const out = template.replace('__BUNDLE__', () => json);

for (const bad of ['<script src=', 'href="http', "@import"]) {
  if (out.includes(bad)) throw new Error('产物包含外部依赖: ' + bad);
}
if (!out.includes('data:image/svg+xml')) throw new Error('产物缺少内嵌图标');

fs.writeFileSync(path.join(root, 'toolbox.html'), out, 'utf8');

const size = Buffer.byteLength(out);
console.log('已生成 toolbox.html');
console.log('  体积: ' + (size / 1024).toFixed(1) + ' KB');
for (const m of manifest) {
  console.log('  ← ' + m.file + '  ' + (m.bytes / 1024).toFixed(1) + ' KB  sha256:' + m.sha256);
}
fs.writeFileSync(
  path.join(root, '.build-manifest.json'),
  JSON.stringify({ builtAt: new Date().toISOString(), bytes: size, parts: manifest }, null, 2),
  'utf8'
);
