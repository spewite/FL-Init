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

# Global variables
url = None
project_location = None
project_name = None
separate_stems = None
template_path = None
project_path = None
youtube_title = None
audio_extension = None
threads = None
original_stderr = None

def output_message(mesage, error=False):
    output_channel = sys.stderr if error else sys.stdout
    print(f"\n{mesage}", file=output_channel)
    sys.stdout.flush()

def is_video_valid():
    """Checks if the provided URL is a valid YouTube URL."""
    parsed_url = urllib.parse.urlparse(url)
    if parsed_url.scheme not in ("http", "https"):
        return False
    if parsed_url.netloc not in ("www.youtube.com", "youtube.com", "youtu.be"):
        return False
    return True

def detect_key(audio_path):

    # Load the song
    y, sr = librosa.load(audio_path)
    
    # Extract the chromagram using the CQT transform
    chromagram = librosa.feature.chroma_cqt(y=y, sr=sr)
    
    # Average over time to obtain a representative vector (12 values)
    chroma_mean = np.mean(chromagram, axis=1)
    
    best_score = -np.inf
    best_key = None
    best_mode = None

    # Evaluate for each major key
    for i in range(12):
        profile_rot = rotate_profile(major_profile, i)
        score = cosine_similarity(chroma_mean, profile_rot)
        if score > best_score:
            best_score = score
            best_key = notes[i]
            best_mode = 'Major'

    # Evaluate for each minor key
    for i in range(12):
        profile_rot = rotate_profile(minor_profile, i)
        score = cosine_similarity(chroma_mean, profile_rot)
        if score > best_score:
            best_score = score
            best_key = notes[i]
            best_mode = 'Minor'
    
    return f"{best_key} {best_mode} (Score: {round(best_score, 2)})"


# Function to download audio only and convert it to MP3
def download_video():
    
    try:
        output_message("Starting audio download...")

        yt = YouTube(url)
        title = yt.title
        title = ''.join(char for char in title if char.isalnum() or char in " -_")
        global youtube_title
        youtube_title = title 

        # Create the folder of the projects
        assets_path = os.path.join(project_path, 'assets')
        os.makedirs(assets_path, exist_ok=True)

        # Save paths and download object
        audio_stream = yt.streams.filter(only_audio=True).first()
        audio_file_path = audio_stream.download(output_path=assets_path, filename=f"{title}.mp4")
        audio_out_path = os.path.join(assets_path, f"{title}.{audio_extension}")

        # Redirect MoviePy's output to stdout
        global original_stderr 
        original_stderr = sys.stderr
        sys.stderr = sys.stdout

        # Download the audio
        audio_clip = AudioFileClip(audio_file_path)

        audio_clip.write_audiofile(audio_out_path)
        audio_clip.close()

        # Restore stderr
        sys.stderr = original_stderr

        # Remove .mp4
        os.remove(audio_file_path)
        
        # Get key and bpm of the song
        key = detect_key(audio_out_path)
        bpm = get_song_bpm(audio_out_path)

        # Create file with original song info
        create_info_file(key, bpm)

        # Crear the FLP template
        create_flp(key, bpm)

        # Open the project folder
        open_folder(project_path)

        # Verify if the stems separation checkbox is checked
        if separate_stems: 
            output_message("The project has been created. The stem extraction process has just begun. ")
            output_message("To see the progress, check the terminal. If you want, you can create another project in the meantime (it will slow down the previous one).")
            separate_audio(assets_path, audio_out_path)
        else: 
            output_message("The project has been created. You can create another one if you wish.")

    except Exception as e:
        output_message(f"Error downloading audio: {str(e)}", error=True)

def create_info_file(key, bpm):
    try:
        with open(os.path.join(project_path, "Original Song Info.txt"), "w") as file:
            file.write(f"Youtube title: {youtube_title}")
            file.write("\nOriginal Song Info: ")
            file.write("\n  -> Key: " + key)
            file.write("\n  -> BPM: " + str(bpm))
    except Exception as err:
        output_message(f"Error creating the original song info file: {err}")
        

def separate_audio(assets_path, audio_path):

    # Define the base path where we want the stems to be located
    stems_base = os.path.join(assets_path, "stems")
    os.makedirs(stems_base, exist_ok=True)

    # Run demucs with the output path set to stems_base.
    # This will generate a structure: stems_base/mdx_extra/audio_name/(the 4 files)
    if audio_extension == 'mp3':
        command = f'--verbose -n mdx_extra --jobs {threads} --mp3 --out "{stems_base}" "{audio_path}"'
    else:
        command = f'--verbose -n mdx_extra --jobs {threads} --out "{stems_base}" "{audio_path}"'
    args = shlex.split(command)

    output_message(f"Stem extraction in progress... Threads: {threads}, Extension: {audio_extension}")

    sys.stderr = sys.stdout
    demucs.separate.main(args)
    sys.stderr = original_stderr
    output_message("The split is complete. Moving the files to the stems folder...")

    # Move the files from the structure generated by demucs to the stems_base folder.
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
            output_message(f"Successfully removed: {mdx_extra_dir}")
        except Exception as e:
            output_message(f"Final removal failed: {str(e)}", error=True)

# Function to open the directory in the file explorer
def open_folder(path):
    os.startfile(path)

def validate_project_name(name):
    # Characters not allowed in Windows for folder and file names.
    invalid_chars = '<>:"/\\|?*'
    if any(char in invalid_chars for char in name):
        raise ValueError("The project name contains characters not allowed by Windows.\n The allowed characters are: <>:\"/\\|?*")
        
    if name.endswith('.') or name.endswith(' '):
        raise ValueError("Invalid project name. The project name cannot end with a period or a space.")


# Create the FLP project
def create_flp(key, bpm):
    if template_path:
        if os.path.isfile(template_path) and template_path.endswith('.flp'):
            project = pyflp.parse(template_path)
            project.comments = f"Original Song: {key} | {bpm}BPM"
            pyflp.save(project, os.path.join(project_path, f'{project_name}.flp'))
            output_message(f"Using valid template from {template_path} to create the project")
        else:
            raise ValueError(f"The provided template is not a valid .flp file: {template_path}")


def get_song_bpm(file_path):
    # Load the audio file
    y, sr = librosa.load(file_path)
    
    # Calculate the onset envelope (detection of note/beat onsets)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    
    # Estimate the BPM
    tempo, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
    
    # Use np.round instead of round for NumPy values
    bpm = int(np.round(tempo, 0))
    
    return bpm - 1 # Rest one unity because always it calculated 1 extra. 161 instead of 160...

def show_parameters():
    output_message(f'Url: {url}')
    output_message(f'Proyect Location: {project_location}')
    output_message(f'Proyect Name: {project_name}')
    output_message(f'Separate stems: {separate_stems}')
    output_message(f'Template Path: {template_path}')

def main(args):

    # UTF-8 encoding configuration for stdout and stderr
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

    # Validate that all required fields have been entered.
    if not args.url or not args.project_location or not args.project_name:
        raise ValueError("Fill the required fields, please.")

    # Assign parameters to global variables.
    global url
    global project_location
    global project_name
    global separate_stems
    global template_path
    global project_path
    global audio_extension
    global threads

    url = args.url
    project_location = args.project_location
    project_name = args.project_name
    separate_stems = args.separate_stems
    template_path = args.template_path
    project_path = os.path.join(project_location, project_name)
    audio_extension = args.audio_extension   # <-- new parameter
    threads = args.threads                   # <-- new parameter
    
    # Validate that the project name does not contain characters not allowed by Windows.
    validate_project_name(project_name)

    try:
        # Check if the URL is from YouTube. 
        # I have it commented out on purpose. If the video is not valid, the script will throw an error anyway.
        # if not is_video_valid():
        #     raise ValueError("The URL must be from YouTube")

        # Check if the destination directory already exists (It must not exist)
        if os.path.exists(project_path):
            raise FileExistsError(f"The destination directory '{project_path}' already exists. Please choose a different project name or change the project location.")
        
    # -- Start the download process -- #
        download_video()
    except ValueError as ve:
        output_message(f"Validation error: {str(ve)}", error=True)

    except Exception as e:
        output_message(f"Error during download or processing of video: {str(e)}", error=True)

    return 1

# ---- FUNCTIONS TO GET SONG KEY ---- # 

# Function to calculate cosine similarity
def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# Krumhansl-Kessler profiles (empirical values)
major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

# Music notes
notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def rotate_profile(profile, n):
    """Rotates the profile 'n' positions (to transpose the template)"""
    return np.roll(profile, n)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Script to download and process YouTube videos")
    parser.add_argument("project_location", help="Destination directory path")
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument("project_name", help="Project name, used as the directory name")
    parser.add_argument("--separate-stems", action='store_true', help="Indicates whether to separate the audio stems")
    parser.add_argument("--template-path", help="Path to the .flp template to use for the project")
    # New arguments for audio extension and number of threads
    parser.add_argument("--audio-extension", choices=['wav', 'mp3'], default='wav', help="Audio output extension (default: wav)")
    parser.add_argument("--threads", type=int, default=4, help="Number of threads for demucs extraction (default: 4)")

    args = parser.parse_args()
    main(args)

