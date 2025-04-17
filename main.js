const { app, BrowserWindow, ipcMain, nativeTheme, globalShortcut, nativeImage, Tray, Menu, Notification } = require('electron');
const { OverlayController, OVERLAY_WINDOW_OPTS } = require('electron-overlay-window');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

app.disableHardwareAcceleration();

let store;

(async () => {
    const Store = (await import('electron-store')).default;
    store = new Store();

    if (typeof store.get('mode') == 'undefined' || typeof store.get('autohotkey') == 'undefined') {
        store.set('mode', 'overlay');
        store.set('autohotkey', 'true');
    }

    const mode = store.get('mode');
    let autohotkey = store.get('autohotkey');

    console.log(process.cwd())

    if(autohotkey) exec(path.join(process.cwd(), '/resources/autohotkey.exe'));

    if (require('electron-squirrel-startup')) app.quit();

    let win = null;
    let tray = null;

    const toggleMouseKey = 'CmdOrCtrl + J';
    const toggleShowKey = 'CmdOrCtrl + K';

    function createWindow() {
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
            autoHideMenuBar: true
        });

        win.once('ready-to-show', () => {
            win.show();
        });

        win.loadURL(path.join(__dirname, `dist/poe2-trade-app/browser/index.html`));

        // Open the DevTools.
        // win.webContents.openDevTools({ mode: 'detach', activate: false });

        nativeTheme.themeSource = 'dark';

        ipcMain.on('analyze-item', (msg) => {
            //nothing
        });
    }

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
        win.webContents.openDevTools({ mode: 'detach', activate: false });

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

        ipcMain.on('toggle-theme', (event, msg) => {
            if (msg === 'dark') {
                nativeTheme.themeSource = 'light';
            } else {
                nativeTheme.themeSource = 'dark';
            }
        });

        nativeTheme.themeSource = 'dark';

        function makeInteractive() {
            let isInteractable = false;

            function toggleOverlayState() {
                if (isInteractable) {
                    isInteractable = false;
                    OverlayController.focusTarget();
                } else {
                    isInteractable = true;
                    OverlayController.activateOverlay();
                }
            }

            win.on('blur', () => {
                console.log('blur');
                isInteractable = false;
                OverlayController.focusTarget();

                win.webContents.send('visibility-change', false);
            })

            ipcMain.on('analyze-item', (msg) => {
                console.log('analyze-item');

                isInteractable = true;
                OverlayController.activateOverlay();

                win.webContents.send('visibility-change', true);
            });

            ipcMain.on('blur', (msg) => {
                win.blur();
            });

            globalShortcut.register(toggleMouseKey, toggleOverlayState);

            globalShortcut.register(toggleShowKey, () => {
                win.webContents.send('visibility-change');

                isInteractable = true;
                OverlayController.activateOverlay();
            })
        }
    }

    app.whenReady().then(() => {
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
                label: 'AutoHotKey',
                type: 'checkbox',
                checked: autohotkey == 'true',
                click: () => {
                    if(autohotkey == 'true'){
                        console.log('kill');
                        exec('TASKKILL /IM autohotkey.exe');

                        autohotkey = 'false';
                    }else{
                        console.log(path.join(process.cwd(), '/resources/autohotkey.exe'));
                        exec(path.join(process.cwd(), '/resources/autohotkey.exe'));
                        
                        autohotkey = 'true';
                    }
                    
                    store.set('autohotKey', autohotkey);
                }
            },
            {
                label: '離開',
                click: () => {
                    exec('TASKKILL /IM autohotkey.exe');
                    app.quit();
                }
            }
        ])

        tray.setToolTip('POE2 查價工具 v0.6.6');
        tray.setContextMenu(contextMenu);

        setTimeout(
            mode == 'overlay' ? createOverlayWindow : createWindow,
            process.platform === 'linux' ? 1000 : 0 // https://github.com/electron/electron/issues/16809
        )

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow()
        })
    })

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            exec('TASKKILL /IM autohotkey.exe');
            app.quit();
        }
    })

    //更換佈景主題
    ipcMain.on('toggle-theme', (event, msg) => {
        if (msg === 'dark') {
            nativeTheme.themeSource = 'light';
        } else {
            nativeTheme.themeSource = 'dark';
        }
    });

})();