import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ClipboardService {
  // 使用 2025 年推薦的 Signal 來儲存最新內容
  currentText = signal<string>('');
  electron: any;

  constructor() {
    this.initClipboardListener();
  }

  private initClipboardListener() {
    if ((<any>window).require) {
      try {
        this.electron = (<any>window).require('electron');
      } catch (e) {
        throw e;
      }
    } else {
      console.warn('App not running inside Electron!');
    }
    this.electron.ipcRenderer.on('clipboard-update', (event: any, message: any) => {
      this.currentText.set(message); // 自動通知 UI 更新
    });
  }
}
