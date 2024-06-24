
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const quote = require('shell-quote').quote;
const { exec } = require('child_process');
const { spawn } = require('child_process');

const CONFIG_PATH = path.join(__dirname, '../../config.json');
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 764,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, '../html/index.html'));

  // Abrir DevTools automáticamente
  // win.webContents.openDevTools();

  const menu = Menu.buildFromTemplate([
    {
      label: 'Configuración',
      submenu: [
        { label: 'Cambiar ubicación de salida por defecto', click() { cambiar_config('ruta_proyecto'); } },
        { label: 'Cambiar ubicación de las plantillas FLP', click() { cambiar_config('ruta_plantillas'); } }
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


/// ------------------------------------  ///
///          CAMBIAR CONFIGURACION        /// 
/// ------------------------------------  ///

function cambiar_config(config)
{
  win.webContents.send('cambiar-config-peticion', config);
}

ipcMain.on('cambiar-config-valores', (event, JSON_ConfigInput) => {

  // Valores Posibles: {ruta_proyecto: (valor)} o {ruta_plantillas: (valor)}
  // CONFIG_PATH está declarado arriba de todo.
  
  fs.readFile(CONFIG_PATH, 'utf8', (err, data) => {

    if (err) {
      lanzar_error('Error al leer el archivo de configuracion:' + err);
      return;
    }

    let JSON_ConfigActual, JSON_ConfigNuevo;
    
    // Leer el JSON actual para poder sobreescribir unicamente el valor que queremos
    try {
      JSON_ConfigActual = JSON.parse(data);
    } catch (parseErr) {
      lanzar_error('Error al parsear el archivo de configuracion: ' + parseErr);
      return;
    }

    if (!JSON_ConfigActual) {
      lanzar_error('Error al leer el archivo de configuracion.');
      return;
    }

    // Obtener el qué parametro hemos cambiado: ruta_proyecto o ruta_plantillas
    // Reemplazar en el json original el valor del nuevo key
    try {
      let parametro = Object.keys(JSON_ConfigInput)[0];
      JSON_ConfigActual[parametro] = JSON_ConfigInput[parametro];

      JSON_ConfigNuevo = JSON_ConfigActual;
    }  catch (parseErr) {
      lanzar_error('Error al parsear el JSON o al intentar meter el nuevo valor: ' + parseErr);
      return;
    }

    // Guardar la configuracion en el archivo de configuracion.
    try {
      const jsonConfig = JSON.stringify(JSON_ConfigNuevo, null, 2);
      fs.writeFileSync(CONFIG_PATH, jsonConfig);
    }  catch (fileSaveError) {
      lanzar_error('Error al guardar el nuevo JSON de configuración: ' + fileSaveError);
      return;
    }

  });
  
});


/// ------------------------------------  ///
///       OPEN FILE/DIRECTORY DIALOG      ///
/// ------------------------------------  ///


// Manejo de IPC para abrir el diálogo de selección de archivos
ipcMain.on('open-directory-dialog', (event) => {

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

// Manejo de IPC para abrir el diálogo de selección de archivos
ipcMain.on('open-file-dialog', (event) => {

  dialog.showOpenDialog({
    properties: ['openFile']
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