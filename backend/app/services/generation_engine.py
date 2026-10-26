import os
import json
import time
from typing import Dict, Any, Tuple, List, Optional
from google import genai
from google.genai import types
from google.genai.errors import APIError, ClientError, ServerError

from app.core.config import settings

DEFAULT_MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"]

SUPPORTED_FORMATS = {
    "executive_summary": "Executive Summary",
    "linkedin_post": "LinkedIn Thought Leadership",
    "twitter_thread": "X/Twitter Thread Wire",
    "advisory": "Institutional Advisory",
    "presentation": "Presentation Deck with Notes",
    "infographic": "Infographic Visual Blueprint",
    "video_script": "Video Script & Storyboard",
}


def _get_genai_client() -> genai.Client:
    api_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Gemini API key is not configured in backend/.env.")
    return genai.Client(api_key=api_key)


def _format_source_context(structured_analysis: Dict[str, Any]) -> str:
    """Formats structured analysis into concise, rich factual context for prompts."""
    main_topic = structured_analysis.get("main_topic", "General Topic")
    exec_summary = structured_analysis.get("executive_summary", "")
    key_points = structured_analysis.get("key_points", [])
    numerical_facts = structured_analysis.get("numerical_facts", [])
    entities = structured_analysis.get("entities", [])
    dates_and_events = structured_analysis.get("dates_and_events", [])
    key_claims = structured_analysis.get("key_claims", [])
    gaps = structured_analysis.get("uncertain_or_missing_info", [])

    lines = [
        f"MAIN TOPIC: {main_topic}",
        f"EXECUTIVE SUMMARY: {exec_summary}",
        "\nKEY TAKEAWAYS:",
    ]
    for kp in key_points:
        lines.append(f"- {kp}")

    if numerical_facts:
        lines.append("\nVERIFIED NUMERICAL FACTS & METRICS:")
        for nf in numerical_facts:
            lines.append(f"- {nf.get('metric')}: {nf.get('value')} (Context: {nf.get('context')})")

    if entities:
        lines.append("\nNAMED ENTITIES:")
        for ent in entities:
            lines.append(f"- {ent.get('name')} ({ent.get('category')}): {ent.get('context', '')}")

    if dates_and_events:
        lines.append("\nTIMELINE & EVENTS:")
        for ev in dates_and_events:
            lines.append(f"- {ev.get('date', 'N/A')}: {ev.get('event')}")

    if key_claims:
        lines.append("\nCLAIMS & STATUS:")
        for kc in key_claims:
            lines.append(f"- [{kc.get('status', 'explicit_fact')}] {kc.get('claim')}")

    if gaps:
        lines.append("\nEXPLICITLY MISSING INFORMATION / KNOWLEDGE GAPS (DO NOT INVENT):")
        for g in gaps:
            lines.append(f"- {g}")

    return "\n".join(lines)


# ---------------- FORMAT-SPECIFIC GENERATORS ---------------- #

def _build_executive_summary_prompt(ctx: str, config: Dict[str, Any]) -> Tuple[str, str, Dict[str, Any]]:
    system_instruction = (
        "You are ContentFlow AI's Executive Briefing Writer.\n"
        "Synthesize the provided structured intelligence into a dense, high-impact C-Suite Executive Summary.\n"
        "STRICT GROUNDING: Strictly preserve factual grounding. Only cite numbers, entities, and facts present in the source.\n"
        f"TARGET AUDIENCE: {config.get('target_audience', 'C-Suite & Executive Leadership')}\n"
        f"TONE: {config.get('tone', 'Professional & Executive')}\n"
        f"LANGUAGE: {config.get('language', 'English')}\n"
        f"DETAIL LEVEL: {config.get('detail_level', 'Standard / Balanced')}\n"
        f"OBJECTIVE: {config.get('communication_objective', 'Inform & Brief')}\n"
    )
    if config.get("additional_instructions"):
        system_instruction += f"\nUSER DIRECTIVE: {config['additional_instructions']}\n"

    user_prompt = f"""
STRUCTURED SOURCE INTELLIGENCE:
{ctx}

Generate a structured Executive Briefing conforming strictly to the requested JSON schema.
"""
    schema = {
        "type": "OBJECT",
        "properties": {
            "headline": {"type": "STRING"},
            "key_takeaways": {"type": "ARRAY", "items": {"type": "STRING"}},
            "executive_briefing": {"type": "ARRAY", "items": {"type": "STRING"}},
            "strategic_implications": {"type": "ARRAY", "items": {"type": "STRING"}},
        },
        "required": ["headline", "key_takeaways", "executive_briefing", "strategic_implications"],
    }
    return system_instruction, user_prompt, schema


def _render_executive_summary_markdown(data: Dict[str, Any]) -> str:
    md = [f"# {data.get('headline', 'Executive Briefing')}\n"]
    md.append("## Key Takeaways")
    for t in data.get("key_takeaways", []):
        md.append(f"- **{t}**")

    md.append("\n## Executive Briefing")
    for p in data.get("executive_briefing", []):
        md.append(f"{p}\n")

    md.append("## Strategic Implications & Market Impact")
    for imp in data.get("strategic_implications", []):
        md.append(f"- {imp}")

    return "\n".join(md)


def _build_linkedin_post_prompt(ctx: str, config: Dict[str, Any]) -> Tuple[str, str, Dict[str, Any]]:
    system_instruction = (
        "You are ContentFlow AI's Lead Thought Leadership Strategist.\n"
        "Transform the structured intelligence into a viral, professional LinkedIn post.\n"
        "RULES:\n"
        "- Hook must stop the scroll in under 140 characters.\n"
        "- Use clean whitespace and short 1-2 sentence paragraphs.\n"
        "- Feature 3-4 bulleted quantitative facts from the source.\n"
        "- Include an engaging discussion question / call to action.\n"
        "- Add 3-5 relevant hashtags.\n"
        f"TARGET AUDIENCE: {config.get('target_audience', 'Industry Professionals')}\n"
        f"TONE: {config.get('tone', 'Thought Leadership & Engaging')}\n"
        f"LANGUAGE: {config.get('language', 'English')}\n"
    )
    if config.get("additional_instructions"):
        system_instruction += f"\nUSER DIRECTIVE: {config['additional_instructions']}\n"

    user_prompt = f"STRUCTURED SOURCE INTELLIGENCE:\n{ctx}\n\nGenerate the LinkedIn post in JSON."
    schema = {
        "type": "OBJECT",
        "properties": {
            "hook": {"type": "STRING"},
            "body_paragraphs": {"type": "ARRAY", "items": {"type": "STRING"}},
            "bullet_takeaways": {"type": "ARRAY", "items": {"type": "STRING"}},
            "call_to_action": {"type": "STRING"},
            "hashtags": {"type": "ARRAY", "items": {"type": "STRING"}},
        },
        "required": ["hook", "body_paragraphs", "bullet_takeaways", "call_to_action", "hashtags"],
    }
    return system_instruction, user_prompt, schema


def _render_linkedin_markdown(data: Dict[str, Any]) -> str:
    lines = [f"{data.get('hook', '')}\n"]
    for p in data.get("body_paragraphs", []):
        lines.append(f"{p}\n")

    if data.get("bullet_takeaways"):
        for b in data.get("bullet_takeaways", []):
            lines.append(f"• {b}")
        lines.append("")

    lines.append(f"{data.get('call_to_action', '')}\n")
    tags = " ".join([f"#{t.lstrip('#')}" for t in data.get("hashtags", [])])
    lines.append(tags)
    return "\n".join(lines)


def _build_twitter_thread_prompt(ctx: str, config: Dict[str, Any]) -> Tuple[str, str, Dict[str, Any]]:
    system_instruction = (
        "You are ContentFlow AI's Financial and Tech Wire Editor on X/Twitter.\n"
        "Convert the structured intelligence into a numbered, data-dense thread of 4 to 7 tweets.\n"
        "STRICT CONSTRAINT: Every single tweet MUST be under 280 characters! Number each tweet as '1/', '2/', etc.\n"
        f"TARGET AUDIENCE: {config.get('target_audience', 'Market Analysts & Tech Investors')}\n"
        f"TONE: {config.get('tone', 'Fast-Paced & Analytical')}\n"
        f"LANGUAGE: {config.get('language', 'English')}\n"
    )
    if config.get("additional_instructions"):
        system_instruction += f"\nUSER DIRECTIVE: {config['additional_instructions']}\n"

    user_prompt = f"STRUCTURED SOURCE INTELLIGENCE:\n{ctx}\n\nGenerate the X/Twitter thread in JSON."
    schema = {
        "type": "OBJECT",
        "properties": {
            "thread_title": {"type": "STRING"},
            "tweets": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "tweet_number": {"type": "INTEGER"},
                        "text": {"type": "STRING"},
                        "character_count": {"type": "INTEGER"},
                    },
                    "required": ["tweet_number", "text", "character_count"],
                },
            },
        },
        "required": ["thread_title", "tweets"],
    }
    return system_instruction, user_prompt, schema


def _render_twitter_markdown(data: Dict[str, Any]) -> str:
    lines = [f"### 🧵 {data.get('thread_title', 'Analytical Thread Wire')}\n"]
    for tw in data.get("tweets", []):
        text = tw.get("text", "")
        count = len(text)
        num = tw.get("tweet_number", 1)
        lines.append(f"**[{num}]** {text}\n*({count}/280 chars)*\n")
    return "\n".join(lines)


def _build_advisory_prompt(ctx: str, config: Dict[str, Any]) -> Tuple[str, str, Dict[str, Any]]:
    system_instruction = (
        "You are ContentFlow AI's Senior Institutional Advisory Partner.\n"
        "Produce an institutional-grade strategic advisory memorandum covering market context, risk exposure, and governance directives.\n"
        f"TARGET AUDIENCE: {config.get('target_audience', 'Board of Directors & Investment Committee')}\n"
        f"TONE: {config.get('tone', 'Rigorous, Institutional & Prescriptive')}\n"
        f"LANGUAGE: {config.get('language', 'English')}\n"
        f"DETAIL LEVEL: {config.get('detail_level', 'Comprehensive / Deep Dive')}\n"
    )
    if config.get("additional_instructions"):
        system_instruction += f"\nUSER DIRECTIVE: {config['additional_instructions']}\n"

    user_prompt = f"STRUCTURED SOURCE INTELLIGENCE:\n{ctx}\n\nGenerate the institutional advisory memorandum in JSON."
    schema = {
        "type": "OBJECT",
        "properties": {
            "memo_title": {"type": "STRING"},
            "executive_summary": {"type": "STRING"},
            "situation_assessment": {"type": "ARRAY", "items": {"type": "STRING"}},
            "key_risks_and_bottlenecks": {"type": "ARRAY", "items": {"type": "STRING"}},
            "strategic_recommendations": {"type": "ARRAY", "items": {"type": "STRING"}},
            "timeline_and_capital_allocation": {"type": "STRING"},
        },
        "required": [
            "memo_title",
            "executive_summary",
            "situation_assessment",
            "key_risks_and_bottlenecks",
            "strategic_recommendations",
            "timeline_and_capital_allocation",
        ],
    }
    return system_instruction, user_prompt, schema


def _render_advisory_markdown(data: Dict[str, Any]) -> str:
    lines = [
        f"# INSTITUTIONAL ADVISORY MEMO: {data.get('memo_title', 'Strategic Directive')}",
        "**CLASSIFICATION:** RESTRICTED / BOARD LEVEL\n",
        "## 1. Executive Summary",
        f"{data.get('executive_summary', '')}\n",
        "## 2. Situation & Market Assessment",
    ]
    for s in data.get("situation_assessment", []):
        lines.append(f"- {s}")

    lines.append("\n## 3. Critical Risks & Operational Bottlenecks")
    for r in data.get("key_risks_and_bottlenecks", []):
        lines.append(f"- ⚠️ **{r}**")

    lines.append("\n## 4. Prescriptive Strategic Recommendations")
    for rec in data.get("strategic_recommendations", []):
        lines.append(f"- 🎯 **{rec}**")

    lines.append("\n## 5. Timeline & Capital Allocation Impact")
    lines.append(data.get("timeline_and_capital_allocation", ""))
    return "\n".join(lines)


def _build_presentation_prompt(ctx: str, config: Dict[str, Any]) -> Tuple[str, str, Dict[str, Any]]:
    system_instruction = (
        "You are ContentFlow AI's Presentation Deck Architect.\n"
        "Design a 5 to 7 slide executive presentation deck with visual layout recommendations and detailed verbatim speaker notes for each slide.\n"
        f"TARGET AUDIENCE: {config.get('target_audience', 'Board & Senior Stakeholders')}\n"
        f"TONE: {config.get('tone', 'Executive & Polished')}\n"
        f"LANGUAGE: {config.get('language', 'English')}\n"
    )
    if config.get("additional_instructions"):
        system_instruction += f"\nUSER DIRECTIVE: {config['additional_instructions']}\n"

    user_prompt = f"STRUCTURED SOURCE INTELLIGENCE:\n{ctx}\n\nGenerate the presentation deck in JSON."
    schema = {
        "type": "OBJECT",
        "properties": {
            "deck_title": {"type": "STRING"},
            "slides": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "slide_number": {"type": "INTEGER"},
                        "title": {"type": "STRING"},
                        "bullet_points": {"type": "ARRAY", "items": {"type": "STRING"}},
                        "visual_layout_suggestion": {"type": "STRING"},
                        "speaker_notes": {"type": "STRING"},
                    },
                    "required": ["slide_number", "title", "bullet_points", "visual_layout_suggestion", "speaker_notes"],
                },
            },
        },
        "required": ["deck_title", "slides"],
    }
    return system_instruction, user_prompt, schema


def _render_presentation_markdown(data: Dict[str, Any]) -> str:
    lines = [f"# 📊 {data.get('deck_title', 'Executive Presentation Deck')}\n"]
    for s in data.get("slides", []):
        num = s.get("slide_number", 1)
        lines.append("---")
        lines.append(f"### Slide {num}: {s.get('title', '')}")
        lines.append(f"*Layout Recommendation: {s.get('visual_layout_suggestion', '')}*\n")
        for b in s.get("bullet_points", []):
            lines.append(f"- {b}")
        lines.append(f"\n> 🗣️ **Speaker Notes:** {s.get('speaker_notes', '')}\n")
    return "\n".join(lines)


def _build_infographic_prompt(ctx: str, config: Dict[str, Any]) -> Tuple[str, str, Dict[str, Any]]:
    system_instruction = (
        "You are ContentFlow AI's Creative Information Designer.\n"
        "Design a comprehensive Infographic Visual Blueprint and Layout Specification.\n"
        "CRITICAL RULE: This is a structured layout and content specification for designers (do not claim to be a rendered image file).\n"
        f"TARGET AUDIENCE: {config.get('target_audience', 'General & Industry Audience')}\n"
        f"TONE: {config.get('tone', 'Visual, Crisp & Data-Driven')}\n"
        f"LANGUAGE: {config.get('language', 'English')}\n"
    )
    if config.get("additional_instructions"):
        system_instruction += f"\nUSER DIRECTIVE: {config['additional_instructions']}\n"

    user_prompt = f"STRUCTURED SOURCE INTELLIGENCE:\n{ctx}\n\nGenerate the infographic blueprint in JSON."
    schema = {
        "type": "OBJECT",
        "properties": {
            "headline": {"type": "STRING"},
            "subtitle": {"type": "STRING"},
            "hero_metric": {"type": "STRING"},
            "visual_metaphor": {"type": "STRING"},
            "recommended_color_palette": {"type": "ARRAY", "items": {"type": "STRING"}},
            "sections": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "section_number": {"type": "INTEGER"},
                        "title": {"type": "STRING"},
                        "focal_stat": {"type": "STRING"},
                        "icon_suggestion": {"type": "STRING"},
                        "layout_directive": {"type": "STRING"},
                        "body_copy": {"type": "STRING"},
                    },
                    "required": ["section_number", "title", "focal_stat", "icon_suggestion", "layout_directive", "body_copy"],
                },
            },
        },
        "required": ["headline", "subtitle", "hero_metric", "visual_metaphor", "recommended_color_palette", "sections"],
    }
    return system_instruction, user_prompt, schema


def _render_infographic_markdown(data: Dict[str, Any]) -> str:
    colors = ", ".join(data.get("recommended_color_palette", []))
    lines = [
        f"# 🖼️ Infographic Blueprint: {data.get('headline', 'Data Visualizer')}",
        f"*{data.get('subtitle', '')}*\n",
        f"**Visual Theme & Metaphor:** {data.get('visual_metaphor', 'Modern Modular Grid')}",
        f"**Recommended Color Palette:** {colors}\n",
        f"## ⚡ Hero Focus Stat: {data.get('hero_metric', 'N/A')}\n",
        "## Visual Content Sections:",
    ]
    for sec in data.get("sections", []):
        num = sec.get("section_number", 1)
        lines.append(f"### Panel {num}: {sec.get('title', '')} [Icon: {sec.get('icon_suggestion', 'Activity')}]")
        lines.append(f"**Primary Metric:** `{sec.get('focal_stat', '')}`")
        lines.append(f"**Layout Directive:** {sec.get('layout_directive', '')}")
        lines.append(f"**Copy:** {sec.get('body_copy', '')}\n")
    return "\n".join(lines)


def _build_video_script_prompt(ctx: str, config: Dict[str, Any]) -> Tuple[str, str, Dict[str, Any]]:
    system_instruction = (
        "You are ContentFlow AI's Executive Video Director and Storyboard Producer.\n"
        "Create a scene-by-scene Video Script and Storyboard Production Guide.\n"
        "CRITICAL RULE: This is a written production guide with visual cues and voiceover lines (do not claim to be a rendered video file).\n"
        f"TARGET AUDIENCE: {config.get('target_audience', 'Video Viewers & Executive Network')}\n"
        f"TONE: {config.get('tone', 'Narrative, Clear & Authoritative')}\n"
        f"LANGUAGE: {config.get('language', 'English')}\n"
    )
    if config.get("additional_instructions"):
        system_instruction += f"\nUSER DIRECTIVE: {config['additional_instructions']}\n"

    user_prompt = f"STRUCTURED SOURCE INTELLIGENCE:\n{ctx}\n\nGenerate the video storyboard and script in JSON."
    schema = {
        "type": "OBJECT",
        "properties": {
            "video_title": {"type": "STRING"},
            "estimated_duration": {"type": "STRING"},
            "opening_hook": {"type": "STRING"},
            "closing_call_to_action": {"type": "STRING"},
            "scenes": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "scene_number": {"type": "INTEGER"},
                        "timecode": {"type": "STRING"},
                        "visual_cues": {"type": "STRING"},
                        "narration_script": {"type": "STRING"},
                    },
                    "required": ["scene_number", "timecode", "visual_cues", "narration_script"],
                },
            },
        },
        "required": ["video_title", "estimated_duration", "opening_hook", "closing_call_to_action", "scenes"],
    }
    return system_instruction, user_prompt, schema


def _render_video_script_markdown(data: Dict[str, Any]) -> str:
    lines = [
        f"# 🎬 Video Script & Storyboard: {data.get('video_title', 'Video Production')}",
        f"**Target Duration:** {data.get('estimated_duration', '60-90 seconds')}\n",
        f"**Opening Hook (0:00-0:05):** *\"{data.get('opening_hook', '')}\"*\n",
        "## Scene-by-Scene Production Grid\n",
        "| Scene & Time | Visual & Camera Direction | Spoken Voiceover Narration |",
        "| :--- | :--- | :--- |",
    ]
    for sc in data.get("scenes", []):
        num = sc.get("scene_number", 1)
        timecode = sc.get("timecode", "")
        visual = sc.get("visual_cues", "").replace("|", "/")
        narration = sc.get("narration_script", "").replace("|", "/")
        lines.append(f"| Scene {num} ({timecode}) | {visual} | \"{narration}\" |")

    lines.append(f"\n**Closing Screen & CTA:** {data.get('closing_call_to_action', '')}")
    return "\n".join(lines)


# Dispatch map
FORMAT_BUILDERS = {
    "executive_summary": (_build_executive_summary_prompt, _render_executive_summary_markdown, "Executive Briefing"),
    "linkedin_post": (_build_linkedin_post_prompt, _render_linkedin_markdown, "LinkedIn Dispatch"),
    "twitter_thread": (_build_twitter_thread_prompt, _render_twitter_markdown, "X/Twitter Thread Wire"),
    "advisory": (_build_advisory_prompt, _render_advisory_markdown, "Institutional Advisory"),
    "presentation": (_build_presentation_prompt, _render_presentation_markdown, "Presentation Deck"),
    "infographic": (_build_infographic_prompt, _render_infographic_markdown, "Infographic Blueprint"),
    "video_script": (_build_video_script_prompt, _render_video_script_markdown, "Video Script & Storyboard"),
}


def generate_single_format(
    structured_analysis: Dict[str, Any],
    format_type: str,
    config: Dict[str, Any],
    max_retries: int = 2,
) -> Tuple[str, Dict[str, Any], str]:
    """
    Generates a single format output using Google Gemini with strict structured JSON schema.
    Returns: (rendered_markdown_content, raw_structured_dict, model_name_used)
    """
    if format_type not in FORMAT_BUILDERS:
        raise ValueError(f"Unsupported format type: '{format_type}'. Supported: {list(FORMAT_BUILDERS.keys())}")

    builder_fn, renderer_fn, default_title = FORMAT_BUILDERS[format_type]
    ctx = _format_source_context(structured_analysis)
    system_instruction, user_prompt, schema = builder_fn(ctx, config)

    client = _get_genai_client()
    preferred_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    candidate_models = [preferred_model] + [m for m in DEFAULT_MODELS if m != preferred_model]

    last_error = None
    for model_name in candidate_models:
        for attempt in range(max_retries):
            try:
                gen_config = types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.2,
                )

                response = client.models.generate_content(
                    model=model_name,
                    contents=user_prompt,
                    config=gen_config,
                )

                if not response.text:
                    raise ValueError("Gemini returned empty response text.")

                structured_json = json.loads(response.text)
                rendered_markdown = renderer_fn(structured_json)
                return rendered_markdown, structured_json, model_name

            except (APIError, ClientError, ServerError) as api_err:
                last_error = api_err
                err_lower = str(api_err).lower()
                if "429" in err_lower or "quota" in err_lower or "503" in err_lower:
                    time.sleep(1.0 * (attempt + 1))
                    continue
                else:
                    break
            except json.JSONDecodeError as json_err:
                last_error = ValueError(f"Malformed JSON from AI: {str(json_err)}")
                time.sleep(0.5)
            except Exception as ex:
                last_error = ex
                break

    raise ValueError(f"Failed to generate {format_type} with Gemini: {str(last_error)}")
