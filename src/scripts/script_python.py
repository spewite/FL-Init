import os
import sys
import argparse

import pyflp.pattern
import pyflp.project
from pytubefix import YouTube
from moviepy.editor import AudioFileClip
import urllib.parse

import pyflp

import demucs.separate
import shlex

# Song Key
import librosa
import numpy as np

# Variables globales
url = None
project_location = None
project_name = None
separate_stems = None
template_path = None
project_path = None
youtube_title = None

original_stderr = None

def sacar_mensaje(mensaje, error=False):

    canal_salida = sys.stderr if error else sys.stdout

    print(mensaje, file=canal_salida)
    sys.stdout.flush()

def es_video_valido():
    """Verifica si la URL proporcionada es una URL válida de YouTube."""
    parsed_url = urllib.parse.urlparse(url)
    if parsed_url.scheme not in ("http", "https"):
        return False
    if parsed_url.netloc not in ("www.youtube.com", "youtube.com", "youtu.be"):
        return False
    return True



def detect_key(audio_path):
    # Cargar la canción
    y, sr = librosa.load(audio_path)
    
    # Extraer el cromagrama con la transformada CQT
    chromagram = librosa.feature.chroma_cqt(y=y, sr=sr)
    
    # Promediar a lo largo del tiempo para obtener un vector representativo (12 valores)
    chroma_mean = np.mean(chromagram, axis=1)
    
    best_score = -np.inf
    best_key = None
    best_mode = None

    # Evaluar para cada tonalidad mayor
    for i in range(12):
        profile_rot = rotate_profile(major_profile, i)
        score = cosine_similarity(chroma_mean, profile_rot)
        if score > best_score:
            best_score = score
            best_key = notes[i]
            best_mode = 'Major'

    # Evaluar para cada tonalidad menor
    for i in range(12):
        profile_rot = rotate_profile(minor_profile, i)
        score = cosine_similarity(chroma_mean, profile_rot)
        if score > best_score:
            best_score = score
            best_key = notes[i]
            best_mode = 'Minor'
    
    return f"{best_key} {best_mode} (Score: {round(best_score, 2)})"


# Función para descargar solo audio y convertirlo a MP3
# Modificar la función de descarga para incluir la separación de stems
def download_video():
    
    try:
        sacar_mensaje("Empezando la descarga del audio...")

        yt = YouTube(url)
        title = yt.title
        title = ''.join(char for char in title if char.isalnum() or char in " -_")
        global youtube_title
        youtube_title = title 

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
        
        # Get key and bpm of the song
        key = detect_key(mp3_path)
        bpm = get_song_bpm(mp3_path)

        # Create file with original song info
        create_info_file(key, bpm)

        # Crear la plantilla FLP
        if template_path:
            create_flp(key, bpm)

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

def create_info_file(key, bpm):
    
    try:
        with open(os.path.join(project_path, "Original Song Info.txt"), "w") as file:
            file.write(f"Youtube title: {youtube_title}")
            file.write("\nOriginal Song Info: ")
            file.write("\n  -> Key: " + key)
            file.write("\n  -> BPM: " + str(bpm))
    except Exception as err:
        sacar_mensaje(f"Error creating the original song info file: {err}")
        

def separate_audio(assets_path, audio_path):
    # Definir la ruta base donde queremos que queden los stems
    stems_base = os.path.join(assets_path, "stems")
    os.makedirs(stems_base, exist_ok=True)

    # Ejecutar demucs con la ruta de salida en stems_base.
    # Esto generará una estructura: stems_base/mdx_extra/nombre_del_audio/(los 4 archivos)
    command = f'--mp3 -n mdx_extra --out "{stems_base}" "{audio_path}"'
    args = shlex.split(command)

    sacar_mensaje("Extracción de stems en progreso...")
    sys.stderr = sys.stdout
    demucs.separate.main(args)
    sys.stderr = original_stderr
    sacar_mensaje("La separación ha terminado. Moviendo los archivos a la carpeta stems...")

    # Mover los archivos desde la estructura generada por demucs a la carpeta stems_base.
    move_stems_up(stems_base)

    sacar_mensaje(f"Los stems se han movido a: {stems_base}")
    open_folder(stems_base)

def move_stems_up(stems_base):
    """
    Busca la carpeta mdx_extra dentro de stems_base y mueve los archivos
    de la subcarpeta (que corresponde al nombre del audio) a stems_base.
    """
    mdx_extra_dir = os.path.join(stems_base, "mdx_extra")
    if not os.path.exists(mdx_extra_dir):
        sacar_mensaje("No se encontró la carpeta 'mdx_extra'. Verifica la salida de demucs.")
        return

    # Recorrer cada carpeta dentro de mdx_extra (normalmente solo habrá una)
    for subfolder in os.listdir(mdx_extra_dir):
        subfolder_path = os.path.join(mdx_extra_dir, subfolder)
        if os.path.isdir(subfolder_path):
            for filename in os.listdir(subfolder_path):
                src_file = os.path.join(subfolder_path, filename)
                dest_file = os.path.join(stems_base, filename)
                # Mover el archivo a la carpeta stems_base
                os.rename(src_file, dest_file)
            # Una vez movidos los archivos, eliminar la carpeta vacía
            os.rmdir(subfolder_path)
    # Eliminar la carpeta mdx_extra si ya está vacía
    os.rmdir(mdx_extra_dir)

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
def create_flp(key, bpm):
    if template_path:
        if os.path.isfile(template_path) and template_path.endswith('.flp'):

            project = pyflp.parse(template_path)
            project.comments = f"Original Song: {key} | {bpm}BPM"
            pyflp.save(project, os.path.join(project_path, f'{project_name}.flp'))

            sacar_mensaje(f"Usando plantilla válida desde {template_path} para crear el proyecto")
        else:
            raise ValueError(f"La plantilla proporcionada no es un archivo .flp válido: {template_path}")


def get_song_bpm(file_path):
    # Cargar el archivo de audio
    y, sr = librosa.load(file_path)
    
    # Calcular la envolvente de onset (detección de inicios de notas/golpes)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    
    # Estimar el tempo (BPM)
    tempo, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
    
    # Usar np.round en lugar de round para valores NumPy
    bpm = int(np.round(tempo, 0))
    
    return bpm

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

    try:
        # Verificar si el URL es de Youtube. 
        # Lo tengo comentado a posta. Si el video no es valido va a lanzar un error el script igualmente.
        # if not es_video_valido():
        #     raise ValueError("El URL debe ser de Youtube")

        # Verificar si el directorio de destino ya existe (No puede existir)
        if os.path.exists(project_path):
            raise FileExistsError(f"El directorio de destino '{project_path}' ya existe. Por favor, elige un nombre de proyecto diferente o cambia la ubicación del proyecto.")
        
    # --  Empezar con el proceso de descarga -- #
        download_video()
    except ValueError as ve:
        sacar_mensaje(f"Error de validacion: {str(ve)}", error=True)

    except Exception as e:
        sacar_mensaje(f"Error durante la descarga o procesamiento del video: {str(e)}", error=True)

    return 1

# ---- FUNCTIONS TO GET SONG KEY ---- # 

# Función para calcular la similitud del coseno
def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# Perfiles de Krumhansl-Kessler (valores empíricos)
major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

# Notas musicales (do, do#, re, re#, mi, fa, fa#, sol, sol#, la, la#, si)
notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def rotate_profile(profile, n):
    """Rota el perfil 'n' posiciones (para transponer la plantilla)"""
    return np.roll(profile, n)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Script para descargar y procesar videos de YouTube")
    parser.add_argument("project_location", help="Ruta del directorio de destino")
    parser.add_argument("url", help="URL del video de YouTube")
    parser.add_argument("project_name", help="Nombre del proyecto, usado como nombre del directorio")
    parser.add_argument("--separate-stems", action='store_true', help="Indica si se deben separar los stems del audio")
    parser.add_argument("--template-path", help="Ruta de la plantilla .flp a usar para el proyecto")

    args = parser.parse_args()
    main(args)

