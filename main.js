const { app, BrowserWindow, ipcMain, nativeTheme, globalShortcut, nativeImage, Tray, Menu, Notification, clipboard, powerSaveBlocker } = require('electron');
const clipboardListener = require('clipboard-event');
const { OverlayController, OVERLAY_WINDOW_OPTS } = require('electron-overlay-window');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { updateElectronApp, UpdateSourceType } = require('update-electron-app')

// 除非遇到特定的黑屏問題，否則建議移除此行以提升效能
app.disableHardwareAcceleration(); 
// 強制關閉背景節流相關限制
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

let store = null;

(async () => {
    const Store = (await import('electron-store')).default;
    store = new Store();

    const getResourcePath = (filename) => {
        return app.isPackaged
            ? path.join(process.resourcesPath, filename)
            : path.join(__dirname, 'resources', filename);
    };

    if (typeof store.get('mode') == 'undefined') {
        store.set('mode', 'overlay');
    }

    const mode = store.get('mode');

    if (require('electron-squirrel-startup')) app.quit();

    let win = null;
    let tray = null;

    const toggleMouseKey = 'CmdOrCtrl + J';
    const toggleShowKey = 'CmdOrCtrl + K';

    if (!app.isPackaged) {
        // 監控記憶體洩漏：每 30 秒輸出一次行程資訊
        setInterval(() => {
            const metrics = app.getAppMetrics();
            console.log('--- Memory Usage Report ---');
            metrics.forEach(metric => {
                console.log(`Process [${metric.type}] (PID: ${metric.pid}): ${(metric.memory.workingSetSize / 1024).toFixed(2)} MB`);
            });
            console.log('---------------------------');
        }, 30000);
    }

    // 阻止系統進入低功耗睡眠狀態，確保分析邏輯反應即時
    powerSaveBlocker.start('prevent-app-suspension');

    //視窗模式
    function createWindow() {
        win = new BrowserWindow({
            width: 600,
            height: 800,
            icon: `dist/poe2-trade-app/browser/favicon.ico`,
            backgroundColor: '#000000cc',
            webPreferences: {
                defaultFontFamily: {
                    standard: "Microsoft YaHei"
                },
                defaultFontSize: 14,
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: true,
                contextIsolation: false,
                backgroundThrottling: false // 關鍵：防止背景執行時被降速
            },
            autoHideMenuBar: true
        });

        win.once('ready-to-show', () => {
            win.show();
        });

        win.loadURL(path.join(__dirname, `dist/poe2-trade-app/browser/index.html`));

        if (!app.isPackaged) {
            // Open the DevTools.
            win.webContents.openDevTools({ mode: 'detach', activate: false });
        }

        nativeTheme.themeSource = 'dark';

        ipcMain.on('analyze-item', (msg) => {
            //nothing
        });
    }

    //覆蓋模式
    function createOverlayWindow() {
        win = new BrowserWindow({
            width: 600,
            height: 800,
            icon: `dist/poe2-trade-app/browser/favicon.ico`,
            webPreferences: {
                defaultFontFamily: {
                    standard: "Microsoft YaHei"
                },
                defaultFontSize: 14,
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: true,
                contextIsolation: false,
                backgroundThrottling: false // 關鍵：防止背景執行時被降速
            },
            ...OVERLAY_WINDOW_OPTS
        });

        win.once('ready-to-show', () => {
            win.show();
        });

        win.loadURL(path.join(__dirname, `dist/poe2-trade-app/browser/index.html`));

        // Open the DevTools.
        if (!app.isPackaged) {
            win.webContents.openDevTools({ mode: 'detach', activate: false });
        }

        makeInteractive();

        OverlayController.attachByTitle(
            win,
            'Path of Exile 2',
            { hasTitleBarOnMac: true }
        )

        OverlayController.events.on('attach', () => {
            console.log('OC: attach');
            // 檢測到遊戲視窗，開始監聽剪貼簿
            clipboardListener.startListening();

            new Notification({
                title: 'POE2 查價通知',
                body: '檢測到POE2視窗。',
                timeoutType: '2000',
                icon: `dist/poe2-trade-app/browser/favicon.ico`
            }).show();
        });

        OverlayController.events.on('detach', () => {
            console.log('OC: detach');
            // 遊戲視窗消失，停止監聽剪貼簿以節省資源
            clipboardListener.stopListening();

            new Notification({
                title: 'POE2 查價通知',
                body: '未檢測到POE2視窗。',
                timeoutType: '2000',
                icon: `dist/poe2-trade-app/browser/favicon.ico`
            }).show();
        });

        nativeTheme.themeSource = 'dark';

        function makeInteractive() {
            let isInteractable = false;

            const setInteractionState = (interactable, shouldNotify = true) => {
                if (!win || win.isDestroyed()) return;

                isInteractable = interactable;

                if (interactable) {
                    // 處理視窗可能被縮小或埋在後面的情況
                    if (win.isMinimized()) win.restore();
                    
                    // 確保視窗在最上層並啟用互動
                    win.showInactive(); 
                    win.setAlwaysOnTop(true, 'screen-saver');
                    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
                    win.moveTop(); // 強制移動到最前方
                    OverlayController.activateOverlay();
                } else {
                    OverlayController.focusTarget();
                }

                if (shouldNotify) {
                    const sendVisibility = () => win.webContents.send('visibility-change', interactable);
                    // 確保在視窗內容載入完成後才發送狀態訊息
                    if (win.webContents.isLoading()) {
                        win.webContents.once('did-finish-load', sendVisibility);
                    } else {
                        sendVisibility();
                    }
                }
            };

            const onBlur = () => setInteractionState(false);
            const onAnalyzeItem = () => {
                console.log('[IPC] Analyze item triggered');
                setInteractionState(true);
            };
            const onManualBlur = () => setInteractionState(false);
            const onToggle = () => setInteractionState(!isInteractable);
            const onForceShow = () => setInteractionState(true);

            win.on('blur', onBlur);
            ipcMain.on('analyze-item', onAnalyzeItem);
            ipcMain.on('blur', onManualBlur);

            globalShortcut.register(toggleMouseKey, onToggle);
            globalShortcut.register(toggleShowKey, onForceShow);

            // 清理邏輯：避免記憶體洩漏與重複監聽
            win.on('closed', () => {
                win.off('blur', onBlur);
                ipcMain.removeListener('analyze-item', onAnalyzeItem);
                ipcMain.removeListener('blur', onManualBlur);
                globalShortcut.unregister(toggleMouseKey);
                globalShortcut.unregister(toggleShowKey);
            });
        }
    }

    app.whenReady().then(() => {
        //自動檢查更新
        updateElectronApp();

        const icon = nativeImage.createFromPath(path.join(__dirname, 'dist/poe2-trade-app/browser/favicon.ico'));
        tray = new Tray(icon);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: '視窗模式',
                type: 'radio',
                checked: mode == 'window',
                click: () => {
                    if (mode == 'overlay') {
                        store.set('mode', 'window');

                        new Notification({
                            title: 'POE2 查價重新啟動通知',
                            body: '將重新啟動切換APP為視窗模式。',
                            timeoutType: '2000',
                            icon: `dist/poe2-trade-app/browser/favicon.ico`
                        }).show();

                        app.relaunch();
                        app.quit();
                    }
                }
            },
            {
                label: '覆蓋模式',
                type: 'radio',
                checked: mode == 'overlay',
                click: () => {
                    if (mode == 'window') {
                        store.set('mode', 'overlay');

                        new Notification({
                            title: 'POE2 查價重新啟動通知',
                            body: '將重新啟動切換APP為覆蓋模式。',
                            timeoutType: '2000',
                            icon: `dist/poe2-trade-app/browser/favicon.ico`
                        }).show();

                        app.relaunch();
                        app.quit();
                    }
                }
            },
            {
                label: '離開',
                click: () => {
                    app.quit();
                }
            }
        ])

        tray.setToolTip('POE2 查價工具 v0.8.1');
        tray.setContextMenu(contextMenu);

        setTimeout(
            mode == 'overlay' ? createOverlayWindow : createWindow,
            process.platform === 'linux' ? 1000 : 0 // https://github.com/electron/electron/issues/16809
        )

        // 視窗模式下直接啟動監聽，覆蓋模式(Overlay)則由 OverlayController 控制
        if (mode === 'window') {
            clipboardListener.startListening();
        }

        let lastText = '';
        // 2. 監聽變動事件
        clipboardListener.on('change', () => {
            const text = clipboard.readText(); // 取得當前剪貼簿文字
            
            if (!text || text === lastText) return;
            lastText = text;

            // 3. 傳送給 Angular 渲染行程
            if (win) {
                win.webContents.send('clipboard-update', text);
            }
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow()
        })
    })

    app.on('window-all-closed', () => {
        clipboardListener.stopListening(); // 程式關閉時停止監聽

        if (process.platform !== 'darwin') {
            app.quit();
        }
    })

    //更換佈景主題
    ipcMain.on('toggle-theme', (event, msg) => {
        if (msg === 'dark') {
            nativeTheme.themeSource = 'light';
            if (store.get('mode') == 'window') {
                win.setBackgroundColor('#ffffffcc');
            }
        } else {
            nativeTheme.themeSource = 'dark';
            if (store.get('mode') == 'window') {
                win.setBackgroundColor('#000000cc');
            }
        }
    });

    //取得本地物品資料
    ipcMain.on('get-local-items', (event, msg) => {
        const items = fs.readFileSync(getResourcePath('items.json'), 'utf-8');

        event.sender.send('reply-local-items', JSON.parse(items));
    });

    //取得本地詞綴資料
    ipcMain.on('get-local-stats', (event, msg) => {
        const stats = fs.readFileSync(getResourcePath('stats.json'), 'utf-8');

        event.sender.send('reply-local-stats', JSON.parse(stats));
    });

    //更新本地物品資料
    ipcMain.on('update-local-items', (event, msg) => {
        fs.writeFileSync(getResourcePath('items.json'), JSON.stringify(msg));
    });

    //更新本地詞綴資料
    ipcMain.on('update-local-stats', (event, msg) => {
        fs.writeFileSync(getResourcePath('stats.json'), JSON.stringify(msg));
    });

    //取得運作模式
    ipcMain.on('get-mode', (event, msg) => {
        event.sender.send('reply-mode', store.get('mode'));
    });

})();