import sys
import os
import json
import cv2
import face_recognition
import numpy as np

# --- Optimization Function ---
def process_frame(frame):
    # Resize frame for faster and less memory-intensive processing
    try:
        # Resize to a fixed width to be consistent, maintaining aspect ratio
        h, w, _ = frame.shape
        new_w = 640
        ratio = new_w / w
        new_h = int(h * ratio)
        small_frame = cv2.resize(frame, (new_w, new_h))
        # Convert from BGR (OpenCV) to RGB (face_recognition)
        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        return rgb_small_frame
    except Exception:
        # If frame is invalid, return None
        return None

# --- Load Known Faces ---
def load_known_faces(division):
    known_face_encodings = []
    known_face_roll_numbers = []
    directory = os.path.join('student_images', division)
    if not os.path.exists(directory):
        return known_face_encodings, known_face_roll_numbers
    for filename in os.listdir(directory):
        if filename.endswith(('.png', '.jpg', '.jpeg')):
            try:
                roll_number = int(os.path.splitext(filename)[0])
                image_path = os.path.join(directory, filename)
                image = face_recognition.load_image_file(image_path)
                encodings = face_recognition.face_encodings(image)
                if encodings:
                    known_face_encodings.append(encodings[0])
                    known_face_roll_numbers.append(roll_number)
            except (ValueError, IndexError) as e:
                print(f"Skipping {filename}: {e}", file=sys.stderr)
    return known_face_encodings, known_face_roll_numbers

# --- Process Media for Attendance ---
def process_media(upload_type, file_paths, known_faces, known_roll_nos):
    if not known_faces: return []
    recognized_roll_numbers = set()
    
    if upload_type == 'video':
        video_path = file_paths[0]
        video_capture = cv2.VideoCapture(video_path)
        frame_count = 0
        while video_capture.isOpened():
            ret, frame = video_capture.read()
            if not ret: break
            
            if frame_count % 5 == 0:
                rgb_small_frame = process_frame(frame)
                if rgb_small_frame is not None:
                    face_locations = face_recognition.face_locations(rgb_small_frame)
                    face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)
                    for face_encoding in face_encodings:
                        matches = face_recognition.compare_faces(known_faces, face_encoding, tolerance=0.6)
                        if True in matches:
                            first_match_index = matches.index(True)
                            recognized_roll_numbers.add(known_roll_nos[first_match_index])
            frame_count += 1
        video_capture.release()

    elif upload_type == 'photos':
        for image_path in file_paths:
            img = cv2.imread(image_path)
            if img is not None:
                rgb_small_frame = process_frame(img)
                if rgb_small_frame is not None:
                    face_locations = face_recognition.face_locations(rgb_small_frame)
                    face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)
                    for face_encoding in face_encodings:
                        matches = face_recognition.compare_faces(known_faces, face_encoding, tolerance=0.6)
                        if True in matches:
                            first_match_index = matches.index(True)
                            recognized_roll_numbers.add(known_roll_nos[first_match_index])
            
    return list(recognized_roll_numbers)

# --- Main Execution Block ---
if __name__ == "__main__":
    try:
        task = sys.argv[1]
        if task == 'attendance':
            upload_type_arg = sys.argv[2]
            division_arg = sys.argv[3]
            file_paths_args = sys.argv[4:]
            known_encodings, known_rolls = load_known_faces(division_arg)
            result = process_media(upload_type_arg, file_paths_args, known_encodings, known_rolls)
            print(json.dumps(result))
    except Exception as e:
        print(f"An error occurred in the Python script: {e}", file=sys.stderr)
        sys.exit(1)