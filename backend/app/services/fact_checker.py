import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from google import genai
from google.genai import types
from google.genai.errors import APIError, ClientError, ServerError

from app.core.config import settings
from app.schemas.verification import ClaimVerificationItem

logger = logging.getLogger(__name__)

# Fallback models prioritized by capacity and capability
DEFAULT_VERIFICATION_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
]


VERIFICATION_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "claims": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "claim_text": {"type": "STRING"},
                    "claim_type": {
                        "type": "STRING",
                        "enum": ["numerical", "date_event", "entity", "substantive"],
                    },
                    "classification": {
                        "type": "STRING",
                        "enum": [
                            "supported",
                            "partially_supported",
                            "unsupported",
                            "contradicts_source",
                            "requires_review",
                        ],
                    },
                    "confidence_score": {"type": "NUMBER"},
                    "reasoning": {"type": "STRING"},
                    "source_excerpt": {"type": "STRING"},
                    "source_reference": {"type": "STRING"},
                },
                "required": ["claim_text", "claim_type", "classification", "reasoning"],
            },
        },
        "overall_grounding_score": {"type": "NUMBER"},
        "summary_notes": {"type": "STRING"},
    },
    "required": ["claims", "overall_grounding_score", "summary_notes"],
}


class FactVerificationEngine:
    """
    Two-tiered fact verification and source grounding engine.
    1. Deterministic layer for numerical, date, and exact entity assertions.
    2. Semantic verification layer powered by Google Gemini with strict anti-fabrication rules.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or getattr(settings, "GEMINI_API_KEY", None)
        self.preferred_model = getattr(settings, "GEMINI_MODEL", "gemini-3.5-flash")
        self._client: Optional[genai.Client] = None

    def _get_client(self) -> genai.Client:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured in backend/.env.")
        if self._client is None:
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    # -------------------------------------------------------------
    # Deterministic Extraction & Comparison Utilities
    # -------------------------------------------------------------

    @staticmethod
    def extract_numbers(text: str) -> List[str]:
        """Extracts numerical tokens (percentages, currencies, multipliers, integers/decimals, excluding standalone 4-digit years)."""
        pattern = r"(?:\$|€|£)?\b\d+(?:,\d{3})*(?:\.\d+)?%?(?:\s*(?:billion|million|trillion|B|M|k|x))?\b"
        matches = re.findall(pattern, text, re.IGNORECASE)
        results = []
        for m in matches:
            val = m.strip()
            # Skip standalone 4-digit calendar years so extract_years_and_quarters handles them
            if re.fullmatch(r"(?:19|20)\d{2}", val):
                continue
            if len(val) > 1 or val in {"0"}:
                results.append(val)
        return results


    @staticmethod
    def extract_years_and_quarters(text: str) -> List[str]:
        """Extracts calendar years and fiscal quarters."""
        pattern = r"\b(?:19|20)\d{2}\b|\bQ[1-4](?:\s*(?:19|20)?\d{2})?\b"
        return [m.strip() for m in re.findall(pattern, text, re.IGNORECASE)]

    def run_deterministic_checks(
        self,
        claims: List[ClaimVerificationItem],
        source_text: str,
        structured_analysis: Optional[Dict[str, Any]] = None,
    ) -> List[ClaimVerificationItem]:
        """
        Enhances or overrides verification results using deterministic rules:
        - If a claim asserts a numerical metric that directly contradicts a known source metric -> contradicts_source
        - If a claim asserts an exact number or percentage present in source with matching context -> verified supported
        - If an asserted date/year conflicts with source dates -> contradicts_source
        """
        source_lower = source_text.lower()
        known_numbers = set()
        known_dates = set()

        if structured_analysis:
            for num_fact in structured_analysis.get("numerical_facts", []):
                val = str(num_fact.get("value", "")).strip().lower()
                if val:
                    known_numbers.add(val)
            for de in structured_analysis.get("dates_and_events", []):
                d = str(de.get("date", "")).strip().lower()
                if d:
                    known_dates.add(d)

        updated_claims = []
        for claim in claims:
            # Check numerical claims
            numbers_in_claim = self.extract_numbers(claim.claim_text)
            years_in_claim = self.extract_years_and_quarters(claim.claim_text)

            is_deterministic = False
            classification = claim.classification
            reasoning = claim.reasoning
            source_excerpt = claim.source_excerpt

            # Deterministic Check A: Numbers
            if numbers_in_claim:
                for num in numbers_in_claim:
                    num_clean = num.lower().replace(",", "")
                    # If number appears verbatim in source
                    if num.lower() in source_lower or num_clean in source_lower:
                        if classification in {"unsupported", "requires_review"}:
                            classification = "supported"
                            is_deterministic = True
                            reasoning = f"Deterministic verification: Exact numeric value '{num}' is verified in the source text."
                            if not source_excerpt:
                                # find snippet around the number
                                idx = source_lower.find(num.lower())
                                if idx != -1:
                                    start = max(0, idx - 40)
                                    end = min(len(source_text), idx + len(num) + 40)
                                    source_excerpt = f"...{source_text[start:end].strip()}..."
                    else:
                        # Number not in source text at all
                        if classification == "supported":
                            # Output claims a number that does not exist anywhere in the source
                            classification = "contradicts_source"
                            is_deterministic = True
                            reasoning = f"Deterministic check flagged: Value '{num}' does not appear anywhere in source document."
                            source_excerpt = None

            # Deterministic Check B: Dates & Quarters
            if years_in_claim and not is_deterministic:
                for yr in years_in_claim:
                    if yr.lower() not in source_lower:
                        # If the output claims a specific year/quarter not in source
                        if classification == "supported":
                            classification = "unsupported"
                            is_deterministic = True
                            reasoning = f"Deterministic check flagged: Timeframe '{yr}' is not found in source text."
                            source_excerpt = None

            # Never fabricate excerpts for unsupported claims (Rule #8)
            if classification == "unsupported":
                source_excerpt = None

            updated_claims.append(
                ClaimVerificationItem(
                    claim_index=claim.claim_index,
                    claim_text=claim.claim_text,
                    claim_type=claim.claim_type,
                    classification=classification,
                    confidence_score=1.0 if is_deterministic else claim.confidence_score,
                    reasoning=reasoning,
                    source_excerpt=source_excerpt,
                    source_reference=claim.source_reference,
                    is_deterministic=is_deterministic,
                )
            )

        return updated_claims

    # -------------------------------------------------------------
    # Semantic Verification via Google Gemini
    # -------------------------------------------------------------

    def verify_output(
        self,
        output_content: str,
        source_text: str,
        source_title: str = "Source Document",
        structured_analysis: Optional[Dict[str, Any]] = None,
        custom_instructions: Optional[str] = None,
    ) -> Tuple[float, Dict[str, int], str, List[ClaimVerificationItem]]:
        """
        Executes complete verification of output content against source text and facts.
        Returns: (overall_grounding_score, classification_counts, summary_notes, claims_list)
        """
        if not output_content or not output_content.strip():
            raise ValueError("Output content is empty; cannot verify.")

        if not source_text or not source_text.strip():
            raise ValueError("Source text is empty; cannot ground claims.")

        # Try AI semantic verification with fallback
        try:
            claims, score, notes = self._run_gemini_verification(
                output_content=output_content,
                source_text=source_text,
                source_title=source_title,
                structured_analysis=structured_analysis,
                custom_instructions=custom_instructions,
            )
        except Exception as err:
            logger.warning(f"AI semantic verification failed, falling back to deterministic: {err}")
            claims, score, notes = self._run_fallback_verification(
                output_content=output_content,
                source_text=source_text,
                structured_analysis=structured_analysis,
            )

        # Apply deterministic overrides and sanity checks
        final_claims = self.run_deterministic_checks(
            claims=claims,
            source_text=source_text,
            structured_analysis=structured_analysis,
        )

        # Re-compute counts and grounding score
        counts = {
            "supported": 0,
            "partially_supported": 0,
            "unsupported": 0,
            "contradicts_source": 0,
            "requires_review": 0,
            "total": len(final_claims),
        }
        for c in final_claims:
            counts[c.classification] = counts.get(c.classification, 0) + 1

        total = counts["total"]
        if total > 0:
            # Weighted score: supported=1.0, partially_supported=0.5, requires_review=0.5, others=0.0
            weighted = (
                counts["supported"] * 1.0
                + counts["partially_supported"] * 0.5
                + counts["requires_review"] * 0.5
            )
            grounding_score = round(weighted / total, 2)
        else:
            grounding_score = 1.0

        return grounding_score, counts, notes, final_claims

    def _run_gemini_verification(
        self,
        output_content: str,
        source_text: str,
        source_title: str,
        structured_analysis: Optional[Dict[str, Any]],
        custom_instructions: Optional[str] = None,
    ) -> Tuple[List[ClaimVerificationItem], float, str]:
        """Invokes Gemini model to extract and verify verifiable claims."""
        client = self._get_client()

        # Format structured analysis if present
        structured_context_str = ""
        if structured_analysis:
            structured_context_str = json.dumps(
                {
                    "main_topic": structured_analysis.get("main_topic"),
                    "numerical_facts": structured_analysis.get("numerical_facts", [])[:15],
                    "dates_and_events": structured_analysis.get("dates_and_events", [])[:15],
                    "entities": structured_analysis.get("entities", [])[:15],
                    "key_claims": structured_analysis.get("key_claims", [])[:10],
                },
                indent=2,
            )

        system_instruction = (
            "You are ContentFlow AI's Lead Fact Grounding & Verification Auditor.\n"
            "Your mission is to perform strict factual verification of a generated communication output "
            "against the original source document and its verified structured intelligence.\n\n"
            "MANDATORY VERIFICATION RULES (RULE #8 & RULE #12):\n"
            "1. Extract the key factual claims made in the generated text (names, dates, numbers, metrics, events, conclusions).\n"
            "2. Classify each claim strictly into ONE of the following 5 categories:\n"
            "   - 'supported': Fact is explicitly corroborated by the source document. You MUST provide the exact verbatim source excerpt.\n"
            "   - 'partially_supported': Broadly true based on the source, but contains minor extrapolation, rounded numbers, or omitted conditions.\n"
            "   - 'unsupported': The claim asserts facts, statistics, or details NOT mentioned anywhere in the source document. 'source_excerpt' MUST BE null.\n"
            "   - 'contradicts_source': The claim directly conflicts with or inverts facts in the source (e.g. wrong number, inverted conclusion, wrong date). Provide source excerpt showing the actual truth.\n"
            "   - 'requires_review': Ambiguous, highly speculative, or subjective claim that cannot be definitively confirmed.\n"
            "3. ANTI-FABRICATION RULE: Never fabricate or guess source excerpts for unsupported claims. If unsupported, source_excerpt MUST be null.\n"
            "4. NEVER treat the AI's judgment as an infallible guarantee of truth.\n"
        )

        user_prompt = f"""
Document Title: {source_title}

<verified_structured_facts>
{structured_context_str}
</verified_structured_facts>

<untrusted_source_content>
{source_text[:12000]}
</untrusted_source_content>

<generated_content_to_verify>
{output_content}
</generated_content_to_verify>

{f"Additional Verification Focus: {custom_instructions}" if custom_instructions else ""}

Verify all factual claims in the generated content strictly against the untrusted source content and verified structured facts. Return the results matching the required JSON schema.
"""

        candidate_models = [self.preferred_model] + [
            m for m in DEFAULT_VERIFICATION_MODELS if m != self.preferred_model
        ]

        last_error = None
        for model_name in candidate_models:
            for attempt in range(2):
                try:
                    config = types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=VERIFICATION_SCHEMA,
                        temperature=0.1,
                    )
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=user_prompt,
                        config=config,
                    )
                    if not resp.text:
                        raise ValueError("Gemini returned empty response for verification.")

                    data = json.loads(resp.text)
                    raw_claims = data.get("claims", [])
                    claims_list = []
                    for idx, c in enumerate(raw_claims):
                        claims_list.append(
                            ClaimVerificationItem(
                                claim_index=idx,
                                claim_text=c.get("claim_text", "").strip(),
                                claim_type=c.get("claim_type", "substantive"),
                                classification=c.get("classification", "requires_review"),
                                confidence_score=float(c.get("confidence_score", 0.9)),
                                reasoning=c.get("reasoning", ""),
                                source_excerpt=c.get("source_excerpt"),
                                source_reference=c.get("source_reference", "Source Document"),
                                is_deterministic=False,
                            )
                        )

                    grounding_score = float(data.get("overall_grounding_score", 1.0))
                    summary_notes = data.get("summary_notes", "Verification completed.")
                    return claims_list, grounding_score, summary_notes

                except (APIError, ClientError, ServerError) as api_err:
                    last_error = api_err
                    if "429" in str(api_err) or "503" in str(api_err):
                        import time
                        time.sleep(1.0)
                        continue
                    break
                except Exception as ex:
                    last_error = ex
                    break

        raise ValueError(f"Gemini verification failed across models: {last_error}")

    def _run_fallback_verification(
        self,
        output_content: str,
        source_text: str,
        structured_analysis: Optional[Dict[str, Any]],
    ) -> Tuple[List[ClaimVerificationItem], float, str]:
        """
        Pure deterministic fallback if Gemini API is unreachable or rate limited.
        Extracts sentences containing factual keywords, numbers, or dates and compares directly.
        """
        sentences = re.split(r"(?<=[.!?])\s+", output_content.strip())
        claims = []
        source_lower = source_text.lower()

        for idx, sent in enumerate(sentences[:15]):  # limit to top 15 key statements
            sent_clean = sent.strip()
            if len(sent_clean) < 15 or sent_clean.startswith("#"):
                continue

            numbers = self.extract_numbers(sent_clean)
            dates = self.extract_years_and_quarters(sent_clean)

            if numbers:
                claim_type = "numerical"
                # Check if all numbers appear in source
                all_found = all(num.lower() in source_lower for num in numbers)
                if all_found:
                    classification = "supported"
                    reasoning = f"Numeric figures ({', '.join(numbers)}) exist in source."
                    source_excerpt = None
                else:
                    classification = "contradicts_source"
                    reasoning = f"Figures ({', '.join(numbers)}) were not found in source text."
                    source_excerpt = None
            elif dates:
                claim_type = "date_event"
                all_dates_found = all(d.lower() in source_lower for d in dates)
                classification = "supported" if all_dates_found else "unsupported"
                reasoning = "Timeframe verification via exact pattern matching."
                source_excerpt = None
            else:
                claim_type = "substantive"
                # Substantive statement
                classification = "requires_review"
                reasoning = "Substantive claim requires semantic review; evaluated deterministically."
                source_excerpt = None

            claims.append(
                ClaimVerificationItem(
                    claim_index=len(claims),
                    claim_text=sent_clean,
                    claim_type=claim_type,
                    classification=classification,
                    confidence_score=0.85,
                    reasoning=reasoning,
                    source_excerpt=source_excerpt,
                    source_reference="Source Document",
                    is_deterministic=True,
                )
            )

        grounding_score = 0.8
        notes = "Completed using deterministic rule verification (Gemini fallback mode)."
        return claims, grounding_score, notes


# Global singleton
fact_verification_engine = FactVerificationEngine()
