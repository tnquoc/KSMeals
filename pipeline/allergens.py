"""Allergen detection by keyword, deliberately not by the LLM.

Parents act on this, so it must be predictable and explainable: a dish is flagged when its
name or its (LLM-suggested) ingredients contain a keyword below. It can over-flag, and it
can miss hidden ingredients; the app always says to confirm with the school.
"""
import re

# allergen id -> Vietnamese keywords (matched as whole words, case-insensitive)
KEYWORDS: dict[str, list[str]] = {
    "crustacean": ["tôm", "cua", "ghẹ", "tép", "tôm khô"],
    "mollusc": ["mực", "bạch tuộc", "nghêu", "ngao", "sò", "sò điệp", "hến", "ốc", "hàu", "trai"],
    "fish": ["cá", "chả cá", "nước mắm", "cá cơm"],
    "egg": ["trứng", "trứng cút", "flan", "bánh flan", "mayonnaise", "sốt mayonnaise"],
    "milk": ["sữa", "sữa chua", "yaourt", "yogurt", "phô mai", "phomai", "bơ sữa", "kem", "váng sữa",
             # brand names that are milk products without the word "sữa"
             "yakult", "dielac", "probi", "susu", "nuvi", "fristi", "milo", "ovaltine", "grow plus"],
    "peanut": ["đậu phộng", "lạc"],
    "soy": ["đậu nành", "đậu hũ", "đậu phụ", "tàu hũ", "tàu hủ", "đậu hủ", "nước tương", "xì dầu"],
    "gluten": ["bánh mì", "mì", "nui", "mì ý", "bột mì", "bánh bao", "bánh bông lan", "bánh quy",
               "bánh cookie", "hoành thánh", "há cảo", "sủi cảo", "bánh gạo lúa mì", "mì căn"],
    "sesame": ["mè", "vừng"],
    "tree_nut": ["hạt điều", "óc chó", "hạnh nhân", "hạt dẻ", "macca", "mắc ca"],
}

LABELS = {
    "crustacean": "Tôm, cua (giáp xác)", "mollusc": "Mực, nghêu, sò (nhuyễn thể)", "fish": "Cá",
    "egg": "Trứng", "milk": "Sữa", "peanut": "Đậu phộng", "soy": "Đậu nành", "gluten": "Lúa mì (gluten)",
    "sesame": "Mè", "tree_nut": "Hạt (điều, óc chó...)",
}

# Phrases that contain a keyword but are not that allergen.
EXCEPTIONS = [
    "sữa đậu nành",   # soy, not milk
    "sữa bắp", "sữa gạo", "sữa hạt",
    "mì gạo", "bánh mì gạo",  # rice based
    "kem dừa",
    "cá rốt",          # common misspelling of cà rốt
]


def _pattern(words: list[str]) -> re.Pattern:
    alts = sorted((re.escape(w) for w in words), key=len, reverse=True)
    return re.compile(r"(?<!\w)(?:" + "|".join(alts) + r")(?!\w)", re.I)


PATTERNS = {k: _pattern(v) for k, v in KEYWORDS.items()}
EXCEPTION_RE = _pattern(EXCEPTIONS)
SOY_MILK_RE = re.compile(r"(?<!\w)sữa đậu nành(?!\w)", re.I)


def detect(texts: list[str]) -> list[str]:
    """Allergen ids found in dish names / ingredients, in a stable order."""
    found = set()
    for text in texts:
        text = text or ""
        if SOY_MILK_RE.search(text):
            found.add("soy")
        cleaned = EXCEPTION_RE.sub(" ", text)
        for allergen, pattern in PATTERNS.items():
            if pattern.search(cleaned):
                found.add(allergen)
    return [a for a in KEYWORDS if a in found]
