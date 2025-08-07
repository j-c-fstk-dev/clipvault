export const config = {
    iconPath: './assets/icon.png',
    defaultSettings: {
        autoLaunch: true,
        showOnStartup: false,
    },
    menuItems: [
        {
            label: 'Open',
            action: 'openApp',
        },
        {
            label: 'Quit',
            action: 'quitApp',
        },
    ],
};