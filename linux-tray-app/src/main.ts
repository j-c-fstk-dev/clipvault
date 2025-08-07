import { app } from 'electron';
import TrayApp from './tray';
import path from 'path';

const trayApp = new TrayApp();

app.on('ready', () => {
    trayApp.createTrayIcon();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (trayApp.tray === null) {
        trayApp.createTrayIcon();
    }
});