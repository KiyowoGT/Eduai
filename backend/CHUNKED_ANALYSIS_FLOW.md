```mermaid
flowchart TD
    A[PDF Upload] --> B{Total Pages?}
    B -- ≤4 --> C[Legacy Single-Pass<br/>Analyze whole PDF at once]
    B -- >4 --> D[Adaptive Chunked Analysis]
    
    D --> E[Determine chunk size<br/>2/3/4/5 pages]
    E --> F[Calculate overlap 50%]
    F --> G[Sequential batch processing]
    
    G --> H{Batch process<br/>pages start-end}
    H --> I[Extract text]
    I --> J{Text ≥50 chars?}
    J -- No --> K[Skip batch<br/>(image-only)]
    J -- Yes --> L[Call Gemini<br/>Analyze ONLY this range]
    L --> M[Extract:<br/>- summary (50w)<br/>- concepts 2-4<br/>- diagrams ≤1<br/>- objectives]
    M --> N[Store batch result]
    N --> O{More batches?}
    O -- Yes --> G
    O -- No --> P[Merge all results]
    
    P --> Q[Deduplicate concepts<br/>by normalized name]
    Q --> R[Merge diagrams<br/>by name+type]
    R --> S[Deduplicate objectives]
    S --> T[Cap: concepts 20,<br/>diagrams 10, obj 10]
    
    T --> U{Synthesize summary<br/>from batches}
    U -- ≤2 batches<br/>or <300 words --> V[Concatenate]
    U -- >300 words --> W[LLM merge to<br/>150-200 words]
    V & W --> X{Fallback check<br/>concepts <5<br/>and pages>10?}
    X -- Yes --> Y[Run legacy analysis<br/>Merge results]
    X -- No --> Z[Return final<br/>title/summary/concepts/diagrams/objectives]
    Y --> Z
    
    C --> Z
```

## Batch Processing Timeline Example (40 pages)

```
Page Range   | Batch | Overlap with Prev
-------------|-------|-----------------
1-4          | 1     | -
3-6          | 2     | pages 3-4
5-8          | 3     | pages 5-6
7-10         | 4     | pages 7-8
9-12         | 5     | pages 9-10
...          | ...   | ...
37-40        | 19    | pages 37-38

Total batches: 19
Overlap ensures no context loss between adjacent ranges.
```

## Data Structure Example

**Input to `_analyze_batch`:**
```python
{
  "reader": PdfReader,
  "start_page": 1,
  "end_page": 4,
  "user": User,
  "total_batches": 19,
  "batch_idx": 0
}
```

**Output from batch:**
```python
{
  "summary": "Batch introduces neural network basics...",
  "key_concepts": [
    {"concept": "Neural Network", "explanation": "...", "code_example": "..."},
    {"concept": "Backpropagation", "explanation": "...", "code_example": "..."}
  ],
  "diagrams": [
    {"name": "Architecture", "type": "flowchart", "explanation": "..."}
  ],
  "learning_objectives": ["Understand NN layers...", "Implement backprop..."],
  "_batch_meta": {
    "start_page": 1,
    "end_page": 4,
    "concept_count": 2,
    "skipped": False,
    "error": None
  }
}
```

**Final merged output:**
```python
{
  "title": "Deep Learning Fundamentals",
  "summary": "3-4 paragraphs synthesized from all batches...",
  "key_concepts": [ ... up to 20 unique, deduped ... ],
  "diagrams": [ ... up to 10 unique, merged ... ],
  "learning_objectives": [ ... up to 10 unique ... ]
}
```
