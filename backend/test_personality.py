"""
White Box Testing untuk Personality Service
Test personality calculation functions step by step
"""

import sys
import os

# Add backend directory to sys.path
backend_path = os.path.abspath(os.path.dirname(__file__))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from services.personality_service import (
    calculate_mbti_type,
    calculate_learning_style,
    get_strengths_and_challenges
)
from models.user import MBTIType, LearningStyle

# ============ TEST 1: calculate_mbti_type() ============
def test_calculate_mbti_type_extrovert_thinking_judging():
    """
    Test case: Scores indicate ENTJ (Extrovert, iNtuition, Thinking, Judging)
    - E (Extrovert) score: 75 > I (Introvert) score: 25
    - N (iNtuition) score: 70 > S (Sensing) score: 30
    - T (Thinking) score: 80 > F (Feeling) score: 20
    - J (Judging) score: 75 > P (Perceiving) score: 25
    """
    scores = {
        "E": 75,
        "I": 25,
        "N": 70,
        "S": 30,
        "T": 80,
        "F": 20,
        "J": 75,
        "P": 25
    }
    
    result = calculate_mbti_type(scores)
    
    print(f"Input scores: {scores}")
    print(f"Expected: ENTJ")
    print(f"Got: {result.value if result else 'None'}")
    
    assert result == MBTIType.ENTJ, f"Expected ENTJ, got {result}"
    print("✅ TEST 1 PASSED: ENTJ type correctly identified\n")


def test_calculate_mbti_type_introvert_feeling_perceiving():
    """
    Test case: Scores indicate INFP (Introvert, iNtuition, Feeling, Perceiving)
    - I (Introvert) score: 80 > E (Extrovert) score: 20
    - N (iNtuition) score: 75 > S (Sensing) score: 25
    - F (Feeling) score: 85 > T (Thinking) score: 15
    - P (Perceiving) score: 70 > J (Judging) score: 30
    """
    scores = {
        "E": 20,
        "I": 80,
        "N": 75,
        "S": 25,
        "T": 15,
        "F": 85,
        "J": 30,
        "P": 70
    }
    
    result = calculate_mbti_type(scores)
    
    print(f"Input scores: {scores}")
    print(f"Expected: INFP")
    print(f"Got: {result.value if result else 'None'}")
    
    assert result == MBTIType.INFP, f"Expected INFP, got {result}"
    print("✅ TEST 2 PASSED: INFP type correctly identified\n")


def test_calculate_mbti_type_balanced_scores():
    """
    Test case: Balanced scores (tie breaker)
    When scores are equal, should pick first in pair
    - E: 50, I: 50 → pick E (Extrovert wins on tie)
    - S: 50, N: 50 → pick S (Sensing wins on tie)
    - T: 50, F: 50 → pick T (Thinking wins on tie)
    - J: 50, P: 50 → pick J (Judging wins on tie)
    Result: ESTJ
    """
    scores = {
        "E": 50,
        "I": 50,
        "S": 50,
        "N": 50,
        "T": 50,
        "F": 50,
        "J": 50,
        "P": 50
    }
    
    result = calculate_mbti_type(scores)
    
    print(f"Input scores: {scores}")
    print(f"Expected: ESTJ (tie-breaker default)")
    print(f"Got: {result.value if result else 'None'}")
    
    assert result == MBTIType.ESTJ, f"Expected ESTJ on tie, got {result}"
    print("✅ TEST 3 PASSED: Tie-breaker correctly defaults to ESTJ\n")


def test_calculate_mbti_type_invalid_scores():
    """
    Test case: Invalid/empty scores
    Function should handle gracefully (return None or default)
    """
    scores = {}
    
    result = calculate_mbti_type(scores)
    
    print(f"Input scores: {scores}")
    print(f"Expected: None or exception handled")
    print(f"Got: {result}")
    
    assert result is None, f"Expected None, got {result}"
    print("✅ TEST 4 PASSED: Invalid scores handled gracefully\n")


# ============ TEST 5: calculate_learning_style() ============
def test_calculate_learning_style_visual_dominant():
    """
    Test case: Visual learning style dominates
    Input: visual=10, auditory=2, kinesthetic=1, reading_writing=0
    Expected: LearningStyle.visual
    """
    style_scores = {
        "visual": 10,
        "auditory": 2,
        "kinesthetic": 1,
        "reading_writing": 0
    }
    
    result = calculate_learning_style(style_scores)
    
    print(f"Input style scores: {style_scores}")
    print(f"Expected: visual")
    print(f"Got: {result.value if result else 'None'}")
    
    assert result == LearningStyle.visual, f"Expected visual, got {result}"
    print("✅ TEST 5 PASSED: Visual learning style correctly identified\n")


def test_calculate_learning_style_kinesthetic_dominant():
    """
    Test case: Kinesthetic learning style dominates
    Input: visual=1, auditory=2, kinesthetic=9, reading_writing=1
    Expected: LearningStyle.kinesthetic
    """
    style_scores = {
        "visual": 1,
        "auditory": 2,
        "kinesthetic": 9,
        "reading_writing": 1
    }
    
    result = calculate_learning_style(style_scores)
    
    print(f"Input style scores: {style_scores}")
    print(f"Expected: kinesthetic")
    print(f"Got: {result.value if result else 'None'}")
    
    assert result == LearningStyle.kinesthetic, f"Expected kinesthetic, got {result}"
    print("✅ TEST 6 PASSED: Kinesthetic learning style correctly identified\n")


def test_calculate_learning_style_auditory_dominant():
    """
    Test case: Auditory learning style dominates
    Input: visual=2, auditory=8, kinesthetic=2, reading_writing=1
    Expected: LearningStyle.auditory
    """
    style_scores = {
        "visual": 2,
        "auditory": 8,
        "kinesthetic": 2,
        "reading_writing": 1
    }
    
    result = calculate_learning_style(style_scores)
    
    print(f"Input style scores: {style_scores}")
    print(f"Expected: auditory")
    print(f"Got: {result.value if result else 'None'}")
    
    assert result == LearningStyle.auditory, f"Expected auditory, got {result}"
    print("✅ TEST 7 PASSED: Auditory learning style correctly identified\n")


def test_calculate_learning_style_reading_writing_dominant():
    """
    Test case: Reading/Writing learning style dominates
    Input: visual=1, auditory=1, kinesthetic=1, reading_writing=7
    Expected: LearningStyle.reading_writing
    """
    style_scores = {
        "visual": 1,
        "auditory": 1,
        "kinesthetic": 1,
        "reading_writing": 7
    }
    
    result = calculate_learning_style(style_scores)
    
    print(f"Input style scores: {style_scores}")
    print(f"Expected: reading_writing")
    print(f"Got: {result.value if result else 'None'}")
    
    assert result == LearningStyle.reading_writing, f"Expected reading_writing, got {result}"
    print("✅ TEST 8 PASSED: Reading/Writing learning style correctly identified\n")


def test_calculate_learning_style_balanced():
    """
    Test case: Balanced learning style (tie)
    Input: visual=3, auditory=3, kinesthetic=2, reading_writing=2
    Expected: visual (tie-breaker picks first max)
    """
    style_scores = {
        "visual": 3,
        "auditory": 3,
        "kinesthetic": 2,
        "reading_writing": 2
    }
    
    result = calculate_learning_style(style_scores)
    
    print(f"Input style scores: {style_scores}")
    print(f"Expected: visual (tie-breaker)")
    print(f"Got: {result.value if result else 'None'}")
    
    # Should pick visual (first in alphabetical order or tie-breaker logic)
    assert result in [LearningStyle.visual, LearningStyle.auditory], \
        f"Expected visual or auditory on tie, got {result}"
    print("✅ TEST 9 PASSED: Balanced learning style handled correctly\n")


def test_calculate_learning_style_empty():
    """
    Test case: Empty learning style scores
    Input: {}
    Expected: None (graceful handling)
    """
    style_scores = {}
    
    result = calculate_learning_style(style_scores)
    
    print(f"Input style scores: {style_scores}")
    print(f"Expected: None")
    print(f"Got: {result}")
    
    assert result is None, f"Expected None, got {result}"
    print("✅ TEST 10 PASSED: Empty learning style handled gracefully\n")


def test_calculate_learning_style_none_input():
    """
    Test case: None input
    Input: None
    Expected: None (graceful handling)
    """
    result = calculate_learning_style(None)
    
    print(f"Input style scores: None")
    print(f"Expected: None")
    print(f"Got: {result}")
    
    assert result is None, f"Expected None, got {result}"
    print("✅ TEST 11 PASSED: None input handled gracefully\n")


# ============ TEST 12: get_strengths_and_challenges() ============
def test_get_strengths_and_challenges_entj():
    """
    Test case: ENTJ personality (Commander)
    - Kekuatan: Kolaboratif dan komunikatif, Pemikiran konseptual dan kreatif, Logis dan analitis, Terorganisir dan tepat waktu
    - Tantangan: Mudah terdistraksi di lingkungan ramai, Cenderung mengabaikan detail kecil, Kurang peka terhadap dinamika emosional kelompok, Kurang fleksibel terhadap perubahan mendadak
    """
    mbti_type = MBTIType.ENTJ
    
    res = get_strengths_and_challenges(mbti_type, None)
    strengths = res["strengths"]
    challenges = res["challenges"]
    
    print(f"Input MBTI: {mbti_type.value}")
    print(f"Got strengths: {strengths}")
    print(f"Got challenges: {challenges}")
    
    # Verify strengths
    assert "Kolaboratif dan komunikatif" in strengths, "Should have E strength"
    assert "Pemikiran konseptual dan kreatif" in strengths, "Should have N strength"
    assert "Logis dan analitis" in strengths, "Should have T strength"
    assert "Terorganisir dan tepat waktu" in strengths, "Should have J strength"
    assert len(strengths) == 4, f"Should have 4 strengths, got {len(strengths)}"
    
    # Verify challenges
    assert "Mudah terdistraksi di lingkungan ramai" in challenges, "Should have E challenge"
    assert "Cenderung mengabaikan detail kecil" in challenges, "Should have N challenge"
    assert "Kurang peka terhadap dinamika emosional kelompok" in challenges, "Should have T challenge"
    assert "Kurang fleksibel terhadap perubahan mendadak" in challenges, "Should have J challenge"
    assert len(challenges) == 4, f"Should have 4 challenges, got {len(challenges)}"
    
    print("✅ TEST 12 PASSED: ENTJ strengths and challenges correctly identified\n")


def test_get_strengths_and_challenges_infp():
    """
    Test case: INFP personality (Mediator)
    - Kekuatan: Fokus mendalam dan kemandirian tinggi, Pemikiran konseptual dan kreatif, Empati tinggi dan kooperatif, Adaptif dan spontan
    - Tantangan: Kurang nyaman dalam diskusi kelompok besar, Cenderung mengabaikan detail kecil, Sulit menerima kritik objektif, Cenderung menunda-nunda pekerjaan
    """
    mbti_type = MBTIType.INFP
    
    res = get_strengths_and_challenges(mbti_type, None)
    strengths = res["strengths"]
    challenges = res["challenges"]
    
    print(f"Input MBTI: {mbti_type.value}")
    print(f"Got strengths: {strengths}")
    print(f"Got challenges: {challenges}")
    
    # Verify strengths
    assert "Fokus mendalam dan kemandirian tinggi" in strengths, "Should have I strength"
    assert "Pemikiran konseptual dan kreatif" in strengths, "Should have N strength"
    assert "Empati tinggi dan kooperatif" in strengths, "Should have F strength"
    assert "Adaptif dan spontan" in strengths, "Should have P strength"
    assert len(strengths) == 4, f"Should have 4 strengths, got {len(strengths)}"
    
    # Verify challenges
    assert "Kurang nyaman dalam diskusi kelompok besar" in challenges, "Should have I challenge"
    assert "Cenderung mengabaikan detail kecil" in challenges, "Should have N challenge"
    assert "Sulit menerima kritik objektif" in challenges, "Should have F challenge"
    assert "Cenderung menunda-nunda pekerjaan" in challenges, "Should have P challenge"
    assert len(challenges) == 4, f"Should have 4 challenges, got {len(challenges)}"
    
    print("✅ TEST 13 PASSED: INFP strengths and challenges correctly identified\n")


def test_get_strengths_and_challenges_istj():
    """
    Test case: ISTJ personality (Logistician)
    """
    mbti_type = MBTIType.ISTJ
    
    res = get_strengths_and_challenges(mbti_type, None)
    strengths = res["strengths"]
    challenges = res["challenges"]
    
    print(f"Input MBTI: {mbti_type.value}")
    print(f"Got strengths: {strengths}")
    print(f"Got challenges: {challenges}")
    
    # Verify strengths
    assert "Fokus mendalam dan kemandirian tinggi" in strengths, "Should have I strength"
    assert "Praktis dan berorientasi pada detail" in strengths, "Should have S strength"
    assert "Logis dan analitis" in strengths, "Should have T strength"
    assert "Terorganisir dan tepat waktu" in strengths, "Should have J strength"
    assert len(strengths) == 4, f"Should have 4 strengths, got {len(strengths)}"
    
    # Verify challenges
    assert "Kurang nyaman dalam diskusi kelompok besar" in challenges, "Should have I challenge"
    assert "Kurang menyukai konsep yang terlalu abstrak" in challenges, "Should have S challenge"
    assert "Kurang peka terhadap dinamika emosional kelompok" in challenges, "Should have T challenge"
    assert "Kurang fleksibel terhadap perubahan mendadak" in challenges, "Should have J challenge"
    assert len(challenges) == 4, f"Should have 4 challenges, got {len(challenges)}"
    
    print("✅ TEST 14 PASSED: ISTJ strengths and challenges correctly identified\n")


def test_get_strengths_and_challenges_enfp():
    """
    Test case: ENFP personality (Campaigner)
    """
    mbti_type = MBTIType.ENFP
    
    res = get_strengths_and_challenges(mbti_type, None)
    strengths = res["strengths"]
    challenges = res["challenges"]
    
    print(f"Input MBTI: {mbti_type.value}")
    print(f"Got strengths: {strengths}")
    print(f"Got challenges: {challenges}")
    
    # Verify strengths
    assert "Kolaboratif dan komunikatif" in strengths, "Should have E strength"
    assert "Pemikiran konseptual dan kreatif" in strengths, "Should have N strength"
    assert "Empati tinggi dan kooperatif" in strengths, "Should have F strength"
    assert "Adaptif dan spontan" in strengths, "Should have P strength"
    assert len(strengths) == 4, f"Should have 4 strengths, got {len(strengths)}"
    
    # Verify challenges
    assert "Mudah terdistraksi di lingkungan ramai" in challenges, "Should have E challenge"
    assert "Cenderung mengabaikan detail kecil" in challenges, "Should have N challenge"
    assert "Sulit menerima kritik objektif" in challenges, "Should have F challenge"
    assert "Cenderung menunda-nunda pekerjaan" in challenges, "Should have P challenge"
    assert len(challenges) == 4, f"Should have 4 challenges, got {len(challenges)}"
    
    print("✅ TEST 15 PASSED: ENFP strengths and challenges correctly identified\n")


def test_get_strengths_and_challenges_none_type():
    """
    Test case: None/Invalid MBTI type
    Expected: Should return empty strengths/challenges lists if both are None
    """
    res = get_strengths_and_challenges(None, None)
    strengths = res["strengths"]
    challenges = res["challenges"]
    
    print(f"Input MBTI: None, Learning Style: None")
    print(f"Got strengths: {strengths}")
    print(f"Got challenges: {challenges}")
    
    # Should return empty lists
    assert isinstance(strengths, list), "Strengths should be a list"
    assert isinstance(challenges, list), "Challenges should be a list"
    assert len(strengths) == 0, "Should have 0 strengths"
    assert len(challenges) == 0, "Should have 0 challenges"
    
    print("✅ TEST 16 PASSED: None inputs handled gracefully\n")


def test_get_strengths_and_challenges_all_types():
    """
    Integration test: Verify all 16 MBTI types have strengths & challenges
    """
    all_types = [mbti_type for mbti_type in MBTIType]
    
    print(f"Testing all {len(all_types)} MBTI types:")
    
    for mbti in all_types:
        res = get_strengths_and_challenges(mbti, None)
        strengths = res["strengths"]
        challenges = res["challenges"]
        
        assert len(strengths) > 0, f"{mbti.value}: Should have strengths"
        assert len(challenges) > 0, f"{mbti.value}: Should have challenges"
        assert len(strengths) == 4, f"{mbti.value}: Should have exactly 4 strengths"
        assert len(challenges) == 4, f"{mbti.value}: Should have exactly 4 challenges"
        
        print(f"  ✓ {mbti.value:5s} - Strengths: {len(strengths)}, Challenges: {len(challenges)}")
    
    print("✅ TEST 17 PASSED: All 16 MBTI types correctly mapped\n")


# ============ RUN ALL TESTS ============
if __name__ == "__main__":
    print("=" * 70)
    print("WHITE BOX TESTING: Personality Service - Full Test Suite")
    print("=" * 70 + "\n")
    
    # SECTION 1: MBTI Tests
    print("📌 SECTION 1: MBTI Type Calculation Tests\n")
    
    try:
        test_calculate_mbti_type_extrovert_thinking_judging()
    except AssertionError as e:
        print(f"❌ TEST 1 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 1 ERROR: {e}\n")
    
    try:
        test_calculate_mbti_type_introvert_feeling_perceiving()
    except AssertionError as e:
        print(f"❌ TEST 2 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 2 ERROR: {e}\n")
    
    try:
        test_calculate_mbti_type_balanced_scores()
    except AssertionError as e:
        print(f"❌ TEST 3 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 3 ERROR: {e}\n")
    
    try:
        test_calculate_mbti_type_invalid_scores()
    except Exception as e:
        print(f"❌ TEST 4 ERROR: {e}\n")
    
    # SECTION 2: Learning Style Tests
    print("\n📌 SECTION 2: Learning Style Calculation Tests\n")
    
    try:
        test_calculate_learning_style_visual_dominant()
    except AssertionError as e:
        print(f"❌ TEST 5 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 5 ERROR: {e}\n")
    
    try:
        test_calculate_learning_style_kinesthetic_dominant()
    except AssertionError as e:
        print(f"❌ TEST 6 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 6 ERROR: {e}\n")
    
    try:
        test_calculate_learning_style_auditory_dominant()
    except AssertionError as e:
        print(f"❌ TEST 7 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 7 ERROR: {e}\n")
    
    try:
        test_calculate_learning_style_reading_writing_dominant()
    except AssertionError as e:
        print(f"❌ TEST 8 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 8 ERROR: {e}\n")
    
    try:
        test_calculate_learning_style_balanced()
    except AssertionError as e:
        print(f"❌ TEST 9 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 9 ERROR: {e}\n")
    
    try:
        test_calculate_learning_style_empty()
    except AssertionError as e:
        print(f"❌ TEST 10 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 10 ERROR: {e}\n")
    
    try:
        test_calculate_learning_style_none_input()
    except AssertionError as e:
        print(f"❌ TEST 11 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 11 ERROR: {e}\n")
    
    # SECTION 3: Strengths & Challenges Tests
    print("\n📌 SECTION 3: Strengths & Challenges Mapping Tests\n")
    
    try:
        test_get_strengths_and_challenges_entj()
    except AssertionError as e:
        print(f"❌ TEST 12 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 12 ERROR: {e}\n")
    
    try:
        test_get_strengths_and_challenges_infp()
    except AssertionError as e:
        print(f"❌ TEST 13 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 13 ERROR: {e}\n")
    
    try:
        test_get_strengths_and_challenges_istj()
    except AssertionError as e:
        print(f"❌ TEST 14 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 14 ERROR: {e}\n")
    
    try:
        test_get_strengths_and_challenges_enfp()
    except AssertionError as e:
        print(f"❌ TEST 15 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 15 ERROR: {e}\n")
    
    try:
        test_get_strengths_and_challenges_none_type()
    except AssertionError as e:
        print(f"❌ TEST 16 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 16 ERROR: {e}\n")
    
    try:
        test_get_strengths_and_challenges_all_types()
    except AssertionError as e:
        print(f"❌ TEST 17 FAILED: {e}\n")
    except Exception as e:
        print(f"❌ TEST 17 ERROR: {e}\n")
    
    print("=" * 70)
    print("WHITE BOX TESTING COMPLETED - All Sections")
    print("=" * 70)
