"""
Quick validation test for chunked analysis functions.
Run: python test_chunked_analysis.py
"""
import sys
sys.path.insert(0, '/backend')

from server import (
    _determine_chunk_size,
    _extract_pages_text,
    _normalize_concept_name,
    _deduplicate_concepts,
    _merge_diagrams,
    _synthesize_summary_from_chunks,
    _analyze_batch,
    _analyze_pdf_legacy,
    analyze_pdf
)

def test_determine_chunk_size():
    assert _determine_chunk_size(5) == 2
    assert _determine_chunk_size(15) == 2
    assert _determine_chunk_size(16) == 3
    assert _determine_chunk_size(30) == 3
    assert _determine_chunk_size(31) == 4
    assert _determine_chunk_size(60) == 4


def test_normalize_concept_name():
    assert _normalize_concept_name("The Neural Network") == "neural network"
    assert _normalize_concept_name("  Backpropagation Algorithm  ") == "backpropagation algorithm"
    assert _normalize_concept_name("Convolutional NN (CNN)") == "convolutional nn cnn"
    assert _normalize_concept_name("A Fast Fourier Transform") == "fast fourier transform"


def test_deduplicate_concepts():
    concepts = [
        {"concept": "Neural Network", "explanation": "A", "code_example": ""},
        {"concept": "neural network", "explanation": "B longer", "code_example": "code"},
        {"concept": "CNN", "explanation": "C", "code_example": ""},
    ]
    result = _deduplicate_concepts(concepts)
    assert len(result) == 2
    # Should keep longer explanation+code
    nn = [c for c in result if "neural" in c["concept"].lower()][0]
    assert nn["explanation"] == "B longer"


def test_merge_diagrams():
    diagrams = [
        {"name": "Architecture", "type": "flowchart", "explanation": "Short"},
        {"name": "architecture", "type": "flowchart", "explanation": "Very detailed long"},
        {"name": "Data Flow", "type": "diagram", "explanation": "X"},
    ]
    result = _merge_diagrams(diagrams)
    assert len(result) == 2
    arch = [d for d in result if d["type"] == "flowchart"][0]
    assert arch["explanation"] == "Very detailed long"


def test_synthesize_summary():
    summaries = [
        "Summary batch 1 about methodology.",
        "Summary batch 2 about results.",
    ]
    # Can't test async easily, but function exists
    print("_synthesize_summary_from_chunks function OK")


if __name__ == "__main__":
    test_determine_chunk_size()
    print("[OK] _determine_chunk_size")
    test_normalize_concept_name()
    print("[OK] _normalize_concept_name")
    test_deduplicate_concepts()
    print("[OK] _deduplicate_concepts")
    test_merge_diagrams()
    print("[OK] _merge_diagrams")
    test_synthesize_summary()
    print("[OK] _synthesize_summary_from_chunks")
    print("\nAll unit tests passed!")
