
import re
import requests
import asyncio

async def scrape_url(url: str) -> str:
    """
    Scrapes the given URL using requests and regex to avoid Playwright instability.
    Returns the text content of the body.
    """
    try:
        # Use a standard user agent to avoid being blocked
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # Run requests in a separate thread since it's blocking
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: requests.get(url, headers=headers, timeout=30))
        response.raise_for_status()
        
        html = response.text
        
        # Extract JSON-LD before cleaning
        json_ld_scripts = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, flags=re.DOTALL | re.IGNORECASE)
        
        # Extract Meta Images
        meta_images = re.findall(r'<meta property="og:image" content="(.*?)">', html, flags=re.IGNORECASE)
        meta_images += re.findall(r'<meta name="twitter:image" content="(.*?)">', html, flags=re.IGNORECASE)
        
        # Simple cleanup using regex
        # 1. Remove scripts and styles
        html = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
        
        # 2. Remove comments
        html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
        
        # 3. Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', html)
        
        # 4. Collapse whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Append JSON-LD data if found
        if json_ld_scripts:
            text += "\n\n--- JSON-LD DATA ---\n"
            for script in json_ld_scripts:
                text += script + "\n"

        # Append Meta Images if found
        if meta_images:
            text += "\n\n--- META IMAGES ---\n"
            for img in meta_images:
                text += img + "\n"
        
        return text

    except Exception as e:
        from logger import logger
        logger.error(f"Scraping error {url}: {e}")
        return ""
