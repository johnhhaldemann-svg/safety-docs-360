"""Write sample_ipa_demo.xlsx for local Streamlit smoke tests (no real IPA required)."""
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent
out = DATA_DIR / "sample_ipa_demo.xlsx"

# No date column: avoids Excel mangling text timestamps. Monthly trends stay empty until you use a real IPA file or upload.
data = [
    [236220, 120000, 5, 3, 2, "Roofing contractors"],
    [238160, 95000, 4, 2, 1, "Painting and wall covering"],
    [236118, 200000, 8, 4, 3, "Residential remodelers"],
    [237130, 88000, 3, 1, 1, "Power and communication line construction"],
]

df = pd.DataFrame(
    data,
    columns=["NAICS", "Hours", "Total cases", "DART", "DAFW", "Industry"],
)
df.to_excel(out, sheet_name="Sheet1", index=False, engine="openpyxl")
print(f"Wrote {out}")
