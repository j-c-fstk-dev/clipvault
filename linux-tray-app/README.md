# Linux Tray App

## Overview
Linux Tray App is a simple desktop application designed to run in the background on Linux systems. It provides a system tray icon that allows users to access basic functionalities such as opening the application and quitting it.

## Features
- System tray icon
- Context menu with options to open the app and quit
- Configurable settings

## Project Structure
```
linux-tray-app
├── src
│   ├── main.ts        # Entry point of the application
│   ├── tray.ts        # Manages the system tray icon and context menu
│   └── config.ts      # Configuration settings for the application
├── package.json        # NPM configuration file
├── tsconfig.json       # TypeScript configuration file
└── README.md           # Documentation for the project
```

## Installation
1. Clone the repository:
   ```
   git clone https://github.com/yourusername/linux-tray-app.git
   cd linux-tray-app
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Usage
To run the application, use the following command:
```
npm start
```

The application will start and an icon will appear in the system tray. You can right-click the icon to access the context menu.

## Configuration
You can modify the configuration settings in `src/config.ts` to customize the application behavior and appearance.

## License
This project is licensed under the MIT License. See the LICENSE file for details.