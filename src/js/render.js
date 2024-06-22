const { ipcRenderer } = require('electron');
const Swal = require('sweetalert2');

const pythonOutput = document.getElementById("python-output");

const SCRIPT_ESTADOS = 
{
  EXITO: 1,
  ERROR: 2,
  INFO: 3,
}

document.getElementById('form').addEventListener('submit', function(event) {
  event.preventDefault();
  const youtubeUrl = document.getElementById('youtube-url').value;
  const projectLocation = document.getElementById('project-location').value;
  const projectName = document.getElementById('project-name').value;
  const separateStems = document.getElementById('separate-stems').checked;

  console.log(" --- INPUTS --- ");

  console.log(youtubeUrl);
  console.log(projectLocation);
  console.log(projectName);
  console.log(separateStems);

  console.log(" ------------ ");
  
  // Argumentos para el script de Python
  const args = [projectLocation, youtubeUrl, projectName];
  if (separateStems) {
    args.push('--separate-stems');
  }

  
  // Llama a la función para ejecutar el script de Python
  ipcRenderer.send('run-python-script', args);
  // Swal.fire("SweetAlert2 is working!");
});

function insertarPythonOutput(mensaje, color)
{

  const p = document.createElement("p");
  const nodo = document.createTextNode(mensaje);

  p.appendChild(nodo);
  p.setAttribute("style", `color:${color};`) 

  pythonOutput.appendChild(p);

}

document.getElementById('browse-location').addEventListener('click', () => {
  ipcRenderer.send('open-file-dialog');
});

ipcRenderer.on('selected-directory', (event, path) => {
  const inputProyectLocation = document.getElementById("project-location"); 
  inputProyectLocation.value = path;
});

ipcRenderer.on('python-script-stdout', (event, stdout) => {
  // alert(`Python Script Output: ${stdout}`);
  insertarPythonOutput(stdout, "#5dc52a");
});

ipcRenderer.on('python-script-error', (event, error) => {
  console.error(`Python Script Error: ${error}`);
  insertarPythonOutput(error, "#c52828");
});


ipcRenderer.on('python-script-info', (event, mensaje) => {
  insertarPythonOutput(mensaje, "#14bef3");
});


