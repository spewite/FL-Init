const { ipcRenderer } = require('electron');
const { copyFileSync } = require('original-fs');
const Swal = require('sweetalert2');


/// ------------------------------------  ///
///               NODOS HTML              /// 
/// ------------------------------------  ///

const pythonOutput = document.getElementById("python-output");

// -----  INPUTS PRINCIPALES ---- //

// Parametros obligatorios 
const inputYoutubeUrl = document.getElementById('youtube-url');
const inputProjectLocation = document.getElementById('project-location');
const inputProjectName = document.getElementById('project-name');

// Parametros opcionales
const inputSeparateStems = document.getElementById('separate-stems'); 
const inputTemplatePath = document.getElementById('template-flp');

// -----  MODAL ---- //
const dialog = document.getElementById("dialog");
const btnModalGuardar = document.getElementById("modal-guardar");
const btnCerrarModal = document.getElementById("cerrar-modal");
const inputProyectoConfig = document.getElementById("dialog-input-proyecto"); 
const inputPlantillasConfig = document.getElementById("dialog-input-plantillas"); 
const browseInputArrayConfig = document.querySelectorAll("button[data-browse-config]");

/// ------------------------------------  ///
///            EVENT LISTENERS            /// 
/// ------------------------------------  ///

// ----- DOMContentLoaded ---- //
document.addEventListener("DOMContentLoaded", (e) => {
  const uuid = crypto.randomUUID();
  document.getElementById("project-name").value = uuid;
});

// ----- CERRAR MODAL ---- //
btnCerrarModal.addEventListener("click", (e) => {
  cerrar_dialog();
});

// ----- GUARDAR MODAL ---- //
btnModalGuardar.addEventListener('click', () => {
  guardar_configuracion();
});

// ----- WINDOW ONCLICK ---- //
window.addEventListener("click", (e) => {
  // Cerrar dialog si se hace click fuera
  e.target.tagName == "DIALOG" && cerrar_dialog();
});

// ----- FORM SUBMIT ---- //

document.getElementById('form').addEventListener('submit', function(event) {
  event.preventDefault();

  // Parametros obligatorios 
  const youtubeUrl = inputYoutubeUrl.value;
  const projectLocation = inputProjectLocation.value;
  const projectName = inputProjectName.value;

  // Parametros opcionales
  const separateStems = inputSeparateStems.checked; 
  const templatePath = inputTemplatePath.value;


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
///      LLAMADA BACKEND FILE DIALOG      /// 
/// ------------------------------------  ///

document.getElementById('browse-location').addEventListener('click', (e) => {
  ipcRenderer.send('open-directory-dialog', 'project-location');
});

document.getElementById('browse-flp-template').addEventListener('click', (e) => {
  ipcRenderer.send('open-file-dialog', ['flp']);
});

// Botones "Browse" del modal de configuración.
browseInputArrayConfig.forEach(browseInput => {  
  browseInput.addEventListener('click', (e) => {
    console.log(e.target.closest("div").getElementsByTagName("INPUT")[0])
    const inputConfigId = e.target.closest("div").getElementsByTagName("INPUT")[0].id;
    ipcRenderer.send('open-directory-dialog', inputConfigId);
  });
});

/// ------------------------------------  ///
///      BACKEND FILE DIALOG RETORNO      /// 
/// ------------------------------------  ///

ipcRenderer.on('selected-directory', (event, args) => {

  const {path} = args;
  const {input_id} = args;

  document.getElementById(input_id).value = path; 
  
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
///           MODAL CONFIGURACIÓN         /// 
/// ------------------------------------  ///


function cerrar_dialog()
{
  // Swal.fire({
  //   title: '¿Quieres guardar el valor del parámetro?',
  //   confirmButtonText: 'Sí',
  //   cancelButtonText: 'No',
  //   showCancelButton: true,
  // }).then((result) => {
  //   console.log(result)
  //     if (result.isConfirmed) {
  //       guardar_configuracion();
  //     }
  // });

  window.dialog.close();
}

function guardar_configuracion()
{
  const valorProyecto = inputProyectoConfig.value;
  const valorPlantillas = inputPlantillasConfig.value;

  const JSON_Config = {
    "ruta_proyecto": valorProyecto,
    "ruta_plantillas": valorPlantillas
  }

  ipcRenderer.send('cambiar-config-valores', JSON_Config);

  // Cerrar el modal
  cerrar_dialog();
}


/// ------- BACKEND MODAL CONFIGURACIÓN ------  ///

ipcRenderer.on('mostrar-modal', (event, valoresConfiguracion) => {  
  
  // Rellenar los inputs con los datos de configuración actual.
  const {ruta_proyecto} = valoresConfiguracion;
  const {ruta_plantillas} = valoresConfiguracion;

  inputProyectoConfig.value = ruta_proyecto;
  inputPlantillasConfig.value = ruta_plantillas;

  // Mostrar el modal
  window.dialog.showModal();
});

ipcRenderer.on('configuracion-guardada', (event, config) => {
  
  Swal.fire("La configuración se ha guardado con éxito!"); 
  
  let {jsonConfig} = config 
  
  jsonConfig = JSON.parse(jsonConfig);

  // Poner la nueva configuración en los inputs.
  inputProjectLocation.value = jsonConfig["ruta_proyecto"];
  inputTemplatePath.value = jsonConfig["ruta_plantillas"];
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