"""
Standalone 5-Why root cause workspace (multipage Streamlit).
Run via the same app as the injury forecaster: streamlit run streamlit/osha_compliance_tracker.py
"""

from __future__ import annotations

import sys
import warnings
from pathlib import Path

import pandas as pd
import streamlit as st

warnings.filterwarnings("ignore")

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from openai_advisor import fetch_rca_ai_suggestions, openai_model, resolve_openai_key


def _load_dotenv_files() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    repo_root = _ROOT.parent
    load_dotenv(repo_root / ".env.local")
    load_dotenv(repo_root / ".env")
    load_dotenv(_ROOT / ".env")


_load_dotenv_files()

st.title("Root cause analysis — 5-Why")
st.caption(
    "Standalone RCA workspace. Not tied to IPA or the injury forecaster. Optional OpenAI coaching uses the same API key as other tools."
)

_api = resolve_openai_key(st)
if _api:
    st.sidebar.success(f"OpenAI: key loaded · `{openai_model()}`")
else:
    st.sidebar.info("OpenAI: optional — set OPENAI_API_KEY or Streamlit Secrets for AI suggestions.")

st.subheader("Incident")
incident_type = st.selectbox(
    "Incident type",
    [
        "Fall to lower level",
        "Overexertion / lifting",
        "Struck-by object",
        "Contact with objects/equipment",
        "Other",
    ],
    key="rca_incident_category",
)
if incident_type == "Other":
    incident_description = st.text_input("Describe the incident", key="rca_incident_custom")
else:
    incident_description = incident_type

st.subheader("5-Why chain")
st.write("Capture each “why” in order. The fifth line should reflect the deepest root cause you can justify.")
st.text_input("Why 1?", key="rca_why1")
st.text_input("Why 2?", key="rca_why2")
st.text_input("Why 3?", key="rca_why3")
st.text_input("Why 4?", key="rca_why4")
st.text_input("Why 5? (Root cause)", key="rca_why5")

if st.button("Save to session log"):
    if "rca_log" not in st.session_state:
        st.session_state.rca_log = []
    w5 = (st.session_state.get("rca_why5") or "").strip()
    chain = " -> ".join(
        (st.session_state.get(f"rca_why{i}") or "").strip()
        for i in range(1, 6)
        if (st.session_state.get(f"rca_why{i}") or "").strip()
    )
    st.session_state.rca_log.append(
        {
            "Date": pd.Timestamp.now().strftime("%Y-%m-%d"),
            "Incident": incident_description,
            "Root cause": w5 if w5 else "Not fully determined",
            "5-Why chain": chain or "—",
        }
    )
    st.success("Saved to this session’s log (export or copy before closing the app if you need to keep it).")

if "rca_log" in st.session_state and st.session_state.rca_log:
    st.subheader("Session log")
    st.dataframe(pd.DataFrame(st.session_state.rca_log), use_container_width=True)

st.divider()
st.subheader("AI coaching (optional)")
if st.button("Suggest follow-up questions & verification steps"):
    if not _api:
        st.warning("Set **OPENAI_API_KEY** (or Streamlit **Secrets**) first.")
    else:
        _chain = " -> ".join(
            (st.session_state.get(f"rca_why{i}") or "").strip()
            for i in range(1, 6)
            if (st.session_state.get(f"rca_why{i}") or "").strip()
        )
        with st.spinner("Calling OpenAI…"):
            _rca_ai, _rca_err = fetch_rca_ai_suggestions(
                api_key=_api,
                incident_label=incident_description,
                why_chain=_chain,
            )
        if _rca_err:
            st.error(_rca_err)
        else:
            st.session_state["rca_ai"] = _rca_ai

if isinstance(st.session_state.get("rca_ai"), dict):
    _ar = st.session_state["rca_ai"]
    with st.expander("AI suggestions", expanded=True):
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
