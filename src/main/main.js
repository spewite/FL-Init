const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000, // Ancho de la ventana
    height: 600, // Alto de la ventana
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile(path.join(__dirname, '../html/index.html'));

  const menu = Menu.buildFromTemplate([
    {
      label: 'Configuración',
      submenu: [
        { label: 'Cambiar ubicación de salida por defecto', click() { console.log('Cambiar ubicación de salida por defecto'); } },
        { label: 'Cambiar ubicación de las plantillas FLP', click() { console.log('Cambiar ubicación de las plantillas FLP'); } }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Mostrar Configuración', click() { console.log('Mostrar Configuración'); } }
      ]
    },
    {
      label: 'Developer',
      submenu: [
        {
          label: 'Toggle DevTools',
          accelerator: process.platform == 'darwin' ? 'Command+Alt+I' : 'Ctrl+Shift+I',
          click(item, focusedWindow) {
            focusedWindow.toggleDevTools();
          }
        },
        { role: 'reload' }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 
  

ipcMain.on('open-file-dialog', (event) => {
  dialog.showOpenDialog({
    properties: ['openDirectory']
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      event.sender.send('selected-directory', result.filePaths[0]);
    }
  }).catch(err => {
    console.error('Error al abrir el diálogo de selección de directorio:', err);
  });
});
