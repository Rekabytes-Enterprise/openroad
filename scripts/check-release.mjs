import { readFile } from 'node:fs/promises';
const files = ['package.json', 'packages/frontend/package.json', 'packages/backend/package.json'];
const versions = await Promise.all(files.map(async file => JSON.parse(await readFile(file, 'utf8')).version));
if (!versions.every(version => version === versions[0])) throw new Error('Workspace versions must match');
if (!/^\d+\.\d+\.\d+$/.test(versions[0])) throw new Error('Expected stable semver');
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== `v${versions[0]}`) throw new Error('Tag does not match package version');
console.log(`Release version ${versions[0]} verified`);
