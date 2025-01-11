const { app, BrowserWindow, ipcMain, nativeTheme, globalShortcut, nativeImage, Tray, Menu } = require('electron');
const { OverlayController, OVERLAY_WINDOW_OPTS } = require('electron-overlay-window');
const path = require('path');

if (require('electron-squirrel-startup')) app.quit();

app.disableHardwareAcceleration();

let win = null;
let tray = null;

const toggleMouseKey = 'CmdOrCtrl + J';
const toggleShowKey = 'CmdOrCtrl + K';

function createWindow() {
    const win = new BrowserWindow({
        width: 600,
        height: 800,
        // backgroundColor: '#ffffff',
        // autoHideMenuBar: true,
        // frame: false,
        // fullscreen: false,
        // fullscreenable: false,
        // resizable: false,
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

    //查看事件blur
    // win.on('blur', (e) => {
    //     console.log('blur');
    // });

    //查看事件focus
    // win.on('focus', (e) => {
    //     console.log('focus');
    // });

    win.loadURL(path.join(__dirname, `dist/poe2-trade-app/browser/index.html`));

    // Open the DevTools.
    // win.webContents.openDevTools({ mode: 'detach', activate: false });

    makeInteractive();

    OverlayController.attachByTitle(
        win,
        'Path of Exile 2',
        { hasTitleBarOnMac: true }
    )

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
                win.webContents.send('focus-change', false);
            } else {
                isInteractable = true;
                OverlayController.activateOverlay();
                win.webContents.send('focus-change', true);
            }
        }

        win.on('blur', () => {
            isInteractable = false;
            win.webContents.send('focus-change', false);
            win.webContents.send('visibility-change', true);
        })

        ipcMain.on('analyze-item', (msg) => {
            isInteractable = true;
            OverlayController.activateOverlay();
            win.webContents.send('focus-change', true);
        });

        globalShortcut.register(toggleMouseKey, toggleOverlayState);

        globalShortcut.register(toggleShowKey, () => {
            win.webContents.send('visibility-change', false)
            isInteractable = true;
            OverlayController.activateOverlay();
            win.webContents.send('focus-change', true);
        })
    }
}

app.whenReady().then(() => {
    const icon = nativeImage.createFromPath('dist/poe2-trade-app/browser/favicon.ico');
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '離開',
            click: () => {
                app.quit();
            }
        }
    ])

    tray.setContextMenu(contextMenu);

    setTimeout(
        createWindow,
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