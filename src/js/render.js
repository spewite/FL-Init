const { ipcRenderer } = require('electron');
const Swal = require('sweetalert2');


const pythonOutput = document.getElementById("python-output");

document.addEventListener("DOMContentLoaded", (e) => {
  const uuid = crypto.randomUUID();
  document.getElementById("project-name").value = uuid;
});


/// ------------------------------------  ///
///              FORM SUBMIT              /// 
/// ------------------------------------  ///

document.getElementById('form').addEventListener('submit', function(event) {
  event.preventDefault();

  // Parametros obligatorios 
  const youtubeUrl = document.getElementById('youtube-url').value;
  const projectLocation = document.getElementById('project-location').value;
  const projectName = document.getElementById('project-name').value;

  // Parametros opcionales
  const separateStems = document.getElementById('separate-stems').checked;
  const templatePath = document.getElementById('template-flp').value;


  // Argumentos para el script de Python
  const args = [projectLocation, youtubeUrl, projectName];
  
  if (separateStems) {
    args.push('--separate-stems');
  }

  if (templatePath)
  {
    args.push(`--template-path=${templatePath}`);
  }
  
  // Llama a la función para ejecutar el script de Python
  ipcRenderer.send('run-python-script', args);
  // Swal.fire("Ejecutando script");

  // console.log(" --- INPUTS --- ");
  // console.log(youtubeUrl);
  // console.log(projectLocation);
  // console.log(projectName);
  // console.log(separateStems);
  // console.log(templatePath);
  // console.log(" ------------ ");
});


/// ------------------------------------  ///
///               UTILIDADES              /// 
/// ------------------------------------  ///

function insertarPythonOutput(mensaje, color)
{
  const p = document.createElement("p");
  const nodo = document.createTextNode(mensaje);

  p.appendChild(nodo);
  p.setAttribute("style", `color:${color};`) 

  pythonOutput.appendChild(p);
}

document.getElementById('browse-location').addEventListener('click', (e) => {
  ipcRenderer.send('open-directory-dialog');
});

document.getElementById('browse-flp-template').addEventListener('click', (e) => {
  ipcRenderer.send('open-file-dialog');
});


/// ------------------------------------  ///
///      BACKEND FILE/DIALOG RETORNO      /// 
/// ------------------------------------  ///
ipcRenderer.on('selected-directory', (event, path) => {

  document.getElementById("project-location").value = path;
});

ipcRenderer.on('selected-file', (event, filePath) => {

  const select = document.getElementById("template-flp");

  // Crea un nuevo elemento option
  var option = document.createElement("option");

  // Divide la cadena por las barras invertidas
  let partes = filePath.split('\\');
  const nombreArchivo = partes[partes.length-1];

  // Configura el texto y el valor del nuevo elemento option
  option.text = nombreArchivo;
  option.value = filePath;

  // Añade el nuevo elemento option al select
  select.appendChild(option);
});


/// ------------------------------------  ///
///         BACKEND CAMBIO CONFIG         /// 
/// ------------------------------------  ///

ipcRenderer.on('mensaje-del-backend', (event, message) => {
  console.log(message); // Aquí puedes ver el mensaje en la consola del navegador
  ejecutarFuncionFrontend(message); // Llama a la función con el mensaje recibido
});

function ejecutarFuncionFrontend(data) {
  alert(data); // Aquí puedes poner la lógica que desees ejecutar en el frontend
}

/// ------------------------------------  ///
///         BACKEND PYTHON RETORNO        /// 
/// ------------------------------------  ///

ipcRenderer.on('python-script-stdout', (event, stdout) => {
  insertarPythonOutput(stdout, "#5dc52a");
});

ipcRenderer.on('python-script-error', (event, error) => {
  console.error(`Python Script Error: ${error}`);
  insertarPythonOutput(error, "#c52828");
});

ipcRenderer.on('python-script-info', (event, mensaje) => {
  insertarPythonOutput(mensaje, "#14bef3");
});




