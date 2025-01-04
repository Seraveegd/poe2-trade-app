const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');

if (require('electron-squirrel-startup')) app.quit();

let win = null;

function createWindow() {
    const win = new BrowserWindow({
        width: 600,
        height: 800,
        backgroundColor: '#ffffff',
        autoHideMenuBar: true,
        icon: `dist/poe2-trade-app/browser/favicon.ico`,
        webPreferences: {
            defaultFontFamily: {
                standard: "Microsoft YaHei"
            },
            defaultFontSize: 14,
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.once('ready-to-show', () => {
        win.show();
    });

    //查看事件blur
    win.on('blur', (e) => {
        console.log('blur');
    });

    //查看事件focus
    win.on('focus', (e) => {
        console.log('focus');
    });

    win.loadURL(path.join(__dirname, `dist/poe2-trade-app/browser/index.html`));

    // Open the DevTools.
    // win.webContents.openDevTools();

    ipcMain.on('analyze-item', (msg) => {
        if (win.isMinimized())
            win.restore();

        win.setVisibleOnAllWorkspaces(true);
        win.setAlwaysOnTop(true, "normal", 1);
        win.show();
        win.setAlwaysOnTop(false);
        app.focus();
        win.moveTop();
    })
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})