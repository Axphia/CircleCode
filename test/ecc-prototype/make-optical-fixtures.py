"""Rasterize the real SVG fixtures, then create deterministic image degradation cases."""
import json
import random
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

output = Path(__file__).resolve().parent / "outputs"
images = output / "optical"
images.mkdir(exist_ok=True)
if not shutil.which("magick"):
    raise RuntimeError("ImageMagick 'magick' must be installed to rasterize the SVG fixtures")

cases = []


def save_case(name, image, expected=True, group="degraded", extension="png"):
    path = images / f"{name}.{extension}"
    image.save(path, **({"quality": 35} if extension == "jpg" else {}))
    cases.append({"name": name, "file": str(path), "expected": expected, "group": group,
                  "width": image.width, "height": image.height})


for style in ("circle", "loncle"):
    for state in ("clean", "damaged"):
        raster = images / f"{style}-{state}.png"
        subprocess.run(["magick", "-background", "white", "-font", "Arial",
                        str(output / f"{style}-{state}.svg"), "-alpha", "remove", "-alpha", "off",
                        "-resize", "480x480", "-depth", "8", str(raster)], check=True, capture_output=True)
        image = Image.open(raster).convert("RGB")
        save_case(f"{style}-{state}", image, group=state)
        if state == "damaged":
            continue
        for size in (240, 320, 800):
            save_case(f"{style}-size-{size}", image.resize((size, size), Image.Resampling.LANCZOS))
        for degrees in (17, 89, 181, 271):
            save_case(f"{style}-rotate-{degrees}", image.rotate(degrees, Image.Resampling.BICUBIC, fillcolor="white"))
        save_case(f"{style}-mirror", ImageOps.mirror(image))
        save_case(f"{style}-inverted", ImageOps.invert(image))
        save_case(f"{style}-mirror-inverted-rotate", ImageOps.invert(ImageOps.mirror(image.rotate(37, Image.Resampling.BICUBIC, fillcolor="white"))))
        for radius in (0.7, 1.2):
            save_case(f"{style}-blur-{radius}", image.filter(ImageFilter.GaussianBlur(radius)))
        save_case(f"{style}-jpeg-35", image, extension="jpg")
        scratched = image.copy()
        ImageDraw.Draw(scratched).line([(110, 110), (370, 370)], fill="white", width=3)
        save_case(f"{style}-scratch", scratched, expected=None, group="exploratory")
        obscured = image.copy()
        ImageDraw.Draw(obscured).rectangle((0, 0, 300, 480), fill="white")
        save_case(f"{style}-occluded", obscured, expected=False, group="negative")

save_case("blank-white", Image.new("RGB", (480, 480), "white"), expected=False, group="negative")
save_case("blank-black", Image.new("RGB", (480, 480), "black"), expected=False, group="negative")
random_source = random.Random(0x434302)
noise = Image.frombytes("RGB", (240, 240), bytes(random_source.randrange(256) for _ in range(240 * 240 * 3)))
save_case("random-noise", noise, expected=False, group="negative")
(images / "cases.json").write_text(json.dumps(cases, indent=2) + "\n", encoding="utf-8")
print(f"Generated {len(cases)} optical cases from actual SVG fixtures")
