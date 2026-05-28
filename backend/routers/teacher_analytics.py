import logging
import json
import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from models.user import User, TeacherTitle
from deps.auth import get_current_user, require_pengajar, require_title, write_audit
from services.ai_service import _call_gemini

logger = logging.getLogger(__name__)
router = APIRouter()

ADAPTIF_SUBJECTS = {
    "bahasa indonesia", "bahasa inggris", "matematika", "ppkn",
    "pendidikan agama islam", "pai", "pendidikan agama", "penjasorkes",
    "pjok", "seni budaya", "pkwu", "prakarya", "sejarah indonesia",
    "bahasa daerah", "mulok", "pendidikan pancasila"
}

@router.get("/teacher/students")
async def get_teacher_students(user: User = Depends(require_pengajar)):
    if user.account_type == "pribadi":
        # Guru Mandiri: students enrolled via this teacher's class tokens
        tokens = await db.class_tokens.find({"created_by_user_id": user.user_id}).to_list(1000)
        token_strings = [t["class_token"] for t in tokens]
        query = {
            "class_token_used": {"$in": token_strings},
            "role": "pelajar"
        }
    else:
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")

        # Scope validation: Only Kepala Sekolah, Kurikulum, Guru Kelas, and Guru Pengajar are allowed to view the student roster
        if not any(t in user.all_titles for t in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum, TeacherTitle.guru_kelas, TeacherTitle.guru_pengajar)):
            raise HTTPException(403, "Akses ditolak: Hanya Wali Kelas, Kurikulum, Kepala Sekolah, atau Guru Pengajar yang dapat melihat daftar siswa.")

        query = {
            "institution_code": user.institution_code,
            "role": "pelajar"
        }

        is_guru_kelas = TeacherTitle.guru_kelas in user.all_titles
        is_guru_pengajar = TeacherTitle.guru_pengajar in user.all_titles
        is_admin_or_kuri = any(t in user.all_titles for t in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum))

        if not is_admin_or_kuri:
            allowed_classes = []
            if is_guru_kelas and user.assigned_class:
                allowed_classes.append(user.assigned_class)
            if is_guru_pengajar:
                allowed_classes.extend(list(getattr(user, "teaching_classes", []) or []))
            
            if allowed_classes:
                query["enrolled_class"] = {"$in": allowed_classes}
            elif is_guru_kelas or is_guru_pengajar:
                query["enrolled_class"] = "__none__"

    students = await db.users.find(query, {
        "_id": 0,
        "password": 0,
        "hash": 0,
        "subjects": 0,
        "schedule": 0
    }).sort("name", 1).to_list(1000)

    # Best-effort backfill for institutional SMA-equivalent student majors
    # using existing institution data only (do not infer from class naming).
    try:
        sma_equiv = {"SMA", "SMK", "MA"}
        inst_major = None
        if user.institution_code:
            inst = await db.institutions.find_one({"institution_code": user.institution_code}, {"major": 1, "_id": 0})
            inst_major = (inst or {}).get("major")

        for s in students:
            if s.get("education_level") in sma_equiv and not s.get("major"):
                if inst_major:
                    s["major"] = inst_major
                    await db.users.update_one({"user_id": s.get("user_id")}, {"$set": {"major": inst_major}})
    except Exception as e:
        logger.warning(f"Gagal backfill jurusan siswa: {e}")

    return students

@router.get("/teacher/analytics/quiz/{quiz_id}")
async def get_quiz_analytics(
    quiz_id: str,
    user: User = Depends(require_pengajar)
):
    if user.account_type == "pribadi":
        quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "user_id": user.user_id}, {"_id": 0})
    else:
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")
        quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "institution_code": user.institution_code}, {"_id": 0})

    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")

    if user.account_type != "pribadi":
        is_allowed = (
            quiz.get("user_id") == user.user_id or
            (user.assigned_subject and quiz.get("subject_name") and quiz.get("subject_name").lower() == user.assigned_subject.lower()) or
            TeacherTitle.kepala_sekolah in user.all_titles or
            TeacherTitle.kurikulum in user.all_titles or
            (TeacherTitle.guru_kelas in user.all_titles and quiz.get("class_name") == user.assigned_class)
        )
        if not is_allowed:
            raise HTTPException(403, "Anda tidak memiliki akses ke analitik kuis ini")

    # Ambil hasil dari quiz_results
    if user.account_type == "pribadi":
        results = await db.quiz_results.find({"quiz_id": quiz_id, "status": "ready"}).to_list(5000)
        # Ambil hasil dari student_sessions (kuis mandiri murid les)
        sessions = await db.student_sessions.find({"quiz_id": quiz_id, "status": "ready"}).to_list(5000)
        for s in sessions:
            results.append({
                "score": s.get("score"),
                "answers": s.get("answers"),
                "items": s.get("items"),
                "student_identifier": s.get("student_identifier"),
                "submitted_at": s.get("submitted_at")
            })
    else:
        # B2B Firewall: filter by institution_code, source='institution_class', and academic_year_id
        active_year_id = quiz.get("academic_year_id")
        if not active_year_id:
            active_year = await db.academic_years.find_one({"institution_code": user.institution_code, "is_active": True})
            if active_year:
                active_year_id = active_year.get("academic_year_id")

        query = {
            "quiz_id": quiz_id,
            "status": "ready",
            "institution_code": user.institution_code,
            "source": "institution_class"
        }
        if active_year_id:
            query["academic_year_id"] = active_year_id

        results = await db.quiz_results.find(query).to_list(5000)

    total_submissions = len(results)
    average_score = sum(r.get("score", 0) for r in results) / total_submissions if total_submissions > 0 else 0.0

    questions_stats = []
    questions = quiz.get("questions", [])
    for i, q in enumerate(questions):
        opt_counts = [0, 0, 0, 0]
        correct_count = 0
        for r in results:
            answers = r.get("answers", [])
            if i < len(answers):
                ans_idx = answers[i]
                if 0 <= ans_idx < 4:
                    opt_counts[ans_idx] += 1
                
                # Check correctness
                if r.get("items") and i < len(r["items"]):
                    if r["items"][i].get("is_correct"):
                        correct_count += 1
                else:
                    if ans_idx == q.get("correct_index", 0):
                        correct_count += 1
                        
        success_rate = (correct_count / total_submissions * 100) if total_submissions > 0 else 0.0
        questions_stats.append({
            "question": q.get("question"),
            "options": q.get("options"),
            "correct_index": q.get("correct_index"),
            "option_counts": opt_counts,
            "success_rate": round(success_rate, 1),
        })

    return {
        "quiz_id": quiz_id,
        "title": quiz.get("source_titles", ["Kuis"])[0] if quiz.get("source_titles") else "Kuis",
        "subject_name": quiz.get("subject_name"),
        "class_name": quiz.get("class_name"),
        "total_submissions": total_submissions,
        "average_score": round(average_score, 1),
        "questions": questions_stats,
        "submissions": [
            {
                "student_identifier": r.get("student_identifier") or "Siswa",
                "score": r.get("score"),
                "answers": r.get("answers"),
                "submitted_at": r.get("submitted_at") or r.get("created_at")
            } for r in results if r.get("student_identifier")
        ]
    }

@router.get("/teacher/analytics/class-summary")
async def get_class_summary(
    class_name: Optional[str] = None,
    user: User = Depends(require_pengajar)
):
    if user.account_type == "pribadi":
        # Guru Mandiri alur
        tokens = await db.class_tokens.find({"created_by_user_id": user.user_id}).to_list(1000)
        token_strings = [t["class_token"] for t in tokens]
        
        student_query = {
            "class_token_used": {"$in": token_strings},
            "role": "pelajar"
        }
        if class_name:
            student_query["enrolled_class"] = class_name
            
        students = await db.users.find(student_query).to_list(1000)
    else:
        # Alur Enterprise
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")

        # Class selection rules
        if TeacherTitle.guru_kelas in user.all_titles and TeacherTitle.guru_pengajar not in user.all_titles:
            class_name = user.assigned_class
        elif not class_name:
            # Default to the first class in the institution alphabetically
            first_class = await db.classes.find_one(
                {"institution_code": user.institution_code},
                sort=[("name", 1)]
            )
            if first_class:
                class_name = first_class["name"]
            else:
                # Fallback: try finding first student class
                first_student = await db.users.find_one(
                    {"institution_code": user.institution_code, "role": "pelajar", "enrolled_class": {"$ne": None}},
                    sort=[("enrolled_class", 1)]
                )
                if first_student:
                    class_name = first_student.get("enrolled_class")
                else:
                    return {"class_name": None, "students": []}

        # Access control
        if not any(t in user.all_titles for t in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum, TeacherTitle.guru_kelas, TeacherTitle.guru_pengajar)):
            return {"class_name": class_name, "students": []}

        students = await db.users.find({
            "institution_code": user.institution_code,
            "enrolled_class": class_name,
            "role": "pelajar"
        }).to_list(1000)

    student_ids = [s["user_id"] for s in students]
    query = {"user_id": {"$in": student_ids}, "status": "ready"}
    if user.account_type == "pribadi":
        query["created_by"] = user.user_id
    else:
        # B2B Firewall: filter by institution_code, source='institution_class', and active academic_year_id
        active_year = await db.academic_years.find_one({"institution_code": user.institution_code, "is_active": True})
        active_year_id = active_year.get("academic_year_id") if active_year else None

        query["institution_code"] = user.institution_code
        query["source"] = "institution_class"
        if active_year_id:
            query["academic_year_id"] = active_year_id

    results = await db.quiz_results.find(query).to_list(10000)

    student_summary = []
    for s in students:
        s_results = [r for r in results if r["user_id"] == s["user_id"]]
        
        # Group by subject
        subject_scores = {}
        for r in s_results:
            subj = r.get("subject_name") or "Umum"
            if subj not in subject_scores:
                subject_scores[subj] = []
            subject_scores[subj].append(r.get("score", 0))
            
        subject_averages = {subj: round(sum(scores)/len(scores), 1) for subj, scores in subject_scores.items()}
        overall_avg = sum(r.get("score", 0) for r in s_results) / len(s_results) if s_results else 0.0
        
        student_summary.append({
            "user_id": s["user_id"],
            "name": s["name"],
            "email": s["email"],
            "quiz_count": len(s_results),
            "overall_average": round(overall_avg, 1),
            "subject_averages": subject_averages
        })

    student_summary.sort(key=lambda x: x["name"])

    return {
        "class_name": class_name,
        "students": student_summary
    }

@router.get("/teacher/dashboard")
async def get_teacher_dashboard(user: User = Depends(require_pengajar)):
    if user.account_type == "pribadi":
        # Guru Mandiri
        tokens = await db.class_tokens.find({"created_by_user_id": user.user_id}).to_list(1000)
        token_strings = [t["class_token"] for t in tokens]
        
        student_count = await db.users.count_documents({
            "class_token_used": {"$in": token_strings},
            "role": "pelajar"
        })
        
        mat_query = {"user_id": user.user_id, "status": {"$ne": "deleted"}}
        materials_count = await db.documents.count_documents(mat_query)
        
        quiz_query = {"user_id": user.user_id, "status": {"$ne": "deleted"}}
        quizzes_count = await db.quizzes.count_documents(quiz_query)
        
        # Pull scores from both quiz_results and student_sessions
        res_query = {"created_by": user.user_id, "status": "ready"}
        results = await db.quiz_results.find(res_query, {"score": 1}).to_list(10000)
        
        teacher_quizzes = await db.quizzes.find({"user_id": user.user_id}, {"quiz_id": 1}).to_list(1000)
        quiz_ids = [q["quiz_id"] for q in teacher_quizzes]
        sessions = await db.student_sessions.find({"quiz_id": {"$in": quiz_ids}, "status": "ready"}, {"score": 1}).to_list(10000)
        
        all_scores = [r.get("score", 0) for r in results] + [s.get("score", 0) for s in sessions]
        avg_score = sum(all_scores) / len(all_scores) if all_scores else 0.0
        
        recent_quizzes = await db.quizzes.find(quiz_query, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
        for rq in recent_quizzes:
            rq_id = rq.get("quiz_id")
            rq["submission_count"] = (
                await db.quiz_results.count_documents({"quiz_id": rq_id, "status": "ready"}) +
                await db.student_sessions.count_documents({"quiz_id": rq_id, "status": "ready"})
            )
            
        public_recent_quizzes = []
        for rq in recent_quizzes:
            if isinstance(rq.get("questions"), list):
                rq["questions"] = [{k: v for k, v in q.items() if k != "correct_index"} for q in rq["questions"]]
            public_recent_quizzes.append(rq)
            
        return {
            "metrics": {
                "student_count": student_count,
                "materials_count": materials_count,
                "quizzes_count": quizzes_count,
                "average_score": round(avg_score, 1),
            },
            "recent_quizzes": public_recent_quizzes
        }

    # Alur Enterprise
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi manapun")

    # 1. Count students
    if any(t in user.all_titles for t in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum)):
        student_count = await db.users.count_documents({"institution_code": user.institution_code, "role": "pelajar"})
    elif TeacherTitle.guru_pengajar in user.all_titles:
        classes = list(getattr(user, "teaching_classes", []) or [])
        if not classes:
            classes = await db.shared_schedules.distinct("class_name", {
                "institution_code": user.institution_code,
                "subject_name": user.assigned_subject
            })
        student_count = await db.users.count_documents({
            "institution_code": user.institution_code,
            "enrolled_class": {"$in": classes},
            "role": "pelajar"
        })
    elif TeacherTitle.guru_kelas in user.all_titles:
        student_count = await db.users.count_documents({
            "institution_code": user.institution_code,
            "enrolled_class": user.assigned_class,
            "role": "pelajar"
        })
    else:
        student_count = 0

    # 2. Count materials (documents)
    mat_query = {
        "status": {"$ne": "deleted"},
        "$or": [
            {"user_id": user.user_id},
            {"institution_code": user.institution_code, "visibility": "institution"},
        ],
    }
    if not any(t in user.all_titles for t in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum)):
        conditions = []
        if TeacherTitle.guru_kelas in user.all_titles:
            conditions.append({"target_class_room": user.assigned_class})
        if TeacherTitle.guru_pengajar in user.all_titles:
            conditions.append({"subject_name": user.assigned_subject})
        if conditions:
            # Narrow institution scope, but always include the teacher's own uploads.
            mat_query["$and"] = [
                {"$or": mat_query["$or"]},
                {"$or": [{"user_id": user.user_id}] + conditions},
            ]
            mat_query.pop("$or", None)
    materials_count = await db.documents.count_documents(mat_query)

    # 3. Count quizzes
    active_year = await db.academic_years.find_one({"institution_code": user.institution_code, "is_active": True})
    active_year_id = active_year.get("academic_year_id") if active_year else None

    inst_quiz_filter = {"institution_code": user.institution_code}
    if active_year_id:
        inst_quiz_filter["academic_year_id"] = active_year_id

    quiz_query = {
        "status": {"$ne": "deleted"},
        "$or": [
            {"user_id": user.user_id},
            inst_quiz_filter,
        ],
    }
    if not any(t in user.all_titles for t in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum)):
        conditions = []
        if TeacherTitle.guru_kelas in user.all_titles:
            conditions.append({"class_name": user.assigned_class})
        if TeacherTitle.guru_pengajar in user.all_titles:
            conditions.append({"subject_name": user.assigned_subject})
        if conditions:
            quiz_query["$and"] = [
                {"$or": quiz_query["$or"]},
                {"$or": [{"user_id": user.user_id}] + conditions},
            ]
            quiz_query.pop("$or", None)
    quizzes_count = await db.quizzes.count_documents(quiz_query)

    # 4. Average score
    res_query = {
        "institution_code": user.institution_code, 
        "status": "ready",
        "source": "institution_class"
    }
    if active_year_id:
        res_query["academic_year_id"] = active_year_id
    if not any(t in user.all_titles for t in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum)):
        conditions = []
        if TeacherTitle.guru_kelas in user.all_titles:
            conditions.append({"student_class": user.assigned_class})
        if TeacherTitle.guru_pengajar in user.all_titles:
            conditions.append({"subject_name": user.assigned_subject})
        if conditions:
            if len(conditions) == 1:
                res_query.update(conditions[0])
            else:
                res_query["$or"] = conditions

    results = await db.quiz_results.find(res_query, {"score": 1}).to_list(10000)
    avg_score = sum(r.get("score", 0) for r in results) / len(results) if results else 0.0

    # Recent quizzes list
    recent_quizzes = await db.quizzes.find(quiz_query, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    for rq in recent_quizzes:
        rq_id = rq.get("quiz_id")
        rq["submission_count"] = await db.quiz_results.count_documents({
            "quiz_id": rq_id, 
            "status": "ready",
            "institution_code": user.institution_code,
            "source": "institution_class"
        })

    # Mask correct index from returned quizzes for security if needed (already done in _public_quiz, but here they are raw, so we can keep the public version structure or strip correct index)
    public_recent_quizzes = []
    for rq in recent_quizzes:
        if isinstance(rq.get("questions"), list):
            rq["questions"] = [{k: v for k, v in q.items() if k != "correct_index"} for q in rq["questions"]]
        public_recent_quizzes.append(rq)

    return {
        "metrics": {
            "student_count": student_count,
            "materials_count": materials_count,
            "quizzes_count": quizzes_count,
            "average_score": round(avg_score, 1),
        },
        "recent_quizzes": public_recent_quizzes
    }

@router.get("/teacher/quizzes/{quiz_id}/insights")
async def get_teacher_quiz_insights(
    quiz_id: str,
    user: User = Depends(require_pengajar)
):
    if user.account_type == "pribadi":
        quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "user_id": user.user_id}, {"_id": 0})
    else:
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")
        quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "institution_code": user.institution_code}, {"_id": 0})

    if not quiz:
        raise HTTPException(status_code=404, detail="Kuis tidak ditemukan")

    # Access control
    if user.account_type != "pribadi":
        is_allowed = (
            quiz.get("user_id") == user.user_id or
            (user.assigned_subject and quiz.get("subject_name") and quiz.get("subject_name").lower() == user.assigned_subject.lower()) or
            TeacherTitle.kepala_sekolah in user.all_titles or
            TeacherTitle.kurikulum in user.all_titles or
            (TeacherTitle.guru_kelas in user.all_titles and quiz.get("class_name") == user.assigned_class)
        )
        if not is_allowed:
            raise HTTPException(403, "Anda tidak memiliki akses ke kuis ini")

    # Count total submissions
    results_count = await db.quiz_results.count_documents({"quiz_id": quiz_id, "status": "ready"})
    sessions_count = await db.student_sessions.count_documents({"quiz_id": quiz_id, "status": "ready"})
    total_submissions = results_count + sessions_count

    if total_submissions == 0:
        return {"insight_text": "Belum ada pengerjaan kuis dari siswa untuk dianalisis oleh AI."}

    # Check cache
    now = datetime.now(timezone.utc)
    cached = await db.quiz_insights.find_one({"quiz_id": quiz_id})
    if cached:
        cached_until_str = cached.get("cached_until")
        if cached_until_str:
            cached_until = datetime.fromisoformat(cached_until_str)
            if now < cached_until and cached.get("last_submission_count") == total_submissions:
                return {"insight_text": cached["insight_text"]}

    # Perform statistics aggregation
    results = await db.quiz_results.find({"quiz_id": quiz_id, "status": "ready"}).to_list(5000)
    sessions = await db.student_sessions.find({"quiz_id": quiz_id, "status": "ready"}).to_list(5000)
    for s in sessions:
        results.append({
            "score": s.get("score"),
            "answers": s.get("answers"),
            "items": s.get("items")
        })

    questions = quiz.get("questions") or []
    question_stats = []
    skill_scores = defaultdict(list)

    for i, q in enumerate(questions):
        correct_count = 0
        skill = q.get("skill_type") or "konsep"
        for r in results:
            answers = r.get("answers", [])
            if i < len(answers):
                ans_idx = answers[i]
                is_correct = False
                if r.get("items") and i < len(r["items"]):
                    is_correct = r["items"][i].get("is_correct", False)
                else:
                    is_correct = (ans_idx == q.get("correct_index", 0))
                
                if is_correct:
                    correct_count += 1

        success_rate = (correct_count / total_submissions * 100) if total_submissions > 0 else 0.0
        question_stats.append({
            "question": q.get("question")[:100],
            "skill_type": skill,
            "success_rate": round(success_rate, 1)
        })
        skill_scores[skill].append(success_rate)

    skill_stats = {}
    for skill, rates in skill_scores.items():
        skill_stats[skill] = round(sum(rates) / len(rates), 1)

    # Call Gemini to generate narrative feedback
    system = (
        "Kamu adalah EduScanner AI, konsultan pedagogi guru. "
        "Tugasmu menganalisis performa kuis siswa les privat/mandiri dan memberikan insight kelemahan topik/skill siswa. "
        "Gunakan Bahasa Indonesia yang santai tapi profesional. Berikan saran pengajaran spesifik. "
        "Jangan gunakan markdown tebal (** atau ###) dalam jawaban. Gunakan teks biasa."
    )
    prompt = (
        f"Mata Pelajaran: {quiz.get('subject_name') or 'Umum'}\n"
        f"Total Siswa: {total_submissions}\n"
        f"Agregat performa kuis per skill/topik:\n{json.dumps(skill_stats)}\n\n"
        f"Detail soal kuis dan tingkat sukses:\n{json.dumps(question_stats)}\n\n"
        "Berikan analisis kelemahan topik (misal: 'Geometri Lemah: 42%') dan rekomendasi pengajaran untuk memantapkan pemahaman siswa."
    )

    try:
        insight_text = await _call_gemini(system, prompt)
        insight_text = re.sub(r'<think>[\s\S]*?</think>', '', insight_text, flags=re.IGNORECASE).strip()
    except Exception as e:
        logger.error(f"Failed to call Gemini for quiz insights: {e}")
        insight_text = "Gagal memproses analisis AI kelemahan kuis karena batasan kuota layanan."

    # Cache the result
    cached_until_dt = now + timedelta(minutes=15)
    insight_doc = {
        "quiz_id": quiz_id,
        "insight_text": insight_text,
        "cached_until": cached_until_dt.isoformat(),
        "last_submission_count": total_submissions,
        "created_at": now.isoformat()
    }
    await db.quiz_insights.update_one({"quiz_id": quiz_id}, {"$set": insight_doc}, upsert=True)

    return {"insight_text": insight_text}


@router.get("/teacher/analytics/pribadi/students")
async def get_pribadi_students_analysis(user: User = Depends(require_pengajar)):
    if user.account_type != "pribadi":
        raise HTTPException(403, "Hanya untuk Guru Mandiri")

    tokens = await db.class_tokens.find({"created_by_user_id": user.user_id}).to_list(1000)
    token_strings = [t["class_token"] for t in tokens]
    students = await db.users.find(
        {"class_token_used": {"$in": token_strings}, "role": "pelajar"},
        {"_id": 0, "password": 0, "hash": 0}
    ).sort("name", 1).to_list(1000)

    teacher_quiz_ids = [q["quiz_id"] for q in await db.quizzes.find({"user_id": user.user_id}, {"quiz_id": 1}).to_list(1000)]
    quiz_map = {}
    for q in await db.quizzes.find({"user_id": user.user_id}, {"_id": 0, "quiz_id": 1, "source_titles": 1, "subject_name": 1, "questions": 1}).to_list(1000):
        quiz_map[q["quiz_id"]] = q

    result_list = []
    for s in students:
        uid = s["user_id"]
        q_results = await db.quiz_results.find({"user_id": uid, "quiz_id": {"$in": teacher_quiz_ids}, "status": "ready"}).to_list(500)
        sessions = await db.student_sessions.find({"student_user_id": uid, "quiz_id": {"$in": teacher_quiz_ids}, "status": "ready"}).to_list(500)

        combined = []
        for r in q_results:
            qid = r.get("quiz_id")
            qinfo = quiz_map.get(qid, {})
            combined.append({
                "quiz_id": qid,
                "quiz_title": (qinfo.get("source_titles") or ["Kuis"])[0] if qinfo.get("source_titles") else "Kuis",
                "subject_name": qinfo.get("subject_name") or r.get("subject_name") or "Umum",
                "score": r.get("score", 0),
                "answers": r.get("answers", []),
                "items": r.get("items", []),
                "submitted_at": r.get("created_at") or r.get("submitted_at")
            })
        for ses in sessions:
            qid = ses.get("quiz_id")
            qinfo = quiz_map.get(qid, {})
            combined.append({
                "quiz_id": qid,
                "quiz_title": (qinfo.get("source_titles") or ["Kuis"])[0] if qinfo.get("source_titles") else "Kuis",
                "subject_name": qinfo.get("subject_name") or "Umum",
                "score": ses.get("score", 0),
                "answers": ses.get("answers", []),
                "items": ses.get("items", []),
                "submitted_at": ses.get("submitted_at"),
                "source": "redeem"
            })

        combined.sort(key=lambda x: x.get("submitted_at") or "", reverse=True)

        subject_scores = {}
        skill_stats = defaultdict(lambda: {"correct": 0, "total": 0})
        for c in combined:
            subj = c["subject_name"]
            if subj not in subject_scores:
                subject_scores[subj] = []
            subject_scores[subj].append(c["score"])
            items = c.get("items", [])
            for item in items:
                sk = item.get("skill_type") or "konsep"
                skill_stats[sk]["total"] += 1
                if item.get("is_correct"):
                    skill_stats[sk]["correct"] += 1

        overall_avg = round(sum(c["score"] for c in combined) / len(combined), 1) if combined else 0.0
        subject_avgs = {subj: round(sum(scores) / len(scores), 1) for subj, scores in subject_scores.items()}
        skill_breakdown = {}
        for sk, st in skill_stats.items():
            skill_breakdown[sk] = {"correct": st["correct"], "total": st["total"], "percentage": round((st["correct"] / st["total"]) * 100, 1) if st["total"] > 0 else 0}

        result_list.append({
            "user_id": uid,
            "name": s.get("name", "Siswa"),
            "email": s.get("email"),
            "enrolled_class": s.get("enrolled_class"),
            "class_token_used": s.get("class_token_used"),
            "quiz_count": len(combined),
            "overall_average": overall_avg,
            "subject_averages": subject_avgs,
            "skill_breakdown": skill_breakdown,
            "score_history": combined[:20]
        })

    return {"students": result_list}


@router.post("/teacher/analytics/student/{student_id}/analyze")
async def analyze_student_character(
    student_id: str,
    user: User = Depends(require_pengajar),
    request: Request = None
):
    if user.account_type != "pribadi":
        raise HTTPException(403, "Hanya untuk Guru Mandiri")

    tokens = await db.class_tokens.find({"created_by_user_id": user.user_id}).to_list(1000)
    token_strings = [t["class_token"] for t in tokens]
    student = await db.users.find_one(
        {"user_id": student_id, "class_token_used": {"$in": token_strings}, "role": "pelajar"},
        {"_id": 0, "password": 0, "hash": 0}
    )
    if not student:
        raise HTTPException(404, "Siswa tidak ditemukan")

    teacher_quiz_ids = [q["quiz_id"] for q in await db.quizzes.find({"user_id": user.user_id}, {"quiz_id": 1}).to_list(1000)]

    q_results = await db.quiz_results.find({"user_id": student_id, "quiz_id": {"$in": teacher_quiz_ids}, "status": "ready"}).to_list(500)
    sessions = await db.student_sessions.find({"student_user_id": student_id, "quiz_id": {"$in": teacher_quiz_ids}, "status": "ready"}).to_list(500)

    combined = []
    for r in q_results:
        combined.append({"score": r.get("score", 0), "subject_name": r.get("subject_name", "Umum"), "submitted_at": r.get("created_at"), "items": r.get("items", [])})
    for ses in sessions:
        combined.append({"score": ses.get("score", 0), "subject_name": "Umum", "submitted_at": ses.get("submitted_at"), "items": ses.get("items", [])})

    if not combined:
        return {
            "student_name": student.get("name", "Siswa"),
            "analysis": "Belum ada data kuis yang cukup untuk menganalisis karakter belajar siswa ini.",
            "summary": "Belum ada data."
        }

    combined.sort(key=lambda x: x.get("submitted_at") or "")
    total = len(combined)
    avg_score = round(sum(c["score"] for c in combined) / total, 1)
    latest_scores = [c["score"] for c in combined[-5:]]
    trend = (latest_scores[-1] - latest_scores[0]) / max(latest_scores[0], 1) * 100 if len(latest_scores) >= 2 else 0
    trend_desc = "meningkat" if trend > 5 else ("menurun" if trend < -5 else "stabil")

    skill_stats = defaultdict(lambda: {"correct": 0, "total": 0})
    for c in combined:
        for item in c.get("items", []):
            sk = item.get("skill_type") or "konsep"
            skill_stats[sk]["total"] += 1
            if item.get("is_correct"):
                skill_stats[sk]["correct"] += 1
    strong_skills = [sk for sk, st in skill_stats.items() if st["total"] > 0 and (st["correct"] / st["total"]) >= 0.7]
    weak_skills = [sk for sk, st in skill_stats.items() if st["total"] > 0 and (st["correct"] / st["total"]) < 0.5]

    system = (
        "Kamu adalah EduScanner AI, konsultan pedagogi yang menganalisis karakter belajar siswa les privat. "
        "Gunakan Bahasa Indonesia santai tapi profesional. "
        "Beri analisis tentang: gaya belajar, kekuatan akademik, area yang perlu ditingkatkan, "
        "dan rekomendasi personal untuk guru. "
        "Jangan gunakan markdown tebal (** atau ###). Gunakan teks biasa."
    )
    prompt = (
        f"Nama Siswa: {student.get('name', 'Siswa')}\n"
        f"Total Kuis Dikerjakan: {total}\n"
        f"Skor Rata-rata: {avg_score}%\n"
        f"Tren Nilai Terakhir: {trend_desc} (perubahan {trend:.1f}%)\n"
        f"Kekuatan ({', '.join(strong_skills) if strong_skills else 'Belum teridentifikasi'}):\n"
        f"Kelemahan ({', '.join(weak_skills) if weak_skills else 'Belum teridentifikasi'}):\n"
        f"Detail performa per skill: {dict(skill_stats)}\n\n"
        "Berdasarkan data ini, berikan analisis karakter belajar siswa dan rekomendasi pengajaran yang personal."
    )

    try:
        analysis = await _call_gemini(system, prompt)
        analysis = re.sub(r'<think>[\s\S]*?</think>', '', analysis, flags=re.IGNORECASE).strip()
    except Exception as e:
        logger.error(f"Failed to call Gemini for student analysis: {e}")
        analysis = "Gagal memproses analisis karakter siswa karena batasan kuota layanan."

    summary_line = f"{student.get('name', 'Siswa')} mengerjakan {total} kuis dengan rata-rata {avg_score}%. Tren: {trend_desc}."

    return {
        "student_name": student.get("name", "Siswa"),
        "analysis": analysis,
        "summary": summary_line,
        "total_quizzes": total,
        "average_score": avg_score,
        "trend": trend_desc,
        "strong_skills": strong_skills,
        "weak_skills": weak_skills
    }


def _is_productive_subject(subject_name: str) -> bool:
    if not subject_name:
        return False
    return subject_name.strip().lower() not in ADAPTIF_SUBJECTS


async def _check_quiz_access(quiz_id: str, user: User) -> Optional[dict]:
    if user.account_type == "pribadi":
        return await db.quizzes.find_one({"quiz_id": quiz_id, "user_id": user.user_id}, {"_id": 0})
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi manapun")
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "institution_code": user.institution_code}, {"_id": 0})
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
    is_allowed = (
        quiz.get("user_id") == user.user_id or
        TeacherTitle.kepala_sekolah in user.all_titles or
        TeacherTitle.kurikulum in user.all_titles or
        (TeacherTitle.guru_kelas in user.all_titles and (
            quiz.get("class_name") == user.assigned_class or
            user.assigned_class in quiz.get("target_class_rooms", [])
        )) or
        (TeacherTitle.kajur in user.all_titles and (
            quiz.get("subject_name") and quiz["subject_name"].strip().lower() == (user.assigned_subject or "").strip().lower()
        )) or
        (user.assigned_subject and quiz.get("subject_name") and
         quiz["subject_name"].strip().lower() == user.assigned_subject.strip().lower())
    )
    if not is_allowed:
        raise HTTPException(403, "Anda tidak memiliki akses ke kuis ini")
    return quiz


async def _ensure_missed_results(quiz: dict):
    if quiz.get("status") != "published":
        return
    deadline_str = quiz.get("deadline")
    if not deadline_str:
        return
    deadline = datetime.fromisoformat(deadline_str)
    if deadline > datetime.now(timezone.utc):
        return

    target_classes = quiz.get("target_class_rooms") or ([quiz.get("class_name")] if quiz.get("class_name") else [])
    if not target_classes or not quiz.get("institution_code"):
        return

    students = await db.users.find({
        "institution_code": quiz["institution_code"],
        "enrolled_class": {"$in": target_classes},
        "role": "pelajar"
    }, {"user_id": 1}).to_list(2000)

    existing = await db.quiz_results.find(
        {"quiz_id": quiz["quiz_id"], "status": {"$ne": "deleted"}},
        {"user_id": 1}
    ).to_list(2000)
    submitted_ids = {r["user_id"] for r in existing}

    now = datetime.now(timezone.utc).isoformat()
    for s in students:
        uid = s["user_id"]
        if uid in submitted_ids:
            continue
        exists = await db.quiz_results.find_one({"quiz_id": quiz["quiz_id"], "user_id": uid})
        if exists:
            continue
        await db.quiz_results.insert_one({
            "result_id": uuid.uuid4().hex,
            "quiz_id": quiz["quiz_id"],
            "document_id": quiz.get("document_id"),
            "user_id": uid,
            "created_by": quiz.get("user_id"),
            "answers": [],
            "score": 0,
            "summary": "Tidak mengerjakan kuis sebelum deadline. Nilai otomatis 0.",
            "items": [],
            "status": "ready",
            "institution_code": quiz.get("institution_code"),
            "student_class": s.get("enrolled_class"),
            "subject_name": quiz.get("subject_name"),
            "source": "institution_class",
            "created_at": now,
        })


@router.get("/teacher/quizzes/{quiz_id}/results")
async def get_quiz_student_results(
    quiz_id: str,
    user: User = Depends(require_pengajar)
):
    quiz = await _check_quiz_access(quiz_id, user)

    if user.account_type != "pribadi" and TeacherTitle.kajur in user.all_titles:
        if not _is_productive_subject(quiz.get("subject_name")):
            raise HTTPException(403, "Kajur/Kaprog hanya dapat mengakses nilai mata pelajaran produktif (kejuruan)")

    if quiz.get("institution_code"):
        await _ensure_missed_results(quiz)

    target_classes = quiz.get("target_class_rooms") or ([quiz.get("class_name")] if quiz.get("class_name") else [])

    results_query = {
        "quiz_id": quiz_id,
        "status": "ready"
    }
    if quiz.get("institution_code"):
        results_query["institution_code"] = quiz["institution_code"]
        results_query["source"] = "institution_class"

    results = await db.quiz_results.find(results_query).to_list(5000)
    results_by_user = {r["user_id"]: r for r in results}

    student_query = {
        "institution_code": quiz.get("institution_code"),
        "enrolled_class": {"$in": target_classes},
        "role": "pelajar"
    } if target_classes and quiz.get("institution_code") else {
        "user_id": {"$in": [r["user_id"] for r in results]},
        "role": "pelajar"
    }

    # Scope for guru_kelas
    if TeacherTitle.guru_kelas in user.all_titles and user.assigned_class and target_classes:
        student_query["enrolled_class"] = user.assigned_class

    students = await db.users.find(student_query, {
        "_id": 0, "user_id": 1, "name": 1, "email": 1, "enrolled_class": 1
    }).to_list(2000)

    student_list = []
    for s in students:
        r = results_by_user.get(s["user_id"])
        student_list.append({
            "user_id": s["user_id"],
            "name": s.get("name", "Siswa"),
            "email": s.get("email"),
            "class": s.get("enrolled_class"),
            "score": r.get("score") if r else 0,
            "status": r.get("status") if r else ("missed" if quiz.get("deadline") and datetime.fromisoformat(quiz["deadline"]) < datetime.now(timezone.utc) else "pending"),
            "submitted_at": r.get("created_at") if r else None,
            "result_id": r.get("result_id") if r else None,
            "summary": (r.get("summary") or "")[:200] if r else None,
        })

    student_list.sort(key=lambda x: x["name"] or "")

    return {
        "quiz_id": quiz_id,
        "title": quiz.get("source_titles", ["Kuis"])[0] if quiz.get("source_titles") else "Kuis",
        "subject_name": quiz.get("subject_name"),
        "target_classes": target_classes,
        "deadline": quiz.get("deadline"),
        "total_students": len(student_list),
        "submitted_count": sum(1 for s in student_list if s["status"] == "ready"),
        "missed_count": sum(1 for s in student_list if s["status"] == "missed"),
        "pending_count": sum(1 for s in student_list if s["status"] == "pending"),
        "average_score": round(
            sum(s["score"] for s in student_list if s["status"] == "ready") /
            max(sum(1 for s in student_list if s["status"] == "ready"), 1), 1
        ),
        "students": student_list,
    }
