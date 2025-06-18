import { ipcRenderer } from 'electron'

declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}

export const electronAPI = {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),

  onCheckBeforeClose: (callback: () => boolean | Promise<boolean>) => {
    ipcRenderer.on('check-before-close', async () => {
      const result = await callback()
      ipcRenderer.send('check-before-close-result', result)
    })
  },
}
