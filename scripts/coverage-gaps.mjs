import fs from 'node:fs';
import path from 'node:path';

/** 按文件过滤显示未覆盖的函数、分支与源码行，帮助定位实际补测边界。 */
const report = JSON.parse(fs.readFileSync('coverage/coverage-final.json', 'utf8'));
const filters = process.argv.slice(2);
for (const [filename, data] of Object.entries(report)) {
  if (!filters.some((filter) => filename.includes(filter))) continue;
  const source = fs.readFileSync(filename, 'utf8').split(/\r?\n/);
  console.log(path.relative(process.cwd(), filename));
  for (const [id, count] of Object.entries(data.f)) {
    if (count === 0) console.log('function', data.fnMap[id].name, data.fnMap[id].loc.start.line);
  }
  const lines = new Set();
  for (const [id, counts] of Object.entries(data.b)) {
    if (counts.some((count) => count === 0)) lines.add(data.branchMap[id].line);
  }
  for (const line of [...lines].sort((a, b) => a - b)) console.log(line, source.slice(Math.max(0, line - 2), line + 1).join(' ').trim());
}
