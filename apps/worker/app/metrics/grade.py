def compute_grade(score: float) -> str:
    """A+ >=0.95, A >=0.90, B >=0.80, C >=0.70, D >=0.60, F <0.60."""
    if score >= 0.95:
        return "A+"
    if score >= 0.90:
        return "A"
    if score >= 0.80:
        return "B"
    if score >= 0.70:
        return "C"
    if score >= 0.60:
        return "D"
    return "F"


def compute_overall_grade(metric_scores: dict[str, float]) -> str:
    """Average all metric scores, then compute_grade."""
    if not metric_scores:
        return "F"
    avg = sum(metric_scores.values()) / len(metric_scores)
    return compute_grade(avg)
