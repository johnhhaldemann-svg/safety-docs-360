from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "safety360docs-platform-valuation-pricing.pdf"


PAGE_W, PAGE_H = letter
MARGIN = 0.55 * inch
ACCENT = colors.HexColor("#174A63")
ACCENT_2 = colors.HexColor("#2F7D62")
LIGHT = colors.HexColor("#EEF5F7")
GRID = colors.HexColor("#B9C9D0")
TEXT = colors.HexColor("#1B2830")
MUTED = colors.HexColor("#52616A")


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="TitleCustom",
        parent=styles["Title"],
        textColor=ACCENT,
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=26,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="Subtitle",
        parent=styles["Normal"],
        textColor=MUTED,
        fontSize=9.5,
        leading=13,
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        name="Section",
        parent=styles["Heading2"],
        textColor=ACCENT,
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=17,
        spaceBefore=10,
        spaceAfter=7,
    )
)
styles.add(
    ParagraphStyle(
        name="Small",
        parent=styles["Normal"],
        textColor=TEXT,
        fontSize=8,
        leading=10.5,
    )
)
styles.add(
    ParagraphStyle(
        name="BodyCustom",
        parent=styles["Normal"],
        textColor=TEXT,
        fontSize=9,
        leading=12,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="Cell",
        parent=styles["Normal"],
        textColor=TEXT,
        fontSize=7.6,
        leading=9.2,
        alignment=TA_LEFT,
    )
)
styles.add(
    ParagraphStyle(
        name="HeaderCell",
        parent=styles["Normal"],
        textColor=colors.white,
        fontName="Helvetica-Bold",
        fontSize=7.4,
        leading=9,
        alignment=TA_LEFT,
    )
)


def p(text: str, style: str = "BodyCustom") -> Paragraph:
    return Paragraph(text, styles[style])


def cell(text: str, header: bool = False) -> Paragraph:
    return Paragraph(text, styles["HeaderCell" if header else "Cell"])


def money(cents: int) -> str:
    return f"${cents // 100:,.0f}"


def table(data, widths, header_rows=1, font_size=7.6):
    tbl = Table(data, colWidths=widths, repeatRows=header_rows, hAlign="LEFT")
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, header_rows - 1), ACCENT),
                ("TEXTCOLOR", (0, 0), (-1, header_rows - 1), colors.white),
                ("FONTNAME", (0, 0), (-1, header_rows - 1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), font_size),
                ("LEADING", (0, 0), (-1, -1), font_size + 1.8),
                ("GRID", (0, 0), (-1, -1), 0.35, GRID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, header_rows), (-1, -1), [colors.white, LIGHT]),
            ]
        )
    )
    return tbl


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, 0.35 * inch, "Safety360Docs - working valuation and pricing model")
    canvas.drawRightString(PAGE_W - MARGIN, 0.35 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_story():
    story = []

    story.append(p("Safety360Docs Platform Valuation + Pricing Model", "TitleCustom"))
    story.append(
        p(
            "Working estimate updated May 20, 2026. This is a practical business valuation and commercial packaging view, not a formal appraisal, legal opinion, or investment advice.",
            "Subtitle",
        )
    )

    story.append(p("Bottom Line", "Section"))
    story.append(
        p(
            "As built today, Safety360Docs is plausibly worth <b>$1.5M-$4M</b> as a fundable early-stage platform. If sold strictly as software/IP without recurring revenue, the more conservative asset-sale range is <b>$300k-$900k</b>. The number gets meaningfully stronger once paid pilots convert into ARR.",
        )
    )
    story.append(
        table(
            [
                [cell("Stage", True), cell("Reasonable valuation", True), cell("What supports the number", True)],
                [
                    cell("No paying customers, working product"),
                    cell("$300k-$900k asset value"),
                    cell("Built SaaS, domain logic, product surfaces, database/RBAC, tests, and launch assets, but no recurring revenue proof yet."),
                ],
                [
                    cell("Demo-ready with serious pilot conversations"),
                    cell("$1.5M-$4M pre-money"),
                    cell("Enterprise-ready product breadth, priced SKU, and revenue pilot docs make it more than an idea-stage prototype."),
                ],
                [
                    cell("3 paid pilots at about $85k ARR each"),
                    cell("$2M-$5M"),
                    cell("Roughly $255k ARR plus category-specific traction and proof buyers will pay annual contracts."),
                ],
                [
                    cell("About $1M ARR with retention evidence"),
                    cell("$3M-$6M+"),
                    cell("Early ARR starts to anchor the valuation in SaaS multiples instead of build cost or replacement cost."),
                ],
                [
                    cell("About $2M ARR with strong retention"),
                    cell("$8M-$13M+"),
                    cell("Recurring revenue, retention, and expansion can move valuation toward stronger private SaaS multiple bands."),
                ],
            ],
            [1.65 * inch, 1.25 * inch, 3.45 * inch],
        )
    )

    story.append(p("Product Evidence", "Section"))
    for bullet in [
        "Broad SaaS surface: company workspaces, jobsites, document control, training, corrective actions, field workflows, JSAs, permits, incidents, admin tooling, and superadmin tooling.",
        "Architecture: Next.js App Router, Supabase Postgres/Auth/RLS, Vercel deployment, scheduled jobs, Stripe billing hooks, and test coverage.",
        "Intelligence layer: Safety Intelligence, analytics, Risk Memory, AI review flows, prediction validation, and recommendation cron work.",
        "Commercial packaging: annual enterprise tiers are modeled at $50k, $85k, $150k, and $250k, plus add-ons.",
        "Launch readiness: docs include production deployment, support/onboarding, pilot SKU, QA signoff, billing cutover, legal/agreement, and post-pilot backlog materials.",
    ]:
        story.append(p(f"- {bullet}", "Small"))

    story.append(PageBreak())
    story.append(p("Pricing Anchor", "Section"))
    story.append(
        table(
            [
                [cell("Tier", True), cell("Annual price", True), cell("Included scale", True)],
                [cell("Tier 1 - Site Launch"), cell("$50,000"), cell("1 jobsite, 25 licensed users")],
                [cell("Tier 2 - Professional Network"), cell("$85,000"), cell("3 jobsites, 75 licensed users")],
                [cell("Tier 3 - Enterprise Safety Intelligence"), cell("$150,000"), cell("6 jobsites, 200 licensed users")],
                [cell("Tier 4 - Black Label Enterprise"), cell("$250,000+"), cell("12 jobsites, 500 licensed users, custom pricing posture")],
            ],
            [2.55 * inch, 1.2 * inch, 2.6 * inch],
        )
    )

    story.append(p("Assumptions", "Section"))
    for bullet in [
        "No verified ARR, signed customer contracts, churn history, or gross margin data were available in the workspace.",
        "The estimate treats the platform as a vertical B2B SaaS product for construction safety and compliance, not as a generic document app.",
        "The high end assumes the product can be demoed credibly, deployed safely, and sold into paid pilots without a full rebuild.",
        "The low end accounts for remaining launch risk: support process, legal review, notifications depth, global search gaps, and pilot waivers.",
    ]:
        story.append(p(f"- {bullet}", "Small"))

    story.append(p("Fastest Path To Increase Value", "Section"))
    for bullet in [
        "Land 3 paid pilots. Even discounted paid pilots can reframe value from asset replacement cost to ARR-based company value.",
        "Use the $85k tier as the target anchor. Three customers at that level imply about $255k ARR before add-ons.",
        "Package the platform tightly. Sell the default full-workspace pilot SKU first; keep waived items contract-visible.",
        "Capture proof. Buyer names, signed terms, annual contract value, renewal intent, usage metrics, and one case study matter more than another feature sprint.",
    ]:
        story.append(p(f"- {bullet}", "Small"))

    story.append(PageBreak())
    story.append(p("Commercial Pricing Tiers", "Section"))
    story.append(
        p(
            "Recommended packaging below keeps the platform simple to sell: one annual workspace subscription, included jobsite and licensed-user capacity, tracked non-user workforce records, then clear expansion pricing.",
            "BodyCustom",
        )
    )
    story.append(
        table(
            [
                [
                    cell("Tier", True),
                    cell("Annual price", True),
                    cell("Included jobsites", True),
                    cell("Licensed users", True),
                    cell("Tracked non-users", True),
                    cell("Best-fit buyer", True),
                ],
                [
                    cell("Tier 1 - Site Launch"),
                    cell("$50,000"),
                    cell("1 active jobsite"),
                    cell("25 app users"),
                    cell("Up to 250 roster records"),
                    cell("Single-project contractor, pilot launch, or owner-controlled site."),
                ],
                [
                    cell("Tier 2 - Professional Network"),
                    cell("$85,000"),
                    cell("3 active jobsites"),
                    cell("75 app users"),
                    cell("Up to 750 roster records"),
                    cell("Regional contractor running multiple crews or active sites."),
                ],
                [
                    cell("Tier 3 - Enterprise Safety Intelligence"),
                    cell("$150,000"),
                    cell("6 active jobsites"),
                    cell("200 app users"),
                    cell("Up to 2,000 roster records"),
                    cell("Larger contractor needing risk intelligence, dashboards, and executive visibility."),
                ],
                [
                    cell("Tier 4 - Black Label Enterprise"),
                    cell("$250,000+"),
                    cell("12 active jobsites"),
                    cell("500 app users"),
                    cell("Up to 5,000 roster records"),
                    cell("Enterprise customer with custom workflows, integrations, support, and expansion needs."),
                ],
            ],
            [1.3 * inch, 0.82 * inch, 0.85 * inch, 0.8 * inch, 1.0 * inch, 1.58 * inch],
            font_size=7.1,
        )
    )

    story.append(p("What Each Tier Includes", "Section"))
    story.append(
        table(
            [
                [cell("Capability", True), cell("Tier 1", True), cell("Tier 2", True), cell("Tier 3", True), cell("Tier 4", True)],
                [
                    cell("Company workspace, RBAC, jobsites, team invites"),
                    cell("Included"),
                    cell("Included"),
                    cell("Included"),
                    cell("Included + custom controls"),
                ],
                [
                    cell("Document generation, upload, library, search"),
                    cell("Core"),
                    cell("Core + templates"),
                    cell("Advanced + review workflows"),
                    cell("Custom templates and governance"),
                ],
                [
                    cell("Field work: JSAs, permits, incidents, corrective actions"),
                    cell("Included"),
                    cell("Included"),
                    cell("Included + analytics"),
                    cell("Included + enterprise configuration"),
                ],
                [
                    cell("Training and non-user workforce tracking"),
                    cell("Basic roster/training tracking"),
                    cell("Expanded tracking"),
                    cell("Advanced readiness views"),
                    cell("Custom import/support model"),
                ],
                [
                    cell("Command Center, analytics, Risk Memory"),
                    cell("Dashboard basics"),
                    cell("Command Center"),
                    cell("Predictive risk + executive reporting"),
                    cell("Custom AI/risk operating model"),
                ],
                [
                    cell("Billing, invoices, pilot/admin controls"),
                    cell("Included"),
                    cell("Included"),
                    cell("Included"),
                    cell("Included + custom terms"),
                ],
                [
                    cell("Support and implementation"),
                    cell("Standard onboarding"),
                    cell("Priority onboarding"),
                    cell("Quarterly success review"),
                    cell("Dedicated support package"),
                ],
            ],
            [1.75 * inch, 1.15 * inch, 1.15 * inch, 1.15 * inch, 1.15 * inch],
            font_size=7.0,
        )
    )

    story.append(PageBreak())
    story.append(p("Expansion Pricing", "Section"))
    story.append(
        p(
            "The base contract should define active jobsite count, licensed users, and tracked non-users separately. This avoids charging full app seats for workers who only need training or roster tracking.",
            "BodyCustom",
        )
    )
    story.append(
        table(
            [
                [cell("Expansion item", True), cell("Recommended price", True), cell("Definition / billing note", True)],
                [
                    cell("Additional active jobsite"),
                    cell("$12,000 per jobsite/year"),
                    cell("Use when a customer needs more live projects than the tier includes. Archive completed jobsites before charging if they are retained only for records."),
                ],
                [
                    cell("Additional licensed user"),
                    cell("$600 per user/year"),
                    cell("Licensed users have app login access and consume seats. Active memberships and pending invites count toward seat usage."),
                ],
                [
                    cell("Additional tracked non-user"),
                    cell("$30 per person/year"),
                    cell("Non-users are employee/worker roster records for training, certifications, readiness, and reporting. They do not have app login access and do not consume licensed seats."),
                ],
                [
                    cell("Document/template pack"),
                    cell("$2,500-$10,000 per pack"),
                    cell("Custom company templates, owner/GC forms, specialty safety programs, or vertical-specific document bundles."),
                ],
                [
                    cell("Professional safety review"),
                    cell("$2,500-$7,500 per review"),
                    cell("Optional human review for CSEP packages, complex program uploads, or customer-required submittals."),
                ],
                [
                    cell("Implementation / onboarding"),
                    cell("$10,000-$25,000 one-time"),
                    cell("Workspace setup, import support, admin training, and launch coordination."),
                ],
                [
                    cell("Data migration"),
                    cell("$5,000-$20,000 one-time"),
                    cell("Historical documents, training files, rosters, jobsites, or previous safety records."),
                ],
                [
                    cell("API / integration package"),
                    cell("$15,000-$50,000/year or setup"),
                    cell("Connectors, custom exports, SSO, ERP/project-management links, or customer reporting feeds."),
                ],
                [
                    cell("SMS / advanced notifications"),
                    cell("Package + pass-through usage"),
                    cell("Text alerts, routing rules, escalation paths, and delivery costs should be separated from the base license."),
                ],
            ],
            [1.55 * inch, 1.35 * inch, 3.45 * inch],
            font_size=7.2,
        )
    )

    story.append(p("Seat Definitions", "Section"))
    story.append(
        table(
            [
                [cell("Type", True), cell("Has login?", True), cell("Consumes licensed user seat?", True), cell("Use case", True)],
                [
                    cell("Licensed user"),
                    cell("Yes"),
                    cell("Yes"),
                    cell("Admins, safety managers, project managers, foremen, field users, auditors, and other people working inside the app."),
                ],
                [
                    cell("Tracked non-user"),
                    cell("No"),
                    cell("No"),
                    cell("Employees, subcontractor workers, or roster-only people tracked for training, certifications, readiness, and safety records."),
                ],
                [
                    cell("Pending invite"),
                    cell("Not yet"),
                    cell("Yes, reserved"),
                    cell("Counts toward capacity so companies cannot exceed the purchased seat limit by sending unlimited invites."),
                ],
            ],
            [1.25 * inch, 0.85 * inch, 1.45 * inch, 2.8 * inch],
            font_size=7.3,
        )
    )

    story.append(p("Valuation Impact Of Pricing Clarity", "Section"))
    story.append(
        p(
            "Clear expansion pricing makes each customer more valuable. A Tier 2 customer at $85k ARR that adds 2 jobsites, 20 licensed users, and 250 tracked non-users moves from $85k ARR to about $128.5k ARR before services or document packs.",
            "BodyCustom",
        )
    )
    story.append(
        table(
            [
                [cell("Example customer", True), cell("Base ARR", True), cell("Expansion ARR", True), cell("Total ARR", True)],
                [cell("Tier 1 only"), cell("$50,000"), cell("$0"), cell("$50,000")],
                [cell("Tier 2 + 2 jobsites + 20 users + 250 non-users"), cell("$85,000"), cell("$43,500"), cell("$128,500")],
                [cell("Tier 3 + 4 jobsites + 50 users + 500 non-users"), cell("$150,000"), cell("$93,000"), cell("$243,000")],
                [cell("Tier 4 custom enterprise"), cell("$250,000+"), cell("Custom"), cell("$300,000-$500,000+ target")],
            ],
            [2.55 * inch, 1.0 * inch, 1.2 * inch, 1.25 * inch],
            font_size=7.5,
        )
    )

    story.append(PageBreak())
    story.append(p("Platform Asset Inventory", "Section"))
    story.append(
        p(
            "This section inventories what is inside the company and gives directional value ranges for each asset group. These ranges are <b>not additive</b>: the same shared engine supports multiple modules, so adding every line together would overstate the company value. Use this as a boardroom map for where value lives.",
            "BodyCustom",
        )
    )
    story.append(
        table(
            [
                [
                    cell("Shared asset group", True),
                    cell("What is inside", True),
                    cell("Standalone/IP value", True),
                    cell("Strategic value", True),
                ],
                [
                    cell("Tenant, workspace, RBAC, security boundary"),
                    cell("Company accounts, roles, permissions, jobsite scope, route checks, RLS pattern, storage boundaries."),
                    cell("$150k-$350k"),
                    cell("Foundation for enterprise trust, multi-customer scale, and regulated workflows."),
                ],
                [
                    cell("Database, storage, deployment architecture"),
                    cell("Supabase schema, Auth, RLS, migrations, Vercel deployment, scheduled jobs, release docs."),
                    cell("$125k-$300k"),
                    cell("Makes the product deployable and harder to replace than a static document generator."),
                ],
                [
                    cell("Billing, subscriptions, seats, invoices"),
                    cell("Company subscriptions, seat caps, licensed users, pending invites, recurring invoice logic."),
                    cell("$75k-$175k"),
                    cell("Turns the product into a sellable SaaS business with expansion mechanics."),
                ],
                [
                    cell("Document engine and library"),
                    cell("Document generation, upload, search, storage, marketplace preview, CSEP/export flows."),
                    cell("$250k-$600k"),
                    cell("Core wedge for compliance buyers because documents are the buying pain."),
                ],
                [
                    cell("Workflow engine"),
                    cell("JSAs, permits, incidents, corrective actions, field issues, jobsite work loops."),
                    cell("$300k-$750k"),
                    cell("Moves the platform from document output to daily operational system of record."),
                ],
                [
                    cell("Training and workforce tracking"),
                    cell("Tracked employees/non-users, training matrix, certifications, readiness signals."),
                    cell("$125k-$300k"),
                    cell("Creates workforce-scale pricing without requiring every worker to log in."),
                ],
                [
                    cell("Analytics, Command Center, Risk Memory"),
                    cell("Dashboards, risk rollups, recommendations, open-work shortcuts, executive visibility."),
                    cell("$250k-$650k"),
                    cell("Raises buyer perception from compliance tool to management intelligence system."),
                ],
                [
                    cell("AI engine and predictive intelligence"),
                    cell("Safety Intelligence, company memory, permit copilot, AI review, predictive risk, feedback logs."),
                    cell("$400k-$1.2M"),
                    cell("Highest strategic upside if it proves repeatable, auditable, and tied to customer data."),
                ],
                [
                    cell("Admin, superadmin, audit operations"),
                    cell("Review queues, company administration, marketplace admin, AI engine operations, validation tools."),
                    cell("$150k-$350k"),
                    cell("Supports real customer operations, service delivery, and compliance evidence."),
                ],
                [
                    cell("Commercial readiness package"),
                    cell("Pilot SKU, QA signoff, billing cutover, onboarding, legal/agreement, production docs."),
                    cell("$75k-$200k"),
                    cell("Reduces launch risk and supports fundraising or customer diligence."),
                ],
            ],
            [1.35 * inch, 2.2 * inch, 1.05 * inch, 1.75 * inch],
            font_size=6.65,
        )
    )

    story.append(PageBreak())
    story.append(p("Construction Platform Inventory", "Section"))
    story.append(
        p(
            "Safety360Docs is the most valuable vertical today because it is the built wedge. The construction platform includes both the shared core and construction-specific workflows. These line items explain the value inside the current product.",
            "BodyCustom",
        )
    )
    story.append(
        table(
            [
                [cell("Construction asset", True), cell("Included modules", True), cell("Directional value", True), cell("Revenue role", True)],
                [
                    cell("CSEP and safety document builder"),
                    cell("CSEP exports, safety programs, project/company details, GC review, final document output."),
                    cell("$250k-$700k"),
                    cell("Primary sales hook for contractors who need fast, polished compliance submittals."),
                ],
                [
                    cell("Document library and marketplace"),
                    cell("Upload, storage, search, marketplace previews, template unlocks, document control."),
                    cell("$150k-$400k"),
                    cell("Supports subscription retention and potential template-pack revenue."),
                ],
                [
                    cell("Jobsite operating workspace"),
                    cell("Jobsites, company workspace, contractors, jobsite access, assignments, live work context."),
                    cell("$175k-$450k"),
                    cell("Justifies jobsite-based expansion pricing."),
                ],
                [
                    cell("Field work system"),
                    cell("JSAs, permits, field issues, incidents, corrective actions, verification and closeout loops."),
                    cell("$300k-$750k"),
                    cell("Daily-use layer that can raise retention and seat expansion."),
                ],
                [
                    cell("Training and non-user workforce"),
                    cell("Tracked employees, training records, certifications, readiness dashboards."),
                    cell("$125k-$325k"),
                    cell("Creates non-user workforce ARR and improves enterprise fit."),
                ],
                [
                    cell("Safety intelligence and command center"),
                    cell("Risk Memory, recommendations, predictive risk, company knowledge, analytics, executive reporting."),
                    cell("$350k-$950k"),
                    cell("Supports Tier 3/Tier 4 pricing and investor upside."),
                ],
                [
                    cell("Billing and customer administration"),
                    cell("Company subscriptions, invoices, seat limits, admin company controls, pilot billing readiness."),
                    cell("$75k-$200k"),
                    cell("Makes the product commercially operable and scalable."),
                ],
                [
                    cell("Construction launch package"),
                    cell("Pilot SKU, production checklist, onboarding/support runbook, QA signoff, legal docs."),
                    cell("$75k-$200k"),
                    cell("Reduces buyer risk and helps close paid pilots."),
                ],
            ],
            [1.42 * inch, 2.25 * inch, 1.0 * inch, 1.68 * inch],
            font_size=6.9,
        )
    )
    story.append(
        p(
            "<b>Construction platform summary:</b> if valued only as IP, Safety360Docs remains around <b>$300k-$900k</b>. As a fundable, demo-ready vertical SaaS platform, it supports the existing <b>$1.5M-$4M</b> range before ARR. With paid pilots and retention, the ARR-based ranges become more important than the module-by-module inventory.",
            "BodyCustom",
        )
    )

    story.append(p("Vertical Platform Inventory", "Section"))
    story.append(
        p(
            "The additional verticals are most valuable when they reuse the same shared compliance engine. The values below assume the parent company owns the shared core and can launch each vertical with focused templates, workflows, and buyer-specific language.",
            "BodyCustom",
        )
    )
    story.append(
        table(
            [
                [
                    cell("Platform", True),
                    cell("What it would include", True),
                    cell("Today / option value", True),
                    cell("Prototype/demo value", True),
                    cell("First paid customer value", True),
                ],
                [
                    cell("Safety360Docs - Construction"),
                    cell("CSEP, JSAs, permits, incidents, jobsite safety, training, predictive risk, safety intelligence."),
                    cell("$1.5M-$4M built platform"),
                    cell("Already demo-ready"),
                    cell("$2M-$5M with 3 pilots"),
                ],
                [
                    cell("Bio360Docs - Biotech"),
                    cell("SOPs, lab safety, CAPA support, QA/EHS documents, audit readiness, training records."),
                    cell("$250k-$750k option value"),
                    cell("$750k-$2M"),
                    cell("$1.5M-$4M"),
                ],
                [
                    cell("Compliance360Docs - General"),
                    cell("Policies, controls, issue tracking, acknowledgments, recurring reviews, compliance evidence."),
                    cell("$150k-$500k option value"),
                    cell("$500k-$1.5M"),
                    cell("$1M-$3M"),
                ],
                [
                    cell("Sustain360Docs - Sustainability"),
                    cell("ESG evidence, environmental programs, waste/emissions documentation, action plans, audit packs."),
                    cell("$200k-$600k option value"),
                    cell("$600k-$1.8M"),
                    cell("$1.5M-$4M"),
                ],
            ],
            [1.15 * inch, 2.0 * inch, 1.05 * inch, 1.05 * inch, 1.1 * inch],
            font_size=6.55,
        )
    )
    story.append(
        p(
            "<b>Important:</b> the option values for Bio360Docs, Compliance360Docs, and Sustain360Docs are not full company valuations yet. They represent strategic upside from reusing the shared engine. Their value becomes real when each vertical has buyer-specific demos, templates, workflows, and paying customers.",
            "Small",
        )
    )

    story.append(PageBreak())
    story.append(p("Value Inventory", "Section"))
    story.append(
        p(
            "This inventory translates commercial actions into approximate company value. For recurring revenue, the simple rule of thumb is: every $1 of new ARR can support about $3-$5 of enterprise value once the buyer believes the revenue is repeatable. One-time services are useful for cash and adoption, but usually receive lower valuation credit unless they convert into recurring product revenue.",
            "BodyCustom",
        )
    )
    story.append(
        table(
            [
                [
                    cell("Customer action", True),
                    cell("Direct revenue value", True),
                    cell("Indicative valuation credit", True),
                    cell("Why it matters", True),
                ],
                [
                    cell("Sell Tier 1 - Site Launch"),
                    cell("$50,000 ARR"),
                    cell("$150,000-$250,000"),
                    cell("Proves a real customer will pay for the platform and creates the first annual contract anchor."),
                ],
                [
                    cell("Sell Tier 2 - Professional Network"),
                    cell("$85,000 ARR"),
                    cell("$255,000-$425,000"),
                    cell("Best target pilot anchor; three Tier 2 customers create about $255k ARR before expansion."),
                ],
                [
                    cell("Sell Tier 3 - Enterprise Safety Intelligence"),
                    cell("$150,000 ARR"),
                    cell("$450,000-$750,000"),
                    cell("Shows the risk intelligence and analytics layer can command enterprise pricing."),
                ],
                [
                    cell("Sell Tier 4 - Black Label Enterprise"),
                    cell("$250,000+ ARR"),
                    cell("$750,000-$1,250,000+"),
                    cell("Creates strategic-account proof and can justify custom support, integrations, and stronger retention."),
                ],
                [
                    cell("Add 1 active jobsite"),
                    cell("$12,000 ARR"),
                    cell("$36,000-$60,000"),
                    cell("Clean expansion lever tied to customer growth and active project count."),
                ],
                [
                    cell("Add 1 licensed user"),
                    cell("$600 ARR"),
                    cell("$1,800-$3,000"),
                    cell("Small unit value individually, but strong when a customer rolls out to more managers and field leads."),
                ],
                [
                    cell("Add 100 tracked non-users"),
                    cell("$3,000 ARR"),
                    cell("$9,000-$15,000"),
                    cell("Monetizes workforce scale without forcing every worker to become an app user."),
                ],
                [
                    cell("Sell document/template pack"),
                    cell("$2,500-$10,000 one-time"),
                    cell("$1,250-$10,000"),
                    cell("Adds cash and stickiness; earns more valuation credit if it becomes repeatable template revenue."),
                ],
                [
                    cell("Sell professional safety review"),
                    cell("$2,500-$7,500 one-time"),
                    cell("$1,250-$7,500"),
                    cell("Good pilot close tool and compliance confidence builder, but less valuable than recurring SaaS ARR."),
                ],
                [
                    cell("Sell implementation/onboarding"),
                    cell("$10,000-$25,000 one-time"),
                    cell("$5,000-$25,000"),
                    cell("Offsets launch cost and improves activation; strongest when paired with annual software revenue."),
                ],
                [
                    cell("Sell integration/API package"),
                    cell("$15,000-$50,000 ARR or setup"),
                    cell("$45,000-$250,000 if recurring"),
                    cell("Can create moat and switching cost when priced annually."),
                ],
            ],
            [1.42 * inch, 1.12 * inch, 1.32 * inch, 2.49 * inch],
            font_size=6.85,
        )
    )

    story.append(p("Company-Building Actions", "Section"))
    story.append(
        table(
            [
                [cell("Action", True), cell("Estimated value impact", True), cell("Notes", True)],
                [
                    cell("Get a signed LOI or paid pilot agreement"),
                    cell("$100k-$500k narrative lift"),
                    cell("An LOI is not ARR, but it reduces perceived market risk and helps fundraising conversations."),
                ],
                [
                    cell("Convert 3 paid pilots at Tier 2 pricing"),
                    cell("$2M-$5M total valuation range"),
                    cell("This is the fastest milestone that moves the company away from asset-sale pricing."),
                ],
                [
                    cell("Create one named case study with usage metrics"),
                    cell("$100k-$300k narrative lift"),
                    cell("Usage proof helps investors believe retention and expansion are possible."),
                ],
                [
                    cell("Renew first annual customer"),
                    cell("20%-40% multiple quality lift"),
                    cell("Renewal evidence is often more valuable than another feature because it proves the product sticks."),
                ],
                [
                    cell("Expand one customer by 25%+"),
                    cell("10%-25% multiple quality lift"),
                    cell("Expansion proves net revenue retention potential and supports stronger SaaS multiples."),
                ],
                [
                    cell("Launch second vertical demo on same engine"),
                    cell("$500k-$2M strategic option value"),
                    cell("Only valuable if it clearly reuses the same platform core rather than looking like a separate app."),
                ],
                [
                    cell("Win first paying customer in second vertical"),
                    cell("$1M-$4M strategic lift"),
                    cell("This proves the parent-company thesis: one compliance engine can sell into more than construction."),
                ],
                [
                    cell("Reach $1M ARR"),
                    cell("$5M-$12M+ total valuation range"),
                    cell("At this stage, valuation is primarily anchored by ARR, retention, growth, and gross margin."),
                ],
            ],
            [2.05 * inch, 1.55 * inch, 2.75 * inch],
            font_size=7.1,
        )
    )

    story.append(p("How To Use The Value Inventory", "Section"))
    for bullet in [
        "Prioritize recurring ARR first: tiers, extra jobsites, extra users, tracked non-users, and recurring integration packages.",
        "Use one-time services to close pilots and fund onboarding, but do not rely on them as the main valuation story.",
        "Track every signed contract, expansion, renewal, active user count, active jobsite count, document generated, permit/JSA workflow, and non-user roster count as valuation evidence.",
        "When pitching the parent company, show construction traction first, then show how the same engine can price and package biotech, general compliance, and sustainability products.",
    ]:
        story.append(p(f"- {bullet}", "Small"))

    story.append(PageBreak())
    story.append(p("Parent Company / Multi-Vertical Upside", "Section"))
    story.append(
        p(
            "Safety360Docs can be positioned as the construction wedge for a broader AI compliance operating system. The same workspace, document, risk, review, billing, analytics, and audit infrastructure can support regulated verticals such as biotech, general compliance, and sustainability.",
            "BodyCustom",
        )
    )
    story.append(
        table(
            [
                [cell("Vertical product", True), cell("Primary buyer", True), cell("Shared platform engine", True), cell("Vertical-specific layer", True)],
                [
                    cell("Safety360Docs"),
                    cell("Construction contractors, owners, safety teams"),
                    cell("Workspace, documents, AI review, risk memory, billing, analytics"),
                    cell("JSAs, permits, CSEP, OSHA-style safety workflows"),
                ],
                [
                    cell("Bio360Docs"),
                    cell("Biotech labs, QA, EHS, operations"),
                    cell("Same core tenant, document, review, and audit trail engine"),
                    cell("SOPs, CAPA support, lab safety, training, inspection readiness"),
                ],
                [
                    cell("Compliance360Docs"),
                    cell("General business compliance and operations"),
                    cell("Same workflow, evidence, and policy management layer"),
                    cell("Policies, controls, acknowledgments, recurring reviews"),
                ],
                [
                    cell("Sustain360Docs"),
                    cell("Sustainability, ESG, environmental teams"),
                    cell("Same reporting, document, data, and analytics foundation"),
                    cell("Waste, emissions, environmental programs, ESG evidence packs"),
                ],
            ],
            [1.25 * inch, 1.45 * inch, 1.85 * inch, 1.8 * inch],
            font_size=7.1,
        )
    )
    story.append(p("Parent Company Valuation Framing", "Section"))
    story.append(
        table(
            [
                [cell("Stage", True), cell("Parent company valuation", True)],
                [cell("Safety360Docs only, no ARR, asset sale"), cell("$300k-$900k")],
                [cell("Safety360Docs demo-ready/fundable"), cell("$1.5M-$4M")],
                [cell("Multi-vertical platform concept with shared engine"), cell("$2M-$6M")],
                [cell("3 paid construction pilots"), cell("$2M-$5M")],
                [cell("Paid customers across 2 verticals"), cell("$4M-$10M")],
                [cell("$1M ARR across verticals"), cell("$5M-$12M+")],
                [cell("$2M ARR with retention"), cell("$10M-$20M+")],
                [cell("$5M ARR across multiple verticals"), cell("$25M-$50M+")],
            ],
            [3.7 * inch, 2.0 * inch],
            font_size=7.5,
        )
    )

    story.append(p("Reference Notes", "Section"))
    for bullet in [
        "Local product evidence: README.md, docs/pilot-sku.md, docs/release-readiness.md, docs/post-pilot-checklist-backlog.md, lib/platformPricing.ts, lib/companySeats.ts.",
        "Private SaaS multiple context: iMerge Advisors, SaaS Valuation Multiples Q1 2026.",
        "Public SaaS multiple context: SaaS Capital Index and public SaaS EV/revenue benchmarks.",
        "Construction software market context: construction management software market reports and vertical SaaS comparables.",
    ]:
        story.append(p(f"- {bullet}", "Small"))

    return story


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=0.55 * inch,
        bottomMargin=0.55 * inch,
        title="Safety360Docs Platform Valuation + Pricing Model",
        author="Safety360Docs",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])
    doc.build(build_story())
    print(OUT)


if __name__ == "__main__":
    main()
