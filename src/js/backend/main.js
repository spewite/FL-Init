/// ------------------------------------  ///
///             GLOBAL VARIABLES          /// 
/// ------------------------------------  ///

const { app, BrowserWindow, ipcMain, dialog, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { spawn, spawnSync } = require('child_process');
const { OUTPUT_STATES } = require('../constants');
const os = require('os');

let win;
let tray = null;
let pythonProcess = null;
let isProcessRunning = false;
let isRestoringWindow = false;

/// -----------------------  ///
///      SINGLE INSTANCE     /// 
/// -----------------------  ///

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv, workingDirectory) => {
      if (win) {
          isRestoringWindow = true;
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
      }
  });
}

/// -----------------  ///
///      SAVE QUIT     /// 
/// -----------------  ///

app.on('before-quit', () => {

  // Kill all the residual process
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
  }
  
  // Clear listeners
  if (win && !win.isDestroyed()) {
    win.removeAllListeners();
  }
});

/// -------------------  ///
///       BUILD PATHS     /// 
/// -------------------  ///

const APPDATA_PATH = app.getPath('userData');
const DEVELOPMENT_PATH = app.getAppPath();
const PRODUCTION_PATH = path.join(process.resourcesPath, "app.asar.unpacked");

console.log("Production Path: " + PRODUCTION_PATH)

const PYTHON_SCRIPT_PATH = process.env.NODE_ENV === 'development'
  ? path.join(DEVELOPMENT_PATH, 'src', 'scripts', 'script_python.py') // Dev path
  : path.join(PRODUCTION_PATH, 'src', 'scripts', 'script_python.py'); // Production path

const pythonVenvPath = process.env.NODE_ENV === 'development'
  ? path.join(DEVELOPMENT_PATH, 'venv', 'Scripts', 'python.exe') // Dev venv
  : path.join(PRODUCTION_PATH, 'venv', 'Scripts', 'python.exe'); // Prod venv

/// ------------------------------  ///
///       SAVE FILES IN APPDATA     /// 
/// ------------------------------  ///

/// -----------  ARCHIVOS -----------  ///

const CONFIG_PATH = path.join(APPDATA_PATH, 'config.json');

const PNG_ICON_PATH = process.env.NODE_ENV === 'development'
  ? path.join(DEVELOPMENT_PATH, 'icons', 'icon.png') // Dev path
  : path.join(PRODUCTION_PATH, 'icons', 'icon.png'); // Production path

const EMPTY_FLP_PATH = process.env.NODE_ENV === 'development'
  ? path.join(DEVELOPMENT_PATH, 'src', 'templates', 'empty-template.flp') // Dev path
  : path.join(PRODUCTION_PATH, 'src', 'templates', 'empty-template.flp'); // Production path

try {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.copyFileSync(path.join(PRODUCTION_PATH, 'config.json'), CONFIG_PATH);
  }
  if (!fs.existsSync(PNG_ICON_PATH)) {
    fs.copyFileSync(path.join(PRODUCTION_PATH, 'icons', 'icon.png'), PNG_ICON_PATH);
  }
  if (!fs.existsSync(EMPTY_FLP_PATH)) {
    fs.copyFileSync(
      path.join(PRODUCTION_PATH, 'src', 'templates', 'empty-template.flp'),
      EMPTY_FLP_PATH
    );
  }
} catch (error) {
  console.error('Error copying files: ', error);
  throwError(error);
}


/// ------------------------------------  ///
///         ELECTRON CONFIGURATION        /// 
/// ------------------------------------  ///

// Function to create the tray icon
function createTrayIcon() {
  if (!tray) {
    tray = new Tray(PNG_ICON_PATH);
    
    // Left click event
    tray.on('click', () => {
      isRestoringWindow = true;
      if (win) {
        win.show();
        if (process.platform === 'darwin') app.dock.show();
      }
    });

    // Contextual menu for right click
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
  
  win.loadFile(path.join(__dirname, '../../html/index.html'));

  // Maximize window after creating
  win.maximize();

  // Open DevTools automatically
  // win.webContents.openDevTools();

  // Modify window close event
  win.on('close', (event) => {
    if (isRestoringWindow) {
      event.preventDefault();
      isRestoringWindow = false;
      return;
    }
  
    if (!app.isQuitting) {
      if (isProcessRunning) {

        // Show dialog if the download/separation process is active
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
          createTrayIcon();
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
        { label: 'Configuration', click() { changeConfig(); } },
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

  win.webContents.on('did-finish-load', () => {
    console.log('Page fully loaded');
    checkPythonInstalled();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (win) {
      isRestoringWindow = true;
      win.show();
      if (process.platform === 'darwin') app.dock.show();
    } else {
      // If does't exist create a window.
      createWindow();
    }
  });
  
  // Check updates when opening app
  autoUpdater.checkForUpdates();

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/// ----------------------------  ///
///            UPDATES            /// 
/// ----------------------------  ///

app.on('ready', () => {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true
});

autoUpdater.on('update-available', () => {
  win.webContents.send('block-ui', true);
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: "A new version of the application is available and is currently being downloaded. Please wait until the download is complete. The app will remain unresponsive during this process.",
  });
  autoUpdater.downloadUpdate();
});

autoUpdater.on('update-downloaded', (info) => {
  win.webContents.send('block-ui', false);
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
  console.error('Error details:', error);
  throwError('Error in the auto-updater: ' + (error.stack || error));
});

// Send the application version when requested by the renderer
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

/// ----------------------------------  ///
///              VALIDATION             /// 
/// ----------------------------------  ///

ipcMain.on('validate-directory', (event, pathToValidate) => {

  fs.stat(pathToValidate, (err, stats) => {

    const response = { success: true, errorMessage: '' };

    if (err || !stats.isDirectory()) {
      response.success = false;
      response.errorMessage = `<p>❌ The base route <span style="font-weight: bold; font-style: italic;">${pathToValidate}</span> does not exist!</p>`;
    }
    
    event.reply('validate-directory', response);

  });
  
});


ipcMain.on('validate-project-name', (event, data) => {

  const { projectPath, directory } = data;
  const pathToValidate = path.join(projectPath, directory);
  
  fs.access(pathToValidate, fs.constants.F_OK, (err) => {
    
    const response = { success: true, errorMessage: '' };

    if (!err) {
      response.success = false;
      response.errorMessage = `<p>❌ The directory <span style="font-weight: bold; font-style: italic;">${pathToValidate}</span> already exists!</p>`;
    }

    event.reply('validate-project-name', response);
  });

});

/// --------------------------------  ///
///          GET CONFIGURATION        /// 
/// --------------------------------  ///

ipcMain.on('get-configuration', async () => {

  try  {
    const config = await getConfiguration();
    win.webContents.send('get-configuration', config);
  } catch (error)  {
      throwError(error);
  }
});

async function getConfiguration() {
  const data = await fs.promises.readFile(CONFIG_PATH, 'utf8');
  let config = JSON.parse(data);
  let updated = false;
  const numberOfCpus = os.cpus().length.toString();

  if (!config.hasOwnProperty('threads')) {
    config.threads = numberOfCpus || "4";  // Default threads value
    updated = true;
  }
  if (!config.hasOwnProperty('audio_extension')) {
    config.audio_extension = "mp3";  // Default extension value
    updated = true;
  }
  if (updated) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }
  return config;
}

/// -----------------------------------  ///
///          CHANGE CONFIGURATION        /// 
/// -----------------------------------  ///

async function changeConfig() {

  try {
    const config = await getConfiguration();
    win.webContents.send('show-modal', config);
  } catch (error)  {
      throwError(error);
  }

}

ipcMain.on('change-config', (event, JSON_Config) => {

  fs.readFile(CONFIG_PATH, 'utf8', (err) => {

    if (err) {
      throwError('Error reading configuration file: ' + err);
      return;
    }
  
    // Save configuration in file 
    try {
      const jsonConfig = JSON.stringify(JSON_Config, null, 2);
      fs.writeFileSync(CONFIG_PATH, jsonConfig);

      // Notify the frontend that the configuration was successfully saved
      event.sender.send('config-saved', { jsonConfig: jsonConfig });

    } catch (fileSaveError) {
      throwError('Error saving new configuration JSON: ' + fileSaveError);
    }
  });

});

ipcMain.on('save-stems-value', (event, separateStems) => {

  fs.readFile(CONFIG_PATH, 'utf8', async (err) => {
    
    if (err) {
      throwError('Error reading configuration file: ' + err);
      return;
    }

    // Save the configuration in the configuration file.
    try {
      const currentConfig = await getConfiguration();
      const newConfig = JSON.stringify({...currentConfig, "separate_stems": separateStems}, null, 2); 
      fs.writeFileSync(CONFIG_PATH, newConfig);
    } catch (fileSaveError) {
      throwError('Error saving new configuration JSON: ' + fileSaveError);
    }
  });
})

ipcMain.on('save-thread-ext-value', async (event, data) => {
  try {
    const currentConfig = await getConfiguration();
    const newConfig = { ...currentConfig, threads: data.threads, audio_extension: data.audio_extension };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
  } catch (error) {
    throwError('Error saving thread/extension values:', error);
  }
});

/// ------------------------------------  ///
///       OPEN FILE/DIRECTORY DIALOG      ///
/// ------------------------------------  ///

// IPC handling to open the folder selection dialog
ipcMain.on('open-directory-dialog', (event, input_id) => {

  dialog.showOpenDialog({
    properties: ['openDirectory']
  }).then(result => {

    if (!result.canceled && result.filePaths.length > 0) {

      event.sender.send('selected-directory', {
        directoryPath: result.filePaths[0],
        input_id: input_id
      });
    }

  }).catch(err => {
    console.error('Error opening the directory selection dialog:', err);
  });

});

// IPC handling to open the file selection dialog
ipcMain.on('open-file-dialog', (event, extensionsArray) => {

  dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Template file', extensions: extensionsArray }]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      console.log(result)
      event.sender.send('selected-file', result.filePaths[0]);
    }
  }).catch(err => {
    console.error('Error opening the file selection dialog:', err);
  });

});

/// ------------------------------------  ///
///             SCRIPTS PYTHON            ///
/// ------------------------------------  ///

function hasTemplatePath(args) {
  return args.some(arg => arg.includes('--template-path'));
}

ipcMain.on('run-python-script', (event, input) => {
  
  isProcessRunning = true;

  // Args:
  // 0: Project location
  // 1: Youtube URL
  // 2: Project Name
  // Optional arguments: --separate-stems, --template-path=<templatePath>
  // If separate stems is checked: --audio-extension=<mp3/wav>, --threads=int
  const {args, UUID} = input;

  if (!hasTemplatePath(args)) {
    args.push('--template-path=' + EMPTY_FLP_PATH);
  }

  pythonProcess = spawn(pythonVenvPath, [PYTHON_SCRIPT_PATH, ...args]);

  // Secure function to send messages
  const safeSend = (message) => {
    if (!win.isDestroyed()) { // Check if the window exists
      event.sender.send('python-script-output', message);
    }
  };

  // Cleanup the python process
  const cleanup = () => {
    isProcessRunning = false;
    if (pythonProcess) {
      pythonProcess.removeAllListeners();
      pythonProcess = null;
    }
  };

  pythonProcess.stdout.on('data', (data) => {

    let message = {
      text: data.toString(),
      UUID: UUID,
      status: undefined
    }
    
    let {text} = message
    text = text.toLowerCase();

    if (text.includes('error')) {
      message.status = OUTPUT_STATES.ERROR;
    } else if (text.includes('%'))  {
      message.status = OUTPUT_STATES.INFO;
    } else 
    {
      message.status = OUTPUT_STATES.SUCCESS;
    }

    safeSend(message);
  });

  pythonProcess.stderr.on('data', (data) => {

    let message = {
      text: data.toString(),
      UUID: UUID,
      status: OUTPUT_STATES.ERROR
    }

    safeSend(message);
  });

  pythonProcess.on('close', (code) => {

    console.log(`Process finished with code ${code}`);
    cleanup();

    let message = {
      text: undefined,
      UUID: UUID,
      status: undefined
    }

    if (code === 0) {
      message.text = "Script completed successfully"
      message.status = OUTPUT_STATES.SUCCESS
    } else {
      message.text = `Script terminated with error code: ${code}`
      message.status = OUTPUT_STATES.ERROR
    }

    safeSend(message);
  });

  pythonProcess.on('error', (error) => {
    const message = {
      text: `Error executing script: ${error.message}`,
      UUID: UUID,
      status: OUTPUT_STATES.ERROR
    };
    safeSend(message);
  });

});


/// -----------------------------------  ///
///               UTILITIES              ///
/// -----------------------------------  ///

// Checks if the venv Python executable exists and is runnable
function checkPythonInstalled() {

  if (!fs.existsSync(pythonVenvPath)) {
    console.error('Python venv not found at:', pythonVenvPath);
    throwError(`The Python virtual environment is not found in path ${pythonVenvPath}. There is an installation error. Please, try to reinstall the app and if the errors persists, contact the developer.`);
    return false;
  }

  try {
    const result = spawnSync(pythonVenvPath, ['--version'], { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      clientLog('Python not runnable:', result.error);
      throwError('Python is not runnable. Please, install python 3.8-3.11');
      return false;
    }
    const versionOutput = (result.stdout || result.stderr).trim();
    const match = versionOutput.match(/Python\s+(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
      clientLog('Could not parse Python version:', versionOutput);
      throwError('Could not parse Python version. Please, install python 3.8-3.11');
      return false;
    }
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    if (
      major !== 3 ||
      minor < 8 ||
      minor > 11
    ) {
      clientLog('Python version not supported:', versionOutput);
      throwError(`Python version not supported: ${versionOutput}. Please, install python 3.8-3.11`);
      return false;
    }
    clientLog('Python found:', versionOutput);
    return true;
  } catch (err) {
    clientLog('Exception checking Python:', err);
    throwError('An unknown error occurred while checking for Python');
    return false;
  }
}

function clientLog(...args) {
  if (win && !win.isDestroyed()) {
    // Send the joined log message to the renderer through the 'client-log' channel
    win.webContents.send('client-log', args.join(' '));
  }
}

function throwError(err)
{
  if (win && !win.isDestroyed()) {
    win.webContents.send('generic-error', err);
  }
  console.log("\x1b[43m", err);  // Colors: https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
  console.log("\x1b[0m", '');    // Reset
}

ipcMain.on('ask-templates-list', async (event) => {
  try {
    const JSON_Config = await getConfiguration();
    const templatesPath = JSON_Config["templates_path"];

    // Check if the path exists
    if (!fs.existsSync(templatesPath)) { 
      console.log("The templates path does not exist"); // We don't want to display a message on the screen, only in the terminal.
      return;
    }

    // Create an array with the paths of all .flp files.
    const files = fs.readdirSync(templatesPath).filter(file => path.extname(file).toLowerCase() === '.flp');

    // Create an array with the full paths of the files
    const filesPaths = files.map(file => path.join(templatesPath, file));

    // Send the object back to the renderer
    event.sender.send('get-templates-list', {
      filesPaths: filesPaths
    });
    
  } catch (error) {
    throwError(error.message);
  }
});