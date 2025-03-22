
/// ------------------------------------  ///
///           VARIABLES GLOBALES          /// 
/// ------------------------------------  ///

const { app, BrowserWindow, ipcMain, dialog, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');

const { ESTADOS_SALIDA } = require('../js/constants');

let win;
let tray = null; // Declaración global importante
let isProcessRunning = false;
let pythonProcess = null;

/// -----------------  ///
///      SAVE QUIT     /// 
/// -----------------  ///

app.on('before-quit', () => {
  // Matar cualquier proceso residual
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
  }
  
  // Limpiar listeners
  if (win && !win.isDestroyed()) {
    win.removeAllListeners();
  }
});

/// -------------------------------------  ///
///      INSTALAR FFMPEG SI NO LO ESTA     /// 
/// -------------------------------------  ///

// Paths for FFmpeg
const FFmpegPath = path.join(app.getPath('userData'), 'ffmpeg');
const FFmpegBinary = path.join(FFmpegPath, 'ffmpeg.exe');

// Function to check if FFmpeg is installed
function checkFFmpeg() {
  if (!fs.existsSync(FFmpegBinary)) {
    console.log('FFmpeg no esta instalado, procediendo a la instalacion...');
    installFFmpeg();
  } else {
    console.log('FFmpeg esta instalado.');
  }
}

// Function to copy FFmpeg from the package to the user data directory
function installFFmpeg() {
  const ffmpegSource = path.join(app.getAppPath(), 'src', 'ffmpeg');

  // Log the paths for debugging
  console.log('ffmpegSource:', ffmpegSource);
  console.log('FFmpegPath:', FFmpegPath);

  try {
    // Verificar que la carpeta fuente existe
    if (!fs.existsSync(ffmpegSource)) {
      throw new Error(`The FFmpeg source directory does not exist: ${ffmpegSource}`);
    }
    
    fs.mkdirSync(FFmpegPath, { recursive: true });

    // Verificar que los archivos existen antes de copiarlos
    const files = ['ffmpeg.exe', 'ffplay.exe', 'ffprobe.exe'];
    for (const file of files) {
      const sourcePath = path.join(ffmpegSource, file);
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`The FFmpeg file ${file} does not exist in the source: ${sourcePath}`);
      }
    }

    fs.copyFileSync(path.join(ffmpegSource, 'ffmpeg.exe'), FFmpegBinary);
    fs.copyFileSync(path.join(ffmpegSource, 'ffplay.exe'), path.join(FFmpegPath, 'ffplay.exe'));
    fs.copyFileSync(path.join(ffmpegSource, 'ffprobe.exe'), path.join(FFmpegPath, 'ffprobe.exe'));

    console.log('FFmpeg instalado correctamente.');
  } catch (error) {
    console.error('Error installing FFmpeg:', error);
    lanzar_error('Error installing FFmpeg:', error);
  }
}

/// ------------------------------------  ///
///       GUARDAR ARCHIVOS EN APPDATA     /// 
/// ------------------------------------  ///

/// -----------  DIRECTORIOS -----------  ///

// APPDATA
const ASSETS_PATH = path.join(app.getPath('userData'), 'assets');
const SCRIPTS_PATH = path.join(app.getPath('userData'), 'scripts');
const ICONS_PATH = path.join(app.getPath('userData'), 'icons');

// ASAR
const ASAR_PATH = app.getAppPath();

try {
  if (!fs.existsSync(ASSETS_PATH)) {
    fs.mkdirSync(ASSETS_PATH);
  }
  if (!fs.existsSync(SCRIPTS_PATH)) {
    fs.mkdirSync(SCRIPTS_PATH);
  }
  if (!fs.existsSync(ICONS_PATH)) {
    fs.mkdirSync(ICONS_PATH);
  }
} catch (error) {
  console.error('Error creando directorios:', error);
  lanzar_error(error);
}

/// -----------  ARCHIVOS -----------  ///

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const SCRIPT_PYTHON_PATH = process.env.NODE_ENV === 'development'
  ? path.join(app.getAppPath(), 'src', 'scripts', 'script_python.py') // Ruta para desarrollo
  : path.join(SCRIPTS_PATH, 'script_python.py'); // Ruta para producción
const PNG_ICON_PATH = process.env.NODE_ENV === 'development'
? path.join(app.getAppPath(), 'icons', 'icon.png') // Ruta para desarrollo
: path.join(ICONS_PATH, 'icon.png'); // Ruta para producción

try {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.copyFileSync(path.join(ASAR_PATH, 'config.json'), CONFIG_PATH);
  }
  if (!fs.existsSync(SCRIPT_PYTHON_PATH)) {
    fs.copyFileSync(path.join(ASAR_PATH, 'src', 'scripts', 'script_python.py'), SCRIPT_PYTHON_PATH);
  }
  if (!fs.existsSync(PNG_ICON_PATH)) {
    fs.copyFileSync(path.join(ASAR_PATH, 'icons', 'icon.png'), PNG_ICON_PATH);
  }
} catch (error) {
  console.error('Error copiando archivos:', error);
  lanzar_error(error);
}


/// ------------------------------------  ///
///         CONFIGURACIÓN ELECTRON        /// 
/// ------------------------------------  ///

// Función para crear el ícono en la bandeja
function crearTrayIcon() {
  if (!tray) {
    tray = new Tray(PNG_ICON_PATH);
    
    // Evento para clic izquierdo
    tray.on('click', () => {
      if (win) {
        win.show();
        if (process.platform === 'darwin') app.dock.show();
      }
    });

    // Menú contextual para clic derecho
    const contextMenu = Menu.buildFromTemplate([
      { 
        label: 'Open', 
        click: () => {
          win.show();
          if (process.platform === 'darwin') app.dock.show();
        }
      },
      { 
        label: 'Quit', 
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);
    
    tray.setToolTip('FL Init');
    tray.setContextMenu(contextMenu);
  }
}

function createWindow() {
  win = new BrowserWindow({
    icon: PNG_ICON_PATH,
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

  // Modifica el evento close de la ventana
  win.on('close', (event) => {
    if (!app.isQuitting) {
      if (isProcessRunning) {
        // Mostrar diálogo solo si hay proceso activo
        const choice = dialog.showMessageBoxSync(win, {
          type: 'question',
          buttons: ['Send to Background', 'Quit Anyway'],
          title: 'Process Running',
          message: 'The audio is being proccessed!',
          detail: 'Closing the app will terminate the current operation.',
          cancelId: 0
        });
  
        if (choice === 1) { // Quit Anyway
          app.isQuitting = true;
          win.destroy();
          app.quit();
          return;
        } else { // Send to Background
          event.preventDefault();
          win.hide();
          crearTrayIcon();
        }
      } else {
        // Regular close
        app.isQuitting = true;
        win.destroy();
        app.quit();
        return;
      }
    }
  });
  

  const menu = Menu.buildFromTemplate([
    {
      label: 'Settings',
      submenu: [
        { label: 'Configuration', click() { cambiar_config(); } },
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
  checkFFmpeg();
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
    title: 'Update available',
    message: "A new version is available. It's downloading... (You can close the message)",
  });
  autoUpdater.downloadUpdate();
});

autoUpdater.on('update-downloaded', (info) => {

  // Forzar actualización de scripts
  fs.copyFileSync(path.join(ASAR_PATH, 'src', 'scripts', 'script_python.py'), SCRIPT_PYTHON_PATH);

  dialog.showMessageBox({
    type: 'info',
    title: 'Update ready',
    message: 'A new version has been downloaded. The app will restart to apply the update.',
  }).then(() => {
    autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('error', (error) => {
  log.error('Error in the auto-updater:', error);
  lanzar_error('Error in the auto-updater:', error);
});

// Enviar la versión de la aplicación cuando el renderizador lo solicite
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

/// ------------------------------------  ///
///              VALIDACIONES             /// 
/// ------------------------------------  ///

ipcMain.on('validate-directory', (event, ruta) => {

  fs.stat(ruta, (err, stats) => {

    const response = { success: true, errorMessage: '' };

    if (err || !stats.isDirectory()) {
      response.success = false;
      response.errorMessage = `<p>❌ The base route <span style="font-weight: bold; font-style: italic;">${ruta}</span> does not exist!</p>`;
    }
    
    event.reply('validate-directory', response);

  });
  
});


ipcMain.on('validate-project-name', (event, data) => {

  const { ruta, directorio } = data;
  const rutaParaValidar = path.join(ruta, directorio);
  
  fs.access(rutaParaValidar, fs.constants.F_OK, (err) => {
    
    const response = { success: true, errorMessage: '' };

    if (!err) {
      response.success = false;
      response.errorMessage = `<p>❌ The directory <span style="font-weight: bold; font-style: italic;">${rutaParaValidar}</span> already exists!</p>`;
    }

    event.reply('validate-project-name', response);
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

// Usar fs.promises para consistencia
async function obtener_configuracion() {
  const data = await fs.promises.readFile(CONFIG_PATH, 'utf8');
  return JSON.parse(data);
}

function cambiar_config() {
  if (!win) {
    console.error('La ventana no está inicializada');
    return;
  }
  
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
      lanzar_error('Error reading configuration file: ' + err);
      return;
    }
  
    // Guardar la configuracion en el archivo de configuracion.
    try {
      const jsonConfig = JSON.stringify(JSON_Config, null, 2);
      fs.writeFileSync(CONFIG_PATH, jsonConfig);

      // Notificar al frontend que la configuración se guardó con éxito
      event.sender.send('configuracion-guardada', { jsonConfig: jsonConfig });

    } catch (fileSaveError) {
      lanzar_error('Error saving new configuration JSON: ' + fileSaveError);
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
    filters: [{ name: '.flp file', extensions: extensionsArray }]
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
  
  isProcessRunning = true;

  const scriptPath = SCRIPT_PYTHON_PATH;
  const venvPath = path.join(app.getAppPath(), 'venv', 'Scripts', 'python.exe');  // For Windows

  const {args, UUID} = input;
  pythonProcess = spawn(venvPath, [scriptPath, ...args]);

  // Función segura para enviar mensajes
  const safeSend = (message) => {
    if (!win.isDestroyed()) { // Verificar si la ventana existe
      event.sender.send('python-script-salida', message);
    }
  };

  // Limpieza mejorada
  const cleanup = () => {
    isProcessRunning = false;
    if (pythonProcess) {
      pythonProcess.removeAllListeners();
      pythonProcess = null;
    }
  };

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

    safeSend(message);
  });

  pythonProcess.stderr.on('data', (data) => {

    let message = {
      texto: data.toString(),
      UUID: UUID,
      status: ESTADOS_SALIDA.ERROR
    }

    safeSend(message);
  });

  pythonProcess.on('close', (code) => {

    console.log(`Proceso terminado con código ${code}`);

    cleanup();

    let message = {
      texto: undefined,
      UUID: UUID,
      status: undefined
    }

    if (code === 0) {
      message.texto = "Script completed successfully"
      message.status = ESTADOS_SALIDA.SUCCESS
    } else {
      message.texto = `Script terminated with error code: ${code}`
      message.status = ESTADOS_SALIDA.ERROR
    }

    safeSend(message);
  });

  pythonProcess.on('error', (error) => {
    const message = {
      texto: `Error executing script: ${error.message}`,
      UUID: UUID,
      status: ESTADOS_SALIDA.ERROR
    };
    safeSend(message);
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
      console.log("No existe la ruta de la plantillas"); // No queremos mostar mensaje en pantalla solo en terminal.
      return;
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