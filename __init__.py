"""Top-level package for secondcomfynode."""

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]

__author__ = """Yuchan Cho"""
__email__ = "yuchan722cho@gmail.com"
__version__ = "0.0.1"

from .src.secondcomfynode.nodes import NODE_CLASS_MAPPINGS
from .src.secondcomfynode.nodes import NODE_DISPLAY_NAME_MAPPINGS

WEB_DIRECTORY = "./web"
