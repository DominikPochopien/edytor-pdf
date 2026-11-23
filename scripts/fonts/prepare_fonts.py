"""Prepares the bundled fonts: static instances, subset to the scripts the editor supports.

Usage: python3 scripts/fonts/prepare_fonts.py <source-dir> <output-dir>

Sources (all free licences, see public/fonts/LICENSES.txt):
  Noto Sans / Noto Serif  github.com/notofonts/notofonts.github.io  fonts/*/unhinted/ttf
  Lato                    github.com/google/fonts                   ofl/lato
  Open Sans               github.com/googlefonts/opensans           fonts/ttf
  Roboto                  github.com/google/fonts                   ofl/roboto (variable, instanced here)
  Latin Modern Roman      TeX Live                                  fonts/opentype/public/lm/lmroman10-*.otf
"""

import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

UNICODES = [
    *range(0x20, 0x7F),  # Basic Latin
    *range(0xA0, 0x250),  # Latin-1, Latin Extended-A/B (ąćęłńóśźż)
    *range(0x300, 0x370),  # combining marks
    *range(0x370, 0x400),  # Greek (math symbols in school sheets)
    *range(0x400, 0x500),  # Cyrillic
    *range(0x1E00, 0x1F00),  # Latin Extended Additional
    *range(0x2000, 0x2070),  # punctuation: – — „ ” …
    *range(0x2070, 0x20A0),  # super- and subscripts
    *range(0x20A0, 0x20D0),  # currency: €
    *range(0x2100, 0x2150),  # letterlike: №, ™
    *range(0x2190, 0x2200),  # arrows
    *range(0x2200, 0x2300),  # mathematical operators
    *range(0x25A0, 0x2600),  # geometric shapes
    *range(0xFB00, 0xFB07),  # ligatures
]

POLISH = "ąćęłńóśźżĄĆĘŁŃÓŚŹŻ"

# Licences that restrict modified versions (Lato: OFL Reserved Font Name "Lato"; Latin Modern:
# GUST Font License) – these files are copied unchanged instead of being subset.
COPY_UNCHANGED = {"lato", "latin-modern"}

# family id, output name, {style: source file}
FAMILIES = [
    ("noto-sans", "NotoSans", {s: f"NotoSans-{f}.ttf" for s, f in [("regular", "Regular"), ("bold", "Bold"), ("italic", "Italic"), ("bold-italic", "BoldItalic")]}),
    ("noto-serif", "NotoSerif", {s: f"NotoSerif-{f}.ttf" for s, f in [("regular", "Regular"), ("bold", "Bold"), ("italic", "Italic"), ("bold-italic", "BoldItalic")]}),
    ("lato", "Lato", {s: f"Lato-{f}.ttf" for s, f in [("regular", "Regular"), ("bold", "Bold"), ("italic", "Italic"), ("bold-italic", "BoldItalic")]}),
    ("open-sans", "OpenSans", {s: f"OpenSans-{f}.ttf" for s, f in [("regular", "Regular"), ("bold", "Bold"), ("italic", "Italic"), ("bold-italic", "BoldItalic")]}),
    ("roboto", "Roboto", {"regular": ("Roboto-VF.ttf", 400), "bold": ("Roboto-VF.ttf", 700), "italic": ("Roboto-Italic-VF.ttf", 400), "bold-italic": ("Roboto-Italic-VF.ttf", 700)}),
    ("latin-modern", "LatinModernRoman", {s: f"lmroman10-{f}.otf" for s, f in [("regular", "regular"), ("bold", "bold"), ("italic", "italic"), ("bold-italic", "bolditalic")]}),
]


def load(source_dir: pathlib.Path, spec) -> TTFont:
    if isinstance(spec, tuple):
        name, weight = spec
        font = TTFont(source_dir / name)
        return instancer.instantiateVariableFont(font, {"wght": weight, "wdth": 100}, updateFontNames=True)
    return TTFont(source_dir / spec)


def main() -> None:
    source_dir, output_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    options = subset.Options()
    options.hinting = False
    options.layout_features = ["kern", "liga", "clig", "calt", "ccmp", "locl", "mark", "mkmk"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    for family_id, out_name, styles in FAMILIES:
        target = output_dir / family_id
        target.mkdir(parents=True, exist_ok=True)
        for style, spec in styles.items():
            font = load(source_dir, spec)
            if family_id not in COPY_UNCHANGED:
                subsetter = subset.Subsetter(options)
                subsetter.populate(unicodes=UNICODES)
                subsetter.subset(font)
            cmap = font.getBestCmap()
            missing = [c for c in POLISH if ord(c) not in cmap]
            if missing:
                raise SystemExit(f"{family_id} {style}: missing {''.join(missing)}")
            extension = "otf" if "CFF " in font else "ttf"
            path = target / f"{out_name}-{style}.{extension}"
            if family_id in COPY_UNCHANGED:
                path.write_bytes((source_dir / spec).read_bytes())
            else:
                font.save(path)
            print(f"{path} {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
