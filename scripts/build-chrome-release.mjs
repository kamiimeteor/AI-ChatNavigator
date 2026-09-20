import { cpSync, existsSync, mkdirSync, readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3 || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  throw new Error('Expected a Manifest V3 extension with a three-part release version.');
}
const files = [
  'manifest.json',
  'content/message-index.js', 'content/navigation.js', 'content/content.js',
  'content/observer.js', 'content/sidebar.js', 'content/adapters/common.js',
  'content/adapters/chatgpt.js', 'content/adapters/claude.js', 'content/adapters/gemini.js',
  'popup/popup.html', 'popup/popup.js', 'styles/sidebar.css',
  'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png'
];
const referenced = manifest.content_scripts.flatMap(script => [...script.js, ...script.css]);
for (const file of [...files, ...referenced]) {
  if (!files.includes(file) || !existsSync(path.join(rootDir, file))) throw new Error('Missing or unapproved release file: ' + file);
  if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', path.join(rootDir, file)]);
}
execFileSync(process.execPath, ['--test', 'tests/message-index.test.cjs', 'tests/navigation.test.cjs'], { cwd: rootDir, stdio: 'inherit' });

// Stage in a fresh directory; never delete the user's existing dist contents.
const stage = mkdtempSync(path.join(tmpdir(), 'acn-release-'));
const payload = path.join(stage, 'extension');
for (const file of files) {
  const dest = path.join(payload, file);
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(path.join(rootDir, file), dest);
}
const zipPath = path.join(stage, 'release.zip');
execFileSync('zip', ['-X', '-q', zipPath, ...files], { cwd: payload });
const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n');
if (listing.length !== files.length || listing.some(file => !files.includes(file))) throw new Error('Release zip contains unexpected files.');
execFileSync('unzip', ['-tq', zipPath]);

const releaseDir = path.join(rootDir, 'release');
mkdirSync(releaseDir, { recursive: true });
const releaseZip = path.join(releaseDir, `AI-ChatNavigator-v${manifest.version}-chrome.zip`);
if (existsSync(releaseZip)) throw new Error('Release already exists; choose a new version instead of overwriting it: ' + releaseZip);
const unpacked = path.join(rootDir, 'dist', `chrome-v${manifest.version}`);
if (existsSync(unpacked)) throw new Error('Unpacked release already exists: ' + unpacked);
cpSync(payload, unpacked, { recursive: true });
cpSync(zipPath, releaseZip);
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
const zipSha = sha(readFileSync(releaseZip));
writeFileSync(releaseZip + '.sha256', `${zipSha}  ${path.basename(releaseZip)}\n`);
const provenance = {
  version: manifest.version,
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }).trim(),
  workingTreeDirty: !!execFileSync('git', ['status', '--porcelain'], { cwd: rootDir, encoding: 'utf8' }).trim(),
  zipSha256: zipSha,
  baselineRelease: existsSync(path.join(releaseDir, 'AI-ChatNavigator-v1.0.2-chrome.zip')) ? {
    file: 'AI-ChatNavigator-v1.0.2-chrome.zip',
    sha256: sha(readFileSync(path.join(releaseDir, 'AI-ChatNavigator-v1.0.2-chrome.zip')))
  } : null,
  sourceSha256: Object.fromEntries(files.map(file => [file, sha(readFileSync(path.join(rootDir, file)))]))
};
writeFileSync(releaseZip + '.provenance.json', JSON.stringify(provenance, null, 2) + '\n');
console.log(`Release: ${releaseZip}\nLoad unpacked: ${unpacked}\nSHA-256: ${zipSha}`);
