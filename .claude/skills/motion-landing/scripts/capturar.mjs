#!/usr/bin/env node
// Verificador visual para páginas con motion y WebGL.
//
// Abre una URL en Chromium headless usando la GPU real, ejecuta una lista de
// pasos (esperar, mover el ratón, clic, rueda, evaluar JS, capturar) y deja las
// fotos en una carpeta. Imprime el renderizador WebGL al empezar (para detectar
// SwiftShader, que va a ~1 fps y hace que las capturas engañen) y los errores de
// consola al terminar.
//
// Uso (desde la raíz del proyecto, que debe tener Playwright instalado):
//   node .claude/skills/motion-landing/scripts/capturar.mjs pasos.json salida/
//
// Formato de pasos.json:
// {
//   "url": "http://127.0.0.1:4321/",
//   "viewport": { "width": 1440, "height": 900 },   // opcional
//   "dpr": 1, "mobile": false, "touch": false,     // opcionales
//   "reduced": false,                              // prefers-reduced-motion
//   "locale": "es-CO",                             // opcional
//   "navegador": "/opt/brave.com/brave/brave",     // opcional: Chromium alternativo
//   "angle": ["--use-angle=gl-egl"],               // opcional: banderas de GPU
//   "localStorage": { "clave": "valor" },          // opcional: cerrar modales
//   "pasos": [
//     { "esperar": 1500 },
//     { "mover": [900, 400], "pasosMov": 12 },
//     { "clic": [700, 520] },
//     { "rueda": 800 },                  // desplaza con la rueda (funciona con Lenis)
//     { "scrollA": 1200 },               // window.scrollTo (no sirve con Lenis)
//     { "eval": "document.title" },      // imprime el resultado en JSON
//     { "foto": "hero.png", "clip": { "x": 0, "y": 0, "width": 800, "height": 600 } },
//     { "foto": "todo.png", "completa": true }
//   ]
// }
// Varios campos pueden ir en el mismo paso; se ejecutan en el orden de la lista
// de arriba (esperar, mover, clic, rueda, scrollA, eval, foto).

import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [archivo, salidaArg] = process.argv.slice(2)
if (!archivo) {
  console.error('Uso: node capturar.mjs pasos.json [carpeta-salida]')
  process.exit(1)
}
const salida = resolve(salidaArg ?? 'capturas')
mkdirSync(salida, { recursive: true })
const cfg = JSON.parse(readFileSync(archivo, 'utf8'))

// Playwright se resuelve desde el proyecto actual, no desde la carpeta de la
// skill: así se usa la misma versión (y los mismos navegadores) que sus tests.
let chromium
try {
  const require = createRequire(join(process.cwd(), 'package.json'))
  ;({ chromium } = require('playwright'))
} catch {
  try {
    const require = createRequire(join(process.cwd(), 'package.json'))
    ;({ chromium } = require('@playwright/test'))
  } catch {
    console.error('No encontré Playwright en este proyecto. Instálalo con: npm i -D playwright && npx playwright install chromium')
    process.exit(1)
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: cfg.navegador,
  args: cfg.angle ?? ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu'],
})
const ctx = await browser.newContext({
  viewport: cfg.viewport ?? { width: 1440, height: 900 },
  deviceScaleFactor: cfg.dpr ?? 1,
  reducedMotion: cfg.reduced ? 'reduce' : 'no-preference',
  hasTouch: !!cfg.touch,
  isMobile: !!cfg.mobile,
  locale: cfg.locale ?? 'es-CO',
})
if (cfg.localStorage) {
  await ctx.addInitScript((pares) => {
    try {
      for (const [k, v] of Object.entries(pares)) localStorage.setItem(k, v)
    } catch {}
  }, cfg.localStorage)
}

const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errores.push(`${m.type()}: ${m.text()}`)
})

await page.goto(cfg.url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => errores.push('goto: ' + e.message))

const renderizador = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2')
  if (!gl) return 'sin WebGL2'
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
})
console.log('renderizador:', renderizador)
if (/swiftshader|llvmpipe/i.test(renderizador)) {
  console.log('AVISO: render por software; las animaciones irán lentas y las capturas pueden engañar. Prueba otras banderas en "angle".')
}

for (const p of cfg.pasos ?? []) {
  try {
    if (p.esperar) await page.waitForTimeout(p.esperar)
    if (p.mover) await page.mouse.move(p.mover[0], p.mover[1], { steps: p.pasosMov ?? 8 })
    if (p.clic) await page.mouse.click(p.clic[0], p.clic[1])
    if (p.rueda !== undefined) await page.mouse.wheel(0, p.rueda)
    if (p.scrollA !== undefined) await page.evaluate((y) => window.scrollTo(0, y), p.scrollA)
    if (p.eval) console.log('eval:', JSON.stringify(await page.evaluate(p.eval)))
    if (p.foto) {
      await page.screenshot({ path: join(salida, p.foto), fullPage: !!p.completa, clip: p.clip, timeout: 45000 })
      console.log('foto:', join(salida, p.foto))
    }
  } catch (e) {
    errores.push(`paso ${JSON.stringify(p)}: ${e.message.split('\n')[0]}`)
  }
}

if (errores.length) console.log('ERRORES:\n' + errores.join('\n'))
await browser.close()
