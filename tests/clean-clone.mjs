// Valida o conteúdo compartilhável sem criar commits no repositório da dupla.
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const temp = mkdtempSync(join(tmpdir(), 'scd-clean-'));
const source = join(temp, 'source');
const clone = join(temp, 'clone');
const run = (command, args, cwd, env = process.env) => execFileSync('rtk', ['proxy', command, ...args], { cwd, env, stdio: 'inherit' });
const files = execFileSync('rtk', ['proxy', 'git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
for (const file of new Set(files)) { const target = join(source, file); mkdirSync(dirname(target), { recursive: true }); copyFileSync(join(root, file), target); }
run('git', ['init', '-q', source], root);
run('git', ['add', '.'], source);
run('git', ['-c', 'user.name=Local validation', '-c', 'user.email=validation@localhost', 'commit', '-qm', 'Temporary source snapshot'], source);
run('git', ['clone', '-q', source, clone], temp);
run('npm', ['ci'], clone);
run('npm', ['run', 'setup'], clone);
run('npm', ['run', 'typecheck'], clone);
run('npm', ['run', 'build'], clone);
const project = `scdclean${Date.now()}`;
writeFileSync(join(clone, '.env'), readFileSync(join(clone, '.env'), 'utf8').replace('COMPOSE_PROJECT_NAME=scd', `COMPOSE_PROJECT_NAME=${project}`).replace('PORT=8080', 'PORT=8081'));
const docker = process.platform === 'win32' ? 'wsl' : 'docker';
const prefix = process.platform === 'win32' ? ['-u', 'root', '--', 'docker'] : [];
try {
  run(docker, [...prefix, 'compose', 'config', '--quiet'], clone);
  run(docker, [...prefix, 'compose', 'up', '--build', '-d', '--wait', '--wait-timeout', '180'], clone);
  run('npm', ['run', 'smoke'], clone, { ...process.env, BASE_URL: 'http://localhost:8081' });
  run(docker, [...prefix, 'compose', 'ps', '-a'], clone);
  console.log(`PASS: clone limpo ${clone}; projeto ${project}`);
} finally {
  run(docker, [...prefix, 'compose', 'down'], clone);
  console.log(`Snapshot preservado em ${temp}; volume ${project}_postgres-data preservado.`);
}
