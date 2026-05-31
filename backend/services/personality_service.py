from datetime import datetime
from typing import List, Dict, Any, Optional

from core.database import db
from models.user import MBTIType, LearningStyle

# Simple sample questions - replace with real validated assessment later
QUESTIONS = [
    {"id": "q1", "text": "Saya lebih suka belajar dengan melihat diagram/grafik.", "options": ["strongly_agree", "agree", "neutral", "disagree", "strongly_disagree"]},
    {"id": "q2", "text": "Saya lebih mudah mengingat melalui penjelasan lisan (mendengar).", "options": ["strongly_agree", "agree", "neutral", "disagree", "strongly_disagree"]},
    {"id": "q3", "text": "Saya suka belajar dengan praktek langsung atau percobaan.", "options": ["strongly_agree", "agree", "neutral", "disagree", "strongly_disagree"]},
    {"id": "q4", "text": "Saya suka membaca dan menulis catatan saat belajar.", "options": ["strongly_agree", "agree", "neutral", "disagree", "strongly_disagree"]},
]

def get_questions() -> List[Dict[str, Any]]:
    return QUESTIONS

def _score_learning_style(answers: Dict[str, str]) -> str:
    # naive scoring: q1 -> visual, q2 -> auditory, q3 -> kinesthetic, q4 -> reading_writing
    mapping = {"q1": "visual", "q2": "auditory", "q3": "kinesthetic", "q4": "reading_writing"}
    totals = {k: 0 for k in mapping.values()}
    for qid, ans in answers.items():
        if ans in ("strongly_agree", "agree"):
            style = mapping.get(qid)
            if style:
                totals[style] += 2 if ans == "strongly_agree" else 1
    # pick highest
    best = max(totals.items(), key=lambda x: x[1])[0]
    return best

def _derive_mbti(answers: Dict[str, str]) -> str:
    # Placeholder heuristic: choose based on simple patterns
    # This should be replaced with a validated MBTI scoring algorithm later
    score_e = 0
    score_i = 0
    # use q1/q4 as introversion/extroversion proxy (very naive)
    if answers.get("q1") in ("strongly_agree", "agree"):
        score_i += 1
    if answers.get("q3") in ("strongly_agree", "agree"):
        score_e += 1
    return "INTJ" if score_i >= score_e else "ENFP"

def calculate_mbti_type(scores: Dict[str, int]) -> Optional[MBTIType]:
    if not scores:
        return None
    keys = {"E", "I", "S", "N", "T", "F", "J", "P"}
    if not any(k in scores for k in keys):
        return None

    e = scores.get("E", 0)
    i = scores.get("I", 0)
    s = scores.get("S", 0)
    n = scores.get("N", 0)
    t = scores.get("T", 0)
    f = scores.get("F", 0)
    j = scores.get("J", 0)
    p = scores.get("P", 0)

    m1 = "E" if e >= i else "I"
    m2 = "S" if s >= n else "N"
    m3 = "T" if t >= f else "F"
    m4 = "J" if j >= p else "P"

    mbti_str = m1 + m2 + m3 + m4
    try:
        return MBTIType(mbti_str)
    except ValueError:
        return None

def calculate_learning_style(scores_or_answers: Dict[str, Any]) -> Optional[LearningStyle]:
    if not scores_or_answers:
        return None
    
    first_val = next(iter(scores_or_answers.values()), None)
    if isinstance(first_val, (int, float)):
        try:
            best_style = max(scores_or_answers.items(), key=lambda x: x[1])[0]
            return LearningStyle(best_style)
        except Exception:
            return None
    else:
        try:
            style_str = _score_learning_style(scores_or_answers)
            return LearningStyle(style_str)
        except Exception:
            return None

def get_strengths_and_challenges(
    mbti_type: Optional[MBTIType], 
    learning_style: Optional[LearningStyle]
) -> Dict[str, List[str]]:
    strengths = []
    challenges = []
    
    if mbti_type:
        mbti_str = mbti_type.value if hasattr(mbti_type, 'value') else str(mbti_type)
        if "I" in mbti_str:
            strengths.append("Fokus mendalam dan kemandirian tinggi")
            challenges.append("Kurang nyaman dalam diskusi kelompok besar")
        else:
            strengths.append("Kolaboratif dan komunikatif")
            challenges.append("Mudah terdistraksi di lingkungan ramai")
            
        if "N" in mbti_str:
            strengths.append("Pemikiran konseptual dan kreatif")
            challenges.append("Cenderung mengabaikan detail kecil")
        else:
            strengths.append("Praktis dan berorientasi pada detail")
            challenges.append("Kurang menyukai konsep yang terlalu abstrak")
            
        if "T" in mbti_str:
            strengths.append("Logis dan analitis")
            challenges.append("Kurang peka terhadap dinamika emosional kelompok")
        else:
            strengths.append("Empati tinggi dan kooperatif")
            challenges.append("Sulit menerima kritik objektif")
            
        if "J" in mbti_str:
            strengths.append("Terorganisir dan tepat waktu")
            challenges.append("Kurang fleksibel terhadap perubahan mendadak")
        else:
            strengths.append("Adaptif dan spontan")
            challenges.append("Cenderung menunda-nunda pekerjaan")

    if learning_style:
        ls_str = learning_style.value if hasattr(learning_style, 'value') else str(learning_style)
        if ls_str == "visual":
            strengths.append("Mudah memahami diagram dan materi visual")
            challenges.append("Sulit mengingat instruksi verbal tanpa catatan")
        elif ls_str == "auditory":
            strengths.append("Sangat baik mendengarkan penjelasan langsung")
            challenges.append("Mudah terganggu oleh suara bising")
        elif ls_str == "kinesthetic":
            strengths.append("Cepat belajar melalui praktek langsung")
            challenges.append("Sulit duduk diam untuk waktu yang lama")
        elif ls_str == "reading_writing":
            strengths.append("Sangat baik dalam membaca dan menulis laporan")
            challenges.append("Kurang menyukai presentasi lisan")

    return {
        "strengths": list(set(strengths)),
        "challenges": list(set(challenges))
    }

async def evaluate_and_save(user, answers: Dict[str, str]):
    learning_style = _score_learning_style(answers)
    mbti = _derive_mbti(answers)

    mbti_enum = None
    if mbti:
        try:
            mbti_enum = MBTIType(mbti)
        except ValueError:
            pass

    ls_enum = None
    if learning_style:
        try:
            ls_enum = LearningStyle(learning_style)
        except ValueError:
            pass

    sc = get_strengths_and_challenges(mbti_enum, ls_enum)

    profile = {
        "mbti": mbti,
        "learning_style": learning_style,
        "strengths": sc["strengths"],
        "weaknesses": sc["challenges"],
        "recommended_teaching_strategies": [],
        "created_at": datetime.utcnow().isoformat(),
    }

    # Simple strategy suggestions based on learning style
    if learning_style == "visual":
        profile["recommended_teaching_strategies"] = ["Gunakan diagram, mindmap, dan visualisasi saat mengajar."]
    elif learning_style == "auditory":
        profile["recommended_teaching_strategies"] = ["Gunakan penjelasan lisan, diskusi, dan rekaman audio."]
    elif learning_style == "kinesthetic":
        profile["recommended_teaching_strategies"] = ["Berikan praktik langsung, eksperimen, dan simulasi."]
    else:
        profile["recommended_teaching_strategies"] = ["Sediakan materi bacaan dan aktivitas menulis."]

    # Persist into users collection
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"personality": profile}})
    return profile

async def get_user_profile(user):
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "personality": 1})
    return doc.get("personality") if doc else None

async def get_class_insights(class_id: str):
    # Aggregate simple counts per learning_style for students in a class
    cursor = db.users.find({"enrolled_class": class_id, "personality": {"$exists": True}}, {"personality.learning_style": 1, "user_id": 1})
    counts = {}
    async for u in cursor:
        ls = u.get("personality", {}).get("learning_style")
        if not ls:
            continue
        counts[ls] = counts.get(ls, 0) + 1
    return {"class_id": class_id, "learning_style_counts": counts}

