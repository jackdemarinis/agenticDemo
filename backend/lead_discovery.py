"""
Lead Discovery Tool for DraftSmith.

This module provides AI-powered lead discovery functionality:
1. Search-based URL discovery using DuckDuckGo
2. Public webpage scraping with Playwright
3. Content extraction with BeautifulSoup + readability-lxml
4. LLM-based enrichment for lead qualification
5. CSV generation for downstream email draft generation
"""

import asyncio
import json
import re
import os
from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse, urljoin
import pandas as pd
from bs4 import BeautifulSoup
from readability import Document
from openai import OpenAI
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class LeadData:
    """Structured lead data matching the required CSV schema."""
    email: str = ""
    first_name: str = ""
    business_name: str = ""
    location: str = ""
    website: str = ""
    platform: str = ""
    product_or_service: str = ""
    target_customer: str = ""
    key_pain_point: str = ""
    personalization_hook: str = ""
    confidence_score: float = 0.0


@dataclass
class DiscoveryConfig:
    """Configuration for lead discovery."""
    seed_input: str  # URL or keyword
    location: str  # City/State
    industry_hint: Optional[str] = None
    max_results: int = 10
    timeout_seconds: int = 30


class SearchEngine:
    """Search-based URL discovery using DuckDuckGo HTML."""

    DUCKDUCKGO_URL = "https://html.duckduckgo.com/html/"

    def __init__(self):
        self.browser = None
        self.context = None

    async def init_browser(self):
        """Initialize Playwright browser."""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=True)
        self.context = await self.browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )

    async def close(self):
        """Close browser resources."""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()

    def build_search_query(self, config: DiscoveryConfig) -> str:
        """Build an optimized search query for lead discovery."""
        parts = []

        # Check if seed_input is a URL or keyword
        if config.seed_input.startswith(('http://', 'https://')):
            # Extract domain/business type from URL
            parsed = urlparse(config.seed_input)
            domain_parts = parsed.netloc.replace('www.', '').split('.')
            if domain_parts:
                parts.append(domain_parts[0])
        else:
            parts.append(config.seed_input)

        # Add location
        if config.location:
            parts.append(config.location)

        # Add industry hint
        if config.industry_hint:
            parts.append(config.industry_hint)

        # Add business-focused terms
        parts.append("small business OR local business OR company")

        # Exclude major platforms we don't want to scrape
        exclusions = "-site:facebook.com -site:ebay.com -site:amazon.com -site:yelp.com"

        return f"{' '.join(parts)} {exclusions}"

    async def search(self, config: DiscoveryConfig) -> List[Dict[str, str]]:
        """
        Perform search and return list of URLs with metadata.

        Returns:
            List of dicts with 'url', 'title', 'snippet' keys
        """
        if not self.browser:
            await self.init_browser()

        query = self.build_search_query(config)
        logger.info(f"Searching: {query}")

        results = []
        page = await self.context.new_page()

        try:
            # Navigate to DuckDuckGo HTML version
            await page.goto(self.DUCKDUCKGO_URL, timeout=config.timeout_seconds * 1000)

            # Fill search form and submit
            await page.fill('input[name="q"]', query)
            await page.click('input[type="submit"]')

            # Wait for results
            await page.wait_for_selector('.result', timeout=config.timeout_seconds * 1000)

            # Extract results
            result_elements = await page.query_selector_all('.result')

            for element in result_elements[:config.max_results]:
                try:
                    # Get title and URL
                    title_elem = await element.query_selector('.result__title a')
                    snippet_elem = await element.query_selector('.result__snippet')

                    if title_elem:
                        url = await title_elem.get_attribute('href')
                        title = await title_elem.inner_text()
                        snippet = ""

                        if snippet_elem:
                            snippet = await snippet_elem.inner_text()

                        # Filter out non-business URLs
                        if url and self._is_valid_business_url(url):
                            results.append({
                                'url': url,
                                'title': title.strip(),
                                'snippet': snippet.strip()
                            })
                except Exception as e:
                    logger.warning(f"Error extracting result: {e}")
                    continue

        except PlaywrightTimeout:
            logger.error("Search timed out")
        except Exception as e:
            logger.error(f"Search error: {e}")
        finally:
            await page.close()

        logger.info(f"Found {len(results)} valid results")
        return results

    def _is_valid_business_url(self, url: str) -> bool:
        """Filter out URLs that aren't useful for lead discovery."""
        if not url:
            return False

        # Skip social media, marketplaces, and aggregators
        blocked_domains = [
            'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
            'youtube.com', 'tiktok.com', 'pinterest.com',
            'amazon.com', 'ebay.com', 'etsy.com', 'alibaba.com',
            'yelp.com', 'tripadvisor.com', 'yellowpages.com',
            'wikipedia.org', 'reddit.com', 'quora.com',
            'gov', '.edu'
        ]

        url_lower = url.lower()
        return not any(blocked in url_lower for blocked in blocked_domains)


class WebScraper:
    """Playwright-based scraper for public webpages."""

    def __init__(self):
        self.browser = None
        self.context = None

    async def init_browser(self):
        """Initialize Playwright browser."""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=True)
        self.context = await self.browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={'width': 1280, 'height': 720}
        )

    async def close(self):
        """Close browser resources."""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()

    async def scrape_page(self, url: str, timeout_seconds: int = 30) -> Dict[str, Any]:
        """
        Scrape a public webpage and extract content.

        Returns:
            Dict with 'html', 'url', 'title', 'success', 'error' keys
        """
        if not self.browser:
            await self.init_browser()

        result = {
            'url': url,
            'html': '',
            'title': '',
            'success': False,
            'error': None
        }

        page = await self.context.new_page()

        try:
            # Navigate with timeout
            response = await page.goto(
                url,
                timeout=timeout_seconds * 1000,
                wait_until='domcontentloaded'
            )

            if response and response.status >= 400:
                result['error'] = f"HTTP {response.status}"
                return result

            # Wait for content to stabilize
            await page.wait_for_timeout(2000)

            # Get page content
            result['html'] = await page.content()
            result['title'] = await page.title()
            result['success'] = True

        except PlaywrightTimeout:
            result['error'] = "Timeout"
        except Exception as e:
            result['error'] = str(e)
        finally:
            await page.close()

        return result


class ContentParser:
    """BeautifulSoup + readability-lxml parser for content extraction."""

    @staticmethod
    def extract_content(html: str, url: str) -> Dict[str, Any]:
        """
        Extract structured content from HTML.

        Returns:
            Dict with extracted business information
        """
        result = {
            'main_content': '',
            'about_text': '',
            'contact_info': {},
            'social_links': [],
            'business_signals': []
        }

        if not html:
            return result

        try:
            # Use readability to extract main content
            doc = Document(html)
            main_content = doc.summary()

            # Parse with BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            main_soup = BeautifulSoup(main_content, 'html.parser')

            # Extract clean text from main content
            result['main_content'] = main_soup.get_text(separator=' ', strip=True)[:5000]

            # Look for about section
            about_section = ContentParser._find_about_section(soup)
            if about_section:
                result['about_text'] = about_section[:2000]

            # Extract contact information
            result['contact_info'] = ContentParser._extract_contact_info(soup, html)

            # Extract social links
            result['social_links'] = ContentParser._extract_social_links(soup)

            # Extract business signals
            result['business_signals'] = ContentParser._extract_business_signals(soup)

        except Exception as e:
            logger.error(f"Content extraction error: {e}")

        return result

    @staticmethod
    def _find_about_section(soup: BeautifulSoup) -> str:
        """Find and extract about section content."""
        about_keywords = ['about', 'who we are', 'our story', 'our mission', 'company']

        for keyword in about_keywords:
            # Look for headers
            for tag in ['h1', 'h2', 'h3', 'h4']:
                headers = soup.find_all(tag, string=re.compile(keyword, re.I))
                for header in headers:
                    # Get sibling content
                    sibling = header.find_next_sibling()
                    if sibling:
                        return sibling.get_text(separator=' ', strip=True)

            # Look for sections/divs with about in class/id
            sections = soup.find_all(['section', 'div'],
                                    attrs={'class': re.compile(keyword, re.I)})
            sections += soup.find_all(['section', 'div'],
                                     attrs={'id': re.compile(keyword, re.I)})
            for section in sections:
                text = section.get_text(separator=' ', strip=True)
                if len(text) > 100:
                    return text

        return ""

    @staticmethod
    def _extract_contact_info(soup: BeautifulSoup, html: str) -> Dict[str, str]:
        """Extract contact information from page."""
        contact = {}

        # Email patterns
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        emails = re.findall(email_pattern, html)
        # Filter out common non-contact emails
        filtered_emails = [e for e in emails if not any(x in e.lower() for x in
                         ['example.com', 'domain.com', 'email.com', 'sentry', 'webpack'])]
        if filtered_emails:
            contact['email'] = filtered_emails[0]

        # Phone patterns
        phone_pattern = r'[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}'
        phones = re.findall(phone_pattern, html)
        valid_phones = [p for p in phones if len(re.sub(r'\D', '', p)) >= 10]
        if valid_phones:
            contact['phone'] = valid_phones[0]

        # Address - look for common patterns
        address_section = soup.find(['address', 'div'],
                                   attrs={'class': re.compile(r'address|location|contact', re.I)})
        if address_section:
            contact['address'] = address_section.get_text(separator=' ', strip=True)[:200]

        return contact

    @staticmethod
    def _extract_social_links(soup: BeautifulSoup) -> List[str]:
        """Extract social media links."""
        social_domains = ['linkedin.com', 'twitter.com', 'facebook.com',
                         'instagram.com', 'youtube.com']
        social_links = []

        for link in soup.find_all('a', href=True):
            href = link['href']
            for domain in social_domains:
                if domain in href and href not in social_links:
                    social_links.append(href)
                    break

        return social_links[:5]  # Limit to 5

    @staticmethod
    def _extract_business_signals(soup: BeautifulSoup) -> List[str]:
        """Extract business-related signals from page."""
        signals = []

        # Look for pricing/services indicators
        pricing_keywords = ['pricing', 'plans', 'services', 'products', 'solutions']
        for keyword in pricing_keywords:
            if soup.find(string=re.compile(keyword, re.I)):
                signals.append(f"has_{keyword}_page")

        # Look for team/about indicators
        team_keywords = ['team', 'founder', 'ceo', 'about us']
        for keyword in team_keywords:
            if soup.find(string=re.compile(keyword, re.I)):
                signals.append(f"mentions_{keyword.replace(' ', '_')}")

        # Look for contact form
        if soup.find('form'):
            signals.append("has_contact_form")

        # Look for testimonials/reviews
        if soup.find(string=re.compile(r'testimonial|review|client', re.I)):
            signals.append("has_testimonials")

        return signals[:10]


class LLMEnricher:
    """LLM-based enrichment for lead qualification."""

    ENRICHMENT_PROMPT = """You are a B2B lead researcher. Analyze the following website content and extract structured lead data for cold email outreach.

WEBSITE URL: {url}
WEBSITE TITLE: {title}
SEARCH CONTEXT: {search_context}
TARGET LOCATION: {location}
INDUSTRY HINT: {industry_hint}

EXTRACTED CONTENT:
{content}

CONTACT INFO FOUND:
{contact_info}

SOCIAL LINKS:
{social_links}

BUSINESS SIGNALS:
{business_signals}

---

Based on this information, extract the following fields. Be conservative - only fill fields where you have reasonable confidence. For fields you cannot determine, use empty string.

IMPORTANT RULES:
1. email: Only use if found in contact_info, otherwise leave empty
2. first_name: Try to find owner/founder name, otherwise leave empty
3. business_name: The company/business name
4. location: City, State format if determinable from content or use the target location
5. website: The URL provided
6. platform: Where this business likely sells (e.g., "own website", "local storefront", "service business")
7. product_or_service: Brief description of what they sell/offer (max 50 words)
8. target_customer: Who their ideal customer is (max 30 words)
9. key_pain_point: A likely business challenge they face that could be addressed (max 30 words)
10. personalization_hook: A specific, non-creepy detail from their website that could be mentioned in outreach (max 30 words)
11. confidence_score: 0.0-1.0 rating of overall data quality (0.8+ = email found + clear business info, 0.5-0.7 = good business info but no email, <0.5 = limited info)

Respond ONLY with valid JSON matching this schema:
{{
    "email": "",
    "first_name": "",
    "business_name": "",
    "location": "",
    "website": "",
    "platform": "",
    "product_or_service": "",
    "target_customer": "",
    "key_pain_point": "",
    "personalization_hook": "",
    "confidence_score": 0.0
}}"""

    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    def enrich_lead(self, url: str, title: str, search_result: Dict,
                    parsed_content: Dict, config: DiscoveryConfig) -> LeadData:
        """
        Use LLM to enrich scraped content into structured lead data.
        """
        try:
            prompt = self.ENRICHMENT_PROMPT.format(
                url=url,
                title=title,
                search_context=f"{search_result.get('title', '')} - {search_result.get('snippet', '')}",
                location=config.location,
                industry_hint=config.industry_hint or "Not specified",
                content=parsed_content.get('main_content', '')[:3000],
                contact_info=json.dumps(parsed_content.get('contact_info', {})),
                social_links=', '.join(parsed_content.get('social_links', [])),
                business_signals=', '.join(parsed_content.get('business_signals', []))
            )

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a precise data extraction assistant. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )

            result = json.loads(response.choices[0].message.content)

            # Ensure website is set
            result['website'] = url

            # Create LeadData object
            return LeadData(
                email=result.get('email', ''),
                first_name=result.get('first_name', ''),
                business_name=result.get('business_name', ''),
                location=result.get('location', config.location),
                website=result.get('website', url),
                platform=result.get('platform', ''),
                product_or_service=result.get('product_or_service', ''),
                target_customer=result.get('target_customer', ''),
                key_pain_point=result.get('key_pain_point', ''),
                personalization_hook=result.get('personalization_hook', ''),
                confidence_score=float(result.get('confidence_score', 0.0))
            )

        except Exception as e:
            logger.error(f"LLM enrichment error for {url}: {e}")
            # Return minimal lead data on error
            return LeadData(
                website=url,
                location=config.location,
                confidence_score=0.1
            )


class LeadDiscoveryPipeline:
    """
    Main pipeline orchestrating the lead discovery process.

    Pipeline flow:
    1. Search: Use DuckDuckGo to find relevant business URLs
    2. Scrape: Fetch public webpage content with Playwright
    3. Parse: Extract structured data with BeautifulSoup + readability
    4. Enrich: Use LLM to qualify and structure lead data
    5. Export: Generate CSV with pandas
    """

    def __init__(self):
        self.search_engine = SearchEngine()
        self.scraper = WebScraper()
        self.parser = ContentParser()
        self.enricher = LLMEnricher()

    async def discover_leads(self, config: DiscoveryConfig,
                            progress_callback=None) -> List[LeadData]:
        """
        Run the full discovery pipeline.

        Args:
            config: Discovery configuration
            progress_callback: Optional async callback(current, total, status)

        Returns:
            List of enriched LeadData objects
        """
        leads = []

        try:
            # Step 1: Search for URLs
            if progress_callback:
                await progress_callback(0, config.max_results, "Searching for businesses...")

            search_results = await self.search_engine.search(config)

            if not search_results:
                logger.warning("No search results found")
                return leads

            total = len(search_results)

            # Step 2-4: Scrape, Parse, and Enrich each result
            for i, result in enumerate(search_results):
                url = result['url']

                if progress_callback:
                    await progress_callback(i + 1, total, f"Processing: {url[:50]}...")

                try:
                    # Scrape
                    scraped = await self.scraper.scrape_page(url, config.timeout_seconds)

                    if not scraped['success']:
                        logger.warning(f"Failed to scrape {url}: {scraped['error']}")
                        continue

                    # Parse
                    parsed = self.parser.extract_content(scraped['html'], url)

                    # Enrich with LLM
                    lead = self.enricher.enrich_lead(
                        url=url,
                        title=scraped['title'],
                        search_result=result,
                        parsed_content=parsed,
                        config=config
                    )

                    # Only keep leads with minimum confidence
                    if lead.confidence_score >= 0.3:
                        leads.append(lead)
                        logger.info(f"Discovered lead: {lead.business_name} ({lead.confidence_score})")

                except Exception as e:
                    logger.error(f"Error processing {url}: {e}")
                    continue

            if progress_callback:
                await progress_callback(total, total, "Discovery complete!")

        finally:
            # Cleanup
            await self.search_engine.close()
            await self.scraper.close()

        return leads

    @staticmethod
    def leads_to_dataframe(leads: List[LeadData]) -> pd.DataFrame:
        """Convert leads to pandas DataFrame."""
        return pd.DataFrame([asdict(lead) for lead in leads])

    @staticmethod
    def export_to_csv(leads: List[LeadData], filepath: str) -> str:
        """Export leads to CSV file."""
        df = LeadDiscoveryPipeline.leads_to_dataframe(leads)
        df.to_csv(filepath, index=False)
        return filepath

    @staticmethod
    def leads_to_recipients(leads: List[LeadData]) -> List[Dict[str, Any]]:
        """
        Convert leads to recipient format for DraftSmith campaign.

        Maps lead fields to recipient fields used by the existing system.
        """
        recipients = []

        for lead in leads:
            recipient = {
                'email': lead.email,
                'first_name': lead.first_name,
                'company': lead.business_name,
                'location': lead.location,
                'company_website_url': lead.website,
                'notes': f"Product/Service: {lead.product_or_service}\n"
                        f"Target Customer: {lead.target_customer}\n"
                        f"Pain Point: {lead.key_pain_point}\n"
                        f"Hook: {lead.personalization_hook}",
                'lead_type': 'b2b',
                'tags': f"ai-discovered,confidence:{lead.confidence_score:.1f}"
            }
            recipients.append(recipient)

        return recipients


# Convenience function for direct usage
async def discover_leads(
    seed_input: str,
    location: str,
    industry_hint: Optional[str] = None,
    max_results: int = 10
) -> List[LeadData]:
    """
    Convenience function to discover leads.

    Args:
        seed_input: URL or keyword to seed the search
        location: Geographic location (city/state)
        industry_hint: Optional industry filter
        max_results: Maximum number of leads to discover

    Returns:
        List of LeadData objects
    """
    config = DiscoveryConfig(
        seed_input=seed_input,
        location=location,
        industry_hint=industry_hint,
        max_results=max_results
    )

    pipeline = LeadDiscoveryPipeline()
    return await pipeline.discover_leads(config)
