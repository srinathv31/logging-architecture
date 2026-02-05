import { readdir, readFile, writeFile, stat, access } from 'fs/promises';
import { join, dirname } from 'path';

const distDir = new URL('../dist', import.meta.url).pathname;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(path) {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function fixImportPath(importPath, fileDir) {
  // Skip if already has extension
  if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
    return importPath;
  }

  const resolvedPath = join(fileDir, importPath);

  // Check if it's a directory with an index.js
  if (await isDirectory(resolvedPath)) {
    if (await exists(join(resolvedPath, 'index.js'))) {
      return `${importPath}/index.js`;
    }
  }

  // Check if the .js file exists
  if (await exists(resolvedPath + '.js')) {
    return `${importPath}.js`;
  }

  return importPath;
}

async function processFile(filePath) {
  let content = await readFile(filePath, 'utf-8');
  const fileDir = dirname(filePath);
  let modified = false;

  // Fix static imports: from './path'
  const staticImportRegex = /from\s+['"](\.[^'"]+)['"]/g;
  let match;
  while ((match = staticImportRegex.exec(content)) !== null) {
    const importPath = match[1];
    const fixedPath = await fixImportPath(importPath, fileDir);
    if (fixedPath !== importPath) {
      content = content.replace(match[0], `from '${fixedPath}'`);
      modified = true;
    }
  }

  // Fix dynamic imports: import('./path')
  const dynamicImportRegex = /import\(['"](\.[^'"]+)['"]\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    const importPath = match[1];
    const fixedPath = await fixImportPath(importPath, fileDir);
    if (fixedPath !== importPath) {
      content = content.replace(match[0], `import('${fixedPath}')`);
      modified = true;
    }
  }

  if (modified) {
    await writeFile(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

async function processDir(dir) {
  const entries = await readdir(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = await stat(fullPath);

    if (stats.isDirectory()) {
      await processDir(fullPath);
    } else if (entry.endsWith('.js')) {
      await processFile(fullPath);
    }
  }
}

console.log('Adding .js extensions to ESM imports...');
await processDir(distDir);
console.log('Done!');
