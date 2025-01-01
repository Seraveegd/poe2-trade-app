const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const { clipboard } = require('electron');
const path = require('path');
const url = require('url');
// const fs = require('fs');

let win = null;

function createWindow() {
    const win = new BrowserWindow({
        width: 600,
        height: 800,
        backgroundColor: '#ffffff',
        autoHideMenuBar: true,
        icon: `dist/poe2-trade-app/browser/logo.png`,
        webPreferences: {
            defaultFontFamily: {
                standard: "Microsoft YaHei"
            },
            defaultFontSize: 14,
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        },
        fullscreen: true
    });

    // child = new BrowserWindow({
    //     parent: win,
    //     width: 400,
    //     height: 400,
    //     backgroundColor: '#ffffff',
    //     center: true,
    //     resizable: false,
    //     frame: false,
    //     transparent: false
    // });
    // child.show();

    // child.loadURL(`file://${__dirname}/dist/electron-app/browser/index.csr.html#/home`)

    win.once('ready-to-show', () => {
        win.show();
    });

    // console.log(path.join(__dirname, `dist/electron-app/browser/index.csr.html#home`));

    win.loadURL(path.join(__dirname, `dist/poe2-trade-app/browser/index.html`));
    // console.log(path.join(__dirname, './dist/electron-app/browser/index.csr.html'));
    // win.loadURL(url.format({
    //     pathname: path.join(__dirname, 'dist/poe2-trade-app/browser/index.html'),
    //     protocol: 'file:',
    //     slashes: true,
    //     hash: 'home'
    // }));

    // Open the DevTools.
    win.webContents.openDevTools();

    setInterval(() => {
        // console.log(window.localStorage.getItem('copyText'), JSON.stringify(clipboard.readText()));
        // if (clipboard.readText().indexOf('稀有度: ') > -1 && localStorage.getItem('copyText') !== JSON.stringify(clipboard.readText())) {
        win.webContents.executeJavaScript(`localStorage.setItem('copyText', '` + JSON.stringify(clipboard.readText()) + `')`);
        // win.loadFile(`dist/electron-app/browser/home`);
        // }
        // console.log(clipboard.readText());
    }, 500);
}

// function scanCopy() {
//     setInterval(() => {
//         console.log(clipboard.readText());
//     }, 500);
// };


app.whenReady().then(() => {
    createWindow();
    // scanCopy();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})