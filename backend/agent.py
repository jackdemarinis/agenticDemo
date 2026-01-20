"""Agentic workflow for personalized email draft generation."""
import os
import json
from typing import Optional, Dict, Any, Literal
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def determine_outreach_mode(recipient_data: Dict[str, Any]) -> Literal["b2b", "b2c"]:
    """
    STEP 1: Determine outreach mode based on recipient data.

    Logic:
    - If lead_type provided -> use it
    - Else if company or role exists -> B2B
    - Else -> B2C
    """
    if recipient_data.get("lead_type"):
        return recipient_data["lead_type"]

    if recipient_data.get("company") or recipient_data.get("role"):
        return "b2b"

    return "b2c"


def should_research(personalization_level: str) -> bool:
    """
    STEP 2: Decide whether to perform research.

    Logic:
    - Low personalization -> skip research
    - Medium/High -> attempt research
    """
    return personalization_level in ["medium", "high"]


def perform_public_research(
    recipient_data: Dict[str, Any],
    outreach_mode: str
) -> Dict[str, Any]:
    """
    STEP 3: Perform public research using OpenAI with web search.

    Returns:
    {
        "summary": "Brief summary of findings",
        "confidence": "high" | "medium" | "low"
    }
    """
    # Build search context from available data
    search_context = []

    first_name = recipient_data.get("first_name", "")
    last_name = recipient_data.get("last_name", "")
    company = recipient_data.get("company", "")
    role = recipient_data.get("role", "")
    linkedin_url = recipient_data.get("linkedin_url", "")
    location = recipient_data.get("location", "")

    # Determine search strategy
    if linkedin_url:
        search_query = f"LinkedIn profile {linkedin_url}"
    elif first_name and last_name and company:
        search_query = f"{first_name} {last_name} {company} {role}"
    elif first_name and last_name and location:
        search_query = f"{first_name} {last_name} {location}"
    elif outreach_mode == "b2b" and company:
        search_query = f"{company} company information"
    else:
        # Not enough info for research
        return {
            "summary": "Insufficient information for public research",
            "confidence": "low"
        }

    # Use OpenAI with web search to gather public information
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": """You are a research assistant. Your job is to find PUBLICLY AVAILABLE information about a person or company for B2B/B2C outreach purposes.

CRITICAL RULES:
- ONLY use information that is publicly available
- NEVER claim to have access to private data
- NEVER reference sensitive attributes (health, religion, politics, race, etc.)
- Focus on professional context: role, company, industry, public achievements, interests
- If confidence is low, say so clearly
- Keep summary brief (2-3 sentences max)
- Return ONLY safe, professional hooks for personalization

Return JSON with:
{
    "summary": "Brief professional summary",
    "confidence": "high|medium|low",
    "safe_hooks": ["hook1", "hook2"]  // 0-2 items only
}"""
                },
                {
                    "role": "user",
                    "content": f"""Research this person/company for outreach purposes:

Search query: {search_query}

Available data:
- Name: {first_name} {last_name}
- Company: {company}
- Role: {role}
- Location: {location}
- LinkedIn: {linkedin_url}
- Outreach mode: {outreach_mode}

Find publicly available professional information that could help personalize an email. Focus on recent achievements, company news, role context, or industry trends."""
                }
            ],
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        return {
            "summary": result.get("summary", "No significant public information found"),
            "confidence": result.get("confidence", "low"),
            "safe_hooks": result.get("safe_hooks", [])
        }

    except Exception as e:
        print(f"Research error: {e}")
        return {
            "summary": f"Research failed: {str(e)}",
            "confidence": "low",
            "safe_hooks": []
        }


def synthesize_personalization(
    recipient_data: Dict[str, Any],
    research_result: Optional[Dict[str, Any]],
    pitch: str,
    tone: str,
    outreach_mode: str,
    sign_off: Optional[str] = None
) -> Dict[str, str]:
    """
    STEP 4 & 5: Synthesize personalization and draft email.

    Returns structured output:
    {
        "subject": "...",
        "body": "...",
        "rationale": "...",
        "used_personalization_level": "low|medium|high"
    }
    """
    # Build context for the agent
    recipient_context = {
        "email": recipient_data.get("email"),
        "first_name": recipient_data.get("first_name"),
        "last_name": recipient_data.get("last_name"),
        "company": recipient_data.get("company"),
        "role": recipient_data.get("role"),
        "location": recipient_data.get("location"),
        "notes": recipient_data.get("notes"),
        "outreach_mode": outreach_mode
    }

    # Add research if available
    if research_result and research_result.get("confidence") != "low":
        recipient_context["research_summary"] = research_result.get("summary")
        recipient_context["safe_hooks"] = research_result.get("safe_hooks", [])
        recipient_context["research_confidence"] = research_result.get("confidence")

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": f"""You are an expert email copywriter specializing in {outreach_mode.upper()} outreach.

Your goal: Draft a personalized email based on the user's pitch and recipient context.

CRITICAL RULES:
1. NEVER claim access to private information
2. NEVER say "I found you on LinkedIn" unless LinkedIn URL was explicitly provided
3. NEVER reference sensitive attributes (health, religion, politics, race, etc.)
4. NEVER sound like surveillance or creepy
5. If research confidence is low, use GENERIC messaging
6. ALWAYS include a respectful opt-out line
7. Email must be 90-160 words (excluding sign-off)
8. ONE clear call-to-action
9. Match the tone: {tone}
10. {"ALWAYS end the email body with the provided sign-off exactly as given" if sign_off else "Use a professional closing (e.g., Best regards)"}

PERSONALIZATION LEVELS:
- Low: Generic message, use only name/company if available
- Medium: Reference role, industry, or company context
- High: Use research hooks IF confidence is high, otherwise downshift to medium

{"SIGN-OFF TO USE (append exactly as-is at the end of the body):\n" + sign_off if sign_off else ""}

Return JSON:
{{
    "subject": "Compelling subject line (5-8 words)",
    "body": "Email body (90-160 words, include greeting, pitch, personalization if appropriate, CTA, opt-out, and sign-off)",
    "rationale": "Brief explanation of personalization approach",
    "used_personalization_level": "low|medium|high"
}}"""
                },
                {
                    "role": "user",
                    "content": f"""Draft an email for this recipient:

PITCH:
{pitch}

RECIPIENT CONTEXT:
{json.dumps(recipient_context, indent=2)}

Create a {tone} email that feels personal but NEVER creepy. Use safe personalization only."""
                }
            ],
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        print(f"Draft generation error: {e}")
        # Fallback to basic draft
        first_name = recipient_data.get("first_name", "there")
        closing = f"\n\n{sign_off}" if sign_off else "\n\nBest regards"
        return {
            "subject": "Quick question",
            "body": f"Hi {first_name},\n\n{pitch}\n\nWould you be open to a brief conversation?{closing}\n\nPS: If this isn't relevant, no worries - just let me know.",
            "rationale": f"Fallback draft due to error: {str(e)}",
            "used_personalization_level": "low"
        }


def generate_draft_for_recipient(
    recipient_data: Dict[str, Any],
    pitch: str,
    audience_type: str,
    tone: str,
    personalization_level: str,
    sign_off: Optional[str] = None
) -> Dict[str, Any]:
    """
    Complete agentic workflow for one recipient.

    Returns all data needed to update the recipient record:
    {
        "inferred_outreach_mode": "b2b|b2c",
        "research_summary": "...",
        "research_confidence": "high|medium|low",
        "subject": "...",
        "body": "...",
        "rationale": "...",
        "used_personalization_level": "low|medium|high"
    }
    """
    # STEP 1: Determine outreach mode
    if audience_type == "mixed":
        outreach_mode = determine_outreach_mode(recipient_data)
    else:
        outreach_mode = audience_type

    # STEP 2 & 3: Research (if needed)
    research_result = None
    if should_research(personalization_level):
        research_result = perform_public_research(recipient_data, outreach_mode)

    # STEP 4 & 5: Personalization synthesis and draft generation
    draft_result = synthesize_personalization(
        recipient_data,
        research_result,
        pitch,
        tone,
        outreach_mode,
        sign_off
    )

    # Combine all results
    return {
        "inferred_outreach_mode": outreach_mode,
        "research_summary": research_result.get("summary") if research_result else None,
        "research_confidence": research_result.get("confidence") if research_result else None,
        "subject": draft_result.get("subject"),
        "body": draft_result.get("body"),
        "rationale": draft_result.get("rationale"),
        "used_personalization_level": draft_result.get("used_personalization_level")
    }
