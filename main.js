const { app, BrowserWindow, ipcMain, nativeTheme, globalShortcut, nativeImage, Tray, Menu, Notification, clipboard, powerSaveBlocker, session } = require('electron');
const clipboardListener = require('clipboard-event');
const { OverlayController, OVERLAY_WINDOW_OPTS } = require('electron-overlay-window');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { updateElectronApp, UpdateSourceType } = require('update-electron-app')

// 開啟硬體加速以提升渲染效能與動畫流暢度
app.disableHardwareAcceleration();

// 軟體渲染模式下的效能優化標籤
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-gpu-compositing'); // 徹底禁用 GPU 合成
app.commandLine.appendSwitch('ignore-gpu-blocklist'); // 忽略顯卡黑名單

// 徹底禁用全域功能表，防止在無邊框視窗中出現任何形式的選單列或佔位空間
Menu.setApplicationMenu(null);

let store = null;
let lastText = ''; // 移至外部作用域以利重置

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

    // 監測主行程事件循環阻塞
    let lastTick = Date.now();
    setInterval(() => {
        const currentTick = Date.now();
        const delta = currentTick - lastTick - 1000; // 理想狀態下差值應接近 0
        if (delta > 100) {
            console.warn(`[Warning] 主行程事件循環阻塞！延遲了 ${delta}ms`);
        }
        lastTick = currentTick;
    }, 1000);

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
            ...OVERLAY_WINDOW_OPTS, // 建議將套件預設值放在前面
            width: 600,
            height: 800,
            icon: `dist/poe2-trade-app/browser/favicon.ico`,
            frame: false, // 強制禁用系統邊框與標題列
            autoHideMenuBar: true, // 自動隱藏功能表列
            backgroundColor: '#00000000', // 確保背景完全透明
            transparent: true,
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
        });

        win.once('ready-to-show', () => {
            win.setMenu(null); // 徹底移除功能表列，防止佔用頂部空間
            win.setMenuBarVisibility(false);
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
            let lastShowTime = 0; // 紀錄視窗顯示的時間戳

            const setInteractionState = (interactable, shouldNotify = true) => {
                if (!win || win.isDestroyed()) return;

                isInteractable = interactable;

                if (interactable) {
                    // 軟體渲染模式下，避免頻繁調用 win.show/restore
                    // 直接利用 OverlayController 提升層級
                    OverlayController.activateOverlay();

                    // 恢復接收滑鼠事件
                    win.setIgnoreMouseEvents(false);
                } else {
                    OverlayController.focusTarget();
                    // 當隱藏或不需互動時，徹底忽略滑鼠。
                    // 移除 { forward: true } 以解決硬體加速下透明區域仍攔截點擊的問題。
                    win.setIgnoreMouseEvents(true);
                }

                if (shouldNotify) {
                    const sendVisibility = () => {
                        if (win && !win.isDestroyed()) {
                            win.webContents.send('visibility-change', interactable);
                        }
                    };
                    // 確保在視窗內容載入完成後才發送狀態訊息
                    if (win.webContents.isLoading()) {
                        win.webContents.once('did-finish-load', sendVisibility);
                    } else {
                        sendVisibility();
                    }
                }
            };

            const onBlur = () => {
                // 軟體渲染模式下，焦點競爭非常嚴重
                // 如果顯示不到 800ms 就失去焦點，通常是系統搶奪，我們忽略它
                const now = Date.now();
                if (now - lastShowTime < 800) {
                    console.log('[Main] Focus fight detected, keeping window alive');
                    return;
                }

                console.log('[Main] Valid blur, hiding window');
                lastText = '';
                setInteractionState(false);
            };
            const onShowOverlay = () => {
                console.log('[IPC] Show overlay triggered by worker');
                lastShowTime = Date.now(); // 標記顯示時間
                setInteractionState(true);
            };
            const onToggle = () => {
                if (!isInteractable) lastShowTime = Date.now();
                setInteractionState(!isInteractable);
            };
            const onForceShow = () => {
                lastShowTime = Date.now();
                setInteractionState(true);
            };

            win.on('blur', onBlur);
            ipcMain.on('show-overlay', onShowOverlay);

            globalShortcut.register(toggleMouseKey, onToggle);
            globalShortcut.register(toggleShowKey, onForceShow);

            // 清理邏輯：避免記憶體洩漏與重複監聽
            win.on('closed', () => {
                win.off('blur', onBlur);
                ipcMain.removeListener('show-overlay', onShowOverlay);
                globalShortcut.unregister(toggleMouseKey);
                globalShortcut.unregister(toggleShowKey);
            });
        }
    }

    app.whenReady().then(() => {
        //自動檢查更新
        updateElectronApp();

        // 初始化時從 store 讀取並設定 Cookie
        const savedSessionId = store.get('poesessid');
        if (savedSessionId) {
            const cookie = {
                url: 'https://pathofexile.tw',
                name: 'POESESSID',
                value: savedSessionId,
                domain: '.pathofexile.tw',
                secure: true,
                httpOnly: true,
                sameSite: 'no_restriction', // 必須設定為 None 才能在跨網域請求中發送
                expirationDate: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30)
            };
            session.defaultSession.cookies.set(cookie).catch(err => console.error(err));
        }

        // 回傳已儲存的 POESESSID 給前端
        ipcMain.on('get-poesessid', (event) => {
            event.sender.send('reply-poesessid', store.get('poesessid') || '');
        });

        // 設定全域請求過濾器：注入 User-Agent 並確保 Cookie 傳送
        const filter = {
            urls: ['https://pathofexile.tw/*', 'https://*.pathofexile.tw/*']
        };

        session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
            // 官方要求自定義工具必須提供辨識用的 User-Agent (名稱/版本/聯絡方式)
            details.requestHeaders['User-Agent'] = 'POE2TradeApp/0.9.2 (Contact: your@email.com)';

            // 模擬官方網站的環境。在 file:// 下 Origin 會是 null，這會觸發 403
            details.requestHeaders['Origin'] = 'https://pathofexile.tw';
            details.requestHeaders['Referer'] = 'https://pathofexile.tw/';
            details.requestHeaders['Host'] = 'pathofexile.tw';
            details.requestHeaders['X-Requested-With'] = 'XMLHttpRequest';

            // 確保請求會帶上 Cookie
            callback({ requestHeaders: details.requestHeaders });
        });

        // 處理設定 POESESSID 的請求
        ipcMain.on('set-poesessid', (event, poesessid) => {
            const cookie = {
                url: 'https://pathofexile.tw',
                name: 'POESESSID',
                value: poesessid,
                domain: '.pathofexile.tw',
                secure: true,
                httpOnly: true,
                sameSite: 'no_restriction', // 確保使用者輸入新的 ID 時也能正確寫入 SameSite 屬性
                expirationDate: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30)
            };

            store.set('poesessid', poesessid); // 儲存至本地設定檔
            session.defaultSession.cookies.set(cookie).then(() => {
                console.log('POESESSID set successfully');
            }).catch(err => console.error(err));
        });

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

        tray.setToolTip('POE2 查價工具 v0.9.4');
        tray.setContextMenu(contextMenu);

        setTimeout(
            mode == 'overlay' ? createOverlayWindow : createWindow,
            process.platform === 'linux' ? 1000 : 0 // https://github.com/electron/electron/issues/16809
        )

        // 視窗模式下直接啟動監聽，覆蓋模式(Overlay)則由 OverlayController 控制
        if (mode === 'window') {
            clipboardListener.startListening();
        }

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

    // 取得所有已儲存的自訂搜尋檔案
    ipcMain.on('get-custom-searches', (event) => {
        const customSearchPath = path.join(app.getPath('userData'), 'custom_searches');

        // 確保目錄存在
        if (!fs.existsSync(customSearchPath)) {
            fs.mkdirSync(customSearchPath, { recursive: true });
        }

        const files = fs.readdirSync(customSearchPath);
        const savedData = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const content = fs.readFileSync(path.join(customSearchPath, file), 'utf-8');
                return JSON.parse(content);
            });

        event.sender.send('reply-custom-searches', savedData);
    });

    // 儲存新的自訂搜尋到 JSON 檔案
    ipcMain.on('save-custom-search', (event, saveData) => {
        const customSearchPath = path.join(app.getPath('userData'), 'custom_searches');
        if (!fs.existsSync(customSearchPath)) {
            fs.mkdirSync(customSearchPath, { recursive: true });
        }

        let fileName = saveData.name;

        // 如果不是覆蓋模式，才需要檢查檔名重複並自動編號
        if (!saveData.overwrite) {
            let counter = 1;
            while (fs.existsSync(path.join(customSearchPath, `${fileName}.json`))) {
                fileName = `${saveData.name} (${counter})`;
                counter++;
            }
        }

        saveData.name = fileName; // 同步更新物件內的名稱，確保載入後顯示與檔名一致
        const filePath = path.join(customSearchPath, `${fileName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2));
    });

    // 刪除自訂搜尋檔案
    ipcMain.on('delete-custom-search', (event, name) => {
        const filePath = path.join(app.getPath('userData'), 'custom_searches', `${name}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    });

    // 重新命名自訂搜尋檔案
    ipcMain.on('rename-custom-search', (event, arg) => {
        const customSearchPath = path.join(app.getPath('userData'), 'custom_searches');
        const oldPath = path.join(customSearchPath, `${arg.oldName}.json`);
        const newPath = path.join(customSearchPath, `${arg.newName}.json`);

        if (fs.existsSync(oldPath)) {
            fs.writeFileSync(newPath, JSON.stringify(arg.data, null, 2));
            fs.unlinkSync(oldPath);
        }
    });

})();