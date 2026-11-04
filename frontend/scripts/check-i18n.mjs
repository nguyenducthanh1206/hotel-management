// Kiểm tra bản dịch: mọi chuỗi tiếng Việt hiển thị trên giao diện phải có trong src/dict.en.js.
// Chạy: npm run check:i18n   (thêm --list để in danh sách khóa còn thiếu dạng sẵn để dán vào từ điển)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const { EN } = await import(pathToFileURL(path.join(root, 'dict.en.js')).href);

const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.jsx?$/.test(f) && f !== 'dict.en.js' && files.push(p); } })(root);

const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const used = new Map();       // khóa -> nơi dùng
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
  let m;
  while ((m = re.exec(src))) {
    const s = m[2].replace(/\\(['"`\\])/g, '$1');
    if (VI.test(s) && !s.includes('${') && !/^\s*(\/\/|\{\/\*)/.test(s)) {
      const line = src.slice(0, m.index).split('\n').length;
      if (!used.has(s)) used.set(s, `${path.relative(root, f)}:${line}`);
    }
  }
}

// Chuỗi tiếng Việt cố ý KHÔNG dịch: dữ liệu gửi lên máy chủ, tên người dùng thử, thông báo chỉ có trong log.
const SKIP = new Set(['Khách tự hủy', 'Quản trị viên', 'Wi-Fi, Điều hòa']);
const missing = [...used].filter(([k]) => !(k in EN) && !SKIP.has(k));
const unused = Object.keys(EN).filter((k) => !used.has(k));

for (const [k] of Object.entries(EN)) {
  const a = [...k.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(',');
  const b = [...String(EN[k]).matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(',');
  if (a !== b) console.log(`THAM SỐ KHÔNG KHỚP: "${k}" -> "${EN[k]}"`);
}
if (process.argv.includes('--list')) missing.forEach(([k, w]) => console.log(`  ${JSON.stringify(k)}: '',  // ${w}`));
else missing.forEach(([k, w]) => console.log(`THIẾU: ${JSON.stringify(k)}  (${w})`));
console.log(`\n${used.size} chuỗi tiếng Việt, ${Object.keys(EN).length} mục trong từ điển, ${missing.length} thiếu, ${unused.length} mục dư (có thể là thông báo từ máy chủ).`);
process.exit(missing.length ? 1 : 0);
