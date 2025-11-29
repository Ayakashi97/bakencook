from sqlalchemy.orm import Session
import models
from database import SessionLocal
import json

def seed_data():
    db = SessionLocal()
    try:
        # 1. Seed Units
        from logger import logger
        logger.info("Seeding Units...")
        units_data = [
            {"name": {"en": {"singular": "g", "plural": "g"}, "de": {"singular": "g", "plural": "g"}}, "description": {"en": "Gram", "de": "Gramm"}},
            {"name": {"en": {"singular": "kg", "plural": "kg"}, "de": {"singular": "kg", "plural": "kg"}}, "description": {"en": "Kilogram", "de": "Kilogramm"}},
            {"name": {"en": {"singular": "ml", "plural": "ml"}, "de": {"singular": "ml", "plural": "ml"}}, "description": {"en": "Milliliter", "de": "Milliliter"}},
            {"name": {"en": {"singular": "l", "plural": "l"}, "de": {"singular": "l", "plural": "l"}}, "description": {"en": "Liter", "de": "Liter"}},
            {"name": {"en": {"singular": "tsp", "plural": "tsp"}, "de": {"singular": "TL", "plural": "TL"}}, "description": {"en": "Teaspoon", "de": "Teelöffel"}},
            {"name": {"en": {"singular": "tbsp", "plural": "tbsp"}, "de": {"singular": "EL", "plural": "EL"}}, "description": {"en": "Tablespoon", "de": "Esslöffel"}},
            {"name": {"en": {"singular": "pcs", "plural": "pcs"}, "de": {"singular": "Stk", "plural": "Stk"}}, "description": {"en": "Piece", "de": "Stück"}},
            {"name": {"en": {"singular": "pinch", "plural": "pinches"}, "de": {"singular": "Prise", "plural": "Prisen"}}, "description": {"en": "Pinch", "de": "Prise"}},
            {"name": {"en": {"singular": "cup", "plural": "cups"}, "de": {"singular": "Tasse", "plural": "Tassen"}}, "description": {"en": "Cup", "de": "Tasse"}},
            {"name": {"en": {"singular": "drop", "plural": "drops"}, "de": {"singular": "Tropfen", "plural": "Tropfen"}}, "description": {"en": "Drop", "de": "Tropfen"}},
        ]

        unit_map = {} # en_singular -> id
        all_units = db.query(models.Unit).all()

        for u_data in units_data:
            target_en_singular = u_data["name"]["en"]["singular"]
            existing = None
            
            for ex in all_units:
                # Handle legacy structure: {'en': 'g', 'de': 'g'}
                # Handle new structure: {'en': {'singular': 'g', ...}}
                ex_name = ex.name
                if isinstance(ex_name, str):
                    try:
                        ex_name = json.loads(ex_name)
                    except:
                        pass
                
                if not isinstance(ex_name, dict):
                    continue

                # Check legacy
                if isinstance(ex_name.get("en"), str):
                    if ex_name.get("en") == target_en_singular:
                        existing = ex
                        break
                # Check new
                elif isinstance(ex_name.get("en"), dict):
                    if ex_name.get("en", {}).get("singular") == target_en_singular:
                        existing = ex
                        break
            
            if not existing:
                try:
                    new_unit = models.Unit(name=u_data["name"], description=u_data["description"])
                    db.add(new_unit)
                    db.commit()
                    db.refresh(new_unit)
                    unit_map[target_en_singular] = new_unit.id
                    logger.info(f"  Created unit: {target_en_singular}")
                    all_units.append(new_unit) # Add to local list for next iterations
                except Exception as e:
                    db.rollback()
                    logger.error(f"  Failed to create unit {target_en_singular}: {e}")
            else:
                # Update if needed (structure or description)
                updated = False
                
                # Check if we need to upgrade structure
                current_name = existing.name
                if isinstance(current_name, str):
                     try:
                        current_name = json.loads(current_name)
                     except:
                        pass
                
                if isinstance(current_name.get("en"), str):
                    # Upgrade to new structure
                    existing.name = u_data["name"]
                    updated = True
                    logger.info(f"  Upgrading unit structure for: {target_en_singular}")

                if not existing.description or existing.description != u_data["description"]:
                    existing.description = u_data["description"]
                    updated = True
                    logger.info(f"  Updating description for: {target_en_singular}")
                
                if updated:
                    try:
                        db.add(existing)
                        db.commit()
                    except Exception as e:
                        db.rollback()
                        logger.error(f"  Failed to update unit {target_en_singular}: {e}")
                else:
                    logger.debug(f"  Unit exists and up to date: {target_en_singular}")
                
                unit_map[target_en_singular] = existing.id

        # 2. Seed Ingredients
        # Helper to get unit ID
        def get_u(name):
            return unit_map.get(name)

        ingredients_data = [
            # Flours
            {"name": {"en": {"singular": "Wheat Flour Type 550", "plural": "Wheat Flour Type 550"}, "de": {"singular": "Weizenmehl Type 550", "plural": "Weizenmehl Type 550"}}, "unit": "g"},
            {"name": {"en": {"singular": "Wheat Flour Type 405", "plural": "Wheat Flour Type 405"}, "de": {"singular": "Weizenmehl Type 405", "plural": "Weizenmehl Type 405"}}, "unit": "g"},
            {"name": {"en": {"singular": "Wheat Flour Type 1050", "plural": "Wheat Flour Type 1050"}, "de": {"singular": "Weizenmehl Type 1050", "plural": "Weizenmehl Type 1050"}}, "unit": "g"},
            {"name": {"en": {"singular": "Whole Wheat Flour", "plural": "Whole Wheat Flour"}, "de": {"singular": "Weizenvollkornmehl", "plural": "Weizenvollkornmehl"}}, "unit": "g"},
            {"name": {"en": {"singular": "Rye Flour Type 1150", "plural": "Rye Flour Type 1150"}, "de": {"singular": "Roggenmehl Type 1150", "plural": "Roggenmehl Type 1150"}}, "unit": "g"},
            {"name": {"en": {"singular": "Rye Flour Type 997", "plural": "Rye Flour Type 997"}, "de": {"singular": "Roggenmehl Type 997", "plural": "Roggenmehl Type 997"}}, "unit": "g"},
            {"name": {"en": {"singular": "Whole Rye Flour", "plural": "Whole Rye Flour"}, "de": {"singular": "Roggenvollkornmehl", "plural": "Roggenvollkornmehl"}}, "unit": "g"},
            {"name": {"en": {"singular": "Spelt Flour Type 630", "plural": "Spelt Flour Type 630"}, "de": {"singular": "Dinkelmehl Type 630", "plural": "Dinkelmehl Type 630"}}, "unit": "g"},
            {"name": {"en": {"singular": "Whole Spelt Flour", "plural": "Whole Spelt Flour"}, "de": {"singular": "Dinkelvollkornmehl", "plural": "Dinkelvollkornmehl"}}, "unit": "g"},
            
            # Liquids
            {"name": {"en": {"singular": "Water", "plural": "Water"}, "de": {"singular": "Wasser", "plural": "Wasser"}}, "unit": "ml"},
            {"name": {"en": {"singular": "Milk", "plural": "Milk"}, "de": {"singular": "Milch", "plural": "Milch"}}, "unit": "ml"},
            {"name": {"en": {"singular": "Buttermilk", "plural": "Buttermilk"}, "de": {"singular": "Buttermilch", "plural": "Buttermilch"}}, "unit": "ml"},
            
            # Yeasts / Starters
            {"name": {"en": {"singular": "Fresh Yeast", "plural": "Fresh Yeast"}, "de": {"singular": "Frischhefe", "plural": "Frischhefe"}}, "unit": "g"},
            {"name": {"en": {"singular": "Dry Yeast", "plural": "Dry Yeast"}, "de": {"singular": "Trockenhefe", "plural": "Trockenhefe"}}, "unit": "g"},
            {"name": {"en": {"singular": "Sourdough Starter", "plural": "Sourdough Starter"}, "de": {"singular": "Sauerteig Anstellgut", "plural": "Sauerteig Anstellgut"}}, "unit": "g"},
            {"name": {"en": {"singular": "Lievito Madre", "plural": "Lievito Madre"}, "de": {"singular": "Lievito Madre", "plural": "Lievito Madre"}}, "unit": "g"},
            {"name": {"en": {"singular": "Baking Powder", "plural": "Baking Powder"}, "de": {"singular": "Backpulver", "plural": "Backpulver"}}, "unit": "tsp"},

            # Basics
            {"name": {"en": {"singular": "Salt", "plural": "Salt"}, "de": {"singular": "Salz", "plural": "Salz"}}, "unit": "g"},
            {"name": {"en": {"singular": "Sugar", "plural": "Sugar"}, "de": {"singular": "Zucker", "plural": "Zucker"}}, "unit": "g"},
            {"name": {"en": {"singular": "Honey", "plural": "Honey"}, "de": {"singular": "Honig", "plural": "Honig"}}, "unit": "g"},
            {"name": {"en": {"singular": "Butter", "plural": "Butter"}, "de": {"singular": "Butter", "plural": "Butter"}}, "unit": "g"},
            {"name": {"en": {"singular": "Egg", "plural": "Eggs"}, "de": {"singular": "Ei", "plural": "Eier"}}, "unit": "pcs"},
            {"name": {"en": {"singular": "Olive Oil", "plural": "Olive Oil"}, "de": {"singular": "Olivenöl", "plural": "Olivenöl"}}, "unit": "ml"},
            
            # Seeds / Grains
            {"name": {"en": {"singular": "Sunflower Seeds", "plural": "Sunflower Seeds"}, "de": {"singular": "Sonnenblumenkerne", "plural": "Sonnenblumenkerne"}}, "unit": "g"},
            {"name": {"en": {"singular": "Pumpkin Seeds", "plural": "Pumpkin Seeds"}, "de": {"singular": "Kürbiskerne", "plural": "Kürbiskerne"}}, "unit": "g"},
            {"name": {"en": {"singular": "Sesame Seeds", "plural": "Sesame Seeds"}, "de": {"singular": "Sesam", "plural": "Sesam"}}, "unit": "g"},
            {"name": {"en": {"singular": "Flax Seeds", "plural": "Flax Seeds"}, "de": {"singular": "Leinsamen", "plural": "Leinsamen"}}, "unit": "g"},
            {"name": {"en": {"singular": "Oats", "plural": "Oats"}, "de": {"singular": "Haferflocken", "plural": "Haferflocken"}}, "unit": "g"},
        ]
        
        logger.info("Seeding Ingredients...")
        all_ingredients = db.query(models.IngredientItem).all()
        
        for ing_data in ingredients_data:
            target_en_singular = ing_data["name"]["en"]["singular"]
            unit_name = ing_data["unit"]
            
            exists = False
            for ing in all_ingredients:
                ing_name = ing.name
                if isinstance(ing_name, str):
                    try:
                        ing_name = json.loads(ing_name)
                    except:
                        pass
                
                if not isinstance(ing_name, dict):
                    continue

                # Check legacy
                if isinstance(ing_name.get("en"), str):
                    if ing_name.get("en") == target_en_singular:
                        exists = True
                        break
                # Check new
                elif isinstance(ing_name.get("en"), dict):
                    if ing_name.get("en", {}).get("singular") == target_en_singular:
                        exists = True
                        break
            
            if not exists:
                unit_id = get_u(unit_name)
                if unit_id:
                    try:
                        new_ing = models.IngredientItem(
                            name=ing_data["name"],
                            default_unit_id=unit_id
                        )
                        db.add(new_ing)
                        db.commit() # Commit each to avoid rollback of all
                        logger.info(f"  Created ingredient: {target_en_singular}")
                        all_ingredients.append(new_ing)
                    except Exception as e:
                        db.rollback()
                        logger.error(f"  Failed to create ingredient {target_en_singular}: {e}")
                else:
                    logger.warning(f"  Skipping {target_en_singular}: Unit {unit_name} not found")
            else:
                logger.debug(f"  Ingredient exists: {target_en_singular}")
                
        logger.info("Seeding completed.")

    except Exception as e:
        logger.error(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
