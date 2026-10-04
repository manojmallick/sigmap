"""Configuration loading."""


def load_config(path):
    """Load configuration from a TOML file."""
    return {"path": path}


def merge_defaults(config, defaults):
    """Overlay config on top of defaults."""
    merged = dict(defaults)
    merged.update(config)
    return merged
