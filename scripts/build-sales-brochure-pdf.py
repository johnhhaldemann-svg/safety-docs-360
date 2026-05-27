from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "SafetyDocs360-sales-brochure.pdf"

PAGE_W, PAGE_H = landscape((16 * inch, 9 * inch))

NAVY = colors.HexColor("#071646")
BLUE = colors.HexColor("#0B4F9E")
TEAL = colors.HexColor("#007565")
DEEP_TEAL = colors.HexColor("#005F55")
GREEN = colors.HexColor("#149244")
ORANGE = colors.HexColor("#F59E0B")
DEEP_ORANGE = colors.HexColor("#EA580C")
RED = colors.HexColor("#DC2626")
PURPLE = colors.HexColor("#4216A3")
INK = colors.HexColor("#111827")
MUTED = colors.HexColor("#46566A")
LIGHT = colors.HexColor("#F8FBFF")
BORDER = colors.HexColor("#C9DDF4")
SOFT_BLUE = colors.HexColor("#ECF5FF")
SOFT_GREEN = colors.HexColor("#ECFDF3")
SOFT_RED = colors.HexColor("#FFF1F2")


def draw_round_rect(c: canvas.Canvas, x: float, y: float, w: float, h: float, radius: float = 7, fill=colors.white, stroke=BORDER, width: float = 1):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(width)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def draw_text(c: canvas.Canvas, text: str, x: float, y: float, size: float = 8, color=INK, font: str = "Helvetica", align: str = "left"):
    c.setFont(font, size)
    c.setFillColor(color)
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def draw_wrapped(c: canvas.Canvas, lines: list[str], x: float, y: float, size: float = 7.2, leading: float = 10, color=MUTED, font: str = "Helvetica", align: str = "left"):
    for i, line in enumerate(lines):
        draw_text(c, line, x, y - i * leading, size, color, font, align)


def draw_icon_building(c: canvas.Canvas, x: float, y: float, s: float, color=colors.white):
    c.setFillColor(color)
    c.rect(x, y, s * 0.22, s * 0.66, fill=1, stroke=0)
    c.rect(x + s * 0.28, y, s * 0.28, s, fill=1, stroke=0)
    c.rect(x + s * 0.62, y, s * 0.3, s * 0.72, fill=1, stroke=0)
    c.setFillColor(NAVY if color == colors.white else colors.white)
    for ox, top, count in [(0.32, 0.78, 4), (0.66, 0.52, 3)]:
        for j in range(count):
            c.rect(x + s * ox, y + s * (top - j * 0.15), s * 0.06, s * 0.06, fill=1, stroke=0)


def draw_icon_bot(c: canvas.Canvas, x: float, y: float, s: float, color=PURPLE):
    c.setFillColor(color)
    c.roundRect(x, y, s, s * 0.72, s * 0.18, fill=1, stroke=0)
    c.circle(x + s * 0.28, y + s * 0.42, s * 0.07, fill=1, stroke=0)
    c.circle(x + s * 0.72, y + s * 0.42, s * 0.07, fill=1, stroke=0)
    c.setStrokeColor(color)
    c.setLineWidth(2)
    c.line(x + s * 0.5, y + s * 0.72, x + s * 0.5, y + s)
    c.circle(x + s * 0.5, y + s * 1.04, s * 0.05, fill=1, stroke=0)


def draw_check(c: canvas.Canvas, x: float, y: float, s: float, color=GREEN):
    c.setStrokeColor(color)
    c.setLineWidth(max(1, s * 0.12))
    c.line(x, y + s * 0.35, x + s * 0.34, y)
    c.line(x + s * 0.34, y, x + s, y + s * 0.82)


def draw_icon_simple(c: canvas.Canvas, label: str, x: float, y: float, s: float, color: colors.Color):
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(1.4)
    if label == "JSA":
        c.rect(x + s * 0.25, y + s * 0.18, s * 0.5, s * 0.64, fill=0, stroke=1)
        c.line(x + s * 0.35, y + s * 0.62, x + s * 0.65, y + s * 0.62)
        c.line(x + s * 0.35, y + s * 0.48, x + s * 0.65, y + s * 0.48)
        c.line(x + s * 0.35, y + s * 0.34, x + s * 0.55, y + s * 0.34)
    elif label == "Permit":
        c.rect(x + s * 0.22, y + s * 0.16, s * 0.56, s * 0.68, fill=0, stroke=1)
        c.line(x + s * 0.34, y + s * 0.66, x + s * 0.66, y + s * 0.66)
        c.line(x + s * 0.34, y + s * 0.51, x + s * 0.66, y + s * 0.51)
        c.line(x + s * 0.34, y + s * 0.36, x + s * 0.52, y + s * 0.36)
    elif label == "Incident":
        c.rect(x + s * 0.22, y + s * 0.16, s * 0.56, s * 0.68, fill=0, stroke=1)
        c.line(x + s * 0.35, y + s * 0.3, x + s * 0.65, y + s * 0.7)
    elif label == "Action":
        c.rect(x + s * 0.25, y + s * 0.2, s * 0.5, s * 0.56, fill=0, stroke=1)
        c.line(x + s * 0.35, y + s * 0.5, x + s * 0.46, y + s * 0.38)
        c.line(x + s * 0.46, y + s * 0.38, x + s * 0.68, y + s * 0.62)
    elif label == "Photo":
        c.roundRect(x + s * 0.18, y + s * 0.24, s * 0.64, s * 0.48, s * 0.08, fill=0, stroke=1)
        c.circle(x + s * 0.5, y + s * 0.48, s * 0.12, fill=0, stroke=1)
    elif label == "Voice":
        c.roundRect(x + s * 0.36, y + s * 0.34, s * 0.28, s * 0.42, s * 0.12, fill=0, stroke=1)
        c.line(x + s * 0.5, y + s * 0.2, x + s * 0.5, y + s * 0.34)
        c.line(x + s * 0.38, y + s * 0.2, x + s * 0.62, y + s * 0.2)
    elif label == "QR":
        for dx, dy in [(0.22, 0.56), (0.58, 0.56), (0.22, 0.2)]:
            c.rect(x + s * dx, y + s * dy, s * 0.18, s * 0.18, fill=0, stroke=1)
        c.rect(x + s * 0.58, y + s * 0.2, s * 0.08, s * 0.08, fill=1, stroke=0)
        c.rect(x + s * 0.72, y + s * 0.32, s * 0.08, s * 0.08, fill=1, stroke=0)
    else:
        c.circle(x + s * 0.5, y + s * 0.5, s * 0.28, fill=0, stroke=1)


def draw_risk_key(c: canvas.Canvas):
    x, y, w, h = 0.22 * inch, 7.56 * inch, 2.08 * inch, 1.18 * inch
    draw_round_rect(c, x, y, w, h, 7, colors.white, BORDER)
    draw_text(c, "RISK LEVEL KEY", x + 0.36 * inch, y + h - 0.23 * inch, 8.2, NAVY, "Helvetica-Bold")
    items = [("Low (0-39)", GREEN), ("Moderate (40-69)", ORANGE), ("High (70-84)", DEEP_ORANGE), ("Critical (85-100)", RED)]
    for i, (label, color) in enumerate(items):
        cy = y + h - 0.47 * inch - i * 0.23 * inch
        c.setFillColor(color)
        c.circle(x + 0.3 * inch, cy + 0.02 * inch, 0.045 * inch, fill=1, stroke=0)
        draw_text(c, label, x + 0.45 * inch, cy, 6.9, INK)


def draw_top_hierarchy(c: canvas.Canvas):
    draw_text(c, "AI-POWERED SAFETY INTELLIGENCE PLATFORM", PAGE_W / 2, 8.49 * inch, 19.5, NAVY, "Helvetica-Bold", "center")
    draw_text(c, "Company  ->  Sites / Jobs  ->  People  ->  Activities  ->  Risk Intelligence", PAGE_W / 2, 8.22 * inch, 10.6, BLUE, "Helvetica", "center")

    company_x, company_y, company_w, company_h = 6.12 * inch, 7.54 * inch, 2.58 * inch, 0.5 * inch
    draw_round_rect(c, company_x, company_y, company_w, company_h, 7, NAVY, NAVY)
    draw_icon_building(c, company_x + 0.36 * inch, company_y + 0.09 * inch, 0.34 * inch)
    draw_text(c, "COMPANY", company_x + 1.45 * inch, company_y + 0.3 * inch, 11.2, colors.white, "Helvetica-Bold", "center")
    draw_text(c, "Your Organization", company_x + 1.45 * inch, company_y + 0.13 * inch, 7.4, colors.white, "Helvetica", "center")

    node_y = 6.66 * inch
    nodes = [
        (3.52 * inch, "SITE / JOB 1", ["Central Plant Expansion", "Active"], TEAL),
        (5.52 * inch, "SITE / JOB 2", ["Warehouse Retrofit", "Active"], TEAL),
        (7.52 * inch, "SITE / JOB 3", ["Warehouse Retrofit", "Active"], TEAL),
        (9.52 * inch, "SITE / JOB N", ["Active"], TEAL),
    ]
    root_cx = company_x + company_w / 2
    trunk_y = 7.08 * inch
    c.setStrokeColor(NAVY)
    c.setLineWidth(1)
    c.line(root_cx, company_y, root_cx, trunk_y)
    c.line(nodes[0][0] + 0.88 * inch, trunk_y, nodes[-1][0] + 0.88 * inch, trunk_y)
    for x, title, body, fill in nodes:
        c.line(x + 0.88 * inch, trunk_y, x + 0.88 * inch, node_y + 0.48 * inch)
        draw_round_rect(c, x, node_y, 1.7 * inch, 0.48 * inch, 5, fill, fill)
        if "N" in title:
            draw_text(c, "...", x + 0.32 * inch, node_y + 0.18 * inch, 19, colors.white, "Helvetica-Bold", "center")
        else:
            draw_icon_building(c, x + 0.14 * inch, node_y + 0.1 * inch, 0.3 * inch)
        draw_text(c, title, x + 1.05 * inch, node_y + 0.3 * inch, 7.2, colors.white, "Helvetica-Bold", "center")
        draw_wrapped(c, body, x + 0.56 * inch, node_y + 0.19 * inch, 5.9, 7.2, colors.white, "Helvetica-Bold")


def draw_gus_panel(c: canvas.Canvas):
    x, y, w, h = 12.68 * inch, 6.65 * inch, 2.95 * inch, 2.08 * inch
    draw_round_rect(c, x, y, w, h, 7, colors.white, colors.HexColor("#C6B8FF"))
    draw_icon_bot(c, x + 0.18 * inch, y + h - 0.55 * inch, 0.38 * inch)
    draw_text(c, "GUS AI SAFETY COACH", x + 1.7 * inch, y + h - 0.28 * inch, 9.2, PURPLE, "Helvetica-Bold", "center")
    items = ["Reviews JSAs", "Recommends Permits", "Identifies Hazards", "Suggests Controls", "Analyzes Trends", "Predicts Risk", "Answers Questions"]
    for i, item in enumerate(items):
        yy = y + h - 0.54 * inch - i * 0.18 * inch
        draw_check(c, x + 0.8 * inch, yy - 0.005 * inch, 0.07 * inch, PURPLE)
        draw_text(c, item, x + 1.02 * inch, yy, 6.8, NAVY)
    draw_text(c, "Always here to help.", x + 1.58 * inch, y + 0.18 * inch, 7.2, PURPLE, "Helvetica-Bold", "center")


def draw_executive_dashboard(c: canvas.Canvas):
    x, y, w, h = 0.25 * inch, 4.45 * inch, 4.65 * inch, 2.0 * inch
    draw_round_rect(c, x, y, w, h, 5, colors.white, BORDER)
    draw_text(c, "MULTI-SITE EXECUTIVE DASHBOARD", x + 0.52 * inch, y + h - 0.23 * inch, 8.6, NAVY, "Helvetica-Bold")
    c.setStrokeColor(BLUE)
    c.rect(x + 0.16 * inch, y + h - 0.33 * inch, 0.22 * inch, 0.17 * inch, fill=0, stroke=1)
    c.line(x + 0.27 * inch, y + h - 0.33 * inch, x + 0.27 * inch, y + h - 0.42 * inch)
    c.line(x + 0.18 * inch, y + h - 0.42 * inch, x + 0.36 * inch, y + h - 0.42 * inch)

    table_x = x + 0.16 * inch
    table_y = y + 0.2 * inch
    col_w = [0.85, 0.75, 0.58, 0.58, 0.62, 0.72, 0.55]
    headers = ["Site / Job", "Risk Score", "Open CAs", "Permits", "Incidents", "Training Gaps", "Status"]
    rows = [
        ["Central Plant Expansion", "HIGH", "7", "12", "1", "4", "Active"],
        ["Warehouse Retrofit", "MODERATE", "3", "5", "0", "2", "Active"],
        ["Warehouse Retrofit", "LOW", "1", "2", "0", "0", "Active"],
        ["...", "...", "...", "...", "...", "...", "..."],
    ]
    cur_x = table_x
    for i, header in enumerate(headers):
        draw_text(c, header, cur_x, table_y + 1.27 * inch, 4.8, NAVY, "Helvetica-Bold")
        cur_x += col_w[i] * inch
    for r, row in enumerate(rows):
        yy = table_y + (0.98 - r * 0.29) * inch
        c.setStrokeColor(colors.HexColor("#E5EDF7"))
        c.line(table_x, yy + 0.18 * inch, x + w - 0.16 * inch, yy + 0.18 * inch)
        cur_x = table_x
        for i, value in enumerate(row):
            if i == 1 and value in {"HIGH", "MODERATE", "LOW"}:
                color = {"HIGH": RED, "MODERATE": ORANGE, "LOW": GREEN}[value]
                draw_round_rect(c, cur_x - 0.02 * inch, yy - 0.04 * inch, 0.45 * inch, 0.16 * inch, 3, color, color)
                draw_text(c, value, cur_x + 0.2 * inch, yy, 4.8, colors.white if value != "MODERATE" else INK, "Helvetica-Bold", "center")
            elif i == 6 and value == "Active":
                c.setFillColor(GREEN)
                c.circle(cur_x + 0.03 * inch, yy + 0.03 * inch, 0.025 * inch, fill=1, stroke=0)
                draw_text(c, value, cur_x + 0.1 * inch, yy, 5.0, INK)
            else:
                draw_text(c, value, cur_x, yy, 5.0, INK if r < 3 else MUTED)
            cur_x += col_w[i] * inch


def draw_super_admin(c: canvas.Canvas):
    x, y, w, h = 0.25 * inch, 2.22 * inch, 4.65 * inch, 2.02 * inch
    draw_round_rect(c, x, y, w, h, 5, colors.white, colors.HexColor("#C6B8FF"))
    draw_text(c, "SUPER ADMIN CONTROL TOWER", x + 0.5 * inch, y + h - 0.25 * inch, 8.8, NAVY, "Helvetica-Bold")
    c.setFillColor(PURPLE)
    c.circle(x + 0.25 * inch, y + h - 0.25 * inch, 0.1 * inch, fill=1, stroke=0)
    items = ["Platform Health", "Module Validation", "Data Integrity", "Permit Upload Tests", "AI Response Monitoring", "Site & User Management", "System Logs & Alerts"]
    for i, item in enumerate(items):
        yy = y + h - 0.58 * inch - i * 0.24 * inch
        c.setFillColor(GREEN)
        c.circle(x + 0.25 * inch, yy + 0.03 * inch, 0.055 * inch, fill=1, stroke=0)
        draw_check(c, x + 0.215 * inch, yy + 0.005 * inch, 0.065 * inch, colors.white)
        draw_text(c, item, x + 0.48 * inch, yy, 7.0, NAVY)

    mx, my, mw, mh = x + 2.12 * inch, y + 0.35 * inch, 2.18 * inch, 1.28 * inch
    draw_round_rect(c, mx, my, mw, mh, 4, colors.HexColor("#0F172A"), colors.HexColor("#0F172A"))
    draw_round_rect(c, mx + 0.08 * inch, my + 0.12 * inch, mw - 0.16 * inch, mh - 0.22 * inch, 3, colors.HexColor("#F8FAFC"), colors.HexColor("#CBD5E1"))
    c.setFillColor(GREEN)
    c.wedge(mx + 0.45 * inch, my + 0.72 * inch, mx + 0.95 * inch, my + 1.22 * inch, 90, 180, fill=1)
    c.setFillColor(BLUE)
    c.wedge(mx + 0.45 * inch, my + 0.72 * inch, mx + 0.95 * inch, my + 1.22 * inch, 180, 360, fill=1)
    c.setFillColor(PURPLE)
    c.wedge(mx + 0.45 * inch, my + 0.72 * inch, mx + 0.95 * inch, my + 1.22 * inch, 0, 90, fill=1)
    for i, bar_h in enumerate([0.35, 0.52, 0.28, 0.62, 0.46]):
        c.setFillColor(BLUE)
        c.rect(mx + (1.15 + i * 0.16) * inch, my + 0.43 * inch, 0.08 * inch, bar_h * inch, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#1E293B"))
    c.rect(mx, my - 0.18 * inch, mw, 0.18 * inch, fill=1, stroke=0)


def draw_site_dashboard(c: canvas.Canvas):
    x, y, w, h = 5.03 * inch, 2.22 * inch, 5.85 * inch, 4.22 * inch
    draw_round_rect(c, x, y, w, h, 5, colors.white, BORDER)
    c.setFillColor(DEEP_TEAL)
    c.rect(x, y + h - 0.31 * inch, w, 0.31 * inch, fill=1, stroke=0)
    draw_text(c, "SITE DASHBOARD - CENTRAL PLANT EXPANSION", x + w / 2, y + h - 0.22 * inch, 9.7, colors.white, "Helvetica-Bold", "center")

    draw_round_rect(c, x + 0.12 * inch, y + 2.75 * inch, 1.48 * inch, 1.18 * inch, 5, colors.white, colors.HexColor("#E1EAF5"))
    draw_text(c, "RISK SCORE", x + 0.86 * inch, y + 3.68 * inch, 5.7, NAVY, "Helvetica-Bold", "center")
    c.setStrokeColor(RED)
    c.setLineWidth(6)
    c.arc(x + 0.42 * inch, y + 3.03 * inch, x + 1.22 * inch, y + 3.83 * inch, 45, 260)
    c.setStrokeColor(colors.HexColor("#CBD5E1"))
    c.arc(x + 0.42 * inch, y + 3.03 * inch, x + 1.22 * inch, y + 3.83 * inch, -35, 80)
    draw_text(c, "78", x + 0.82 * inch, y + 3.25 * inch, 24, INK, "Helvetica-Bold", "center")
    draw_text(c, "HIGH RISK", x + 0.82 * inch, y + 2.98 * inch, 6.5, NAVY, "Helvetica-Bold", "center")
    draw_text(c, "Trending Up", x + 0.82 * inch, y + 2.8 * inch, 6.5, RED, "Helvetica-Bold", "center")

    draw_round_rect(c, x + 1.72 * inch, y + 2.75 * inch, 2.38 * inch, 1.18 * inch, 5, colors.white, colors.HexColor("#E1EAF5"))
    draw_text(c, "TOP RISK DRIVERS", x + 2.91 * inch, y + 3.68 * inch, 5.8, NAVY, "Helvetica-Bold", "center")
    drivers = ["Open Hot Work Permits", "Elevated Work Planned", "3 Open Corrective Actions", "Fall Protection Observations Increasing", "Wind Risk Increasing After 1:00 PM"]
    for i, item in enumerate(drivers):
        yy = y + 3.48 * inch - i * 0.2 * inch
        draw_text(c, "!", x + 1.91 * inch, yy, 7, RED, "Helvetica-Bold")
        draw_text(c, item, x + 2.08 * inch, yy, 6.2, INK)

    draw_round_rect(c, x + 4.22 * inch, y + 2.75 * inch, 1.5 * inch, 1.18 * inch, 5, colors.white, colors.HexColor("#E1EAF5"))
    draw_text(c, "SITE INFO", x + 4.38 * inch, y + 3.68 * inch, 5.8, NAVY, "Helvetica-Bold")
    info = ["Client: Eli Lilly & Co.", "GC: ABC Construction", "Start Date: Jan 15, 2024", "End Date: Dec 31, 2024", "Phase: Structural", "Workers On-Site: 86", "Trades: 7 Active"]
    draw_wrapped(c, info, x + 4.38 * inch, y + 3.48 * inch, 5.55, 8.2, INK, "Helvetica-Bold")

    metrics = [
        ("ACTIVE JSAs", "8", BLUE),
        ("ACTIVE PERMITS", "12", GREEN),
        ("OBSERVATIONS", "15", GREEN),
        ("OPEN CAs", "7", RED),
        ("INCIDENTS", "1", RED),
        ("NEAR MISSES", "2", ORANGE),
        ("INSPECTIONS", "4", BLUE),
        ("TRAINING GAPS", "4", PURPLE),
    ]
    for i, (label, value, color) in enumerate(metrics):
        col = i % 4
        row = i // 4
        bx = x + 0.12 * inch + col * 1.36 * inch
        by = y + 1.92 * inch - row * 0.72 * inch
        draw_round_rect(c, bx, by, 1.22 * inch, 0.58 * inch, 5, colors.white, colors.HexColor("#E1EAF5"))
        draw_text(c, label, bx + 0.61 * inch, by + 0.4 * inch, 5.0, NAVY, "Helvetica-Bold", "center")
        draw_text(c, value, bx + 0.61 * inch, by + 0.18 * inch, 13, INK, "Helvetica-Bold", "center")
        draw_text(c, "View All", bx + 0.61 * inch, by + 0.06 * inch, 4.7, BLUE, "Helvetica", "center")

    draw_round_rect(c, x + 0.12 * inch, y + 0.1 * inch, 2.43 * inch, 0.76 * inch, 5, colors.white, colors.HexColor("#E1EAF5"))
    draw_text(c, "GUS RECOMMENDATIONS FOR TODAY", x + 0.23 * inch, y + 0.67 * inch, 5.7, PURPLE, "Helvetica-Bold")
    recs = ["Verify fall protection and hot work permits.", "Review and approve two pending work permits.", "Complete observed hazard walk.", "Ensure workers attend toolbox talk before hot work starts."]
    for i, item in enumerate(recs):
        draw_check(c, x + 0.24 * inch, y + (0.52 - i * 0.13) * inch, 0.045 * inch, GREEN)
        draw_text(c, item, x + 0.48 * inch, y + (0.52 - i * 0.13) * inch, 4.7, INK)
    draw_round_rect(c, x + 0.25 * inch, y + 0.16 * inch, 0.9 * inch, 0.18 * inch, 3, PURPLE, PURPLE)
    draw_text(c, "Ask Gus Anything", x + 0.7 * inch, y + 0.21 * inch, 5.2, colors.white, "Helvetica-Bold", "center")

    draw_round_rect(c, x + 2.67 * inch, y + 0.1 * inch, 1.33 * inch, 0.76 * inch, 5, colors.white, colors.HexColor("#E1EAF5"))
    draw_text(c, "WEATHER RISK", x + 3.34 * inch, y + 0.67 * inch, 5.7, NAVY, "Helvetica-Bold", "center")
    draw_text(c, "Watch: High", x + 3.34 * inch, y + 0.47 * inch, 5.3, INK, align="center")
    draw_text(c, "Gusts: 25 mph", x + 3.34 * inch, y + 0.34 * inch, 5.3, INK, align="center")
    draw_text(c, "Risk Level", x + 3.12 * inch, y + 0.16 * inch, 5.0, NAVY, "Helvetica-Bold", "center")
    draw_round_rect(c, x + 3.43 * inch, y + 0.09 * inch, 0.46 * inch, 0.17 * inch, 3, ORANGE, ORANGE)
    draw_text(c, "MODERATE", x + 3.66 * inch, y + 0.14 * inch, 4.7, INK, "Helvetica-Bold", "center")

    draw_round_rect(c, x + 4.12 * inch, y + 0.1 * inch, 1.6 * inch, 0.76 * inch, 5, colors.white, colors.HexColor("#E1EAF5"))
    draw_text(c, "HIGH + RISK WORK TODAY", x + 4.92 * inch, y + 0.67 * inch, 5.5, NAVY, "Helvetica-Bold", "center")
    draw_wrapped(c, ["Elevated structural steel work", "Crane lifting operations", "Hot Work (Grinding)", "NEWH operations"], x + 4.37 * inch, y + 0.48 * inch, 4.8, 8.2, INK)


def draw_mobile_panel(c: canvas.Canvas):
    x, y, w, h = 11.0 * inch, 2.22 * inch, 4.65 * inch, 4.22 * inch
    draw_round_rect(c, x, y, w, h, 5, colors.white, BORDER)
    draw_text(c, "MOBILE FIELD EXPERIENCE", x + w / 2, y + h - 0.24 * inch, 8.8, NAVY, "Helvetica-Bold", "center")

    phone_x, phone_y, phone_w, phone_h = x + 0.34 * inch, y + 0.14 * inch, 2.12 * inch, 3.55 * inch
    draw_round_rect(c, phone_x, phone_y, phone_w, phone_h, 26, colors.HexColor("#101827"), colors.HexColor("#101827"))
    draw_round_rect(c, phone_x + 0.08 * inch, phone_y + 0.1 * inch, phone_w - 0.16 * inch, phone_h - 0.2 * inch, 18, colors.white, colors.HexColor("#111827"))
    c.setFillColor(NAVY)
    c.roundRect(phone_x + 0.08 * inch, phone_y + phone_h - 0.78 * inch, phone_w - 0.16 * inch, 0.68 * inch, 14, fill=1, stroke=0)
    draw_text(c, "Central Plant Expansion", phone_x + 0.24 * inch, phone_y + phone_h - 0.48 * inch, 5.7, colors.white, "Helvetica-Bold")
    draw_text(c, "Good Morning, Alex!", phone_x + 0.24 * inch, phone_y + phone_h - 0.68 * inch, 6.3, colors.white, "Helvetica-Bold")
    draw_text(c, "What would you like to do?", phone_x + 0.24 * inch, phone_y + phone_h - 1.05 * inch, 5.2, INK, "Helvetica-Bold")
    actions = [("JSA", GREEN), ("Observation", ORANGE), ("Permit", BLUE), ("Incident", RED), ("Corrective Action", PURPLE), ("Ask Gus", PURPLE)]
    for i, (label, color) in enumerate(actions):
        col, row = i % 2, i // 2
        bx = phone_x + 0.23 * inch + col * 0.83 * inch
        by = phone_y + phone_h - 1.78 * inch - row * 0.68 * inch
        draw_round_rect(c, bx, by, 0.68 * inch, 0.52 * inch, 5, colors.white, colors.HexColor("#E1EAF5"))
        draw_icon_simple(c, "Action" if label == "Corrective Action" else label, bx + 0.23 * inch, by + 0.22 * inch, 0.24 * inch, color)
        draw_text(c, label, bx + 0.34 * inch, by + 0.1 * inch, 4.5, NAVY, "Helvetica-Bold", "center")
    c.setStrokeColor(colors.HexColor("#CBD5E1"))
    c.line(phone_x + 0.18 * inch, phone_y + 0.46 * inch, phone_x + phone_w - 0.18 * inch, phone_y + 0.46 * inch)
    for i, label in enumerate(["Home", "Notifications", "Profile"]):
        draw_text(c, label, phone_x + (0.43 + i * 0.63) * inch, phone_y + 0.24 * inch, 4.0, NAVY, "Helvetica-Bold", "center")

    side_x = x + 2.9 * inch
    items = [
        ("Quick & Easy", "Big Buttons", "JSA"),
        ("Voice Input", "Dictate notes, JSAs, and more", "Voice"),
        ("Photo Upload", "Capture and document issues", "Photo"),
        ("QR Code Access", "Instant site access for workers", "QR"),
        ("Offline Mode", "Work anywhere, stay linked", "Cloud"),
        ("Ask Gus", "AI help on every page", "Gus"),
    ]
    for i, (title, body, icon) in enumerate(items):
        by = y + h - 0.93 * inch - i * 0.55 * inch
        draw_round_rect(c, side_x, by, 1.58 * inch, 0.5 * inch, 5, colors.white, colors.HexColor("#D7E7F9"))
        if icon == "Gus":
            draw_icon_bot(c, side_x + 0.15 * inch, by + 0.16 * inch, 0.22 * inch, PURPLE)
        else:
            draw_icon_simple(c, icon, side_x + 0.12 * inch, by + 0.1 * inch, 0.28 * inch, BLUE if icon != "Cloud" else PURPLE)
        draw_text(c, title, side_x + 0.5 * inch, by + 0.31 * inch, 6.0, BLUE if icon != "Gus" else PURPLE, "Helvetica-Bold")
        draw_wrapped(c, [body] if len(body) < 26 else [body[:22], body[22:].strip()], side_x + 0.5 * inch, by + 0.18 * inch, 5.2, 6.8, INK)


def draw_foundation(c: canvas.Canvas):
    x, y, w, h = 0.25 * inch, 1.16 * inch, 15.4 * inch, 0.93 * inch
    draw_round_rect(c, x, y, w, h, 5, colors.white, BORDER)
    draw_text(c, "PLATFORM FOUNDATION - EVERYTHING CONNECTED TO SITE/JOB", x + 0.25 * inch, y + h - 0.16 * inch, 7.8, NAVY, "Helvetica-Bold")
    modules = [
        ("JSAs", "Job Safety Analysis", GREEN),
        ("Permits", "Trend Alerts", GREEN),
        ("Observations", "Safety Observations", ORANGE),
        ("Corrective Actions", "Track & Close Actions", RED),
        ("Incidents", "Record & Investigate", RED),
        ("Inspections", "Safety Inspections", PURPLE),
        ("Training", "Training Matrix & Gaps", BLUE),
        ("Documents", "Plans, Drawings & Forms", TEAL),
        ("Weather", "Real-Time Weather", BLUE),
        ("Reports", "Dashboards & Analytics", NAVY),
        ("Risk Engine", "Predictive Risk Scoring", PURPLE),
        ("AI Intelligence", "Gus AI Insights", PURPLE),
    ]
    tile_w = 1.13 * inch
    for i, (title, body, color) in enumerate(modules):
        tx = x + 0.2 * inch + i * 1.25 * inch
        ty = y + 0.09 * inch
        draw_round_rect(c, tx, ty, tile_w, 0.58 * inch, 4, colors.white, colors.HexColor("#E1EAF5"))
        draw_icon_simple(c, "JSA", tx + 0.12 * inch, ty + 0.18 * inch, 0.27 * inch, color)
        draw_text(c, title, tx + 0.5 * inch, ty + 0.38 * inch, 5.4, color, "Helvetica-Bold")
        draw_wrapped(c, body.split(" & ") if " & " in body else [body], tx + 0.5 * inch, ty + 0.24 * inch, 4.7, 6.2, NAVY)


def draw_roles(c: canvas.Canvas):
    x, y, w, h = 0.25 * inch, 0.22 * inch, 15.4 * inch, 0.75 * inch
    roles = [
        ("FOR OWNERS / EXECUTIVES", ["Real-time visibility, risk reduction,", "and performance insights."]),
        ("FOR PROJECT MANAGERS", ["Track compliance, manage risk,", "and keep projects on track."]),
        ("FOR SAFETY MANAGERS", ["Proactive risk management,", "documentation, and reporting."]),
        ("FOR SUPERVISORS / FOREMEN", ["Easy tools to keep crews safe", "and productive."]),
        ("FOR WORKERS", ["Simple, mobile tools to report,", "communicate, and stay safe."]),
        ("FOR INSURANCE PARTNERS", ["Better data, lower risk,", "smarter decisions."]),
    ]
    card_w = (w - 0.12 * inch * 5) / 6
    for i, (title, body) in enumerate(roles):
        cx = x + i * (card_w + 0.12 * inch)
        draw_round_rect(c, cx, y, card_w, h, 5, colors.white, BORDER)
        draw_text(c, title, cx + card_w / 2, y + h - 0.22 * inch, 5.9, NAVY, "Helvetica-Bold", "center")
        draw_wrapped(c, body, cx + card_w / 2, y + h - 0.42 * inch, 5.6, 8.2, NAVY, align="center")


def build_pdf():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=(PAGE_W, PAGE_H))
    c.setTitle("SafetyDocs360 Platform Overview")
    c.setAuthor("SafetyDocs360")
    c.setFillColor(colors.white)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    draw_risk_key(c)
    draw_top_hierarchy(c)
    draw_gus_panel(c)
    draw_executive_dashboard(c)
    draw_super_admin(c)
    draw_site_dashboard(c)
    draw_mobile_panel(c)
    draw_foundation(c)
    draw_roles(c)

    draw_text(c, "Current platform map - May 2026", PAGE_W - 0.25 * inch, 0.08 * inch, 5.5, MUTED, "Helvetica", "right")
    c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    build_pdf()
