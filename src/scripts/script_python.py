import os
import shutil
import sys
import argparse 
import stat

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
        sacar_mensaje("Starting audio download...")

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
        create_flp(key, bpm)

        # Abrir la carpeta donde hemos metido todo
        open_folder(project_path)

        # Verifica si el checkbox de separación de stems está marcado
        if separate_stems: 
            sacar_mensaje("\nThe project has been created. The stem extraction process has just begun. ")
            sacar_mensaje("To see the progress, check the terminal. If you want, you can create another project in the meantime (it will slow down the previous one).")
            separate_audio(assets_path, mp3_path)
        else: 
            sacar_mensaje("The project has been created. You can create another one if you wish.")

    except Exception as e:
        sacar_mensaje(f"Error downloading audio: {str(e)}", error=True)

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
    command = f'--mp3 --verbose -n mdx_extra --out "{stems_base}" "{audio_path}"'
    args = shlex.split(command)

    sacar_mensaje("Stem extraction in progress...")
    sys.stderr = sys.stdout
    demucs.separate.main(args)
    sys.stderr = original_stderr
    sacar_mensaje("The split is complete. Moving the files to the stems folder...")

    # Mover los archivos desde la estructura generada por demucs a la carpeta stems_base.
    move_stems_up(stems_base)
    open_folder(stems_base)

def move_stems_up(stems_base):
    def handle_remove_readonly(func, path, exc_info):
        os.chmod(path, stat.S_IWRITE)
        func(path)

    mdx_extra_dir = os.path.join(stems_base, "mdx_extra")
    
    if os.path.exists(mdx_extra_dir):
        try:
            # If there's exactly one subfolder, assume it's the extra folder from Demucs,
            # and move its contents (the 4 stem files) to stems_base.
            contents = os.listdir(mdx_extra_dir)
            if len(contents) == 1 and os.path.isdir(os.path.join(mdx_extra_dir, contents[0])):
                inner_dir = os.path.join(mdx_extra_dir, contents[0])
                for item in os.listdir(inner_dir):
                    src_path = os.path.join(inner_dir, item)
                    dst_path = os.path.join(stems_base, item)
                    shutil.move(src_path, dst_path)
            else:
                # Otherwise, move all items inside mdx_extra_dir.
                for item in contents:
                    src_path = os.path.join(mdx_extra_dir, item)
                    dst_path = os.path.join(stems_base, item)
                    shutil.move(src_path, dst_path)

            shutil.rmtree(mdx_extra_dir, onerror=handle_remove_readonly)
            sacar_mensaje(f"Successfully removed: {mdx_extra_dir}")
        except Exception as e:
            sacar_mensaje(f"Final removal failed: {str(e)}", error=True)

# Función para abrir el directorio en el explorador de archivos
def open_folder(path):
    os.startfile(path)

def validar_nombre_proyecto(name):
    # Caracteres no permitidos en Windows para nombres de carpetas y archivos en windows.
    invalid_chars = '<>:"/\\|?*'
    if any(char in invalid_chars for char in name):
        raise ValueError("The project name contains characters not allowed by Windows.\n The allowed characters are: <>:\"/\\|?*")
        
    if name.endswith('.') or name.endswith(' '):
        raise ValueError("Invalid project name", "The project name cannot end with a period or a space.")


# Crear el proyecto de FL Studio
def create_flp(key, bpm):
    if template_path:
        if os.path.isfile(template_path) and template_path.endswith('.flp'):

            project = pyflp.parse(template_path)
            project.comments = f"Original Song: {key} | {bpm}BPM"
            pyflp.save(project, os.path.join(project_path, f'{project_name}.flp'))

            sacar_mensaje(f"Using valid template from {template_path} to create the project")
        else:
            raise ValueError(f"The provided template is not a valid .flp file: {template_path}")


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
        raise ValueError("Fill the required fields, please.")

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
            raise FileExistsError(f"The destination directory '{project_path}' already exists. Please choose a different project name or change the project location.")
        
    # --  Empezar con el proceso de descarga -- #
        download_video()
    except ValueError as ve:
        sacar_mensaje(f"Validation error: {str(ve)}", error=True)

    except Exception as e:
        sacar_mensaje(f"Error during download or processing of video: {str(e)}", error=True)

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

