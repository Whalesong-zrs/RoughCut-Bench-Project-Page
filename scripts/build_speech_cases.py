#!/usr/bin/env python3
"""Build full transcript examples for the static project page."""

import argparse
import json
import re
from pathlib import Path


CASE_METADATA = [
    {
        "id": "beauty-im",
        "source": "case4_5",
        "title": "Concealer tutorial",
        "scenario": "Beauty/Fashion",
        "metrics": {"IM F1": 1.000, "RM→R Succ.": 1.000, "D F1": 0.996},
    },
    {
        "id": "qa-rm",
        "source": "case3_4",
        "title": "Reflective monologue",
        "scenario": "Podcast/Q&A",
        "metrics": {"IM F1": 0.824, "RM→R Succ.": 0.889, "D F1": 0.853},
    },
    {
        "id": "lifestyle-d",
        "source": "case6_2",
        "title": "Food review",
        "scenario": "Lifestyle/Food",
        "metrics": {"IM F1": 0.585, "RM→R Succ.": 1.000, "D F1": 0.840},
    },
]

TAG_PATTERN = re.compile(r"\[(IM|RM|C|D)\]")
RM_PAIR_PATTERN = re.compile(r"\[RM\](.*?)\[RM\]\s*\[C\](.*?)\[C\]", re.DOTALL)
TYPE_PRIORITY = (("RM", "rm"), ("C", "r"), ("IM", "im"), ("D", "d"))


def parse_annotated_transcript(text):
    active = set()
    segments = []
    cursor = 0

    for match in TAG_PATTERN.finditer(text):
        append_segment(segments, text[cursor : match.start()], active)
        tag = match.group(1)
        if tag in active:
            active.remove(tag)
        else:
            active.add(tag)
        cursor = match.end()

    append_segment(segments, text[cursor:], active)
    return segments


def append_segment(segments, text, active):
    if not text:
        return

    segment_type = next((label for tag, label in TYPE_PRIORITY if tag in active), None)
    if segments and segments[-1].get("type") == segment_type:
        segments[-1]["text"] += text
        return

    segment = {"text": text}
    if segment_type:
        segment["type"] = segment_type
    segments.append(segment)


def build_reference(text):
    active = set()
    kept = []
    cursor = 0

    for match in TAG_PATTERN.finditer(text):
        chunk = text[cursor : match.start()]
        if not active.intersection({"IM", "RM", "D"}):
            kept.append(chunk)
        tag = match.group(1)
        if tag in active:
            active.remove(tag)
        else:
            active.add(tag)
        cursor = match.end()

    if not active.intersection({"IM", "RM", "D"}):
        kept.append(text[cursor:])
    return re.sub(r"\s+", " ", "".join(kept)).strip()


def normalize_match_text(text):
    return re.sub(r"\s+", " ", text).strip().lower()


def extract_rm_pairs(text):
    pairs = {}
    for match in RM_PAIR_PATTERN.finditer(text):
        removed = re.sub(TAG_PATTERN, "", match.group(1))
        retained = re.sub(TAG_PATTERN, "", match.group(2))
        pairs[normalize_match_text(removed)] = re.sub(r"\s+", " ", retained).strip()
    return pairs


def build_case(source_root, metadata):
    case_root = source_root / metadata["source"]
    gt_text = (case_root / "gt.txt").read_text(encoding="utf-8").strip()
    prediction = json.loads(
        (case_root / "COT_ZERO_SHOT_PROMPT" / "gemini_3_pro.json").read_text(
            encoding="utf-8"
        )
    )
    rm_pairs = extract_rm_pairs(gt_text)
    model_edits = []
    for edit in prediction.get("edits", []):
        edit_type = edit.get("type", "").lower()
        kept = edit.get("kept", "")
        if edit_type == "rm" and not kept:
            kept = rm_pairs.get(normalize_match_text(edit.get("text", "")), "")
        model_edits.append(
            {
                "type": edit_type,
                "text": edit.get("text", ""),
                "kept": kept,
            }
        )

    case = {
        "id": metadata["id"],
        "title": metadata["title"],
        "scenario": metadata["scenario"],
        "model": "Gemini 3.0 Pro",
        "privacyReviewed": True,
        "privacyNote": "Complete transcript reviewed for public display.",
        "focus": "IM · RM→R · D",
        "originalSegments": parse_annotated_transcript(gt_text),
        "referenceTranscript": build_reference(gt_text),
        "modelEdits": model_edits,
        "modelTranscript": prediction["cleaned_text"],
        "metrics": metadata["metrics"],
    }
    return case


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-root",
        type=Path,
        default=Path("../kdd_rough_cut_benchmark/asr_case_v2"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/speech_cases.json"),
    )
    args = parser.parse_args()

    payload = {
        "category": {
            "id": "speech-cleanup-cases",
            "label": "Speech Cleanup",
            "summary": (
                "High-alignment transcript-cleanup cases with complete inputs and outputs."
            ),
            "cases": [build_case(args.source_root, metadata) for metadata in CASE_METADATA],
        }
    }
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
