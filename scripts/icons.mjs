import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const out = resolve('public/icons')
mkdirSync(out, { recursive: true })

const mark = (bg, ring, dot, radius) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
  ${bg ? `<rect width="64" height="64" rx="${radius}" fill="${bg}"/>` : ''}
  <circle cx="32" cy="32" r="17" fill="none" stroke="${ring}" stroke-width="5" opacity=".28"/>
  <path d="M44.02 44.02 A17 17 0 1 1 44.02 19.98" fill="none" stroke="${ring}" stroke-width="5" stroke-linecap="round"/>
  <circle cx="44.02" cy="19.98" r="5.2" fill="${dot}"/>
</svg>`

const jobs = [
  { file: 'icon-192.png', size: 192, html: mark('#1d3b33', '#f3efe4', '#e8542e', 16) },
  { file: 'icon-512.png', size: 512, html: mark('#1d3b33', '#f3efe4', '#e8542e', 16) },
  { file: 'apple-touch-icon.png', size: 180, html: mark('#1d3b33', '#f3efe4', '#e8542e', 0) },
  { file: 'maskable-512.png', size: 512, html: `<div style="width:100%;height:100%;background:#1d3b33;display:flex;align-items:center;justify-content:center"><div style="width:72%;height:72%">${mark(null, '#f3efe4', '#e8542e', 0)}</div></div>` },
  { file: 'badge-96.png', size: 96, html: mark(null, '#ffffff', '#ffffff', 0) },
]

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
for (const j of jobs) {
  await page.setViewport({ width: j.size, height: j.size, deviceScaleFactor: 1 })
  await page.setContent(`<html><body style="margin:0;width:${j.size}px;height:${j.size}px;background:transparent">${j.html}</body></html>`)
  await page.screenshot({ path: resolve(out, j.file), omitBackground: true })
  console.log('wrote', j.file)
}
await browser.close()
