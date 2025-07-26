"""Top-level package for displayHistory_ComfyUI."""

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]

__author__ = """Yuchan Cho"""
__email__ = "yuchan722cho@gmail.com"
__version__ = "0.0.1"

from .src.displayHistory_ComfyUI.nodes import NODE_CLASS_MAPPINGS
from .src.displayHistory_ComfyUI.nodes import NODE_DISPLAY_NAME_MAPPINGS

WEB_DIRECTORY = "./web"
