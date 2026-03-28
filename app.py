from flask import Flask, request, jsonify, render_template
import re
import io

app = Flask(__name__)

# ─── SKILL CATEGORIES ─────────────────────────────────

SKILL_CATEGORIES = {
    "Programming Languages": ["python", "java", "javascript", "c\\+\\+", "c#"],
    "Web & Frontend": ["html", "css", "react", "angular", "vue"],
    "Backend & Frameworks": ["flask", "django", "node", "express"],
    "Data & AI/ML": ["machine learning", "deep learning", "pandas", "numpy", "tensorflow", "pytorch"],
    "Databases": ["sql", "mysql", "mongodb", "postgresql"]
}

# ─── JOB ROLES ───────────────────────────────────────

JOB_ROLES = [
    {
        "title": "Machine Learning Engineer",
        "keywords": ["python", "machine learning", "pandas", "numpy"],
        "min_match": 2,
        "icon": "🤖"
    },
    {
        "title": "Full Stack Developer",
        "keywords": ["javascript", "react", "node", "html", "css"],
        "min_match": 3,
        "icon": "💻"
    }
]

# ─── PDF EXTRACTION ──────────────────────────────────

def extract_text_from_pdf(file_bytes):
    text = ""

    # PyPDF2
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
    except:
        pass

    # pdfplumber fallback
    if text.strip() == "":
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page in pdf.pages:
                    t = page.extract_text()
                    if t:
                        text += t + "\n"
        except:
            pass

    # OCR fallback (important)
    if text.strip() == "":
        try:
            from pdf2image import convert_from_bytes
            import pytesseract

            images = convert_from_bytes(file_bytes, dpi=300)
            for img in images:
                text += pytesseract.image_to_string(img) + "\n"
        except:
            pass

    return text


def extract_text_from_txt(file_bytes):
    for enc in ["utf-8", "latin-1", "cp1252"]:
        try:
            return file_bytes.decode(enc)
        except:
            continue
    return ""


# ─── ANALYSIS FUNCTIONS ───────────────────────────────

def detect_skills(text):
    text_lower = text.lower()
    detected = {}

    for category, skills in SKILL_CATEGORIES.items():
        found = []
        for skill in skills:
            if re.search(r'\b' + skill + r'\b', text_lower):
                found.append(skill)
        if found:
            detected[category] = found

    return detected


def match_jobs(text, skills):
    matches = []

    for role in JOB_ROLES:
        score = sum(1 for kw in role["keywords"] if kw in text or kw in skills)

        if score >= role["min_match"]:
            matches.append({
                "title": role["title"],
                "icon": role["icon"],
                "match": int((score / len(role["keywords"])) * 100)
            })

    return matches


def compute_score(text, skills):
    score = 0
    breakdown = {}

    # Skills
    skill_score = min(len(skills) * 5, 40)
    breakdown["Skills"] = skill_score
    score += skill_score

    # Length
    words = len(text.split())
    if words > 300:
        length_score = 30
    elif words > 150:
        length_score = 20
    else:
        length_score = 10
    breakdown["Content"] = length_score
    score += length_score

    # Keywords
    keyword_score = 0
    if "project" in text.lower():
        keyword_score += 10
    if "experience" in text.lower():
        keyword_score += 10
    breakdown["Keywords"] = keyword_score
    score += keyword_score

    return min(score, 100), breakdown


def generate_tips(text, skills, score):
    tips = []

    if len(skills) < 8:
        tips.append("Add more technical skills to improve ATS score.")
    if "project" not in text.lower():
        tips.append("Add project section with technologies used.")
    if "experience" not in text.lower():
        tips.append("Include experience or internship details.")
    if score < 70:
        tips.append("Improve resume using job description keywords.")

    return tips


def get_score_label(score):
    if score >= 85:
        return "Excellent", "#00f5a0"
    elif score >= 70:
        return "Good", "#7cfc00"
    elif score >= 50:
        return "Average", "#ffd700"
    else:
        return "Needs Work", "#ff4444"


# ─── ROUTES ───────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    if "resume" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    f = request.files["resume"]
    filename = f.filename.lower()
    file_bytes = f.read()

    # Extract text
    if filename.endswith(".pdf"):
        text = extract_text_from_pdf(file_bytes)
    elif filename.endswith(".txt"):
        text = extract_text_from_txt(file_bytes)
    else:
        return jsonify({"error": "Only PDF and TXT supported"}), 400

    if not text or len(text.strip()) < 10:
        return jsonify({"error": "Could not extract readable text"}), 422

    # Analysis
    skill_categories = detect_skills(text)
    flat_skills = [s for v in skill_categories.values() for s in v]

    score, breakdown = compute_score(text, flat_skills)
    label, color = get_score_label(score)

    jobs = match_jobs(text.lower(), flat_skills)
    tips = generate_tips(text, flat_skills, score)

    return jsonify({
        "score": score,
        "score_label": label,
        "score_color": color,
        "breakdown": breakdown,
        "skill_categories": skill_categories,
        "flat_skills": flat_skills,
        "job_matches": jobs,
        "tips": tips,
        "word_count": len(text.split()),
        "char_count": len(text)
    })


# ─── RUN ──────────────────────────────────────────────

if __name__ == "__main__":
   #app.run(debug=True)
   app.run(host="0.0.0.0", port=10000)