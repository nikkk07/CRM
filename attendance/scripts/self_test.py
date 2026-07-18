"""End-to-end self test WITHOUT cameras: uses InsightFace's bundled sample
photo to prove that detection, enrollment, matching, and attendance marking
all work. Safe to run any time:  ./venv/bin/python scripts/self_test.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import attendance, config, db
from app.recognition import Recognizer

db.init()
print("1) Loading face model (first run downloads it, ~280 MB)...")
rec = Recognizer()
print("   model ready")

import insightface
img = insightface.data.get_image("t1")  # sample group photo bundled with the library
faces = rec.detect(img)
print(f"2) Detection: found {len(faces)} faces in the sample photo")
assert len(faces) >= 2, "expected multiple faces in sample image"

faces = sorted(faces, key=lambda f: f.bbox[0])
person_a, person_b = faces[0], faces[1]

pid = db.add_person("SELF TEST PERSON", "student")
db.add_face(pid, person_a.normed_embedding.astype("float32").tobytes(), "self_test")
rec.reload()
print(f"3) Enrolled face A as person id {pid}")

match_a, score_a = rec.match(person_a.normed_embedding)
match_b, score_b = rec.match(person_b.normed_embedding)
print(f"4) Match face A -> person {match_a} (score {score_a:.3f})  [expect person {pid}, ~1.0]")
print(f"   Match face B -> person {match_b} (score {score_b:.3f})  [expect None, low score]")
assert match_a == pid and score_a > 0.9
assert match_b is None

attendance.record_sighting(pid, score_a, "SelfTestCam", img, person_a.bbox)
row = db.get_attendance(pid, db.today_str())
if attendance.is_working_day(__import__("datetime").datetime.now()):
    assert row is not None and row["entry_time"], "entry was not marked"
    print(f"5) Attendance ENTRY marked at {row['entry_time']} with snapshot {row['entry_snapshot']}")
else:
    print("5) Today is Sunday/holiday - correctly skipped marking (rule works)")
    assert row is None

# cleanup
db.delete_person(pid)
with db.conn() as c:
    c.execute("DELETE FROM attendance WHERE person_id=?", (pid,))
print("\n✅ SELF TEST PASSED - recognition and attendance logic work.")
