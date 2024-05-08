<p align="center">
  <img src="/assets/icon.ico" alt="Logo FLInit" width="200"/>
</p>

# FL INIT

FL INIT es un script en Python diseñado para simplificar la creación de proyectos en FL Studio utilizando canciones de YouTube. Este script automatiza la descarga de audio y facilita la configuración inicial de proyectos en FL Studio. Los usuarios pueden seleccionar una plantilla .flp específica para cada proyecto y, opcionalmente, extraer los stems de las canciones.

## Características

- **Descarga de audio de YouTube**: Permite descargar canciones directamente de YouTube y guardarlas en formato MP3.
- **Creación automática de proyectos FL Studio**: Genera un archivo .flp utilizando una plantilla proporcionada por el usuario.
- **Separación de stems**: Ofrece la opción de separar los stems de la canción utilizando Demucs.
- **Gestión de configuraciones**: Usa un archivo `settings.ini`, que se crea automáticamente si no existe, para establecer rutas predeterminadas de proyectos y la ruta de las plantillas .flp.

**Cómo es la intefaz:**

<p align="center">
  <img src="/docs/captura-interfaz.png" alt="Intefaz FL Init" width="750""/>
</p>

## Requisitos

- Windows 10 o 11
- Python (recomendable 3.7 o superior)
- 2GB de almacenamiento libre.
- Tener FFmpeg instalado. [Página oficial de descarga](https://ffmpeg.org/download.html) [Tutorial de descarga](https://www.youtube.com/watch?v=DMEP82yrs5g)
- Las dependencias se indican en `requirements.txt`; no obstante, no te tienes que preocupar de la instalación de los paquetes, ya que lo hace automaticamente. Si no tienes instalado ningún paquete aún es normal que te tardee mucho en instalartelos, pero solo es una única vez. 
- `requirements.txt`: 
  - `pytube==15.0.0`
  - `moviepy==1.0.3`
  - `pyflp==2.2.1`
  - `demucs==4.0.1`
  - `torch==2.3.0`
  - `torchaudio==2.3.0`

## Instalación

1. **Clonar el repositorio**: Descarga el repositorio y colócalo en un directorio definitivo.
2. **Tener Python instalado**: Asegúrate de tener Python instalado en tu sistema. Si no es así, instálalo antes de continuar. 
3. **Ejecutar el script de instalación con permisos de administrador**:
   - Abre el directorio `/dist` del proyecto y ejecuta `instalador.bat`. Este script automatiza los siguientes pasos:
     - Verifica la instalación de Python y FFmpeg en tu sistema.
     - Crea y activa un entorno virtual en la carpeta `venv` si no existe.
     - Instala las dependencias necesarias listadas en `requirements.txt`.
     - Crea accesos directos en la raíz del proyecto y en el escritorio para facilitar el acceso al script.
       
## Uso

- **Instalar la aplicación**: Como he dicho anteriormente, para instalar la aplicación tienes que ejecutar el archivo instalador.bat que se encuentra dentro de /dist. **Asegurate de tener permisos de administrador**.
- **Ejecutar la aplicación**: Para abrir la aplicación tienes que usar el acceso directo creado en el escritorio, o en la raiz del repositorio. Al ejecutar el programa, se abrirá una terminal donde se mostrarán las barras de progreso de la descarga y la separación de stems junto con la interfaz gráfica para indicarle los parámetros.
- **Rellenar los campos**: Tendrás que introducir la URL de YouTube, la ubicación del proyecto, el nombre del proyecto y opcionalmente la plantilla .flp que deseas usar (si no se indica nada no creará el archivo .flp). Al rellenar todos los campos, podrás iniciar la descarga. También hay un checkbox opcional para que separe los stems. Ten en cuenta que este proceso utiliza IA (Demucs) y que la velocidad va a variar dependiendo de la GPU. En mi caso, un portátil con una gráfica integrada, me tarda 5 mins.
- **Configuración de la ruta de las plantillas**: Si no te aparece ningún valor en el menú desplegable ten en cuenta que las plantillas las coge de la ruta que tengas en Configuración>Cambiar ubicación de las plantillas FLP.
- **Descarga**: Cuando le das al botón “Descargar”, te creará el directorio que se indica en el label, donde estarán el archivo de FL Studio junto con el audio en formato mp3 (bajo el directorio `/assets`). Si has seleccionado la extracción de los stems, se guardarán en `assets/mdx_extra/`. Ten en cuenta que no se creará ningún stem hasta que se terminen todos. 

## Contribuir

Si deseas contribuir al proyecto, puedes enviar pull requests o abrir issues en este repositorio para sugerir mejoras o reportar errores.

## Contacto

Si tienes preguntas, comentarios o sugerencias, no dudes en ponerte en contacto conmigo:

- GitHub: [spewite](https://github.com/spewite/)
- Twitter: [@iizetaa](https://twitter.com/iizetaa)

