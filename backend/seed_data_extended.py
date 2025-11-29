import models
from database import get_db
from sqlalchemy.orm import Session
import json

def seed_data_extended():
    db = next(get_db())
    
    # --- Units ---
    # Comprehensive list of units for Cooking & Baking (DE/EN)
    units_data = [
        # Weight
        {"name": {"en": {"singular": "g", "plural": "g"}, "de": {"singular": "g", "plural": "g"}}, "description": {"en": "Gram", "de": "Gramm"}},
        {"name": {"en": {"singular": "kg", "plural": "kg"}, "de": {"singular": "kg", "plural": "kg"}}, "description": {"en": "Kilogram", "de": "Kilogramm"}},
        {"name": {"en": {"singular": "mg", "plural": "mg"}, "de": {"singular": "mg", "plural": "mg"}}, "description": {"en": "Milligram", "de": "Milligramm"}},
        {"name": {"en": {"singular": "lb", "plural": "lbs"}, "de": {"singular": "Pfund", "plural": "Pfund"}}, "description": {"en": "Pound", "de": "Pfund"}},
        {"name": {"en": {"singular": "oz", "plural": "oz"}, "de": {"singular": "Unze", "plural": "Unzen"}}, "description": {"en": "Ounce", "de": "Unze"}},
        
        # Volume
        {"name": {"en": {"singular": "ml", "plural": "ml"}, "de": {"singular": "ml", "plural": "ml"}}, "description": {"en": "Milliliter", "de": "Milliliter"}},
        {"name": {"en": {"singular": "l", "plural": "l"}, "de": {"singular": "l", "plural": "l"}}, "description": {"en": "Liter", "de": "Liter"}},
        {"name": {"en": {"singular": "tsp", "plural": "tsp"}, "de": {"singular": "TL", "plural": "TL"}}, "description": {"en": "Teaspoon", "de": "Teelöffel"}},
        {"name": {"en": {"singular": "tbsp", "plural": "tbsp"}, "de": {"singular": "EL", "plural": "EL"}}, "description": {"en": "Tablespoon", "de": "Esslöffel"}},
        {"name": {"en": {"singular": "cup", "plural": "cups"}, "de": {"singular": "Tasse", "plural": "Tassen"}}, "description": {"en": "Cup", "de": "Tasse"}},
        {"name": {"en": {"singular": "fl oz", "plural": "fl oz"}, "de": {"singular": "fl oz", "plural": "fl oz"}}, "description": {"en": "Fluid Ounce", "de": "Flüssigunze"}},
        {"name": {"en": {"singular": "pint", "plural": "pints"}, "de": {"singular": "Pint", "plural": "Pints"}}, "description": {"en": "Pint", "de": "Pint"}},
        {"name": {"en": {"singular": "quart", "plural": "quarts"}, "de": {"singular": "Quart", "plural": "Quarts"}}, "description": {"en": "Quart", "de": "Quart"}},
        {"name": {"en": {"singular": "gal", "plural": "gal"}, "de": {"singular": "Gallone", "plural": "Gallonen"}}, "description": {"en": "Gallon", "de": "Gallone"}},
        
        # Count/Other
        {"name": {"en": {"singular": "pcs", "plural": "pcs"}, "de": {"singular": "Stk", "plural": "Stk"}}, "description": {"en": "Piece", "de": "Stück"}},
        {"name": {"en": {"singular": "pinch", "plural": "pinches"}, "de": {"singular": "Prise", "plural": "Prisen"}}, "description": {"en": "Pinch", "de": "Prise"}},
        {"name": {"en": {"singular": "slice", "plural": "slices"}, "de": {"singular": "Scheibe", "plural": "Scheiben"}}, "description": {"en": "Slice", "de": "Scheibe"}},
        {"name": {"en": {"singular": "clove", "plural": "cloves"}, "de": {"singular": "Zehe", "plural": "Zehen"}}, "description": {"en": "Clove", "de": "Zehe"}},
        {"name": {"en": {"singular": "can", "plural": "cans"}, "de": {"singular": "Dose", "plural": "Dosen"}}, "description": {"en": "Can", "de": "Dose"}},
        {"name": {"en": {"singular": "bunch", "plural": "bunches"}, "de": {"singular": "Bund", "plural": "Bunde"}}, "description": {"en": "Bunch", "de": "Bund"}},
        {"name": {"en": {"singular": "package", "plural": "packages"}, "de": {"singular": "Packung", "plural": "Packungen"}}, "description": {"en": "Package", "de": "Packung"}},
        {"name": {"en": {"singular": "sprig", "plural": "sprigs"}, "de": {"singular": "Zweig", "plural": "Zweige"}}, "description": {"en": "Sprig", "de": "Zweig"}},
        {"name": {"en": {"singular": "dash", "plural": "dashes"}, "de": {"singular": "Spritzer", "plural": "Spritzer"}}, "description": {"en": "Dash", "de": "Spritzer"}},
        {"name": {"en": {"singular": "drop", "plural": "drops"}, "de": {"singular": "Tropfen", "plural": "Tropfen"}}, "description": {"en": "Drop", "de": "Tropfen"}},
    ]

    unit_map = {} # Map English singular name to ID for ingredient linking

    for u_data in units_data:
        # Check if exists (by EN singular name)
        en_singular = u_data["name"]["en"]["singular"]
        
        # We need to fetch all to check because of JSON structure
        # Or we can just insert and ignore errors, but better to check
        # For simplicity in this script, we'll fetch all units first
        existing_units = db.query(models.Unit).all()
        existing = None
        for eu in existing_units:
            if isinstance(eu.name, dict) and eu.name.get("en", {}).get("singular") == en_singular:
                existing = eu
                break
        
        if not existing:
            new_unit = models.Unit(name=u_data["name"], description=u_data["description"])
            db.add(new_unit)
            db.flush() # Get ID
            unit_map[en_singular] = new_unit.id
        else:
            unit_map[en_singular] = existing.id
            
    db.commit()
    
    # --- Ingredients ---
    # Comprehensive list of ingredients (Cooking & Baking)
    # Mapping default unit by EN singular name
    
    ingredients_data = [
        # Baking Basics
        {"name": {"en": "Wheat Flour Type 550", "de": "Weizenmehl Type 550"}, "unit": "g"},
        {"name": {"en": "Wheat Flour Type 405", "de": "Weizenmehl Type 405"}, "unit": "g"},
        {"name": {"en": "Wheat Flour Type 1050", "de": "Weizenmehl Type 1050"}, "unit": "g"},
        {"name": {"en": "Whole Wheat Flour", "de": "Weizenvollkornmehl"}, "unit": "g"},
        {"name": {"en": "Rye Flour Type 1150", "de": "Roggenmehl Type 1150"}, "unit": "g"},
        {"name": {"en": "Whole Rye Flour", "de": "Roggenvollkornmehl"}, "unit": "g"},
        {"name": {"en": "Spelt Flour Type 630", "de": "Dinkelmehl Type 630"}, "unit": "g"},
        {"name": {"en": "Whole Spelt Flour", "de": "Dinkelvollkornmehl"}, "unit": "g"},
        {"name": {"en": "Water", "de": "Wasser"}, "unit": "ml"}, # Or g
        {"name": {"en": "Milk", "de": "Milch"}, "unit": "ml"},
        {"name": {"en": "Buttermilk", "de": "Buttermilch"}, "unit": "ml"},
        {"name": {"en": "Yeast (Fresh)", "de": "Frischhefe"}, "unit": "g"},
        {"name": {"en": "Yeast (Dry)", "de": "Trockenhefe"}, "unit": "g"},
        {"name": {"en": "Sourdough Starter", "de": "Sauerteig Anstellgut"}, "unit": "g"},
        {"name": {"en": "Salt", "de": "Salz"}, "unit": "g"},
        {"name": {"en": "Sugar", "de": "Zucker"}, "unit": "g"},
        {"name": {"en": "Brown Sugar", "de": "Brauner Zucker"}, "unit": "g"},
        {"name": {"en": "Powdered Sugar", "de": "Puderzucker"}, "unit": "g"},
        {"name": {"en": "Honey", "de": "Honig"}, "unit": "g"},
        {"name": {"en": "Butter", "de": "Butter"}, "unit": "g"},
        {"name": {"en": "Oil", "de": "Öl"}, "unit": "ml"},
        {"name": {"en": "Olive Oil", "de": "Olivenöl"}, "unit": "ml"},
        {"name": {"en": "Vegetable Oil", "de": "Pflanzenöl"}, "unit": "ml"},
        {"name": {"en": "Egg", "de": "Ei"}, "unit": "pcs"},
        {"name": {"en": "Egg Yolk", "de": "Eigelb"}, "unit": "pcs"},
        {"name": {"en": "Egg White", "de": "Eiweiß"}, "unit": "pcs"},
        {"name": {"en": "Baking Powder", "de": "Backpulver"}, "unit": "tsp"},
        {"name": {"en": "Baking Soda", "de": "Natron"}, "unit": "tsp"},
        {"name": {"en": "Vanilla Extract", "de": "Vanilleextrakt"}, "unit": "tsp"},
        {"name": {"en": "Cinnamon", "de": "Zimt"}, "unit": "tsp"},
        
        # Cooking Basics - Vegetables
        {"name": {"en": "Onion", "de": "Zwiebel"}, "unit": "pcs"},
        {"name": {"en": "Garlic", "de": "Knoblauch"}, "unit": "clove"},
        {"name": {"en": "Potato", "de": "Kartoffel"}, "unit": "g"},
        {"name": {"en": "Carrot", "de": "Karotte"}, "unit": "pcs"},
        {"name": {"en": "Tomato", "de": "Tomate"}, "unit": "pcs"},
        {"name": {"en": "Cucumber", "de": "Gurke"}, "unit": "pcs"},
        {"name": {"en": "Bell Pepper", "de": "Paprika"}, "unit": "pcs"},
        {"name": {"en": "Zucchini", "de": "Zucchini"}, "unit": "pcs"},
        {"name": {"en": "Broccoli", "de": "Brokkoli"}, "unit": "g"},
        {"name": {"en": "Cauliflower", "de": "Blumenkohl"}, "unit": "g"},
        {"name": {"en": "Spinach", "de": "Spinat"}, "unit": "g"},
        {"name": {"en": "Mushroom", "de": "Pilz"}, "unit": "g"},
        {"name": {"en": "Lettuce", "de": "Salat"}, "unit": "pcs"},
        
        # Cooking Basics - Meat/Fish
        {"name": {"en": "Chicken Breast", "de": "Hähnchenbrust"}, "unit": "g"},
        {"name": {"en": "Ground Beef", "de": "Rinderhackfleisch"}, "unit": "g"},
        {"name": {"en": "Beef Steak", "de": "Rindersteak"}, "unit": "g"},
        {"name": {"en": "Pork Chop", "de": "Schweinekotelett"}, "unit": "g"},
        {"name": {"en": "Bacon", "de": "Speck"}, "unit": "g"},
        {"name": {"en": "Salmon", "de": "Lachs"}, "unit": "g"},
        {"name": {"en": "Tuna (Canned)", "de": "Thunfisch (Dose)"}, "unit": "can"},
        
        # Cooking Basics - Dairy/Cheese
        {"name": {"en": "Cheese (Grated)", "de": "Käse (gerieben)"}, "unit": "g"},
        {"name": {"en": "Mozzarella", "de": "Mozzarella"}, "unit": "g"},
        {"name": {"en": "Parmesan", "de": "Parmesan"}, "unit": "g"},
        {"name": {"en": "Cheddar", "de": "Cheddar"}, "unit": "g"},
        {"name": {"en": "Cream", "de": "Sahne"}, "unit": "ml"},
        {"name": {"en": "Sour Cream", "de": "Saure Sahne"}, "unit": "g"},
        {"name": {"en": "Yogurt", "de": "Joghurt"}, "unit": "g"},
        {"name": {"en": "Quark", "de": "Quark"}, "unit": "g"},
        
        # Cooking Basics - Grains/Pasta
        {"name": {"en": "Rice", "de": "Reis"}, "unit": "g"},
        {"name": {"en": "Pasta", "de": "Nudeln"}, "unit": "g"},
        {"name": {"en": "Spaghetti", "de": "Spaghetti"}, "unit": "g"},
        {"name": {"en": "Oats", "de": "Haferflocken"}, "unit": "g"},
        {"name": {"en": "Quinoa", "de": "Quinoa"}, "unit": "g"},
        {"name": {"en": "Couscous", "de": "Couscous"}, "unit": "g"},
        
        # Spices/Herbs
        {"name": {"en": "Black Pepper", "de": "Schwarzer Pfeffer"}, "unit": "tsp"},
        {"name": {"en": "Paprika Powder", "de": "Paprikapulver"}, "unit": "tsp"},
        {"name": {"en": "Cumin", "de": "Kreuzkümmel"}, "unit": "tsp"},
        {"name": {"en": "Basil", "de": "Basilikum"}, "unit": "tsp"}, # Or fresh bunch
        {"name": {"en": "Oregano", "de": "Oregano"}, "unit": "tsp"},
        {"name": {"en": "Thyme", "de": "Thymian"}, "unit": "tsp"},
        {"name": {"en": "Rosemary", "de": "Rosmarin"}, "unit": "tsp"},
        {"name": {"en": "Parsley", "de": "Petersilie"}, "unit": "bunch"},
        
        # Other
        {"name": {"en": "Tomato Paste", "de": "Tomatenmark"}, "unit": "tbsp"},
        {"name": {"en": "Mustard", "de": "Senf"}, "unit": "tsp"},
        {"name": {"en": "Soy Sauce", "de": "Sojasauce"}, "unit": "tbsp"},
        {"name": {"en": "Vinegar", "de": "Essig"}, "unit": "tbsp"},
        {"name": {"en": "Lemon Juice", "de": "Zitronensaft"}, "unit": "tbsp"},
        {"name": {"en": "Stock/Broth", "de": "Brühe"}, "unit": "ml"},
    ]

    for ing_data in ingredients_data:
        # Check if exists (by EN name)
        en_name = ing_data["name"]["en"]
        
        existing_ings = db.query(models.IngredientItem).all()
        existing = None
        for ei in existing_ings:
             if isinstance(ei.name, dict) and ei.name.get("en") == en_name:
                 existing = ei
                 break
        
        if not existing:
            # Find unit ID
            unit_name = ing_data["unit"]
            unit_id = unit_map.get(unit_name)
            
            # Fallback if unit not found (should not happen if lists are synced)
            if not unit_id:
                # Try to find 'g' or 'pcs' as fallback
                unit_id = unit_map.get("g") if unit_name in ["g", "kg", "mg"] else unit_map.get("pcs")
            
            new_ing = models.IngredientItem(
                name=ing_data["name"],
                default_unit_id=unit_id,
                is_verified=True
            )
            db.add(new_ing)
            
    db.commit()
    from logger import logger
    logger.info("Extended data seeding completed.")

if __name__ == "__main__":
    seed_data_extended()
