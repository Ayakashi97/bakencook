import logging
import os
import sys

# Default to False (INFO), controlled by DB/Main
DEBUG_MODE = False

# Configure Logger
logger = logging.getLogger("bakencook")
logger.setLevel(logging.INFO)

# Create Console Handler
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.INFO)

# Create Formatter
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)

# Create File Handler
file_handler = logging.FileHandler("app.log")
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(formatter)

# Add Handlers to Logger
if not logger.handlers:
    logger.addHandler(handler)
    logger.addHandler(file_handler)

def get_logger(name: str = None):
    if name:
        return logger.getChild(name)
    return logger

def set_log_level(debug_mode: bool):
    level = logging.DEBUG if debug_mode else logging.INFO
    logger.setLevel(level)
    for h in logger.handlers:
        h.setLevel(level)
