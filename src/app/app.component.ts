export type VisibilityState = boolean | 'blur' | undefined;

import { Component, NgZone, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class AppComponent implements OnInit {
  private isVisible = false; // 追蹤目前狀態

  public colorScheme = 'dark';
  public mode: any;

  constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef) { }

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

    // 在 Zone 之外監聽 IPC，避免不必要的變更偵測
    this.ngZone.runOutsideAngular(() => {
      ipc.on('visibility-change', (_e: any, state: VisibilityState) => {
        this.updateVisibility(state);
      });
    });
  }

  /**
   * 根據傳入狀態更新 UI
   */
  updateVisibility(state: VisibilityState) {
    // 重新定義 targetShow，確保邏輯明確
    // 只要不是 'blur' 或 false，就顯示 UI
    const targetShow = (state === 'blur' || state === false) ? false : true;

    // 即使 isVisible 相同也強制套用 CSS，解決渲染狀態偏移
    this.isVisible = targetShow;

    // 使用 requestAnimationFrame 確保在下一幀渲染前完成樣式變更
    window.requestAnimationFrame(() => {
      const body = document.body;
      if (targetShow) {
        body.style.setProperty('visibility', 'visible', 'important');
        body.style.setProperty('opacity', '1', 'important');
        body.style.setProperty('pointer-events', 'auto', 'important');
      } else {
        body.style.setProperty('visibility', 'hidden', 'important');
        body.style.setProperty('opacity', '0', 'important');
        body.style.setProperty('pointer-events', 'none', 'important');
      }
      // 手動觸發檢查
      this.cdr.detectChanges();
    });
  }
}
