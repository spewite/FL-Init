const { exec } = require('child_process');
const { ipcRenderer } = require('electron');
const Swal = require('sweetalert2');

// Mejor manejo de argumentos para seguridad
const quote = require('shell-quote').quote;

// Función para ejecutar un script de Python y manejar la salida
function runPythonScript(args) {
  const command = `python ${quote(['script_python.py', ...args])}`;
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      return;
    }
    console.log(`Stdout: ${stdout}`);
    alert(stdout); // Mostrar salida como un alerta para propósitos de demostración
  });
}
Swal.fire("SweetAlert2 is working!");

document.getElementById('form').addEventListener('submit', function(event) {
  Swal.fire("SweetAlert2 is working!");
  event.preventDefault();
  const youtubeUrl = document.getElementById('youtube-url').value;
  const projectLocation = document.getElementById('project-location').value;
  const projectName = document.getElementById('project-name').value;
  const separateStems = document.getElementById('separate-stems').checked;

  // Argumentos para el script de Python
  const args = [youtubeUrl, projectLocation, projectName];
  if (separateStems) {
    args.push('--separate-stems');
  }

  runPythonScript(args);
});

document.getElementById('browse-location').addEventListener('click', () => {
  ipcRenderer.send('open-file-dialog');
});

ipcRenderer.on('selected-directory', (event, path) => {
  const inputProyectLocation = document.getElementById("project-location"); 
  inputProyectLocation.value = path;
});