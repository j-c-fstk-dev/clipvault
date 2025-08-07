// electron.js
const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard } = require('electron');
const path = require('path');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // Inicia oculto para ser mostrado pelo ícone da bandeja
    webPreferences: {
      // Configurações de segurança recomendadas:
      nodeIntegration: false, // Desabilita a integração Node.js no processo de renderização
      contextIsolation: true, // Habilita o isolamento de contexto para segurança
      // Caminho para o script de pré-carregamento:
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Carrega o arquivo HTML da sua aplicação React/Vite
  // Verifica se está em ambiente de desenvolvimento ou produção
  if (process.env.NODE_ENV === 'development') {
    // Em desenvolvimento, carrega do servidor Vite
    mainWindow.loadURL('http://localhost:5173'); // Verifique a porta do seu Vite
    mainWindow.webContents.openDevTools(); // Abre as ferramentas de desenvolvedor
  } else {
    // Em produção, carrega do diretório 'dist'
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Comportamento ao fechar a janela: esconder em vez de fechar
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// Quando o aplicativo estiver pronto
app.on('ready', () => {
  createWindow();

  // Configura o ícone da bandeja (Tray icon)
  // Certifique-se de que o caminho para 'tray.png' está correto
  tray = new Tray(path.join(__dirname, 'assets', 'tray.png'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir ClipVault',
      click: () => mainWindow.show(),
    },
    {
      label: 'Sair',
      click: () => {
        app.isQuiting = true; // Define a flag para permitir o encerramento
        app.quit();
      },
    },
  ]);
  tray.setToolTip('ClipVault');
  tray.setContextMenu(contextMenu);

  // Ao clicar no ícone da bandeja, mostra a janela
  tray.on('click', () => mainWindow.show());

  // Configura o manipulador IPC para a função saveClipboard
  // Esta função será chamada pelo frontend (App.tsx) via preload.js
  ipcMain.handle('save-clipboard', async () => {
    console.log('Recebida solicitação para salvar clipboard do frontend.');
    const content = clipboard.readText();
    // Você pode adicionar mais lógica aqui, como ler imagens, etc.
    return content;
  });
});

// Impede que o aplicativo feche completamente quando todas as janelas são fechadas,
// a menos que esteja saindo pelo ícone da bandeja.
app.on('window-all-closed', (e) => {
  if (!app.isQuiting) {
    e.preventDefault();
  }
});

// Ativa a janela quando o ícone do dock/barra de tarefas é clicado
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});