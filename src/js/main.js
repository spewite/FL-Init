
/// ------------------------------------  ///
///           VARIABLES GLOBALES          /// 
/// ------------------------------------  ///

const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const quote = require('shell-quote').quote;
const { exec } = require('child_process');
const { spawn } = require('child_process');

const { ESTADOS_SALIDA } = require('../js/constants');

let win;

/// ------------------------------------  ///
///       GUARDAR ARCHIVOS EN APPDATA     /// 
/// ------------------------------------  ///

/// -----------  DIRECTORIOS -----------  ///

// APPDATA
const ASSETS_PATH = path.join(app.getPath('userData'), 'assets');
const SCRIPTS_PATH = path.join(app.getPath('userData'), 'scripts');

// ASAR
const ASAR_PATH = app.getAppPath();

if (!fs.existsSync(ASSETS_PATH)) {
  fs.mkdirSync(ASSETS_PATH);
}

// Crear el directorio assets si no existe
if (!fs.existsSync(SCRIPTS_PATH)) {
  fs.mkdirSync(SCRIPTS_PATH);
}

/// -----------  ARCHIVOS -----------  ///

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const SCRIPT_PYTHON_PATH = path.join(SCRIPTS_PATH, 'script_python.py');

// CONFIG
if (!fs.existsSync(CONFIG_PATH)) {
  fs.copyFileSync(path.join(ASAR_PATH, 'config.json'), CONFIG_PATH);
}

// PYTHON SCRIPT
if (!fs.existsSync(SCRIPT_PYTHON_PATH)) {
  fs.copyFileSync(path.join(ASAR_PATH, 'src', 'scripts', 'script_python.py'), SCRIPT_PYTHON_PATH);
}

/// ------------------------------------  ///
///         CONFIGURACIÓN ELECTRON        /// 
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

  // Verificar actualizaciones al iniciar la aplicación
  autoUpdater.checkForUpdates();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


/// ------------------------------------  ///
///            ACTUALIZACIONES            /// 
/// ------------------------------------  ///

app.on('ready', () => {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true
});

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización disponible',
    message: 'Hay una nueva versión disponible. Se está descargando... (Puedes cerrar el mensaje)',
  });
  autoUpdater.downloadUpdate();
});

autoUpdater.on('update-downloaded', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización lista',
    message: 'Una nueva versión ha sido descargada. La aplicación se reiniciará para aplicar la actualización.',
  }).then(() => {
    autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('error', (error) => {
  log.error('Error en el auto-updater:', error);
  lanzar_error('Error en el auto-updater:', error);
});

// Enviar la versión de la aplicación cuando el renderizador lo solicite
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

/// ------------------------------------  ///
///              VALIDACIONES             /// 
/// ------------------------------------  ///

ipcMain.on('existe-directorio', (event, data) => {

  const {ruta} = data;
  const {directorio} = data;

  const rutaParaValidar = path.join(ruta, directorio)

  // Verificar si la ruta existe y retornar el resultado.
  fs.access(rutaParaValidar, fs.constants.F_OK, (err) => {

    const responseData = {
      existeDirectorio: !err,
      path: rutaParaValidar
    }

    event.sender.send('existe-directorio-retorno', responseData);
  });
});

/// ------------------------------------  ///
///          OBTENER CONFIGURACION        /// 
/// ------------------------------------  ///

ipcMain.on('obtener-configuracion', (event, data) => {

  obtener_configuracion()
    .then(JSON_Config => {
      // Si todo ha salido bien, mostrar la modal con la configuración actual
      win.webContents.send('obtener-configuracion', JSON_Config);
    })
    .catch(error => {
      lanzar_error(error);
    });

});

/// ------------------------------------  ///
///          CAMBIAR CONFIGURACION        /// 
/// ------------------------------------  ///

function obtener_configuracion() {
  return new Promise((resolve, reject) => {
    fs.readFile(CONFIG_PATH, 'utf8', (err, data) => {
      if (err) {
        reject('Error al leer el archivo de configuracion: ' + err);
        return;
      }

      try {
        const JSON_Config = JSON.parse(data);

        if (!JSON_Config) {
          throw new Error('La configuración es nula o indefinida');
        }

        resolve(JSON_Config);
      } catch (parseErr) {
        reject('Error al parsear el archivo de configuracion: ' + parseErr);
      }
    });
  });
}

function cambiar_config() {
  obtener_configuracion()
    .then(JSON_Config => {
      // Si todo ha salido bien, mostrar la modal con la configuración actual
      win.webContents.send('mostrar-modal', JSON_Config);
    })
    .catch(error => {
      lanzar_error(error);
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

ipcMain.on('run-python-script', (event, input) => {
  let scriptPath = SCRIPT_PYTHON_PATH;

  const {args} = input;
  const {UUID} = input;

  const pythonProcess = spawn('python', [scriptPath, ...args]);

  pythonProcess.stdout.on('data', (data) => {

    let message = {
      texto: data.toString(),
      UUID: UUID,
      status: undefined
    }
    
    let {texto} = message
    texto = texto.toLowerCase();

    if (texto.includes('error')) {
      message.status = ESTADOS_SALIDA.ERROR;
    } else if (texto.includes('%'))  {
      message.status = ESTADOS_SALIDA.INFO;
    } else 
    {
      message.status = ESTADOS_SALIDA.SUCCESS;
    }

    event.sender.send('python-script-salida', message);
  });

  pythonProcess.stderr.on('data', (data) => {

    let message = {
      texto: data.toString(),
      UUID: UUID,
      status: ESTADOS_SALIDA.ERROR
    }

    event.sender.send('python-script-salida', message);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Proceso terminado con código ${code}`);

    let message = {
      texto: undefined,
      UUID: UUID,
      status: undefined
    }

    if (code === 0) {
      message.texto = "Script terminado con éxito"
      message.status = ESTADOS_SALIDA.SUCCESS
    } else {
      message.texto = `Script terminado con código de error: ${code}`
      message.status = ESTADOS_SALIDA.ERROR
    }

    event.sender.send('python-script-salida', message);
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

ipcMain.on('pedir-lista-plantillas', async (event) => {
  try {
    const JSON_Config = await obtener_configuracion();
    const rutaPlantillas = JSON_Config["ruta_plantillas"];

    // Verificar si la ruta es correcta
    if (!fs.existsSync(rutaPlantillas)) {
      throw new Error('La ruta de plantillas no existe: ' + rutaPlantillas);
    }

    // Crear un array con las rutas de todos los archivos .flp.
    const archivos = fs.readdirSync(rutaPlantillas).filter(file => path.extname(file).toLowerCase() === '.flp');

    // Crear un array con las rutas completas de los archivos
    const rutasArchivos = archivos.map(file => path.join(rutaPlantillas, file));

    // Crear el objeto a devolver
    const resultado = {
      rutasArchivos: rutasArchivos
    };

    // Enviar el objeto de vuelta al renderer
    event.sender.send('obtener-lista-plantillas', resultado);
    
  } catch (error) {
    lanzar_error(error.message);
  }
});