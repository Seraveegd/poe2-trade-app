const { app, BrowserWindow, ipcMain, nativeTheme, globalShortcut, nativeImage, Tray, Menu, Notification, clipboard } = require('electron');
const clipboardListener = require('clipboard-event');
const { OverlayController, OVERLAY_WINDOW_OPTS } = require('electron-overlay-window');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { updateElectronApp, UpdateSourceType } = require('update-electron-app')

app.disableHardwareAcceleration();

let store = null;

(async () => {
    const Store = (await import('electron-store')).default;
    store = new Store();

    if (typeof store.get('mode') == 'undefined') {
        store.set('mode', 'overlay');
    }

    const mode = store.get('mode');

    if (require('electron-squirrel-startup')) app.quit();

    let win = null;
    let tray = null;

    const toggleMouseKey = 'CmdOrCtrl + J';
    const toggleShowKey = 'CmdOrCtrl + K';

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
                contextIsolation: false
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
                contextIsolation: false
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

            new Notification({
                title: 'POE2 查價通知',
                body: '檢測到POE2視窗。',
                timeoutType: '2000',
                icon: `dist/poe2-trade-app/browser/favicon.ico`
            }).show();
        });

        OverlayController.events.on('detach', () => {
            console.log('OC: detach');

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

            // --- 核心狀態控制函數 (封裝重複邏輯) ---
            const setInteractionState = (interactable, shouldNotify = true) => {
                if (win.isDestroyed()) return;

                isInteractable = interactable;

                interactable ? OverlayController.activateOverlay() : OverlayController.focusTarget();

                if (shouldNotify) {
                    win.webContents.send('visibility-change', interactable);
                }
            };

            const onBlur = () => setInteractionState(false);
            const onAnalyzeItem = () => {
                console.log('[IPC] Analyze item triggered');

                if (!win || win.isDestroyed()) return;

                // 強制將視窗置頂並顯示，防止視窗被縮小或擋住
                win.showInactive(); // 顯示但不奪取焦點
                win.setAlwaysOnTop(true, 'screen-saver'); // 使用 screen-saver 等級確保最高層級

                isInteractable = true;
                OverlayController.activateOverlay();

                // 確保在視窗準備好後再發送
                if (win.webContents.isLoading()) {
                    win.webContents.once('did-finish-load', () => {
                        win.webContents.send('visibility-change', true);
                    });
                } else {
                    win.webContents.send('visibility-change', true);
                }
            };
            const onManualBlur = () => !win.isDestroyed() && win.blur();
            const onToggle = () => setInteractionState(!isInteractable);
            const onForceShow = () => setInteractionState(true);

            // --- 註冊監聽 (先清除舊監聽，防止重複註冊導致記憶體洩漏) ---
            win.on('blur', onBlur);
            ipcMain.on('analyze-item', onAnalyzeItem);
            ipcMain.on('blur', onManualBlur);

            // --- 全域快捷鍵 ---
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

        tray.setToolTip('POE2 查價工具 v0.7.12');
        tray.setContextMenu(contextMenu);

        setTimeout(
            mode == 'overlay' ? createOverlayWindow : createWindow,
            process.platform === 'linux' ? 1000 : 0 // https://github.com/electron/electron/issues/16809
        )

        // 1. 啟動剪貼簿監聽
        clipboardListener.startListening();

        // 2. 監聽變動事件
        clipboardListener.on('change', () => {
            const text = clipboard.readText(); // 取得當前剪貼簿文字

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
        items = fs.readFileSync(path.join(process.cwd(), '/resources/items.json'), 'utf-8');

        event.sender.send('reply-local-items', JSON.parse(items));
    });

    //取得本地詞綴資料
    ipcMain.on('get-local-stats', (event, msg) => {
        stats = fs.readFileSync(path.join(process.cwd(), '/resources/stats.json'), 'utf-8');

        event.sender.send('reply-local-stats', JSON.parse(stats));
    });

    //更新本地物品資料
    ipcMain.on('update-local-items', (event, msg) => {
        fs.writeFileSync(path.join(process.cwd(), '/resources/items.json'), JSON.stringify(msg));
    });

    //更新本地詞綴資料
    ipcMain.on('update-local-stats', (event, msg) => {
        fs.writeFileSync(path.join(process.cwd(), '/resources/stats.json'), JSON.stringify(msg));
    });

    //取得運作模式
    ipcMain.on('get-mode', (event, msg) => {
        event.sender.send('reply-mode', store.get('mode'));
    });

})();