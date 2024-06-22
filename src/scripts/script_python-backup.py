import os
import sys
import argparse
from pytube import YouTube
from moviepy.editor import AudioFileClip
import re
import moviepy.config as mp_config
import urllib.parse

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


def download_video(url, output_path):
    """Descargar un video de YouTube."""
    if not es_video_valido(url):
        raise ValueError(f"URL no valida de YouTube: {url}")

    sacar_mensaje(f"Descargando video desde {url}")
    
    yt = YouTube(url)

    stream = yt.streams.filter(only_audio=True).first()
    default_filename = stream.default_filename
    downloaded_file = stream.download(output_path=output_path, filename=default_filename)

    # Convertir a MP3
    new_filename = default_filename.replace('.mp4', '.mp3')
    new_file_path = os.path.join(output_path, new_filename)
    
    # Redirigir la salida de MoviePy a stdout
    original_stderr = sys.stderr
    sys.stderr = sys.stdout

    clip = AudioFileClip(downloaded_file)
    clip.write_audiofile(new_file_path)
    clip.close()

    # Restaurar stderr
    sys.stderr = original_stderr
    
    os.remove(downloaded_file)
    sacar_mensaje(f"Archivo de audio guardado como {new_file_path}")
    
    return new_file_path

# Crear el proyecto de FL Studio
def create_flp(project_path, project_name):
    print("CREAR PLANTILLA")
    
def main(args):
    final_output_path = os.path.join(args.project_location, args.project_name)
    os.makedirs(final_output_path, exist_ok=True)
    
    sacar_mensaje("Preparando descarga...")
    
    try:
        downloaded_file = download_video(args.url, final_output_path)
        sacar_mensaje(f"Video descargado y procesado en {downloaded_file}")
        
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
    
    args = parser.parse_args()
    main(args)