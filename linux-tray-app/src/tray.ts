class TrayApp {
    private tray: Electron.Tray;
    private contextMenu: Electron.Menu;

    constructor() {
        this.createTray();
    }

    private createTray() {
        const iconPath = this.getIconPath();
        this.tray = new Electron.Tray(iconPath);
        this.contextMenu = this.createContextMenu();

        this.tray.setToolTip('Linux Tray App');
        this.tray.setContextMenu(this.contextMenu);

        this.tray.on('click', () => {
            this.onTrayClick();
        });
    }

    private createContextMenu() {
        return Electron.Menu.buildFromTemplate([
            {
                label: 'Open',
                click: () => {
                    this.openApp();
                }
            },
            {
                label: 'Quit',
                click: () => {
                    this.quitApp();
                }
            }
        ]);
    }

    private onTrayClick() {
        // Logic to handle tray icon click
        this.openApp();
    }

    private openApp() {
        // Logic to open the main application window
    }

    private quitApp() {
        Electron.app.quit();
    }

    private getIconPath() {
        // Logic to retrieve the icon path from config
        return 'path/to/icon.png'; // Replace with actual path from config
    }
}

export default TrayApp;