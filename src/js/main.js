
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const quote = require('shell-quote').quote;
const { exec } = require('child_process');
const { spawn } = require('child_process');


function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 764,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, '../html/index.html'));

  // Abrir DevTools automáticamente
  win.webContents.openDevTools();

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

// Manejo de IPC para abrir el diálogo de selección de archivos
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


ipcMain.on('run-python-script', (event, args) => {
  let scriptPath = path.join(__dirname, '../scripts/script_python.py');

  const pythonProcess = spawn('python', [scriptPath, ...args]);

  pythonProcess.stdout.on('data', (data) => {

    const message = data.toString();
    
    if (message.toLowerCase().includes('error')) {
      event.sender.send('python-script-error', message);
    } else if (message.toLowerCase().includes('chunk'))  {
      event.sender.send('python-script-info', message);
    } else 
    {
      console.log(`stdout: ${message}`);
      event.sender.send('python-script-stdout', message);
    }

  });

  pythonProcess.stderr.on('data', (data) => {
    const error = data.toString();
    console.error(`stderr: ${error}`);
    event.sender.send('python-script-error', error);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Proceso terminado con código ${code}`);
    if (code === 0) {
      event.sender.send('python-script-stdout', "Script terminado con éxito");
    } else {
      event.sender.send('python-script-error', `Script terminado con código de error: ${code}`);
    }
  });
});