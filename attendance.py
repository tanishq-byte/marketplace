import cv2
import face_recognition
import numpy as np
import csv
from datetime import datetime


video_capture = cv2.VideoCapture(0)

# Load known images and encode them
papa_image = face_recognition.load_image_file("projectphoto/papa.PNG")
papa_encoding = face_recognition.face_encodings(papa_image)[0]

mumma_image = face_recognition.load_image_file("projectphoto/mumma.PNG")
mumma_encoding = face_recognition.face_encodings(mumma_image)[0]

tanishq_image = face_recognition.load_image_file("projectphoto/tanishq.PNG")
tanishq_encoding = face_recognition.face_encodings(tanishq_image)[0]

known_face_encodings = [papa_encoding, tanishq_encoding, mumma_encoding]
known_face_names = ["papa", "tanishq", "mumma"]

students = known_face_names.copy()

face_locations = []
face_encodings = []

now = datetime.now()
current_date = now.strftime("%Y-%m-%d")

f = open(f"{current_date}.csv", "w+", newline="")
lnwriter = csv.writer(f)

while True:
    ret, frame = video_capture.read()
    if not ret:
        break

  
    small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
    rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

    # Get face locations and encodings
    face_locations = face_recognition.face_locations(rgb_small_frame)
    face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

    for face_encoding, face_location in zip(face_encodings, face_locations):
        matches = face_recognition.compare_faces(known_face_encodings, face_encoding)
        face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)
        best_match_index = np.argmin(face_distances)

        if matches[best_match_index]:
            name = known_face_names[best_match_index]

            
            top, right, bottom, left = face_location
            top *= 4
            right *= 4
            bottom *= 4
            left *= 4

            cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)
            cv2.rectangle(frame, (left, bottom - 35), (right, bottom), (0, 255, 0), cv2.FILLED)
            font = cv2.FONT_HERSHEY_SIMPLEX
            cv2.putText(frame, f"{name} Present", (left + 6, bottom - 6), font, 1.0, (255, 255, 255), 2)

            if name in students:
                students.remove(name)
                current_time = now.strftime("%H:%M:%S")
                lnwriter.writerow([name, current_time])

    
    cv2.imshow("Camera", frame)

    # Exit on pressing 'q'
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break


video_capture.release()
cv2.destroyAllWindows()
f.close()
