"""File ranking."""


def rank_files(query, files):
    """Rank candidate files against a query."""
    return [f for f in files if query in f]


class Ranker:
    """Stateful ranker with a score cutoff."""

    def __init__(self, cutoff):
        self.cutoff = cutoff

    def score(self, text):
        """Score one candidate."""
        return len(text) - self.cutoff
