const { app, BrowserWindow, ipcMain, nativeTheme, globalShortcut, nativeImage, Tray, Menu, Notification } = require('electron');
const { OverlayController, OVERLAY_WINDOW_OPTS } = require('electron-overlay-window');
const path = require('path');
const fs = require('fs');

const file = path.join(__dirname, 'config.json');

let json = JSON.parse(fs.readFileSync(file, 'utf-8'));

if (require('electron-squirrel-startup')) app.quit();

app.disableHardwareAcceleration();

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
    // win.webContents.openDevTools({ mode: 'detach', activate: false });

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
            checked: json.mode == 'window',
            click: () => {
                if(json.mode == 'overlay'){
                    json.mode = 'window';

                    fs.writeFileSync(file, JSON.stringify(json));

                    new Notification({
                        title: 'POE2 查價重新啟動通知',
                        body: '將重新啟動切換APP模式為視窗模式。',
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
            checked: json.mode == 'overlay',
            click: () => {
                if(json.mode == 'window'){
                    json.mode = 'overlay';

                    fs.writeFileSync(file, JSON.stringify(json));

                    new Notification({
                        title: 'POE2 查價重新啟動通知',
                        body: '將重新啟動切換APP模式為視窗模式。',
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

    tray.setToolTip('POE2 查價工具 v0.6.3');
    tray.setContextMenu(contextMenu);

    setTimeout(
        json.mode == 'overlay' ? createOverlayWindow : createWindow,
        process.platform === 'linux' ? 1000 : 0 // https://github.com/electron/electron/issues/16809
    )

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
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