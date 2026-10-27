import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mobileViewport = {width: 390, height: 844};
const desktopViewport = {width: 1440, height: 1100};
const originalFolder = 'docs/correccion_integral/capturas/web/WEB-1792482508091';
const destination = 'docs/correccion_integral/capturas/cierre_visual_analytics';
const out = path.join(root, destination);
const require = createRequire('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const {chromium} = require('playwright');
const docker = 'C:/Program Files/Docker/Docker/resources/bin/docker.exe';
const sourceFiles = ['web-admin/src/App.tsx', 'web-admin/src/components/Sidebar.tsx',
  'web-admin/src/styles/global.css', 'web-admin/src/components/AnalyticsChart.tsx', 'web-admin/src/pages/BusinessIntelligence.tsx'];
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const receipt = async file => ({file, sha256: hash(await fs.readFile(path.join(root, file)))});
const pngSize = buffer => ({width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)});
await fs.mkdir(out, {recursive: true});
const report = {result: 'RUNNING', replacements: [], checks: [], limitations: [
  'Comprobación técnica visual local; no constituye UAT humana ni repite la evidencia E2E original.',
  'Login PKCE real; todas las peticiones /api son de lectura. No se usan mocks ni se siembran datos.',
  'Los datos pueden diferir de la ejecución original por actividad autorizada de otros actores.',
  'Los PNG enmascaran datos personales; el rótulo de procedencia se añade solo al navegador de QA.',
  'Se conservan 1440x1100 y 390x844. Los nuevos gráficos pueden necesitar continuaciones adicionales al integrarlos en Word/PPT.',
], executedAt: new Date().toISOString(), originalFolder, destination, humanAcceptance: 'NOT_ASSESSED',
  quality: [], captures: [], requests: [], blockedWrites: [], pageErrors: []};
const save = () => fs.writeFile(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
async function check(name, action) {
  const detail = await action(); report.checks.push({name, result: 'PASS', ...(detail === undefined ? {} : {detail})});
  await save(); console.log(`PASS ${name}`);
}
async function run(name, executable, args, cwd = root) {
  console.log(`START ${name}`);
  const began = Date.now();
  const entry = {name, executable, arguments: args, startedAt: new Date().toISOString()};
  const heartbeat = setInterval(() => console.log(`RUNNING ${name} (${Math.round((Date.now() - began) / 1000)} s)`), 30000);
  const result = await new Promise(resolve => execFile(executable, args,
    {cwd, encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 24 * 1024 * 1024, windowsHide: true, shell: false},
    (error, stdout, stderr) => resolve({error, stdout, stderr})));
  clearInterval(heartbeat);
  Object.assign(entry, {exitCode: result.error ? (typeof result.error.code === 'number' ? result.error.code : null) : 0,
    stdout: result.stdout || '', stderr: result.stderr || '', durationMs: Date.now() - began});
  report.quality.push(entry); await save();
  assert.equal(entry.exitCode, 0, `${name}: revisar stdout/stderr en results.json`);
  console.log(`PASS ${name}`); return entry;
}

let browser;
try {
  report.sources = await Promise.all(sourceFiles.map(receipt));
  if (process.argv.includes('--capture-only')) {
    const prior = JSON.parse(await fs.readFile(path.join(out, 'results.json'), 'utf8'));
    assert.deepEqual(report.sources, prior.sources, 'Las fuentes cambiaron: vuelva a validar y construir antes de capturar');
    assert.ok(prior.quality.length > 0 && prior.quality.every(command => command.exitCode === 0));
    report.quality = prior.quality;
    report.checks.push(...prior.checks.filter(check => check.name === 'Backend no recreado'));
    report.previousAttempt = {result: prior.result, finishedAt: prior.finishedAt,
      failedChecks: prior.checks.filter(check => check.result === 'FAIL')};
    report.reusedQualityReason = 'Mismas fuentes; se repite QA tras esperar la transición responsive de 200 ms.';
  }
  const originals = JSON.parse(await fs.readFile(path.join(root, originalFolder, 'results.json'), 'utf8'));
  report.originalReceipts = await Promise.all(['results.json', ...originals.screenshots].map(file => receipt(`${originalFolder}/${file}`)));
  if (!process.argv.includes('--capture-only')) {
    const web = path.join(root, 'web-admin');
    await run('ESLint (sin advertencias)', process.execPath, ['node_modules/eslint/bin/eslint.js', '.', '--max-warnings', '0'], web);
    await run('TypeScript build', process.execPath, ['node_modules/typescript/bin/tsc', '-b'], web);
    await run('Vite build', process.execPath, ['node_modules/vite/bin/vite.js', 'build'], web);
    const tests = (await fs.readdir(path.join(web, 'tests'))).filter(file => file.endsWith('.test.mjs')).map(file => `tests/${file}`);
    await run('Tests web existentes', process.execPath, ['--test', ...tests], web);
    const before = await run('Identidad de backend antes (solo inspección)', docker, ['inspect', '--format', '{{.Id}}', 'ecoroute-backend']);
    await run('Build solo web', docker, ['compose', 'build', 'ecoroute-web-admin']);
    await run('Recreate solo web, sin dependencias', docker, ['compose', 'up', '-d', '--no-deps', 'ecoroute-web-admin']);
    const after = await run('Identidad de backend después (solo inspección)', docker, ['inspect', '--format', '{{.Id}}', 'ecoroute-backend']);
    await check('Backend no recreado', () => assert.equal(before.stdout.trim(), after.stdout.trim()));
  }
  browser = await chromium.launch({channel: 'msedge', headless: true});
  const context = await browser.newContext({viewport: desktopViewport, deviceScaleFactor: 1, locale: 'es-PE', timezoneId: 'America/Lima'});
  await context.route('**/api/**', async route => {
    const request = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      report.blockedWrites.push({method: request.method(), path: new URL(request.url()).pathname});
      await route.abort('blockedbyclient');
    } else await route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/')) report.requests.push({method: response.request().method(), path: url.pathname, status: response.status()});
  });
  await page.goto('http://localhost:3000/login', {waitUntil: 'networkidle'});
  await page.getByRole('button', {name: /Iniciar|Ingresar|Keycloak/i}).click();
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill(process.env.ECOROUTE_ADMIN_PASSWORD || 'admin123');
  await page.locator('#kc-login').click();
  await page.waitForURL('http://localhost:3000/');
  await page.waitForLoadState('networkidle');
  await check('Login PKCE real y sesión backend 200', () => assert.ok(report.requests.some(r => r.path === '/api/session/me' && r.status === 200)));

  async function go(url, viewport) {
    await page.setViewportSize(viewport);
    await page.goto(`http://localhost:3000${url}`, {waitUntil: 'networkidle'});
    await page.locator('.main-content .header-title').waitFor();
    await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes('Cargando'));
    await page.evaluate(() => document.fonts.ready);
    // Provenance overlay only, never UI/business data changes.
    await page.evaluate(() => {
      const stamp = document.createElement('div'); stamp.id = 'qa-provenance';
      stamp.textContent = 'BACKEND LOCAL REAL · Solo lectura · UAT humana no evaluada';
      Object.assign(stamp.style, {position: 'fixed', bottom: '0', right: '0', zIndex: '1500', maxWidth: '100%',
        background: '#0f2942', color: '#fff', fontSize: '10px', padding: '3px 6px', pointerEvents: 'none'});
      document.body.append(stamp);
    });
  }
  async function scrollTo(top) {
    return page.locator('main.main-content').evaluate((element, position) => {
      element.scrollTop = position; return element.scrollTop;
    }, top);
  }
  async function focusSection(heading) {
    await heading.evaluate(element => {
      const main=document.querySelector('main.main-content');
      const section=element.closest('section.card');
      if(main&&section)main.scrollTop+=section.getBoundingClientRect().top-main.getBoundingClientRect().top-16;
    });
    await page.waitForTimeout(100);
  }
  async function shot(original, replacement, extra = {}) {
    await page.waitForTimeout(250);
    const masks = page.locator('aside p, main input:not([type=checkbox]), main select, main tbody td:not(:last-child)');
    const buffer = await page.screenshot({path: path.join(out, replacement), fullPage: false, mask: [masks], maskColor: '#cbd5e1'});
    const dimensions = pngSize(buffer);
    if (original) {
      assert.ok(originals.screenshots.includes(original), `Original desconocido ${original}`);
      const originalDimensions = pngSize(await fs.readFile(path.join(root, originalFolder, original)));
      assert.deepEqual(dimensions, originalDimensions, `Cambió tamaño de ${original}`);
      report.replacements.push({original, replacement});
    }
    report.captures.push({original: original || null, replacement, dimensions, sha256: hash(buffer),
      url: new URL(page.url()).pathname, scrollTop: await page.locator('main.main-content').evaluate(el => el.scrollTop), ...extra});
    await save();
  }
  async function noOverlap(name) {
    await check(name, async () => {
      const geometry = await page.evaluate(() => {
        const header = document.querySelector('.mobile-navigation-bar')?.getBoundingClientRect();
        const title = document.querySelector('main .header-title')?.getBoundingClientRect();
        const main = document.querySelector('main')?.getBoundingClientRect();
        return {headerBottom: header?.bottom, titleTop: title?.top, mainTop: main?.top,
          documentWidth: document.documentElement.scrollWidth, viewport: innerWidth};
      });
      assert.ok(geometry.headerBottom > 0); assert.ok(geometry.titleTop >= geometry.headerBottom);
      assert.ok(geometry.mainTop >= geometry.headerBottom); assert.ok(geometry.documentWidth <= geometry.viewport);
      return geometry;
    });
  }
  await go('/orders', mobileViewport);
  await noOverlap('MV03: título de pedidos separado del menú a 390px');
  await shot('responsive_orders.png', 'mv03_responsive_orders.png');
  await check('Menú móvil abre, contiene foco, cierra con Escape y devuelve foco', async () => {
    const trigger = page.getByRole('button', {name: 'Abrir navegación'});
    await trigger.click(); await page.getByRole('dialog', {name: 'Menú principal'}).waitFor();
    assert.equal(await page.locator('#app-sidebar').evaluate(el => el.contains(document.activeElement)), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('#app-sidebar').evaluate(el => el.contains(document.activeElement)), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#app-sidebar').count(), 0);
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
  });
  await check('Breakpoint 767/768 mantiene contenido fuera de Sidebar', async () => {
    for (const width of [767, 768]) {
      await page.setViewportSize({width, height: 844});
      await page.waitForTimeout(350);
      const geometry = await page.evaluate(() => ({sidebar: !!document.querySelector('aside'),
        topbar: !!document.querySelector('.mobile-navigation-bar'), mainX: document.querySelector('main').getBoundingClientRect().x}));
      assert.equal(geometry.sidebar, width === 768); assert.equal(geometry.topbar, width === 767);
      assert.equal(geometry.mainX, width === 768 ? 260 : 0);
    }
  });

  await go('/bi', mobileViewport);
  await page.getByRole('heading', {name: /^IID ·/}).waitFor();
  await noOverlap('MV03: título BI separado del menú a 390px');
  await shot('responsive_bi.png', 'mv03_responsive_bi.png');
  const responsiveOriginals = ['responsive_bi_scroll844.png', 'responsive_bi_scroll1688.png',
    'responsive_bi_scroll2532.png', 'responsive_bi_scroll3376.png', 'responsive_bi_scroll4220.png'];
  const anchors = [/^IID ·/, /^SUCCESS ·/, /^Evolución diaria · IID$/, /^Evolución diaria · TDE$/, /^Evolución diaria · ONTIME$/];
  for (let index = 0; index < anchors.length; index++) {
    const heading = page.getByRole('heading', {name: anchors[index]});
    await focusSection(heading);
    const box = await heading.boundingBox();
    const bar = await page.locator('.mobile-navigation-bar').boundingBox();
    assert.ok(box.y >= bar.y + bar.height && box.x >= 0 && box.x + box.width <= 390);
    await shot(responsiveOriginals[index], `mv03_responsive_bi_${index + 1}.png`, {semanticAnchor: anchors[index].source});
  }
  await check('MV03: IID y cinco gráficos de tendencias disponibles sin superposición', async () => {
    assert.equal(await page.getByRole('heading', {name: /^Evolución diaria ·/}).count(), 5);
    return {responsiveContinuations: 5, viewport: mobileViewport};
  });
  await go('/bi', desktopViewport);
  await page.getByRole('heading', {name: /^IID ·/}).waitFor();
  await shot('screen_bi.png', 'mv03_screen_bi.png');
  await shot('bi_Tendencias.png', 'mv03_bi_Tendencias.png');
  await scrollTo(1100);
  await shot('screen_bi_scroll1100.png', 'mv03_screen_bi_scroll1100.png');
  await shot('bi_Tendencias_scroll1100.png', 'mv03_bi_Tendencias_scroll1100.png');
  await scrollTo(0); await page.getByRole('button', {name: 'Causas', exact: true}).click();
  await shot('bi_Causas.png', 'mv04_bi_Causas.png');
  await scrollTo(1100); await shot('bi_Causas_scroll1100.png', 'mv04_bi_Causas_scroll1100.png');
  async function readableCauses(name) {
    await check(name, async () => {
      const data = await page.locator('.analytics-chart--horizontal').evaluateAll(sections => sections.map(section => ({
        title: section.querySelector('h3').textContent,
        labels: [...section.querySelectorAll('.analytics-bar-label')].map(label => {
          const box = label.getBoundingClientRect(), row = label.closest('li').getBoundingClientRect();
          return {text: label.textContent, fontSize: parseFloat(getComputedStyle(label).fontSize),
            fits: label.scrollWidth <= label.clientWidth + 1 && box.left >= row.left && box.right <= row.right + 1};
        }),
        rows: [...section.querySelectorAll('.analytics-bar-row')].map(row => {
          const track = row.querySelector('.analytics-bar-track').getBoundingClientRect();
          const value = row.querySelector('.analytics-bar-value').getBoundingClientRect();
          return {trackWidth: track.width, separateValue: track.right <= value.left};
        }),
      })));
      assert.equal(data.length, 3);
      assert.ok(data.every(chart => chart.labels.length > 0 && chart.labels.every(label => label.fits && label.fontSize >= 14)));
      assert.ok(data.every(chart => chart.rows.every(row => row.trackWidth > 80 && row.separateValue)));
      return data;
    });
  }
  await readableCauses('MV04: tres gráficos horizontales con etiquetas completas y valores legibles a 1440px');
  const causeTitles = ['Motivos registrados · todas las fuentes', 'Motivos en historial de estados', 'Motivos de incidencias'];
  for (let index = 0; index < causeTitles.length; index++) {
    await focusSection(page.getByRole('heading', {name: causeTitles[index], exact: true}));
    await shot(null, `mv04_causas_detalle_${index + 1}.png`);
  }
  await page.setViewportSize(mobileViewport);
  await page.waitForTimeout(350);
  await readableCauses('MV04: etiquetas y valores legibles a 390px');
  await focusSection(page.getByRole('heading', {name: causeTitles[0], exact: true}));
  await shot(null, 'mv04_responsive_causas.png');
  await check('Sin escrituras API, errores JS ni respuestas API fallidas', () => {
    assert.deepEqual(report.blockedWrites, []); assert.deepEqual(report.pageErrors, []);
    assert.ok(report.requests.length > 0 && report.requests.every(request => request.status < 400));
    return {readRequests: report.requests.length, apiWrites: 0, pageErrors: 0};
  });
  await check('Fuentes finales y originales E2E sin cambios durante QA', async () => {
    for (const file of [...report.sources, ...report.originalReceipts]) assert.equal((await receipt(file.file)).sha256, file.sha256);
    return {sourceFiles: report.sources.length, originalFiles: report.originalReceipts.length};
  });
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL'; report.checks.push({name: 'Cierre de QA', result: 'FAIL', detail: error.message});
  console.log(`FAIL ${error.message}`); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString(); await save();
  console.log(JSON.stringify({result: report.result, replacements: report.replacements.length,
    captures: report.captures.length, checks: report.checks.length, path: `${destination}/results.json`}));
}
