import cv2
import face_recognition
import os
import sqlite3
import pickle
import time
import csv
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

# ----- Database Initialization -----
def init_db():
    conn = sqlite3.connect("attendance.db")
    cursor = conn.cursor()
    cursor.execute("""CREATE TABLE IF NOT EXISTS students (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        encoding BLOB NOT NULL,
                        reg_time TEXT NOT NULL
                      )""")
    conn.commit()
    conn.close()

# ----- Registration Function -----
def register_student():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Webcam not accessible.")
        return
    student_name = input("Enter Student Name: ").strip()
    print("Capturing face for registration. Press 'q' to capture a single photo.")
    face_encoding = None
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error capturing frame")
            break
        cv2.imshow("Registration - Press 'q' to capture", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            faces = face_recognition.face_locations(rgb_frame)
            encodings = face_recognition.face_encodings(rgb_frame, faces)
            if encodings:
                face_encoding = encodings[0]
                break
            else:
                print("No face detected. Try again.")
    cap.release()
    cv2.destroyAllWindows()
    
    if face_encoding is None:
        print("Registration failed: no face encoding captured.")
        return
    
    # Store student info in database
    conn = sqlite3.connect("attendance.db")
    cursor = conn.cursor()
    encoding_blob = pickle.dumps(face_encoding)
    reg_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("INSERT INTO students (name, encoding, reg_time) VALUES (?, ?, ?)",
                   (student_name, encoding_blob, reg_time))
    conn.commit()
    conn.close()
    print(f"Student {student_name} registered successfully.")

# ----- Attendance & PDF Generation Function -----
def mark_attendance_and_generate_pdf():
    # Load registered students from DB
    conn = sqlite3.connect("attendance.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, encoding FROM students")
    students = cursor.fetchall()
    conn.close()
    
    if not students:
        print("No students registered.")
        return
    
    # Build dictionary: student_id -> {name, encoding}
    student_data = {}
    for sid, name, encoding_blob in students:
        encoding = pickle.loads(encoding_blob)
        student_data[sid] = {"name": name, "encoding": encoding}
    
    print("Please position students. Capturing attendance in 3 seconds...")
    time.sleep(3)
    
    # Capture a single frame for attendance
    cap = cv2.VideoCapture(0)
    ret, frame = cap.read()
    cap.release()
    if not ret:
        print("Error capturing frame")
        return
    
    # Save the captured frame (attendance photo)
    attendance_photo_folder = "attendance_photos"
    os.makedirs(attendance_photo_folder, exist_ok=True)
    photo_path = os.path.join(attendance_photo_folder, "attendance_photo.jpg")
    cv2.imwrite(photo_path, frame)
    print(f"Attendance photo saved at {photo_path}")
    
    # Process the frame for face detection and encoding
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    face_locations = face_recognition.face_locations(rgb_frame)
    face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
    
    # Mark attendance once per student (avoid duplicates)
    attendance_marked = {}
    csv_filename = "attendance.csv"
    with open(csv_filename, "a", newline="") as csvfile:
        writer = csv.writer(csvfile)
        for face_encoding in face_encodings:
            for sid, data in student_data.items():
                if sid in attendance_marked:
                    continue
                matches = face_recognition.compare_faces([data["encoding"]], face_encoding, tolerance=0.5)
                if matches[0]:
                    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    attendance_marked[sid] = timestamp
                    writer.writerow([data["name"], timestamp])
                    print(f"Attendance marked for {data['name']} at {timestamp}")
                    break  # Avoid duplicate marking
    
    # ----- Generate PDF Report -----
    attendance_pdf_folder = "attendance_pdf"
    os.makedirs(attendance_pdf_folder, exist_ok=True)
    pdf_filename = os.path.join(attendance_pdf_folder, "attendance_report.pdf")
    
    # Setup the PDF document using Platypus
    doc = SimpleDocTemplate(pdf_filename, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []
    
    # Create header row with bold "Attendance" and date (dd/mm/yyyy) aligned left/right
    header_style = styles['Title']
    header_data = [[
        Paragraph('<b>Attendance</b>', header_style),
        Paragraph('<b>Date: {}</b>'.format(datetime.now().strftime("%d/%m/%Y")), header_style)
    ]]
    header_table = Table(header_data, colWidths=[300, 300])
    header_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (0,0), 'LEFT'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 24))
    
    # Create table data with column headers (including S.No)
    table_data = [["S.No", "Name of Student", "Attendance Time"]]
    for index, (sid, timestamp) in enumerate(attendance_marked.items(), start=1):
        name = student_data[sid]["name"]
        table_data.append([str(index), name, timestamp])
    
    table = Table(table_data, colWidths=[80, 250, 200])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.grey),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 12),
        ('GRID', (0,0), (-1,-1), 1, colors.black),
    ]))
    elements.append(table)
    
    start_time = time.time()
    doc.build(elements)
    end_time = time.time()
    print(f"PDF report generated as {pdf_filename} in {end_time - start_time:.2f} seconds.")

# ----- Main Application Flow -----
def main():
    init_db()
    mode = input("Enter mode (r for register, a for attendance): ").strip().lower()
    if mode == "r":
        register_student()
    elif mode == "a":
        mark_attendance_and_generate_pdf()
    else:
        print("Invalid mode. Choose 'r' or 'a'.")

if __name__ == "__main__":
    main()
