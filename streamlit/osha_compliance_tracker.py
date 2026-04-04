from __future__ import annotations

import io
import warnings
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from fpdf import FPDF

from openai_advisor import (
    fetch_forecast_ai_briefing,
    fetch_rca_ai_suggestions,
    openai_model,
    resolve_openai_key,
)

warnings.filterwarnings("ignore")

DATA_DIR = Path(__file__).resolve().parent


def _load_dotenv_files() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    root = Path(__file__).resolve().parent.parent
    load_dotenv(root / ".env.local")
    load_dotenv(root / ".env")
    load_dotenv(DATA_DIR / ".env")


_load_dotenv_files()
DEFAULT_IPA_PATH = DATA_DIR / "2024 IPA.xlsx"
DEMO_IPA_PATH = DATA_DIR / "sample_ipa_demo.xlsx"


def normalize_ipa_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(col).strip().lower().replace(" ", "_").replace("\n", "") for col in df.columns]
    rename_map = {
        "naics": "naics_code",
        "hours": "total_hours",
        "total_cases": "total_cases",
        "dart": "dart_cases",
        "dafw": "dafw_cases",
        "industry": "industry_description",
    }
    df = df.rename(columns=rename_map)
    df = df[df["naics_code"].astype(str).str.startswith("23", na=False)].copy()
    return df


@st.cache_data
def load_ipa_from_path(path_str: str) -> pd.DataFrame:
    df = pd.read_excel(path_str, sheet_name="Sheet1")
    return normalize_ipa_dataframe(df)


def load_ipa_from_bytes(raw: bytes) -> pd.DataFrame:
    df = pd.read_excel(io.BytesIO(raw), sheet_name="Sheet1")
    return normalize_ipa_dataframe(df)


def compute_injury_forecast(
    ipa: pd.DataFrame, trade: str, fte: int, overall_dart_rate: float
) -> tuple[float, float, dict[str, int]]:
    """DART rate per 200k hours, expected DART cases for scenario hours, injury share percents."""
    filtered = ipa[ipa["industry_description"] == trade]
    th = filtered["total_hours"].sum()
    trade_dart_rate = (
        round((filtered["dart_cases"].sum() / th * 200000), 2)
        if len(filtered) > 0 and th > 0
        else overall_dart_rate
    )
    total_scenario_hours = fte * 2000
    # OSHA-style: cases = rate * hours / 200000
    expected_dart_cases = round(trade_dart_rate * total_scenario_hours / 200000, 1)
    trade_l = str(trade).lower()
    injuries = {
        "Sprains/strains/tears (back/shoulder)": 45 if any(x in trade_l for x in ["concrete", "excav"]) else 35,
        "Falls to lower level": 42 if any(x in trade_l for x in ["roof", "frame", "siding"]) else 25,
        "Fractures": 18,
        "Cuts/lacerations": 15,
        "Struck-by object": 22,
    }
    return trade_dart_rate, expected_dart_cases, injuries


def _pdf_ascii(text: str, max_len: int = 3500) -> str:
    return str(text).encode("latin-1", errors="replace").decode("latin-1")[:max_len]


def _pdf_multi(pdf: FPDF, text: str, line_h: float = 5, max_len: int = 3500) -> None:
    """fpdf2 multi_cell(0, …) can raise if cursor/x is wrong; use explicit printable width."""
    w = float(pdf.epw)
    if w < 10:
        w = float(pdf.w) - float(pdf.l_margin) - float(pdf.r_margin)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(w, line_h, _pdf_ascii(text, max_len))


def build_forecast_pdf_bytes(
    overall_dart_rate: float,
    overall_total_rate: float,
    trade: str,
    fte: int,
    month: str,
    expected_dart_cases: float,
    injuries: dict[str, int],
    ai_briefing: dict | None = None,
) -> bytes:
    class PDF(FPDF):
        def header(self) -> None:
            self.set_font("Helvetica", "B", 14)
            self.cell(0, 10, "Construction Injury Forecast Report (IPA-based)", ln=1, align="C")
            self.ln(4)

        def footer(self) -> None:
            self.set_y(-12)
            self.set_font("Helvetica", "I", 8)
            self.cell(0, 8, f"Page {self.page_no()}", align="C", ln=0)

    pdf = PDF()
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Summary rates (full IPA construction subset)", ln=1)
    pdf.set_font("Helvetica", size=11)
    pdf.cell(0, 7, f"DART rate: {overall_dart_rate:.2f} per 200k hrs (BLS construction ref. ~1.3)", ln=1)
    pdf.cell(0, 7, f"Total recordable rate: {overall_total_rate:.2f} per 200k hrs (BLS ref. ~2.2)", ln=1)
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Scenario injury forecast (IPA trade + workforce)", ln=1)
    pdf.set_font("Helvetica", size=11)
    pdf.cell(0, 7, f"Trade: {trade}", ln=1)
    pdf.cell(0, 7, f"FTE: {fte}  |  Horizon: {month}", ln=1)
    pdf.cell(0, 7, f"Expected DART cases (scenario): {expected_dart_cases}", ln=1)
    pdf.ln(3)

    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "Likely injury mix (illustrative weights)", ln=1)
    pdf.set_font("Helvetica", size=10)
    for inj, pct in list(injuries.items())[:5]:
        count = round((pct / 100) * expected_dart_cases, 1)
        pdf.cell(0, 6, f"- {inj}: {pct}% weight -> ~{count} cases", ln=1)

    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 9)
    _pdf_multi(
        pdf,
        "Generated from your IPA workbook and OSHA incidence-rate math. Not a substitute for professional safety or legal advice.",
        line_h=5,
        max_len=500,
    )

    if ai_briefing:
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_x(pdf.l_margin)
        pdf.cell(0, 8, _pdf_ascii("AI advisory (OpenAI — planning aid only)"), ln=1)
        pdf.set_font("Helvetica", size=10)
        h = ai_briefing.get("headline")
        if h:
            pdf.set_font("Helvetica", "B", 11)
            _pdf_multi(pdf, str(h), line_h=6, max_len=500)
            pdf.set_font("Helvetica", size=10)
        es = ai_briefing.get("executiveSummary")
        if es:
            for para in str(es).split("\n"):
                p = para.strip()
                if p:
                    _pdf_multi(pdf, p, line_h=5, max_len=2000)
            pdf.ln(2)
        acts = ai_briefing.get("priorityActions")
        if isinstance(acts, list) and acts:
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_x(pdf.l_margin)
            pdf.cell(0, 6, _pdf_ascii("Priority actions"), ln=1)
            pdf.set_font("Helvetica", size=10)
            for a in acts[:8]:
                _pdf_multi(pdf, f"- {a}", line_h=5, max_len=400)
        lim = ai_briefing.get("limitations")
        if lim:
            pdf.ln(2)
            pdf.set_font("Helvetica", "I", 9)
            _pdf_multi(pdf, str(lim), line_h=5, max_len=800)

    out = pdf.output(dest="S")
    if isinstance(out, str):
        return out.encode("latin-1", errors="replace")
    return bytes(out)


st.set_page_config(page_title="Construction Injury Forecaster (IPA)", layout="wide")
st.title("Injury forecaster — OSHA IPA construction")
st.markdown(
    "**IPA-based DART / recordable rates, monthly trends, 5-Why RCA, training notes, scenario injury forecast, "
    "optional OpenAI briefings, PDF export**"
)

st.sidebar.header("Data source")
uploaded = st.sidebar.file_uploader(
    "Upload 2024 IPA.xlsx (optional)",
    type=["xlsx"],
    help=f"If omitted, uses `{DEFAULT_IPA_PATH.name}` or bundled `{DEMO_IPA_PATH.name}` when present.",
)

if uploaded is not None:
    ipa = load_ipa_from_bytes(uploaded.getvalue())
elif DEFAULT_IPA_PATH.is_file():
    ipa = load_ipa_from_path(str(DEFAULT_IPA_PATH))
elif DEMO_IPA_PATH.is_file():
    st.sidebar.info(
        f"Using bundled **{DEMO_IPA_PATH.name}**. Add **{DEFAULT_IPA_PATH.name}** or upload for production IPA data."
    )
    ipa = load_ipa_from_path(str(DEMO_IPA_PATH))
else:
    st.warning(
        f"Place **{DEFAULT_IPA_PATH.name}** in `{DATA_DIR}`, run `python streamlit/generate_demo_workbook.py`, "
        "or upload a file in the sidebar."
    )
    st.stop()

# ====================== PARSE DATES FOR MONTHLY TRENDS ======================
date_col = None
for col in ipa.columns:
    if ipa[col].astype(str).str.contains(":", na=False).any():
        date_col = col
        break

if date_col:
    ipa["submission_date"] = pd.to_datetime(ipa[date_col], format="%d%b%y:%H:%M:%S", errors="coerce")
    ipa["submission_month"] = ipa["submission_date"].dt.strftime("%Y-%m")
    ipa["month_name"] = ipa["submission_date"].dt.strftime("%b %Y")
    monthly = (
        ipa.groupby("submission_month")
        .agg(
            {
                "total_hours": "sum",
                "total_cases": "sum",
                "dart_cases": "sum",
                "dafw_cases": "sum",
                "month_name": "first",
            }
        )
        .reset_index()
    )
    monthly["dart_rate"] = (monthly["dart_cases"] / monthly["total_hours"] * 200000).round(2)
    monthly = monthly.sort_values("submission_month")
    monthly["dart_rate_mom_change"] = monthly["dart_rate"].pct_change() * 100
else:
    monthly = pd.DataFrame()

# ====================== OVERALL METRICS ======================
total_hours = ipa["total_hours"].sum()
overall_dart_rate = round((ipa["dart_cases"].sum() / total_hours * 200000), 2) if total_hours > 0 else 0
overall_total_rate = round((ipa["total_cases"].sum() / total_hours * 200000), 2) if total_hours > 0 else 0

# ====================== SIDEBAR ======================
st.sidebar.header("Your 2024 Summary")
st.sidebar.metric("DART Rate", f"{overall_dart_rate:.2f}", "vs BLS 1.3")
st.sidebar.metric("Total Recordable Rate", f"{overall_total_rate:.2f}", "vs BLS 2.2")
st.sidebar.metric("Records Analyzed", len(ipa))
_api_key_sidebar = resolve_openai_key(st)
if _api_key_sidebar:
    st.sidebar.caption(f"OpenAI: key loaded · `{openai_model()}`")
else:
    st.sidebar.caption("OpenAI: set OPENAI_API_KEY or Streamlit Secrets")

# ====================== MAIN DASHBOARD ======================
col1, col2, col3 = st.columns(3)
col1.metric("DART Rate", f"{overall_dart_rate:.2f}")
col2.metric("Total Recordable Rate", f"{overall_total_rate:.2f}")
col3.metric(
    "DAFW Rate",
    f"{(ipa['dafw_cases'].sum() / total_hours * 200000):.2f}" if total_hours > 0 else "0",
)

if overall_dart_rate > 2.0:
    st.error("HIGH RISK — DART rate above typical threshold")
elif overall_dart_rate > 1.3:
    st.warning("ELEVATED RISK — above BLS construction reference")
else:
    st.success("Rates at or below BLS reference band (contextual only)")

# Monthly Trend Tracking
st.subheader("Monthly trend tracking — 2024")
if not monthly.empty:
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=monthly["month_name"],
            y=monthly["dart_rate"],
            mode="lines+markers",
            name="DART Rate",
            line=dict(color="#1f77b4"),
        )
    )
    fig.add_trace(
        go.Bar(
            x=monthly["month_name"],
            y=monthly["dart_cases"],
            name="DART Cases",
            marker_color="#ff7f0e",
            yaxis="y2",
        )
    )
    fig.add_trace(
        go.Scatter(
            x=monthly["month_name"],
            y=[1.3] * len(monthly),
            mode="lines",
            name="BLS Avg (1.3)",
            line=dict(color="red", dash="dash"),
        )
    )
    fig.update_layout(yaxis2=dict(title="DART Cases", overlaying="y", side="right"))
    st.plotly_chart(fig, use_container_width=True)
else:
    st.info("No month column detected in this workbook (or demo data). Upload full IPA with submission timestamps for charts.")

# ====================== ROOT CAUSE (5-WHY) ======================
st.subheader("Incident root cause (5-Why)")
incident_type = st.selectbox(
    "Incident Type",
    [
        "Fall to lower level",
        "Overexertion / lifting",
        "Struck-by object",
        "Contact with objects/equipment",
        "Other",
    ],
)
if incident_type == "Other":
    incident_description = st.text_input("Describe the incident")
else:
    incident_description = incident_type

st.write("**5-Why analysis**")
st.text_input("Why 1?", key="why1")
st.text_input("Why 2?", key="why2")
st.text_input("Why 3?", key="why3")
st.text_input("Why 4?", key="why4")
st.text_input("Why 5? (Root cause)", key="why5")

if st.button("Save root cause analysis"):
    if "rca_log" not in st.session_state:
        st.session_state.rca_log = []
    w5 = (st.session_state.get("why5") or "").strip()
    chain = " -> ".join(
        (st.session_state.get(f"why{i}") or "").strip()
        for i in range(1, 6)
        if (st.session_state.get(f"why{i}") or "").strip()
    )
    st.session_state.rca_log.append(
        {
            "Date": pd.Timestamp.now().strftime("%Y-%m-%d"),
            "Incident": incident_description,
            "Root cause": w5 if w5 else "Not fully determined",
            "5-Why chain": chain or "—",
        }
    )
    st.success("Analysis saved.")

if "rca_log" in st.session_state and st.session_state.rca_log:
    st.dataframe(pd.DataFrame(st.session_state.rca_log))

_rca_key = resolve_openai_key(st)
if st.button("AI: suggest follow-up questions (5-Why)"):
    if not _rca_key:
        st.warning("Set **OPENAI_API_KEY** (or Streamlit **Secrets**) to use RCA coaching.")
    else:
        _chain = " -> ".join(
            (st.session_state.get(f"why{i}") or "").strip()
            for i in range(1, 6)
            if (st.session_state.get(f"why{i}") or "").strip()
        )
        with st.spinner("Calling OpenAI…"):
            _rca_ai, _rca_err = fetch_rca_ai_suggestions(
                api_key=_rca_key,
                incident_label=incident_description,
                why_chain=_chain,
            )
        if _rca_err:
            st.error(_rca_err)
        else:
            st.session_state["ai_rca"] = _rca_ai

if isinstance(st.session_state.get("ai_rca"), dict):
    _ar = st.session_state["ai_rca"]
    with st.expander("AI RCA suggestions", expanded=True):
        fq = _ar.get("followUpQuestions")
        if isinstance(fq, list) and fq:
            st.write("**Follow-up questions**")
            for q in fq:
                st.write(f"- {q}")
        st_t = _ar.get("systemicThemes")
        if isinstance(st_t, list) and st_t:
            st.write("**Systemic themes**")
            for t in st_t:
                st.write(f"- {t}")
        nv = _ar.get("nextVerificationSteps")
        if isinstance(nv, list) and nv:
            st.write("**Verification steps**")
            for v in nv:
                st.write(f"- {v}")

# ====================== TRAINING ======================
st.subheader("OSHA-aligned training reminders")
trained = st.slider("Percent of workforce with current OSHA 10-Hour (illustrative)", 0, 100, 65)
st.progress(trained / 100)
st.write("**Typical priorities from construction IPA patterns**")
st.info(
    "Fall protection, lifting/ergonomics, struck-by awareness, full OSHA 10-Hour for field staff — tune to your trade mix."
)

# ====================== INJURY FORECAST (scenario model) ======================
st.subheader("Injury forecast — trade + workforce scenario (IPA-driven)")
st.caption(
    "Uses your IPA subset: trade-level DART rate per 200k hours, scaled to FTE x 2,000 hours/year. "
    "Injury mix is a structured heuristic, not a trained ML model."
)

col_ai1, col_ai2 = st.columns(2)
with col_ai1:
    trade = st.selectbox("Trade / sub-sector", options=sorted(ipa["industry_description"].dropna().unique()))
with col_ai2:
    fte = st.number_input("Number of workers (FTE)", min_value=1, value=50, step=1)

month = st.selectbox(
    "Scenario month label",
    options=["Overall 2024"] + list(monthly["month_name"].unique()) if not monthly.empty else ["Overall 2024"],
)

if st.button("Run injury forecast", type="primary"):
    st.session_state.pop("ai_briefing", None)
    _tdr, expected_dart_cases, injuries = compute_injury_forecast(ipa, trade, fte, overall_dart_rate)
    st.session_state["forecast_trade"] = trade
    st.session_state["forecast_fte"] = fte
    st.session_state["forecast_month"] = month
    st.session_state["forecast_expected"] = expected_dart_cases
    st.session_state["forecast_injuries"] = injuries
    st.session_state["forecast_tdr"] = _tdr

if "forecast_expected" in st.session_state:
    st.subheader(
        f"Forecast for **{st.session_state['forecast_trade']}** — "
        f"{st.session_state['forecast_fte']} FTE — {st.session_state['forecast_month']}"
    )
    st.metric("Expected DART cases (scenario year)", f"{st.session_state['forecast_expected']}")
    st.caption(f"Trade DART rate used: {st.session_state.get('forecast_tdr', 0):.2f} per 200k hours")
    st.write("**Likely injury mix (weights)**")
    for inj, pct in list(st.session_state["forecast_injuries"].items())[:5]:
        count = round((pct / 100) * st.session_state["forecast_expected"], 1)
        st.write(f"- **{inj}** — {pct}% weight → ~**{count}** cases")
    st.info("Prioritize fall protection and mechanical lifting where weights are high for your trade.")

    st.divider()
    st.subheader("AI safety advisor (OpenAI)")
    _oa = resolve_openai_key(st)
    if not _oa:
        st.info(
            "Add **OPENAI_API_KEY** to `.env.local` (repo root), your shell, or **Streamlit Cloud → Secrets**. "
            "Uses the same key as Injury Weather. Optional: **OPENAI_MODEL** (default `gpt-4o-mini`)."
        )
    else:
        st.caption(f"Model: **{openai_model()}** — generates a narrative briefing from the numbers above (not a medical or legal opinion).")
        if st.button("Generate AI briefing from this forecast"):
            with st.spinner("Calling OpenAI…"):
                _brief, _berr = fetch_forecast_ai_briefing(
                    api_key=_oa,
                    n_records=len(ipa),
                    overall_dart=overall_dart_rate,
                    overall_trir=overall_total_rate,
                    trade=str(st.session_state["forecast_trade"]),
                    fte=int(st.session_state["forecast_fte"]),
                    month=str(st.session_state["forecast_month"]),
                    expected_cases=float(st.session_state["forecast_expected"]),
                    injury_mix=dict(st.session_state["forecast_injuries"]),
                )
            if _berr:
                st.error(_berr)
            else:
                st.session_state["ai_briefing"] = _brief

    if isinstance(st.session_state.get("ai_briefing"), dict):
        _ab = st.session_state["ai_briefing"]
        st.markdown(f"#### {_ab.get('headline', 'Briefing')}")
        if _ab.get("executiveSummary"):
            st.markdown(str(_ab["executiveSummary"]))
        _pa = _ab.get("priorityActions")
        if isinstance(_pa, list) and _pa:
            st.markdown("**Priority actions**")
            for line in _pa:
                st.markdown(f"- {line}")
        _tt = _ab.get("trainingTopics")
        if isinstance(_tt, list) and _tt:
            st.markdown("**Training topics**")
            for line in _tt:
                st.markdown(f"- {line}")
        if _ab.get("limitations"):
            st.caption(str(_ab["limitations"]))

# ====================== PDF EXPORT ======================
st.subheader("Download PDF report")
_pdf_trade = st.session_state.get("forecast_trade", trade)
_pdf_fte = st.session_state.get("forecast_fte", fte)
_pdf_month = st.session_state.get("forecast_month", month)
_, _exp, _inj = compute_injury_forecast(ipa, _pdf_trade, _pdf_fte, overall_dart_rate)

_ai_pdf = st.session_state.get("ai_briefing")
if not isinstance(_ai_pdf, dict):
    _ai_pdf = None

pdf_bytes = build_forecast_pdf_bytes(
    overall_dart_rate,
    overall_total_rate,
    _pdf_trade,
    _pdf_fte,
    _pdf_month,
    _exp,
    _inj,
    ai_briefing=_ai_pdf,
)
st.download_button(
    label="Download injury forecast PDF",
    data=pdf_bytes,
    file_name="Construction_Injury_Forecast_IPA_Report.pdf",
    mime="application/pdf",
)

st.caption("IPA workbook + BLS reference values. For internal planning only.")
st.success("App ready — run a forecast, optionally generate an AI briefing, then download the PDF (PDF includes AI section when present).")
