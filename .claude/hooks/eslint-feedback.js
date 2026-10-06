#!/usr/bin/env node
// PostToolUse feedback: lints the TypeScript file that was just edited and reports errors back to Claude.
// Does not block: the edit has already happened. Many files still have baseline lint errors (TD-2),
// so this reports them on every edit; read the output as "file got worse" only if the errors are new.
const { spawnSync } = require('child_process');

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  const data = JSON.parse(input || '{}');
  const filePath = (data.tool_input && data.tool_input.file_path) || '';

  if (!filePath.endsWith('.ts')) process.exit(0);

  const result = spawnSync('npx', ['eslint', '--format', 'compact', filePath], {
    shell: true,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    process.stderr.write(result.stdout || result.stderr || 'eslint failed\n');
    process.exit(2);
  }
  process.exit(0);
});
