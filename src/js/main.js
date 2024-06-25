
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const quote = require('shell-quote').quote;
const { exec } = require('child_process');
const { spawn } = require('child_process');


/// ------------------------------------  ///
///           VARIABLES GLOBALES         /// 
/// ------------------------------------  ///

const CONFIG_PATH = path.join(__dirname, '../../config.json');
let win;


/// ------------------------------------  ///
///          CONFIGURACIÓN BACKEND        /// 
/// ------------------------------------  ///

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, '../html/index.html'));

  // Maximizar la ventana después de crearla
  win.maximize();

  // Abrir DevTools automáticamente
  // win.webContents.openDevTools();

  const menu = Menu.buildFromTemplate([
    {
      label: 'Ajustes',
      submenu: [
        { label: 'Configuración', click() { cambiar_config(); } },
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


/// ------------------------------------  ///
///          CAMBIAR CONFIGURACION        /// 
/// ------------------------------------  ///

function cambiar_config()
{
  // Leer la configuración actual para mostrarlo al abrir la modal de configuración
  fs.readFile(CONFIG_PATH, 'utf8', (err, data) => {
    
    let JSON_Config;
    
    try {
      if (err) {
        throw new Error('Error al leer el archivo de configuracion:' + err);
      }

      JSON_Config = JSON.parse(data);

      if (!JSON_Config) {
        throw new Error('La configuración es nula o indefinida');
      }

      // Si todo ha salido bien mostrar la modal con la configuración actual
      win.webContents.send('mostrar-modal', JSON_Config);
      
    } catch (error) {
      lanzar_error('Error al leer el archivo de configuracion:' + error);
    }
  });
}

ipcMain.on('cambiar-config-valores', (event, JSON_Config) => {

  // CONFIG_PATH está declarado arriba de todo. 
  
  fs.readFile(CONFIG_PATH, 'utf8', (err, data) => {

    if (err) {
      lanzar_error('Error al leer el archivo de configuracion: ' + err);
      return;
    }
  
    // Guardar la configuracion en el archivo de configuracion.
    try {
      const jsonConfig = JSON.stringify(JSON_Config, null, 2);
      fs.writeFileSync(CONFIG_PATH, jsonConfig);

      // Notificar al frontend que la configuración se guardó con éxito
      event.sender.send('configuracion-guardada', { jsonConfig: jsonConfig });

    } catch (fileSaveError) {
      lanzar_error('Error al guardar el nuevo JSON de configuración: ' + fileSaveError);
    }
  });

});


/// ------------------------------------  ///
///       OPEN FILE/DIRECTORY DIALOG      ///
/// ------------------------------------  ///

// Manejo de IPC para abrir el diálogo de selección de archivos
ipcMain.on('open-directory-dialog', (event, input_id) => {

  dialog.showOpenDialog({
    properties: ['openDirectory']
  }).then(result => {

    if (!result.canceled && result.filePaths.length > 0) {

      const retorno = {
        path: result.filePaths[0],
        input_id: input_id
      } 

      event.sender.send('selected-directory', retorno);
    }

  }).catch(err => {
    console.error('Error al abrir el diálogo de selección de directorio:', err);
  });

});

// Manejo de IPC para abrir el diálogo de selección de archivos
ipcMain.on('open-file-dialog', (event, extensionsArray) => {

  dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Plantilla .flp', extensions: extensionsArray }]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      console.log(result)
      event.sender.send('selected-file', result.filePaths[0]);
    }
  }).catch(err => {
    console.error('Error al abrir el diálogo de selección de directorio:', err);
  });

});

/// ------------------------------------  ///
///             SCRIPTS PYTHON            ///
/// ------------------------------------  ///

ipcMain.on('run-python-script', (event, args) => {
  let scriptPath = path.join(__dirname, '../scripts/script_python.py');

  const pythonProcess = spawn('python', [scriptPath, ...args]);

  pythonProcess.stdout.on('data', (data) => {

    const message = data.toString();
    
    if (message.toLowerCase().includes('error')) {
      event.sender.send('python-script-error', message);
    } else if (message.toLowerCase().includes('%'))  {
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


/// ------------------------------------  ///
///               UTILIDADES              ///
/// ------------------------------------  ///

function lanzar_error(err)
{
  win.webContents.send('error-generico', err);
  console.log("\x1b[43m", err);  // Colores: https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
  console.log("\x1b[0m", '');    // Resetear
}