import os
import sys
import argparse

from pytube import YouTube
from moviepy.editor import AudioFileClip
import moviepy.config as mp_config
import urllib.parse

import pyflp

import demucs.separate
import shlex

# Variables globales
url = None
project_location = None
project_name = None
separate_stems = None
template_path = None
project_path = None

original_stderr = None


def sacar_mensaje(mensaje, error=False):

    canal_salida = sys.stderr if error else sys.stdout

    print(mensaje, file=canal_salida)
    sys.stdout.flush()

def es_video_valido(url):
    """Verifica si la URL proporcionada es una URL válida de YouTube."""
    parsed_url = urllib.parse.urlparse(url)
    if parsed_url.scheme not in ("http", "https"):
        return False
    if parsed_url.netloc not in ("www.youtube.com", "youtube.com", "youtu.be"):
        return False
    return True


# Función para descargar solo audio y convertirlo a MP3
# Modificar la función de descarga para incluir la separación de stems
def download_video():
    
    try:
        sacar_mensaje("Empezando la descarga del audio...")

        yt = YouTube(url)
        title = yt.title
        title = ''.join(char for char in title if char.isalnum() or char in " -_")

        # Crear las carpetas de los proyectos
        assets_path = os.path.join(project_path, 'assets')
        os.makedirs(assets_path, exist_ok=True)

        # Guardar rutas y objeto de descarga
        audio_stream = yt.streams.filter(only_audio=True).first()
        audio_file_path = audio_stream.download(output_path=assets_path, filename=f"{title}.mp4")
        mp3_path = os.path.join(assets_path, f'{title}.mp3')

        # Redirigir la salida de MoviePy a stdout
        global original_stderr 
        original_stderr = sys.stderr
        sys.stderr = sys.stdout

        # Descargar el audio
        audio_clip = AudioFileClip(audio_file_path)

        audio_clip.write_audiofile(mp3_path)
        audio_clip.close()

        # Restaurar stderr
        sys.stderr = original_stderr

        # Borrar el .mp4
        os.remove(audio_file_path)
        
        # Crear la plantilla FLP
        if template_path:
            create_flp()

        # Abrir la carpeta donde hemos metido todo
        open_folder(project_path)

        # Verifica si el checkbox de separación de stems está marcado
        if separate_stems: 
            sacar_mensaje("Se ha creado el proyecto. Se acaba de iniciar el proceso de extraer los stems. Para ver el progreso mira la terminal. Si quieres puedes crear otro proyecto miestras tanto (te va a ralentizar el otro).")
            separate_audio(assets_path, mp3_path)
        else: 
            sacar_mensaje("Se ha creado el proyecto. Si quieres puedes crear otro.")

    except Exception as e:
        sacar_mensaje(f"Error al descargar el audio: {str(e)}", error=True)


# Añadir esta función que proporcionaste para separar los stems
def separate_audio(assets_path, audio_path):

    os.makedirs(assets_path, exist_ok=True) # A priori debería de existir siempre

    # Aquí se define el modelo, el input y la salida.
    command = f'--mp3 -n mdx_extra --out "{assets_path}" "{audio_path}"'
    args = shlex.split(command)

    # Proceder a la separación de los stems.
    sacar_mensaje("Extracción de stems en progreso...")
    sys.stderr = sys.stdout
    demucs.separate.main(args)
    sys.stderr = original_stderr
    sacar_mensaje(f"La separación ha terminado. Los stems se han guardado en: {assets_path}")

    open_folder(assets_path)

# Función para abrir el directorio en el explorador de archivos
def open_folder(path):
    os.startfile(path)

def validar_nombre_proyecto(name):
    # Caracteres no permitidos en Windows para nombres de carpetas y archivos en windows.
    invalid_chars = '<>:"/\\|?*'
    if any(char in invalid_chars for char in name):
        raise ValueError("El nombre del proyecto contiene caracteres no permitidos por Windows.\n Los caracteres no permitidos son: <>:\"/\\|?*")
        
    if name.endswith('.') or name.endswith(' '):
        raise ValueError("Nombre del Proyecto Inválido", "El nombre del proyecto no puede terminar con un punto o un espacio.")


# Crear el proyecto de FL Studio
def create_flp():
    if template_path:
        if os.path.isfile(template_path) and template_path.endswith('.flp'):

            project = pyflp.parse(template_path)
            pyflp.save(project, os.path.join(project_path, f'{project_name}.flp'))

            sacar_mensaje(f"Usando plantilla válida desde {template_path} para crear el proyecto")
        else:
            raise ValueError(f"La plantilla proporcionada no es un archivo .flp válido: {template_path}")


def mostrar_parametros():
    sacar_mensaje(f'Url: {url} \n')
    sacar_mensaje(f'Proyect Location: {project_location} \n')
    sacar_mensaje(f'Proyect Name: {project_name} \n')
    sacar_mensaje(f'Separate stems: {separate_stems} \n')
    sacar_mensaje(f'Template Path: {template_path} \n')

    
def main(args):

    # Configuración de codificación UTF-8 para stdout y stderr
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

    # Validar que se han introducido todos los campos obligatorios.
    if not args.url or not args.project_location or not args.project_name:
        raise ValueError("Inserte los campos obligatorios")

    # Poner los parametros en variables globales.
    global url
    global project_location
    global project_name
    global separate_stems
    global template_path
    global project_path

    url = args.url
    project_location = args.project_location
    project_name = args.project_name
    separate_stems = args.separate_stems
    template_path = args.template_path
    project_path = os.path.join(project_location, project_name)
    
    # Validar que el nombre del proyecto no tenga caracteres no permitidos por Windows.
    validar_nombre_proyecto(project_name)

    # Verificar si el directorio de destino ya existe (No puede existir)
    if os.path.exists(project_path):
        raise FileExistsError(f"El directorio de destino '{project_path}' ya existe. Por favor, elige un nombre de proyecto diferente o cambia la ubicación del proyecto.")
        
    # --  Empezar con el proceso de descarga -- #
    try:
        download_video()
    except ValueError as ve:
        sacar_mensaje(f"Error de validacion: {str(ve)}", error=True)

    except Exception as e:
        sacar_mensaje(f"Error durante la descarga o procesamiento del video: {str(e)}", error=True)

    return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Script para descargar y procesar videos de YouTube")
    parser.add_argument("project_location", help="Ruta del directorio de destino")
    parser.add_argument("url", help="URL del video de YouTube")
    parser.add_argument("project_name", help="Nombre del proyecto, usado como nombre del directorio")
    parser.add_argument("--separate-stems", action='store_true', help="Indica si se deben separar los stems del audio")
    parser.add_argument("--template-path", help="Ruta de la plantilla .flp a usar para el proyecto")

    args = parser.parse_args()
    main(args)