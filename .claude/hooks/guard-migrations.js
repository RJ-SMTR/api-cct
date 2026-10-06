#!/usr/bin/env node
// PreToolUse gate: applied migrations are immutable (CLAUDE.md, "Rules that cannot be inferred").
// Blocks Edit/Write on an existing file under src/database/migrations/; new migrations are allowed.
const fs = require('fs');

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  const data = JSON.parse(input || '{}');
  const filePath = (data.tool_input && data.tool_input.file_path) || '';
  const normalized = filePath.replace(/\\/g, '/');

  if (!normalized.includes('src/database/migrations/')) process.exit(0);
  if (!fs.existsSync(filePath)) process.exit(0);

  process.stderr.write(
    'Blocked: applied migrations must not be edited. Add a new migration instead (see CLAUDE.md).\n',
  );
  process.exit(2);
});
