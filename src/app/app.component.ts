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
    // 1. 修正邏輯：明確判斷 'blur' 為隱藏狀態
    // 舊邏輯 !!state 會把字串 'blur' 轉為 true，導致失去焦點時無法隱藏
    const targetShow = state === 'blur' ? false : (typeof state === 'undefined' ? !this.isVisible : !!state);

    // 1. 增加防抖與狀態檢查，避免無限循環呼叫
    if (this.isVisible === targetShow && typeof state !== 'undefined') return;

    // 2. 即使狀態相同也強制執行一次（解決 DOM 被意外修改的問題）
    this.isVisible = targetShow;

    // 3. 使用 setTimeout(0) 確保在微任務後執行，避免 Angular 生命周期衝突
    setTimeout(() => {
      const body = document.body;

      if (targetShow) {
        body.style.setProperty('display', 'block', 'important');
        body.style.setProperty('visibility', 'visible', 'important');
        body.style.setProperty('opacity', '1', 'important');
        body.style.setProperty('pointer-events', 'auto', 'important');
      } else {
        // 在軟體渲染模式下，display: none 是最節省 CPU 的做法
        body.style.setProperty('display', 'none', 'important');
        body.style.setProperty('pointer-events', 'none', 'important');
        body.style.setProperty('visibility', 'hidden', 'important');
        body.style.setProperty('opacity', '0', 'important');
      }

      // 3. 關鍵：如果 UI 隱藏了，主動通知 Main Process 徹底忽略滑鼠事件
      if (!targetShow) {
        (window as any).ipcRenderer.send('blur');
      }
    }, 0);
  }
}
