export type VisibilityState = boolean | 'blur' | undefined;

import { Component, NgZone, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-root',
  imports: [
    NgbTooltipModule,
    RouterOutlet,
    RouterLink
  ],
  providers: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})



export class AppComponent implements OnInit {
  private isVisible = false; // 追蹤目前狀態

  public colorScheme = 'dark';
  public mode: any;

  constructor(private ngZone: NgZone) { }

  ngOnInit(): void {
    (<any>window).ipcRenderer.on('reply-mode', (event: any, arg: any) => {
      this.mode = arg;
    });
    (<any>window).ipcRenderer.send('get-mode');

    const localStorageColorScheme = localStorage.getItem('prefers-color');
    // Check if any prefers-color-scheme is stored in localStorage
    if (localStorageColorScheme) {
      this.colorScheme = localStorageColorScheme;
      // Save prefers-color-scheme from localStorage
      (<any>window).ipcRenderer.send('toggle-theme', localStorageColorScheme);
    }

    this.initIpcListeners();
  }

  changeTheme() {
    if (this.colorScheme === 'dark') {
      this.colorScheme = 'light';
    } else {
      this.colorScheme = 'dark';
    }

    localStorage.setItem('prefers-color', this.colorScheme);

    (<any>window).ipcRenderer.send('toggle-theme', this.colorScheme);
  }

  private initIpcListeners() {
    const ipc = (window as any).ipcRenderer;

    if (!ipc) return;

    ipc.on('visibility-change', (_e: any, state: VisibilityState) => {
      this.ngZone.run(() => this.updateVisibility(state));
    });
  }

  /**
   * 根據傳入狀態更新 UI
   */
  updateVisibility(state: VisibilityState) {
    // 1. 解析目標狀態
    const targetShow = typeof state === 'undefined' ? !this.isVisible : !!state;

    // 2. 即使狀態相同也強制執行一次（解決 DOM 被意外修改的問題）
    this.isVisible = targetShow;

    // 3. 使用 setTimeout(0) 確保在微任務後執行，避免 Angular 生命周期衝突
    setTimeout(() => {
      const body = document.body;
      const displayValue = targetShow ? 'block' : 'none';

      // 核心：除了設定 Style，我們額外加上一個 class 作為保險
      if (targetShow) {
        body.style.setProperty('display', 'block', 'important');
        body.style.setProperty('visibility', 'visible', 'important');
        body.style.setProperty('opacity', '1', 'important');
      } else {
        body.style.setProperty('display', 'none', 'important');
      }

      console.log(`[強制渲染] 指令: ${state}, 結果: ${displayValue}`);

      // 觸發一次 window 的 resize 事件，強制 Chromium 重新渲染畫面
      window.dispatchEvent(new Event('resize'));
    }, 0);
  }
}
