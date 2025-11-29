import google.generativeai as genai
import os
import json
from schemas import RecipeCreate, IngredientCreate, StepCreate
from models import RecipeType, IngredientType, StepType

def configure_genai(api_key: str = None):
    key = api_key
    if key:
        genai.configure(api_key=key)
    return key

async def parse_recipe_from_text(text: str, source_url: str = None, language: str = "en", api_key: str = None) -> dict:
    """
    Uses Gemini to parse unstructured text into a structured Recipe object.
    Returns a dictionary matching the RecipeCreate schema.
    """
    key = configure_genai(api_key)
    if not key:
        raise Exception("GEMINI_API_KEY is not set")

    model = genai.GenerativeModel('gemini-flash-latest')

    prompt = f"""
    You are a professional baker and recipe parser. Extract a structured recipe from the following text.
    
    Target Language: {language.upper()} (Translate title, descriptions, and ingredient names to this language if needed).
    
    Text:
    {text[:40000]} # Limit text length

    Return ONLY valid JSON matching this structure:
    {{
        "title": "Recipe Title",
        "type": "baking", // "baking" or "cooking"
        "image_url": "http://example.com/image.jpg", // Extract best image URL from JSON-LD or Meta Data
        "yield_amount": 4, // Number of portions/servings (default 1)
        "weight_per_piece": 0, // Optional: Weight per piece in grams (if applicable/mentioned)
        "reference_temperature": 20, // Reference temperature in Celsius (default 20 if not found)
        "chapters": [
            {{
                "name": "Sauerteig", // e.g., Main Dough, Sourdough, Poolish
                "order_index": 0, // REQUIRED: 0-based index
                "ingredients": [
                    {{ "name": {{ "en": "Rye Flour", "de": "Roggenmehl" }}, "amount": 100.5, "unit": "g", "type": "flour", "temperature": null }},
                    {{ "name": {{ "en": "Water", "de": "Wasser" }}, "amount": 100, "unit": "g", "type": "liquid", "temperature": 50 }}
                ],
                "steps": [
                    {{ "order_index": 1, "description": "Mix and let rest", "duration_min": 720, "type": "passive" }}
                ]
            }},
            {{
                "name": "Hauptteig",
                "order_index": 1, // REQUIRED
                "ingredients": [
                    {{ "name": {{ "en": "Wheat Flour", "de": "Weizenmehl" }}, "amount": 500, "unit": "g", "type": "flour" }}
                ],
                "steps": [
                    {{ "order_index": 1, "description": "Knead all ingredients", "duration_min": 10, "type": "active" }},
                    {{ "order_index": 2, "description": "Bulk fermentation", "duration_min": 60, "type": "passive" }}
                ]
            }}
        ]
    }}

    Rules:
    - Classify "type" as either "baking" (bread, cakes, cookies, pastries) or "cooking" (meals, soups, salads, etc.).
    - Identify separate recipe parts (e.g., Sourdough, Soaker, Main Dough) and map them to "chapters".
    - Ingredient types MUST be one of: flour, liquid, starter (use for yeast/sourdough), salt, add_in, other.
    - Step types: active (kneading, shaping), passive (resting, proofing), baking (oven).
    - duration_min: Estimate time in minutes. 'Overnight' = 720-900 min.
    - yield_amount: Extract the number of portions or servings (e.g. "For 4 people" -> 4). Do NOT sum the weights.
    - weight_per_piece: If the recipe mentions weight per piece (e.g. "10 buns at 80g"), extract 80. Otherwise 0 or null.
    - Translate ingredient names to German (de) and English (en).
    - If the text contains a "reference temperature" (Teigtemperatur), extract it.
    - Ignore marketing text, comments, and unrelated content.
    - ENSURE every chapter has an "order_index".
    - Amounts can be FLOATS (e.g. 1.5, 0.5). Do not round to integer unless it is a whole number.
    - EXTRACT TEMPERATURES: If an ingredient has a temperature (e.g. "Water 20°C" or "Wasser (50°C)"), extract "20" or "50" into the "temperature" field and REMOVE it from the name.
    - IMAGE URL: Look for image URLs in the "--- JSON-LD DATA ---" or "--- META IMAGES ---" sections. Prefer high-resolution images.
    """

    try:
        response = model.generate_content(prompt)
        from logger import logger
        logger.debug(f"Gemini Response: {response.text}") # DEBUG
        
        # Robust JSON extraction
        import re
        json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
        if not json_match:
             raise ValueError("No JSON object found in AI response")
             
        cleaned_text = json_match.group(0)
        data = json.loads(cleaned_text)
        
        # Add metadata
        data["source_url"] = source_url
        data["created_type"] = RecipeType.ai_import
        
        # Sanitize data to match schema (handle None values)
        for chapter in data.get("chapters", []):
            for ingredient in chapter.get("ingredients", []):
                if ingredient.get("amount") is None:
                    ingredient["amount"] = 0.0
                if ingredient.get("unit") is None:
                    ingredient["unit"] = ""
        
        return data
    except Exception as e:
        from logger import logger
        logger.error(f"Error parsing with AI: {e}")
        # Return a dummy structure or raise
        raise e

async def translate_ingredient(name: str, api_key: str = None) -> dict:
    """
    Translates an ingredient name to English and German using Gemini.
    Returns: {"en": "...", "de": "..."}
    """
    key = configure_genai(api_key)
    if not key:
        # Fallback if no key
        return {"en": name, "de": name}

    model = genai.GenerativeModel('gemini-flash-latest')
    
    prompt = f"""
    Translate the ingredient "{name}" to English and German.
    Return ONLY valid JSON: 
    {{ 
        "en": {{ "singular": "English Singular", "plural": "English Plural" }}, 
        "de": {{ "singular": "German Singular", "plural": "German Plural" }} 
    }}
    If the input is already in one language, keep it and translate to the other.
    """
    
    try:
        response = model.generate_content(prompt)
        cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned_text)
    except Exception as e:
        from logger import logger
        logger.error(f"Error translating: {e}")
        # Fallback structure
        return {
            "en": {"singular": name, "plural": name},
            "de": {"singular": name, "plural": name}
        }


async def parse_recipe_from_image(image_path: str, language: str = "en", api_key: str = None) -> dict:
    """
    Uses Gemini to parse a recipe from an image file.
    Returns a dictionary matching the RecipeCreate schema.
    """
    key = configure_genai(api_key)
    if not key:
        raise Exception("GEMINI_API_KEY is not set")

    # Upload the file to Gemini
    try:
        sample_file = genai.upload_file(path=image_path, display_name="Recipe Image")
        
        model = genai.GenerativeModel('gemini-flash-latest') # Use flash for speed and multimodal
        
        prompt = f"""
        You are a professional baker and recipe parser. Extract a structured recipe from this image.
        
        Target Language: {language.upper()} (Translate title, descriptions, and ingredient names to this language if needed).
        
        Return ONLY valid JSON matching this structure:
        {{
            "title": "Recipe Title",
            "type": "baking", // "baking" or "cooking"
            "image_url": "", // Leave empty for image import, we will handle the image separately if needed
            "yield_amount": 4, // Number of portions/servings (default 1)
            "weight_per_piece": 0, // Optional: Weight per piece in grams (if applicable/mentioned)
            "reference_temperature": 20, // Reference temperature in Celsius (default 20 if not found)
            "chapters": [
                {{
                    "name": "Sauerteig", // e.g., Main Dough, Sourdough, Poolish
                    "order_index": 0, // REQUIRED: 0-based index
                    "ingredients": [
                        {{ "name": {{ "en": "Rye Flour", "de": "Roggenmehl" }}, "amount": 100.5, "unit": "g", "type": "flour", "temperature": null }},
                        {{ "name": {{ "en": "Water", "de": "Wasser" }}, "amount": 100, "unit": "g", "type": "liquid", "temperature": 50 }}
                    ],
                    "steps": [
                        {{ "order_index": 1, "description": "Mix and let rest", "duration_min": 720, "type": "passive" }}
                    ]
                }}
            ]
        }}

        Rules:
        - Classify "type" as either "baking" (bread, cakes, cookies, pastries) or "cooking" (meals, soups, salads, etc.).
        - Identify separate recipe parts (e.g., Sourdough, Soaker, Main Dough) and map them to "chapters".
        - Ingredient types MUST be one of: flour, liquid, starter (use for yeast/sourdough), salt, add_in, other.
        - Step types MUST be one of: active (kneading, shaping, cooking), passive (resting, proofing), baking (oven).
        - duration_min: Estimate time in minutes. 'Overnight' = 720-900 min.
        - yield_amount: Extract the number of portions or servings.
        - weight_per_piece: If the recipe mentions weight per piece, extract it.
        - Translate ingredient names to German (de) and English (en).
        - If the text contains a "reference temperature" (Teigtemperatur), extract it.
        - Ignore marketing text, comments, and unrelated content.
        - ENSURE every chapter has an "order_index".
        - Amounts can be FLOATS (e.g. 1.5, 0.5).
        - EXTRACT TEMPERATURES: If an ingredient has a temperature, extract it into the "temperature" field.
        """

        response = model.generate_content([sample_file, prompt])
        
        # Cleanup file from Gemini immediately
        try:
            sample_file.delete()
        except:
            pass

        from logger import logger
        logger.debug(f"Gemini Image Response: {response.text}")
        
        # Robust JSON extraction
        import re
        json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
        if not json_match:
             raise ValueError("No JSON object found in AI response")
             
        cleaned_text = json_match.group(0)
        data = json.loads(cleaned_text)
        
        # Add metadata
        data["source_url"] = None
        data["created_type"] = RecipeType.ai_import
        
        # Sanitize data
        valid_step_types = ["active", "passive", "baking"]
        for chapter in data.get("chapters", []):
            for ingredient in chapter.get("ingredients", []):
                if ingredient.get("amount") is None:
                    ingredient["amount"] = 0.0
                if ingredient.get("unit") is None:
                    ingredient["unit"] = ""
            
            for step in chapter.get("steps", []):
                if step.get("type") not in valid_step_types:
                    step["type"] = "active" # Fallback
        
        return data

    except Exception as e:
        from logger import logger
        logger.error(f"Error parsing image with AI: {e}")
        raise e

