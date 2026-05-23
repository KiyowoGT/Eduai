import logging
import json
import re
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

        # Scope validation: Only Kepala Sekolah, Kurikulum, and Guru Kelas (Wali Kelas) are allowed to view the student roster
        if user.title not in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum, TeacherTitle.guru_kelas):
            raise HTTPException(403, "Akses ditolak: Hanya Wali Kelas, Kurikulum, atau Kepala Sekolah yang dapat melihat daftar siswa.")

        query = {
            "institution_code": user.institution_code,
            "role": "pelajar"
        }

        if user.title == TeacherTitle.guru_kelas:
            query["enrolled_class"] = user.assigned_class

    students = await db.users.find(query, {
        "_id": 0,
        "password": 0,
        "hash": 0,
        "subjects": 0,
        "schedule": 0
    }).sort("name", 1).to_list(1000)

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
            quiz.get("subject_name").lower() == user.assigned_subject.lower()
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
        if user.title == TeacherTitle.guru_kelas:
            class_name = user.assigned_class
        elif not class_name:
            raise HTTPException(400, "Parameter query class_name wajib ditentukan")

        # Access control
        if user.title not in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum, TeacherTitle.guru_kelas):
            raise HTTPException(403, "Akses ditolak: Hanya Wali Kelas, Kurikulum, atau Kepala Sekolah yang dapat melihat ringkasan nilai kelas.")

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
    if user.title in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum):
        student_count = await db.users.count_documents({"institution_code": user.institution_code, "role": "pelajar"})
    elif user.title == TeacherTitle.guru_kelas:
        student_count = await db.users.count_documents({
            "institution_code": user.institution_code,
            "enrolled_class": user.assigned_class,
            "role": "pelajar"
        })
    elif user.title == TeacherTitle.guru_pengajar:
        classes = await db.shared_schedules.distinct("class_name", {
            "institution_code": user.institution_code,
            "subject_name": user.assigned_subject
        })
        student_count = await db.users.count_documents({
            "institution_code": user.institution_code,
            "enrolled_class": {"$in": classes},
            "role": "pelajar"
        })
    else:
        student_count = 0

    # 2. Count materials (documents)
    mat_query = {"institution_code": user.institution_code, "visibility": "institution", "status": {"$ne": "deleted"}}
    if user.title == TeacherTitle.guru_kelas:
        mat_query["target_class_room"] = user.assigned_class
    elif user.title == TeacherTitle.guru_pengajar:
        mat_query["subject_name"] = user.assigned_subject
    materials_count = await db.documents.count_documents(mat_query)

    # 3. Count quizzes
    active_year = await db.academic_years.find_one({"institution_code": user.institution_code, "is_active": True})
    active_year_id = active_year.get("academic_year_id") if active_year else None

    quiz_query = {"institution_code": user.institution_code, "status": {"$ne": "deleted"}}
    if active_year_id:
        quiz_query["academic_year_id"] = active_year_id
    if user.title == TeacherTitle.guru_kelas:
        quiz_query["class_name"] = user.assigned_class
    elif user.title == TeacherTitle.guru_pengajar:
        quiz_query["subject_name"] = user.assigned_subject
    quizzes_count = await db.quizzes.count_documents(quiz_query)

    # 4. Average score
    res_query = {
        "institution_code": user.institution_code, 
        "status": "ready",
        "source": "institution_class"
    }
    if active_year_id:
        res_query["academic_year_id"] = active_year_id
    if user.title == TeacherTitle.guru_kelas:
        res_query["student_class"] = user.assigned_class
    elif user.title == TeacherTitle.guru_pengajar:
        res_query["subject_name"] = user.assigned_subject

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
            quiz.get("subject_name").lower() == user.assigned_subject.lower()
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

