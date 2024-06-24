const { ipcRenderer } = require('electron');
const Swal = require('sweetalert2');


const pythonOutput = document.getElementById("python-output");



/// ------------------------------------  ///
///            EVENT LISTENERS            /// 
/// ------------------------------------  ///


// ----- DOMContentLoaded ---- //
document.addEventListener("DOMContentLoaded", (e) => {
  const uuid = crypto.randomUUID();
  document.getElementById("project-name").value = uuid;
});

// ----- CERRAR MODAL ---- //
const btnCerrarModal = document.getElementById("cerrar-modal");
btnCerrarModal.addEventListener("click", (e) => {
  window.dialog.close();
});

// ----- WINDOW ONCLICK ---- //
window.addEventListener("click", (e) => {
  console.log(e.target)
});

// ----- FORM SUBMIT ---- //

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

ipcRenderer.on('error-generico', (event, err) => {
  alert(`Error: ${err}`);
});

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

ipcRenderer.on('cambiar-config-peticion', (event, parametro) => {
  
  // Parametro: (1) ruta_proyecto (2) ruta_plantillas

  window.dialog.showModal();

  const valor = 'C:\\Users\\Izeta\\Desktop\\TEST\\35e450f4-1265-4b30-843f-4e5101af9db9\\assets';

  const JSON_Config = {
    [parametro]: valor,
  }

  ipcRenderer.send('cambiar-config-valores', JSON_Config);
});

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




