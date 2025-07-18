import Image

# === CONFIG ===
input_file = "unboxd_closed.png"  # your local PNG filename
output_basename = "icon"  # base name for output files
sizes = [16, 32, 48, 128]  # target sizes

# === LOAD IMAGE ===
original = Image.open(input_file).convert("RGBA")

# === RESIZE & SAVE ===
for size in sizes:
    resized = original.resize((size, size), Image.LANCZOS)
    output_path = f"{output_basename}_{size}x{size}.png"
    resized.save(output_path)
    print(f"Saved: {output_path}")
