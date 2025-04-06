<p align="center">
  <img src="/icons/icon.png" alt="Logo FLInit" width="200"/>
</p>

# FL INIT

FL INIT es un script en Python diseñado para simplificar la creación de proyectos en FL Studio utilizando canciones de YouTube. Este script automatiza la descarga de audio y facilita la configuración inicial de proyectos en FL Studio. Los usuarios pueden seleccionar una plantilla .flp específica para cada proyecto y, opcionalmente, extraer los stems de las canciones.

## Características

- **Descarga de audio de YouTube**: Permite descargar canciones directamente de YouTube y guardarlas en formato MP3.
- **Creación automática de proyectos FL Studio**: Genera un archivo .flp utilizando una plantilla proporcionada por el usuario.
- **Separación de stems**: Ofrece la opción de separar los stems de la canción utilizando Demucs.
- **Gestión de configuraciones**: Usa un archivo `settings.ini`, que se crea automáticamente si no existe, para establecer rutas predeterminadas de proyectos y la ruta de las plantillas .flp.


(POR TERMINAR)
(VÉASE LA VERSIÓN LITE)[https://github.com/spewite/FLInit-Lite] 

- PYTHON ENVIRONMENT: 

Download and extract the embedded Python distribution into the "python-embed" folder.
Download the "get‑pip.py" file from https://bootstrap.pypa.io/get-pip.py and save it in the "python-embed" folder.
Open a PowerShell (or CMD) window inside the "python-embed" folder and run:
• .\python.exe get-pip.py
This bootstraps pip in your embedded distribution.
Edit the python311._pth file located in the "python-embed" folder.
• In this file, ensure that the line "import site" is uncommented so that the embedded Python loads site‑packages.
(Optional) Run:
• .\python.exe -m pip install --upgrade pip
This upgrades pip within the embedded environment.
Now install your dependencies by switching to the "Scripts" folder and running:
• pip.exe install -r ..\requirements.txt
This installs the required packages into the Lib\site‑packages directory of your embedded Python.
Update your application configuration (for example, in main.js) to use the Python executable from "python-embed" instead of a virtual environment (venv).