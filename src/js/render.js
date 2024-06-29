const { ipcRenderer } = require('electron');
const { copyFileSync, stat } = require('original-fs');
const Swal = require('sweetalert2');

const { ESTADOS_SALIDA } = require('../js/constants');


/// ------------------------------------  ///
///               NODOS HTML              /// 
/// ------------------------------------  ///

const pythonOutputContainer = document.getElementById("python-output-container");


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

const progressDialogContainer = document.getElementById("progress-dialog-container");


/// ------------------------------------  ///
///            EVENT LISTENERS            /// 
/// ------------------------------------  ///

// ----- DOMContentLoaded ---- //
document.addEventListener("DOMContentLoaded", (e) => {

  // Añadir un valor vacio al select
  insertar_option('');
  
  // Cargar el combo de plantillas FLP
  cargar_plantillas();

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

  // Validacion de campos
  if (!youtubeUrl.trim() || !projectLocation.trim()  || !projectName.trim() )
  {
    let camposSinRellenar = "Los siguientes campos son obligatorios: ";

    camposSinRellenar = !youtubeUrl.trim() ? `${camposSinRellenar} \n- URL de Youtube ` : camposSinRellenar;
    camposSinRellenar = !projectLocation.trim() ? `${camposSinRellenar} \n- Ubicación del proyecto ` : camposSinRellenar;
    camposSinRellenar = !projectName.trim() ? `${camposSinRellenar} \n- Nombre del proyecto ` : camposSinRellenar;

    lanzar_error('', camposSinRellenar);
    return;
  }

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

  // Añadirle un UUID para identificar cada progreso.
  const UUID = crypto.randomUUID();

  const salida = {
    args: args,
    UUID: UUID
  }
  
  // Llama a la función para ejecutar el script de Python
  ipcRenderer.send('run-python-script', salida);
  // Swal.fire("Ejecutando script");

  // ---- VACIAR INPUTS ---- //

  inputYoutubeUrl.value = "";
  inputProjectName.value = "";

  // ---- INSERTAR TEXTO DEL LOG ---- //

  // Si el contenedor del log esta oculto se muestra.
  pythonOutputContainer.parentNode.style.display = "block"
  pythonOutputContainer.parentNode.style.opacity = 1
  
  // Añadir el texto
  const p_salida = document.createElement("p");
  const textNode = document.createTextNode(`➜ ${projectName}`);
  p_salida.append(textNode);
  p_salida.setAttribute("data-dialog", UUID);
  pythonOutputContainer.appendChild(p_salida);

  // Añadir una clase para activar la animación
  p_salida.classList.add("fade-in");

  p_salida.addEventListener("click", () => {
    const data_dialog = p_salida.getAttribute("data-dialog");
    const dialog = document.querySelector(`dialog[data-uuid='${data_dialog}']`)
    dialog.showModal();
  });

  // ---- CREAR LA MODAL PARA EL TEXTO DEL LOG ---- //

  const dialog_template = document.querySelector("dialog[data-template-dialog]");
  const dialog = dialog_template.cloneNode(true);

  dialog.setAttribute("data-uuid", UUID);

  const pProgressTitle = dialog.getElementsByClassName("progress-title")[0];
  pProgressTitle.textContent = projectName;

  dialog.getElementsByClassName("x")[0].addEventListener("click", () => {
    cerrar_dialog();
  });

  progressDialogContainer.appendChild(dialog);
  dialog.showModal();

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
  insertar_option(filePath);
});


/// ------------------------------------  ///
///           MODAL CONFIGURACIÓN         /// 
/// ------------------------------------  ///


function cerrar_dialog()
{
  document.querySelector("dialog[open]").close();
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

ipcRenderer.on('mostrar-modal', (event, valoresConfiguracionActual) => {  
  
  // Rellenar los inputs con los datos de configuración actual.
  const {ruta_proyecto} = valoresConfiguracionActual;
  const {ruta_plantillas} = valoresConfiguracionActual;

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

  // Cargar las plantillas de la nueva configuración
  cargar_plantillas()
});

/// ------------------------------------  ///
///         BACKEND PYTHON RETORNO        /// 
/// ------------------------------------  ///

ipcRenderer.on('python-script-salida', (event, data) => {

  const {texto} = data;
  const {UUID} = data;
  const {status} = data;
  
  let color_texto = "white"; // Por defecto.

  if (status == ESTADOS_SALIDA.ERROR)
  {
    color_texto = "#c52828";
  } else if (status == ESTADOS_SALIDA.INFO)
  {
    color_texto = "#14bef3";
  } else if (status == ESTADOS_SALIDA.SUCCESS)
  {
    color_texto = "#5dc52a";
  }

  insertarPythonOutput(texto, UUID, color_texto);
});


// ipcRenderer.on('python-script-stdout', (event, data) => {
//   const stdout = data[data];
//   const {uuid} = data;

//   insertarPythonOutput(stdout, uuid, "#5dc52a");
// });

// ipcRenderer.on('python-script-error', (event, data) => {

//   const error = data[data];
//   const {uuid} = data;

//   console.error(`Python Script Error: ${error}`);
//   insertarPythonOutput(error,  uuid, "#c52828");
// });

// ipcRenderer.on('python-script-info', (event, mensaje) => {

//   const error = data[data];
//   const {uuid} = data;

//   insertarPythonOutput(mensaje, uuid, "#14bef3");
// });

/// ------------------------------------  ///
///               UTILIDADES              /// 
/// ------------------------------------  ///

ipcRenderer.on('error-generico', (event, err) => {
  lanzar_error('', err)
});

function lanzar_error(titulo, err)
{
  alert(`Error: ${err}`);
}

function insertarPythonOutput(mensaje, UUID, color)
{
  const dialog = document.querySelector(`dialog[data-uuid='${UUID}']`)
  const div = dialog.querySelector(".body")

  const p = document.createElement("p");
  const nodo = document.createTextNode(mensaje);

  p.appendChild(nodo);
  p.setAttribute("style", `color:${color};`) 

  div.appendChild(p);
}

function cargar_plantillas()
{
  ipcRenderer.send('pedir-lista-plantillas');
}

ipcRenderer.on('obtener-lista-plantillas', (event, json_arrays) => {
  
  const {rutasArchivos} = json_arrays;

  rutasArchivos.forEach( rutaArchivo => {
    insertar_option(rutaArchivo);
  })
});


function insertar_option(rutaArchivo)
{
  const select = inputTemplatePath;

  // Crea un nuevo elemento option
  var option = document.createElement("option");

  // Divide la cadena por las barras invertidas
  let partes = rutaArchivo.split('\\');
  const nombreArchivo = partes[partes.length-1];

  // Configura el texto y el valor del nuevo elemento option
  option.text = nombreArchivo;
  option.value = rutaArchivo;

  // Añade el nuevo elemento option al select
  select.appendChild(option);

  // Seleccionar el elemento que hemos añadido
  select.selectedIndex = select.options.length-1;
}