import sys
import os
import json
import traceback
from deepface import DeepFace

# --- 1. Find Recognized Faces in a Single Image ---
def find_faces(image_path, student_db_path):
    recognized_roll_numbers = set()
    try:
        # The core of deepface: finds and recognizes faces in one go.
        # It will check the image against all images in the student_db_path folder.
        dfs = DeepFace.find(
            img_path=image_path,
            db_path=student_db_path,
            model_name='VGG-Face', # A standard, reliable model
            detector_backend='opencv', # A fast detector
            silent=True, # Suppresses verbose logging
            enforce_detection=False # Continues even if no face is found
        )
        
        # Process the results
        if isinstance(dfs, list) and len(dfs) > 0:
            for df in dfs:
                if not df.empty:
                    for identity_path in df['identity']:
                        # Extract roll number from the matched image's filename
                        filename = os.path.basename(identity_path)
                        roll_number = os.path.splitext(filename)[0]
                        recognized_roll_numbers.add(int(roll_number))

    except Exception as e:
        # Print detailed error to stderr for debugging
        print(f"Error processing {image_path}: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        
    return list(recognized_roll_numbers)

# --- 2. Main Execution Block ---
if __name__ == "__main__":
    try:
        task = sys.argv[1]
        if task == 'attendance':
            # Note: deepface works best with multiple photos, not video.
            # This script is now optimized for the 'photos' upload type.
            division_arg = sys.argv[3]
            file_paths_args = sys.argv[4:]
            
            student_image_directory = os.path.join('student_images', division_arg)
            
            all_recognized_rolls = set()

            for uploaded_image_path in file_paths_args:
                recognized_in_image = find_faces(uploaded_image_path, student_image_directory)
                for roll in recognized_in_image:
                    all_recognized_rolls.add(roll)

            print(json.dumps(list(all_recognized_rolls)))

    except Exception as e:
        print(f"An error occurred in the Python script: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)