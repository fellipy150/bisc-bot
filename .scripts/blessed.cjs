const fs = require('fs')
const path = require('path')
const blessed = require('blessed')

const FILE = path.resolve(process.cwd(), 'blessed.json')

// inicialização do arquivo
if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, '[]')
}

// leitura inicial
let buffer = JSON.parse(fs.readFileSync(FILE, 'utf8'))

const persist = (event) => {
  buffer.push(event)
  fs.writeFileSync(FILE, JSON.stringify(buffer, null, 2))
}

// screen
const screen = blessed.screen({
  smartCSR: false,
  fullUnicode: true,
  dockBorders: true,
  mouse: true,
  input: process.stdin,
  output: process.stdout,
  terminal: 'xterm-256color'
})

screen.program.enableMouse()
screen.program.setMouse({ allMotion: true })
screen.program.raw = true

// menu
const menu = blessed.list({
  top: 0,
  left: 0,
  width: '30%',
  height: '100%',
  border: 'line',
  label: ' Menu ',
  items: [
    'Eventos',
    'Raw input',
    'Mouse',
    'Teclado',
    'Resize'
  ],
  style: {
    selected: { bg: 'blue' }
  }
})

// log visual
const log = blessed.log({
  top: 0,
  left: '30%',
  width: '70%',
  height: '100%',
  border: 'line',
  label: ' Input dump ',
  scrollable: true,
  alwaysScroll: true,
  keys: true,
  mouse: true
})

screen.append(menu)
screen.append(log)

// dump
const dump = (type, data) => {
  const payload = {
    ts: Date.now(),
    type,
    data
  }

  log.add(JSON.stringify(payload, null, 2))
  persist(payload)
  screen.render()
}

// teclado
screen.on('keypress', (ch, key) => {
  dump('keypress', { ch, key })
})

// mouse
screen.on('mouse', data => {
  dump('mouse', data)
})

// resize
screen.on('resize', () => {
  dump('resize', {
    cols: screen.cols,
    rows: screen.rows
  })
})

// focus / touch indireto
screen.on('element focus', el => {
  dump('focus', { element: el.type })
})

// saída
screen.key(['C-c'], () => {
  screen.destroy()
  process.exit(0)
})

menu.focus()
screen.render()
