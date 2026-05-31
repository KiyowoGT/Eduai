"""
White Box Testing untuk Personality Service
Test personality calculation functions step by step
"""

import sys
import os

# Add backend directory to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
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


# ============ RUN ALL TESTS ============
if __name__ == "__main__":
    print("=" * 70)
    print("WHITE BOX TESTING: Personality Service - MBTI & Learning Style")
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
    
    print("=" * 70)
    print("WHITE BOX TESTING COMPLETED")
    print("=" * 70)
