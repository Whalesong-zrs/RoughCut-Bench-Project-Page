#!/usr/bin/env python3
"""Build full transcript examples for the static project page."""

import argparse
import json
import re
from pathlib import Path


CASE_METADATA = [
    {
        "id": "beauty-im",
        "source": "case4_8",
        "title": "Beauty tutorial",
        "scenario": "Beauty/Fashion",
    },
    {
        "id": "qa-rm",
        "source": "case3_5",
        "title": "Reflective monologue",
        "scenario": "Podcast/Q&A",
    },
    {
        "id": "lifestyle-d",
        "source": "case15_1",
        "title": "Meal-preparation vlog",
        "scenario": "Lifestyle Vlog",
    },
]

TAG_PATTERN = re.compile(r"\[(IM|RM|C|D)\]")
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


def build_case(source_root, metadata):
    case_root = source_root / metadata["source"]
    gt_text = (case_root / "gt.txt").read_text(encoding="utf-8").strip()
    prediction = json.loads(
        (case_root / "COT_ZERO_SHOT_PROMPT" / "gemini_3_pro.json").read_text(
            encoding="utf-8"
        )
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
        "modelTranscript": prediction["cleaned_text"],
        "metrics": {},
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
                "Complete transcript-cleanup cases covering the annotated operations."
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
