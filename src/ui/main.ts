// ────────────────────────────────────────────────────────────────
//  Valet Pilot — Electron Main Process
//  Unix Domain Socket으로 데몬 UIServer에 연결하여 UI 이벤트를 수신하고
//  ipcMain을 통해 렌더러에 전달합니다.
// ────────────────────────────────────────────────────────────────

import { app, BrowserWindow, ipcMain } from 'electron'
import { createConnection, type Socket } from 'node:net'
import { createInterface } from 'node:readline'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'

// ── 경로 ─────────────────────────────────────────────────────────

const SOCKET_PATH = join(homedir(), '.valet-pilot', 'ui.sock')
const PID_FILE = join(homedir(), '.valet-pilot', 'daemon.pid')

// ── 상태 ─────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null
let socketClient: Socket | null = null
let retryCount = 0
const MAX_RETRIES = 10
const RETRY_INTERVAL_MS = 100

// ── 창 생성 ───────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 860,
    minWidth: 400,
    minHeight: 600,
    resizable: true,
    fullscreen: true,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── Unix Socket 연결 ──────────────────────────────────────────────

function connectToSocket(): void {
  if (!existsSync(SOCKET_PATH)) {
    if (retryCount < MAX_RETRIES) {
      retryCount++
      setTimeout(connectToSocket, RETRY_INTERVAL_MS)
    }
    return
  }

  const socket = createConnection(SOCKET_PATH)

  socket.on('connect', () => {
    retryCount = 0
    socketClient = socket

    // 소켓에서 줄 단위로 JSON 이벤트 수신
    const rl = createInterface({ input: socket })
    rl.on('line', (line) => {
      try {
        const event = JSON.parse(line)
        if (event.type === 'shutdown') {
          app.quit()
          return
        }
        mainWindow?.webContents.send('ui-event', event)
      } catch {
        // 파싱 오류 무시
      }
    })
  })

  socket.on('error', () => {
    socketClient = null
    if (retryCount < MAX_RETRIES) {
      retryCount++
      setTimeout(connectToSocket, RETRY_INTERVAL_MS)
    }
  })

  socket.on('close', () => {
    socketClient = null
  })
}

// ── UI PID 파일 정리 ──────────────────────────────────────────────

function cleanupUiPid(): void {
  try {
    const uiPidFile = join(homedir(), '.valet-pilot', 'ui.pid')
    if (existsSync(uiPidFile)) unlinkSync(uiPidFile)
  } catch {
    // 무시
  }
}

// ── 데몬 종료 ─────────────────────────────────────────────────────

function shutdownDaemon(): void {
  try {
    socketClient?.destroy()
    if (existsSync(PID_FILE)) {
      const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10)
      if (!isNaN(pid)) {
        process.kill(pid, 'SIGTERM')
      }
    }
  } catch {
    // 이미 종료된 경우 무시
  }
}

// ── App 이벤트 ────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  connectToSocket()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  shutdownDaemon()
  cleanupUiPid()
  app.quit()
})

// IPC: 렌더러에서 수동 종료 요청
ipcMain.on('quit', () => {
  shutdownDaemon()
  app.quit()
})
