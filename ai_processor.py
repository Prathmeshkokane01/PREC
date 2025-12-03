import sys
import os
import json
import cv2
import face_recognition
import numpy as np

def load_known_faces(division):
    known_encodings = []
    known_rolls = []
    directory = os.path.join('student_images', division)
    
    if not os.path.exists(directory):
        return [], []

    for filename in os.listdir(directory):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            try:
                # Assuming filename is 'roll_no.jpg'
                roll = int(os.path.splitext(filename)[0])
                path = os.path.join(directory, filename)
                img = face_recognition.load_image_file(path)
                encs = face_recognition.face_encodings(img)
                if encs:
                    known_encodings.append(encs[0])
                    known_rolls.append(roll)
            except Exception:
                continue
    return known_encodings, known_rolls

def process(upload_type, file_paths, known_encs, known_rolls):
    found_rolls = set()
    
    for file_path in file_paths:
        if upload_type == 'video':
            cap = cv2.VideoCapture(file_path)
            frame_count = 0
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret: break
                # Process every 10th frame to save speed
                if frame_count % 10 == 0:
                    small = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
                    rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
                    locs = face_recognition.face_locations(rgb)
                    encs = face_recognition.face_encodings(rgb, locs)
                    
                    for encoding in encs:
                        matches = face_recognition.compare_faces(known_encs, encoding, tolerance=0.6)
                        if True in matches:
                            idx = matches.index(True)
                            found_rolls.add(known_rolls[idx])
                frame_count += 1
            cap.release()
        else:
            # Photo mode
            img = cv2.imread(file_path)
            if img is None: continue
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            locs = face_recognition.face_locations(rgb)
            encs = face_recognition.face_encodings(rgb, locs)
            for encoding in encs:
                matches = face_recognition.compare_faces(known_encs, encoding, tolerance=0.6)
                if True in matches:
                    idx = matches.index(True)
                    found_rolls.add(known_rolls[idx])

    return list(found_rolls)

if __name__ == "__main__":
    # Args: script.py task upload_type division file1 file2 ...
    if len(sys.argv) < 5:
        print(json.dumps([]))
        sys.exit(0)

    upload_type = sys.argv[2]
    division = sys.argv[3]
    files = sys.argv[4:]

    known_encs, known_rolls = load_known_faces(division)
    
    if not known_encs:
        print(json.dumps([]))
    else:
        results = process(upload_type, files, known_encs, known_rolls)
        print(json.dumps(results))