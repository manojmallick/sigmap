from app.config import load_config


def test_load_config():
    assert load_config("a")["path"] == "a"
