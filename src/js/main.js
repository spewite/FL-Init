
/// ------------------------------------  ///
///             GLOBAL VARIABLES          /// 
/// ------------------------------------  ///

const { app, BrowserWindow, ipcMain, dialog, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const { OUTPUT_STATES } = require('../js/constants');

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

/// -------------------------------------  ///
///      INSTALL FFMPEG IF NOT INSTALLED   /// 
/// -------------------------------------  ///

// Paths for FFmpeg
const FFmpegPath = path.join(app.getPath('userData'), 'ffmpeg');
const FFmpegBinary = path.join(FFmpegPath, 'ffmpeg.exe');

// Function to check if FFmpeg is installed
function checkFFmpeg() {
  if (!fs.existsSync(FFmpegBinary)) {
    console.log('FFmpeg is not installed, proceeding with the installation...');
    installFFmpeg();
  } else {
    console.log('FFmpeg is installed.');
  }
}

// Function to copy FFmpeg from the package to the user data directory
function installFFmpeg() {
  const ffmpegSource = path.join(app.getAppPath(), 'src', 'ffmpeg');

  // Log the paths for debugging
  console.log('ffmpegSource:', ffmpegSource);
  console.log('FFmpegPath:', FFmpegPath);

  try {
    // Check if the source folder exists
    if (!fs.existsSync(ffmpegSource)) {
      throw new Error(`The FFmpeg source directory does not exist: ${ffmpegSource}`);
    }
    
    fs.mkdirSync(FFmpegPath, { recursive: true });

    // Check if the files exist before copying
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

    console.log('FFmpeg installed correctly.');
  } catch (error) {
    console.error('Error installing FFmpeg:', error);
    throwError('Error installing FFmpeg:', error);
  }
}


/// ----------------------  ///
///          VENV           /// 
/// ----------------------  ///

const venvPath = process.env.NODE_ENV === 'development'
? path.join(app.getAppPath(), 'venv', 'Scripts', 'python.exe') // Dev path
: path.join(app.getPath('userData'), 'venv', 'Scripts', 'python.exe'); // Production path

function checkVenv() {
  if (process.env.NODE_ENV !== 'development') {
    const venvTarget = path.join(app.getPath('userData'), 'venv');
    const pythonExecutable = path.join(venvTarget, 'Scripts', 'python.exe');

    if (!fs.existsSync(pythonExecutable)) {
      console.log('Copying Python virtual environment for production...');
      
      try {
        win.webContents.send('block-ui', true);
        fs.mkdirSync(venvTarget, { recursive: true });
        const venvSource = path.join(process.resourcesPath, 'venv');
        copyFolderRecursiveSync(venvSource, venvTarget);
      } catch (error) {
        console.log(error)
        throwError('Failed to copy Python environment: ' + error);
      } finally {
        win.webContents.send('block-ui', false);
      }
    } else {
      console.log("Venv found")
    }
  }
}

// Add this helper function
function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) fs.mkdirSync(target);
  
  fs.readdirSync(source).forEach(item => {
    const srcPath = path.join(source, item);
    const tgtPath = path.join(target, item);
    
    if (fs.lstatSync(srcPath).isDirectory()) {
      copyFolderRecursiveSync(srcPath, tgtPath);
    } else {
      fs.copyFileSync(srcPath, tgtPath);
    }
  });
}

/// ------------------------------  ///
///       SAVE FILES IN APPDATA     /// 
/// ------------------------------  ///

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
  console.error('Error creating directories: ', error);
  throwError(error);
}

/// -----------  ARCHIVOS -----------  ///

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

const PYTHON_SCRIPT_PATH = process.env.NODE_ENV === 'development'
  ? path.join(app.getAppPath(), 'src', 'scripts', 'script_python.py') // Dev path
  : path.join(SCRIPTS_PATH, 'script_python.py'); // Production path

const PNG_ICON_PATH = process.env.NODE_ENV === 'development'
  ? path.join(app.getAppPath(), 'icons', 'icon.png') // Dev path
  : path.join(ICONS_PATH, 'icon.png'); // Production path

const EMPTY_FLP_PATH = process.env.NODE_ENV === 'development'
  ? path.join(app.getAppPath(), 'src', 'templates', 'empty-template.flp') // Dev path
  : path.join(SCRIPTS_PATH, 'empty-template.flp'); // Production path

try {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.copyFileSync(path.join(ASAR_PATH, 'config.json'), CONFIG_PATH);
  }
  if (!fs.existsSync(PYTHON_SCRIPT_PATH)) {
    fs.copyFileSync(path.join(ASAR_PATH, 'src', 'scripts', 'script_python.py'), PYTHON_SCRIPT_PATH);
  }
  if (!fs.existsSync(PNG_ICON_PATH)) {
    fs.copyFileSync(path.join(ASAR_PATH, 'icons', 'icon.png'), PNG_ICON_PATH);
  }
  if (!fs.existsSync(EMPTY_FLP_PATH)) {
    fs.copyFileSync(
      path.join(ASAR_PATH, 'src', 'templates', 'empty-template.flp'),
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
  
  win.loadFile(path.join(__dirname, '../html/index.html'));

  // Maximize window after creating
  win.maximize();

  // // Open DevTools automatically
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
}

app.whenReady().then(() => {
  createWindow();
  checkFFmpeg();
  checkVenv();

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
  return JSON.parse(data);
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
  const {args, UUID} = input;

  if (!hasTemplatePath(args)) {
    args.push('--template-path=' + EMPTY_FLP_PATH);
  }

  pythonProcess = spawn(venvPath, [PYTHON_SCRIPT_PATH, ...args]);

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