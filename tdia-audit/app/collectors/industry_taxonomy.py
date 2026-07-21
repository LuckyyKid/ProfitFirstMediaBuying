"""Table de correspondance categorie DTC -> codes MARTS (US Census), SCIAN (StatCan)
et mots-cles EDGAR (du plus precis au plus general).

Sources:
- MARTS (Monthly Retail Trade Survey): codes derives du NAICS 2017 (Census
  n'a pas encore bascule ses series historiques sur NAICS 2022).
- SCIAN (StatCan): tableau 20-10-0056 utilise NAICS 2022 modernise, qui a
  fusionne plusieurs categories 2017 (ex: 442 + 443 -> 449, 448 -> 458,
  4511 -> 459A). Donc `scian_code` != `marts_category_code` pour plusieurs
  categories, c'est normal.
- EDGAR keywords: passes au full-text search des 10-K/10-Q pour trouver les
  acteurs publics de la categorie. Ordre du plus precis au plus general — le
  collecteur essaie chaque mot-cle et s'arrete au premier avec des resultats.
"""

INDUSTRY_TAXONOMY: dict[str, dict] = {
    "meubles_maison": {
        "label_fr": "Meubles et articles pour la maison",
        "marts_category_code": "442",  # NAICS 2017: Furniture & Home Furnishings
        "scian_code": "4491",  # NAICS 2022: Furniture, floor covering, window treatment
        "category_keywords_en": [
            "modular sofa direct-to-consumer",
            "home furnishings ecommerce",
            "furniture retail",
        ],
    },
    "vetements": {
        "label_fr": "Vetements",
        "marts_category_code": "448",  # NAICS 2017: Clothing & Accessories Stores
        "scian_code": "4581",  # NAICS 2022: Clothing and clothing accessories retailers
        "category_keywords_en": [
            "direct-to-consumer apparel brand",
            "apparel ecommerce",
            "clothing retail",
        ],
    },
    "bijoux_accessoires": {
        "label_fr": "Bijoux et accessoires",
        "marts_category_code": "4483",  # NAICS 2017: Jewelry, Luggage & Leather
        "scian_code": "4583",  # NAICS 2022: Jewellery, luggage and leather goods
        "category_keywords_en": [
            "fine jewelry direct-to-consumer",
            "jewelry ecommerce",
            "jewelry retail",
        ],
    },
    "alimentation": {
        "label_fr": "Alimentation (epicerie, produits alimentaires)",
        "marts_category_code": "445",  # NAICS 2017: Food & Beverage Stores
        "scian_code": "445",  # NAICS 2022: Food and beverage retailers
        "category_keywords_en": [
            "packaged food direct-to-consumer",
            "specialty food retail",
            "grocery ecommerce",
        ],
    },
    "boissons": {
        "label_fr": "Boissons (kombucha, sodas fonctionnels, boissons non-alcoolisees)",
        "marts_category_code": "4451",  # NAICS 2017: Grocery Stores
        "scian_code": "4451",  # NAICS 2022: Grocery and convenience retailers
        "category_keywords_en": [
            "kombucha",
            "functional beverage",
            "non-alcoholic beverage",
            "beverage brand",
        ],
    },
    "sport_fitness": {
        "label_fr": "Sport et fitness",
        "marts_category_code": "4511",  # NAICS 2017: Sporting Goods Stores
        "scian_code": "459A",  # NAICS 2022: Sporting goods, hobby, musical instr, books
        "category_keywords_en": [
            "activewear direct-to-consumer",
            "fitness equipment ecommerce",
            "sporting goods retail",
        ],
    },
    "beaute_soins": {
        "label_fr": "Beaute et soins personnels",
        "marts_category_code": "446",  # NAICS 2017: Health & Personal Care Stores
        "scian_code": "456",  # NAICS 2022: Health and personal care retailers
        "category_keywords_en": [
            "clean beauty direct-to-consumer",
            "skincare brand ecommerce",
            "beauty retail",
        ],
    },
    "bebe_enfant": {
        "label_fr": "Bebe et enfant (vetements, produits, jeux d'eveil)",
        "marts_category_code": "4481",  # NAICS 2017: Clothing Stores
        "scian_code": "458",  # NAICS 2022: Clothing, accessories, shoes, jewellery, luggage
        "category_keywords_en": [
            "baby products direct-to-consumer",
            "childrens apparel brand",
            "kids ecommerce",
        ],
    },
    "animaux": {
        "label_fr": "Animaux de compagnie",
        "marts_category_code": "4539",  # NAICS 2017: Other Miscellaneous Store Retailers
        "scian_code": "459B",  # NAICS 2022: Miscellaneous retailers
        "category_keywords_en": [
            "pet food direct-to-consumer",
            "pet supplies ecommerce",
            "pet retail",
        ],
    },
    "electronique": {
        "label_fr": "Electronique grand public",
        "marts_category_code": "4431",  # NAICS 2017: Electronics & Appliance Stores
        "scian_code": "4492",  # NAICS 2022: Electronics and appliances retailers
        "category_keywords_en": [
            "consumer electronics direct-to-consumer",
            "electronics ecommerce",
            "electronics retail",
        ],
    },
    "jouets": {
        "label_fr": "Jouets et jeux",
        "marts_category_code": "4511",  # NAICS 2017: Sporting Goods, Hobby, Toys
        "scian_code": "459A",  # NAICS 2022: Sporting goods, hobby, musical instr, books
        "category_keywords_en": [
            "toy brand direct-to-consumer",
            "toys ecommerce",
            "toy retail",
        ],
    },
    "bien_etre_supplements": {
        "label_fr": "Bien-etre / supplements / vitamines",
        "marts_category_code": "446",  # NAICS 2017: Health & Personal Care Stores
        "scian_code": "456",  # NAICS 2022: Health and personal care retailers
        "category_keywords_en": [
            "dietary supplement direct-to-consumer",
            "vitamins ecommerce",
            "wellness brand",
        ],
    },
    "librairie_papeterie": {
        "label_fr": "Livres, papeterie, loisirs creatifs",
        "marts_category_code": "451",  # NAICS 2017: Sporting Goods, Hobby, Books
        "scian_code": "459A",  # NAICS 2022: Sporting goods, hobby, musical instr, books
        "category_keywords_en": [
            "stationery direct-to-consumer",
            "books ecommerce",
            "hobby retail",
        ],
    },
    "outillage_maison": {
        "label_fr": "Outillage, jardin, bricolage",
        "marts_category_code": "444",  # NAICS 2017: Building Material & Garden
        "scian_code": "444",  # NAICS 2022: Building material and garden equipment
        "category_keywords_en": [
            "home improvement direct-to-consumer",
            "garden equipment ecommerce",
            "building material retail",
        ],
    },
    "ecommerce_general": {
        "label_fr": "E-commerce non specialise",
        "marts_category_code": "4541",  # NAICS 2017: Electronic Shopping & Mail-Order
        "scian_code": "44-45",  # NAICS 2022: Retail trade total (avec dim sales=e-commerce)
        "category_keywords_en": [
            "direct-to-consumer brand",
            "ecommerce",
            "online retail",
        ],
    },
}


def get_category(key: str) -> dict:
    """Retourne la fiche categorie ou leve KeyError avec la liste des cles valides."""
    if key not in INDUSTRY_TAXONOMY:
        raise KeyError(
            f"Categorie '{key}' inconnue. Cles valides: {list(INDUSTRY_TAXONOMY.keys())}"
        )
    return INDUSTRY_TAXONOMY[key]


def taxonomy_as_markdown_table() -> str:
    """Rendu markdown injecte dans le prompt de l'agent Contexte."""
    lines = [
        "| Cle | Categorie | MARTS | SCIAN | Keywords EDGAR (precis -> general) |",
        "|---|---|---|---|---|",
    ]
    for key, cat in INDUSTRY_TAXONOMY.items():
        kw = " ; ".join(cat["category_keywords_en"])
        lines.append(
            f"| `{key}` | {cat['label_fr']} | {cat['marts_category_code']} | "
            f"{cat['scian_code']} | {kw} |"
        )
    return "\n".join(lines)
