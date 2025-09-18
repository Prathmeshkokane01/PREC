import sys
import os
import json
import cv2
import face_recognition
import numpy as np

# --- 1. Load Known Faces ---
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

# --- 2. Process Media for Attendance ---
def process_media(upload_type, file_paths, known_faces, known_roll_nos):
    if not known_faces: return []
    recognized_roll_numbers = set()
    if upload_type == 'video':
        video_path = file_paths[0]
        video_capture = cv2.VideoCapture(video_path)
        while video_capture.isOpened():
            ret, frame = video_capture.read()
            if not ret: break
            # Process frame
            face_locations = face_recognition.face_locations(frame)
            face_encodings = face_recognition.face_encodings(frame, face_locations)
            for face_encoding in face_encodings:
                matches = face_recognition.compare_faces(known_faces, face_encoding, tolerance=0.6)
                face_distances = face_recognition.face_distance(known_faces, face_encoding)
                if True in matches:
                    best_match_index = np.argmin(face_distances)
                    if matches[best_match_index]:
                        recognized_roll_numbers.add(known_roll_nos[best_match_index])
        video_capture.release()
    elif upload_type == 'photos':
        for image_path in file_paths:
            image = face_recognition.load_image_file(image_path)
            # Process image
            face_locations = face_recognition.face_locations(image)
            face_encodings = face_recognition.face_encodings(image, face_locations)
            for face_encoding in face_encodings:
                matches = face_recognition.compare_faces(known_faces, face_encoding, tolerance=0.6)
                face_distances = face_recognition.face_distance(known_faces, face_encoding)
                if True in matches:
                    best_match_index = np.argmin(face_distances)
                    if matches[best_match_index]:
                        recognized_roll_numbers.add(known_roll_nos[best_match_index])
    return list(recognized_roll_numbers)

# --- 3. Main Execution Block ---
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