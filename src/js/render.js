const { ipcRenderer, shell } = require('electron');
const Swal = require('sweetalert2');

const { OUTPUT_STATES } = require('../js/constants');
const changeEvent = new Event('change'); // Manually trigger the change event

// Dark theme configuration for SweetAlert2
const darkThemeOptions = {
  background: '#1e1e1e',
  color: '#ffffff',
  confirmButtonColor: '#d9b063',
  cancelButtonColor: '#d33',
};

/// ------------------------------------  ///
///               HTML NODES              /// 
/// ------------------------------------  ///

const pythonOutputContainer = document.getElementById("python-output-container");

// -----  MAIN INPUTS ---- //

// Required parameters 
const inputYoutubeUrl = document.getElementById('youtube-url');
const inputProjectLocation = document.getElementById('project-location');
const inputProjectName = document.getElementById('project-name');

// Optional parameters
const inputSeparateStems = document.getElementById('separate-stems'); 
const inputTemplatePath = document.getElementById('template-flp');
const stemOptions = document.getElementById("stems-options");

function updateStemOptionsVisibility() {
    if (inputSeparateStems.checked) {
        stemOptions.style.display = 'flex';
    } else {
        stemOptions.style.display = 'none';
    }
}

// Set the initial state (in case configuration remembers the value)
document.addEventListener("DOMContentLoaded", () => {
    updateStemOptionsVisibility();

    const advancedToggle = document.getElementById("advanced-toggle");
    const advancedOptionsContent = document.getElementById("advanced-options-content");
    if (advancedToggle && advancedOptionsContent) {
      // Ensure advanced options content is hidden by default.
      advancedOptionsContent.style.display = 'none';
      advancedToggle.addEventListener("click", () => {
        const icon = advancedToggle.querySelector("i");
        if (advancedOptionsContent.style.display === 'none' || advancedOptionsContent.style.display === '') {
          advancedOptionsContent.style.display = 'block';
          if (icon) {
            icon.classList.remove("fa-chevron-down");
            icon.classList.add("fa-chevron-up");
          }
        } else {
          advancedOptionsContent.style.display = 'none';
          if (icon) {
            icon.classList.remove("fa-chevron-up");
            icon.classList.add("fa-chevron-down");
          }
        }
      });
    }
});
inputSeparateStems.addEventListener("change", updateStemOptionsVisibility);

// -----  MODAL ---- //
const btnModalSave = document.getElementById("modal-save");
const btnModalClose = document.getElementById("close-modal");
const inputProjectConfig = document.getElementById("default-project-path"); 
const inputTemplatesConfig = document.getElementById("dialog-default-templates-path"); 
const browseInputArrayConfig = document.querySelectorAll("button[data-browse-config]");

// -----  CONTAINERS ---- //
const progressDialogContainer = document.getElementById("progress-dialog-container");
const youtubeInputGroup = document.getElementById("youtube-input-group");
const projectNameInputGroup = document.getElementById("project-name-input-group");
const directoryInputGroup = document.getElementById("directory-input-group");

/// ------------------------------------  ///
///           DISPLAY THE VERSION         /// 
/// ------------------------------------  ///

ipcRenderer.invoke('get-app-version').then(version => {
  document.getElementById('app-version').innerText = `v${version}`;
});

/// ------------------------------------  ///
///            EVENT LISTENERS            /// 
/// ------------------------------------  ///

// ----- DOMContentLoaded ---- //
document.addEventListener("DOMContentLoaded", (e) => {

  // Load the project path parameter
  ipcRenderer.send("get-configuration");
});

ipcRenderer.on('get-configuration', (event, JSON_Config) => {
  setupParameters(JSON_Config)
});

function setupParameters(JSON_Config) {

  const {project_path, separate_stems} = JSON_Config
  
  if (!project_path) {
    window.dialog.showModal();
  } else {
    inputProjectLocation.value = project_path;
  } 

  // Add empty value to templates select
  insertOption('');
  document.querySelector("#template-flp option").textContent = '(empty template)';
  
  // Load templates combo
  loadTemplates();

  // Set the default value of separate stems and update the panel visibility
  inputSeparateStems.checked = separate_stems;
  updateStemOptionsVisibility();
}

// ----- OPEN LINKS IN BROWSER ---- //
document.addEventListener('click', function(e) {
  const target = e.target.closest('a');
  if (target && target.target === '_blank' && target.href.startsWith('http')) {
    e.preventDefault();
    shell.openExternal(target.href);
  }
});

// ----- MODAL CLOSE ---- //
btnModalClose.addEventListener("click", (e) => {
  closeDialog();
});

// ----- SAVE MODAL ---- //
btnModalSave.addEventListener('click', () => {
  saveConfiguration();
});

// ----- WINDOW ONCLICK ---- //
window.addEventListener("click", (e) => {
  // Close dialog if clicked outside
  e.target.tagName == "DIALOG" && closeDialog();
});

// ----- SAVE STEMS DEFAULT VALUE ---- //
inputSeparateStems.addEventListener("change", () => {
  saveStemsValue();
})

// Toggle the display of stems options when 'Separate stems' is changed.
inputSeparateStems.addEventListener("change", () => {
  const stemsOptions = document.getElementById("stems-options");
  if (inputSeparateStems.checked) {
    stemsOptions.style.display = 'flex';
  } else {
    stemsOptions.style.display = 'none';
  }
});

// ----- VALID URL VALIDATION ---- //
inputYoutubeUrl.addEventListener("change", () => {

  const url = inputYoutubeUrl.value;
  const isValidURL = validateYoutubeURL(url);
  const warning_p = youtubeInputGroup.querySelector(".warning");

  // If the field is empty, remove the warning
  // If the warning message is already displayed and the user enters a valid value, remove the warning
  if (warning_p && isValidURL || !url) {
    // Add the animation class
    warning_p.classList.add("fade-out");

    // Wait for the animation to finish and remove the element from the DOM
    warning_p.addEventListener('animationend', function() {
      // Remove the element from the DOM
      warning_p.remove();
    }, { once: true });

    return;
  }

  // If the URL is invalid and the warning is not already displayed.
  if (!isValidURL && !warning_p)
  {
    const warning_p = document.createElement("p");
    warning_p.textContent = "⚠️ The URL doesn't seem to be from Youtube!"
    warning_p.setAttribute("class", "warning slide-fade-in");

    youtubeInputGroup.append(warning_p);
  }

})

// ----- VALIDATE PROJECT NAME ---- //
inputProjectLocation.addEventListener("change", () => {
  validateProjectName();
  validateDirectory();
});

inputProjectName.addEventListener("change", () => {
  validateProjectName();
  validateDirectory();
});

function validateDirectory() {
  const projectPath = inputProjectLocation.value;
  ipcRenderer.send("validate-directory", projectPath);
}

function validateProjectName() {

  const projectPath = inputProjectLocation.value;
  const directory = inputProjectName.value;

  if (!projectPath || !directory) {
    return
  }
  
  ipcRenderer.send("validate-project-name", {
    projectPath: projectPath,
    directory: directory
  });
}

ipcRenderer.on('validate-directory', (event, response) => {
  const parent = directoryInputGroup;
  if (!response.success) {
    displayError(response.errorMessage, parent);
  } else {
    removeError(parent);
  }
});

ipcRenderer.on('validate-project-name', (event, response) => {
  const parent = projectNameInputGroup;
  if (!response.success) {
    displayError(response.errorMessage, parent);
  } else {
    removeError(parent);
  }
});

function displayError(mesage, parent) {
  removeError(parent);
  const error_p = document.createElement("p");
  error_p.innerHTML = mesage;
  error_p.className = "error slide-fade-in";
  parent.appendChild(error_p);
}

function removeError(parent) {
  const error_p = parent.querySelector(".error");

  // If the directory does not exist and an error message is being displayed, remove it.
  if (error_p) {
    // Add the animation class
    error_p.classList.add("fade-out");
    
    // Wait for the animation to finish and remove the element from the DOM
    error_p.addEventListener('animationend', function() {
      // Remove the element from the DOM
      error_p.remove();
    }, { once: true });
  }
}

// ----- FORM SUBMIT ---- //

document.getElementById('form').addEventListener('submit', function(event) {
  event.preventDefault();

  // Required parameters 
  const youtubeUrl = inputYoutubeUrl.value;
  const projectLocation = inputProjectLocation.value;
  const projectName = inputProjectName.value;

  // Field validations
  if (!youtubeUrl.trim() || !projectLocation.trim()  || !projectName.trim() )
  {
    let emptyFields = "The following fields are required: ";

    emptyFields = !youtubeUrl.trim() ? `${emptyFields} <br /> - Youtube URL ` : emptyFields;
    emptyFields = !projectLocation.trim() ? `${emptyFields} <br /> - Project Location ` : emptyFields;
    emptyFields = !projectName.trim() ? `${emptyFields} <br /> - Project Name ` : emptyFields;

    throwError('Validation Error', emptyFields);
    return;
  }
  
  const error_p = projectNameInputGroup.querySelector(".error");
  if (error_p)
  {
    throwError('Validation error', `${error_p.innerHTML} <br/> Change the project location or choose a unique project name.`);
    return
  } 

  // Optional parameters
  const separateStems = inputSeparateStems.checked; 
  const templatePath = inputTemplatePath.value;


  // Python script's arguments
  const args = [projectLocation, youtubeUrl, projectName];
  
  if (separateStems) {
    args.push('--separate-stems');
  }

  if (templatePath) {
    args.push(`--template-path=${templatePath}`);
  }

  // Read additional stems options if separate stems is active.
  if (inputSeparateStems.checked) {
    const audioExtension = document.getElementById("audio-extension").value;
    const threads = document.getElementById("threads").value;
    // Append these to your args array or configuration object.
    args.push(`--audio-extension=${audioExtension}`);
    args.push(`--threads=${threads}`);
  }

  // Add UUID to identify each process
  const UUID = crypto.randomUUID();

  const output = {
    args: args,
    UUID: UUID
  }
  
  // Execute the python script
  ipcRenderer.send('run-python-script', output);

  // Clear inputs
  inputYoutubeUrl.value = "";
  inputProjectName.value = "";

  // ---- Insert logs ---- //

  // If the log container is hidden show it
  document.querySelector(".progress-div").classList.remove("hide")
  
  // Create the button to display the log modal
  const modalButton = document.createElement("p");
  const textNode = document.createTextNode(projectName);
  modalButton.append(textNode);
  modalButton.setAttribute("data-dialog", UUID);
  modalButton.classList.add("push-button-3d");
  pythonOutputContainer.appendChild(modalButton);

  // Show the modal with an animation
  modalButton.classList.add("fade-in");

  modalButton.addEventListener("click", () => {
    const data_dialog = modalButton.getAttribute("data-dialog");
    const dialog = document.querySelector(`dialog[data-uuid='${data_dialog}']`)
    dialog.showModal();
  });

  // ---- Create the modal for the logs ---- //

  const dialog_template = document.querySelector("dialog[data-template-dialog]");
  const dialog = dialog_template.cloneNode(true);

  dialog.setAttribute("data-uuid", UUID);

  const modalTitle = dialog.getElementsByClassName("progress-title")[0];
  modalTitle.textContent = projectName;

  dialog.getElementsByClassName("x")[0].addEventListener("click", () => {
    closeDialog();
  });

  progressDialogContainer.appendChild(dialog);
  insertPythonOutput("Loading script...", UUID, "#747474")
  dialog.showModal();

});

/// ------------------------- ///
///      FILE DIALOG CALL     /// 
/// ------------------------- ///

document.getElementById('browse-location').addEventListener('click', (e) => {
  ipcRenderer.send('open-directory-dialog', 'project-location');
});

document.getElementById('browse-flp-template').addEventListener('click', (e) => {
  ipcRenderer.send('open-file-dialog', ['flp']);
});

// "Browse" buttons in the configuration modal.
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
  const {directoryPath, input_id} = args;
  const input = document.getElementById(input_id); 
  input.value = directoryPath; 
  input.dispatchEvent(changeEvent); // Executes the change event
});

ipcRenderer.on('selected-file', (event, filePath) => {
  insertOption(filePath);
});

/// ------------------------------------  ///
///           MODAL CONFIGURATION         /// 
/// ------------------------------------  ///

function closeDialog() {
  document.querySelector("dialog[open]").close();
}

function saveConfiguration()
{
  const projectPath = inputProjectConfig.value;
  const templatesPath = inputTemplatesConfig.value;

  const JSON_Config = {
    "project_path": projectPath,
    "templates_path": templatesPath
  }

  ipcRenderer.send('change-config', JSON_Config);

  closeDialog();
}

function saveStemsValue() {
  const value = inputSeparateStems.checked;
  ipcRenderer.send('save-stems-value', value)
}

/// ------- BACKEND MODAL CONFIGURATION ------  ///

ipcRenderer.on('show-modal', (event, currentConfig) => {  
  
  // Fill the inputs with the current configuration data.
  const {project_path} = currentConfig;
  const {templates_path} = currentConfig;

  inputProjectConfig.value = project_path;
  inputTemplatesConfig.value = templates_path;

  // Show the configuration modal
  window.dialog.showModal();
});

ipcRenderer.on('config-saved', (event, config) => {
  
  Swal.fire({
    text: "The settings have been saved successfully!",
    icon: "success",
    ...darkThemeOptions
  });
  
  let {jsonConfig} = config 
  
  jsonConfig = JSON.parse(jsonConfig);

  // Set the new configuration values in the inputs
  inputProjectLocation.value = jsonConfig["project_path"];
  inputTemplatePath.value = jsonConfig["templates_path"];

  // Load the templates of the new configuration
  loadTemplates()
});

/// ---------------------------  ///
///         PYTHON OUTPUT        /// 
/// ---------------------------  ///

ipcRenderer.on('python-script-output', (event, data) => {

  const {text, UUID, status} = data;
  let textColor;

  switch (status) {
    case OUTPUT_STATES.ERROR:
      textColor = "#c52828";
      break
    case OUTPUT_STATES.INFO:
      textColor = "#14bef3";
      break
    case OUTPUT_STATES.SUCCESS:
      textColor = "#5dc52a";
      break
    default: 
      textColor = "white";
  }

  insertPythonOutput(text, UUID, textColor);
});

ipcRenderer.on('block-ui', (event, shouldBlock) => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = (shouldBlock ? 'block' : 'none');
  }
});

/// ----------------------  ///
///        UTILITIES        /// 
/// ----------------------  ///

ipcRenderer.on('client-log', (event, message) => {
  console.log("Client log:", message);
});

ipcRenderer.on('generic-error', (event, err) => {
  throwError('Error', err)
});

function throwError(title, err)
{
  Swal.fire({
    title: title,
    html: `<p>${err}</p>`,
    icon: "error",
    ...darkThemeOptions
  });
}

function insertPythonOutput(mesage, UUID, color)
{
  const dialog = document.querySelector(`dialog[data-uuid='${UUID}']`)
  const div = dialog.querySelector(".body")

  const p = document.createElement("p");
  const nodo = document.createTextNode(mesage);

  p.appendChild(nodo);
  p.setAttribute("style", `color:${color};`) 

  div.appendChild(p);
  div.scrollTop = div.scrollHeight
}

function loadTemplates(){
  ipcRenderer.send('ask-templates-list');
}

ipcRenderer.on('get-templates-list', (event, json_arrays) => {
  
  const { filesPaths } = json_arrays;

  filesPaths.forEach( filePath => {
    insertOption(filePath);
  })
});


function insertOption(filePath)
{
  const select = inputTemplatePath;

  // Create option element
  var option = document.createElement("option");

  // Split the string by backslashes
  let parts = filePath.split('\\');
  const fileName = parts[parts.length - 1];

  // Set the text and value of the new option element
  option.text = fileName;
  option.value = filePath;

  // Add the new option element to the select
  select.appendChild(option);

  // Select the element we just added
  select.selectedIndex = select.options.length-1;
}

function validateYoutubeURL(url) {
  if (url) {
    var regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    var match = url.match(regExp);
    if (match) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}