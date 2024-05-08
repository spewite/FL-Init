import os
import sys
import argparse
from pytube import YouTube
from moviepy.editor import AudioFileClip
import configparser
import subprocess

def load_configuration():
    """Cargar o inicializar la configuración de la aplicación."""
    config = configparser.ConfigParser()
    config_file = 'settings.ini'
    if not os.path.exists(config_file):
        config['DEFAULT'] = {
            'DownloadPath': os.path.expanduser('~'),
            'FLPTemplatePath': os.path.expanduser('~')
        }
        with open(config_file, 'w') as f:
            config.write(f)
    config.read(config_file)
    return config

def download_video(url, output_path, only_audio=True):
    """Descargar un video de YouTube."""
    print(f"Descargando video desde {url}")
    yt = YouTube(url)
    stream = yt.streams.filter(only_audio=only_audio).first()
    default_filename = stream.default_filename
    downloaded_file = stream.download(output_path=output_path, filename=default_filename)

    if only_audio:
        # Convertir a MP3
        new_filename = default_filename.replace('.mp4', '.mp3')
        new_file_path = os.path.join(output_path, new_filename)
        clip = AudioFileClip(downloaded_file)
        clip.write_audiofile(new_file_path)
        clip.close()
        os.remove(downloaded_file)
        print(f"Archivo de audio guardado como {new_file_path}")
        return new_file_path
    
    return downloaded_file

def separate_stems(audio_path, output_dir):
    """Separar los stems del archivo de audio usando Demucs."""
    print("Iniciando la separación de stems...")
    command = f"python -m demucs.separate --dl -n demucs -d cpu '{audio_path}' -o '{output_dir}'"
    process = subprocess.run(command, shell=True, text=True, capture_output=True)
    if process.returncode != 0:
        print(f"Error en la separación de stems: {process.stderr}")
    else:
        print(f"Stems separados exitosamente en {output_dir}")

def main(args):
    config = load_configuration()
    download_path = config['DEFAULT'].get('DownloadPath', os.path.expanduser('~'))

    final_output_path = os.path.join(download_path, args.project_name)
    os.makedirs(final_output_path, exist_ok=True)

    try:
        downloaded_file = download_video(args.url, final_output_path, only_audio=True)
        print(f"Video descargado y procesado en {downloaded_file}")

        if args.separate_stems:
            separate_stems(downloaded_file, final_output_path)

    except Exception as e:
        print(f"Error durante la descarga o procesamiento del video: {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Script para descargar y procesar videos de YouTube")
    parser.add_argument("url", help="URL del video de YouTube")
    parser.add_argument("project_name", help="Nombre del proyecto, usado como nombre del directorio")
    parser.add_argument("--separate-stems", action='store_true', help="Indica si se deben separar los stems del audio")
    
    args = parser.parse_args()
    main(args)
