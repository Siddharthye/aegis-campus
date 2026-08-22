"""The triage rule cascade.

Deliberately a cascade rather than a weighted score. In a medical context the
single worst finding has to decide the outcome — a person who is not breathing
is P0 regardless of how many other answers look reassuring, and averaging
findings together would let mild answers dilute a fatal one.

Every rule returns the reason it fired, so the result is always explainable and
a clinician can see exactly what drove it.
"""
from .schemas import MedicalReportIn, Reason

# How quickly someone should be *reached*. Not a clinical prognosis.
REACH_TARGET = {"P0": 180, "P1": 480, "P2": 1200, "P3": 3600}

# How this maps onto a host platform's 1-100 severity, in one place so a
# different host can change it without touching the protocol.
SEVERITY_MAP = {"P0": 95, "P1": 78, "P2": 55, "P3": 30}

RANK = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}


def _worse(a: str, b: str) -> str:
    return a if RANK[a] <= RANK[b] else b


# Findings that are immediately life-threatening on their own.
P0_FINDINGS = {
    "drowning": "drowning or near-drowning",
    "electrocution": "electrical injury",
    "allergic_reaction": "possible severe allergic reaction",
}
P1_FINDINGS = {
    "chest_pain": "chest pain",
    "stroke_signs": "possible stroke signs",
    "seizure": "seizure",
    "head_injury": "head injury",
    "overdose_suspected": "suspected overdose or poisoning",
    "pregnancy_related": "pregnancy-related emergency",
    "diabetic_episode": "diabetic episode",
}
P2_FINDINGS = {
    "burn": "burn",
    "fracture": "possible fracture",
    "heat_exhaustion": "heat exhaustion",
}


def triage(r: MedicalReportIn) -> tuple[str, list[Reason]]:
    priority = "P3"
    reasons: list[Reason] = []

    def bump(p: str, code: str, detail: str, forced: bool = False):
        nonlocal priority
        priority = _worse(priority, p)
        reasons.append(Reason(code=code, detail=detail, forced=forced))

    # ---- absolute red flags -------------------------------------------------
    if r.breathing in ("absent", "gasping"):
        bump("P0", "breathing_absent",
             "Not breathing normally — this alone sets P0", forced=True)
    if r.responsive is False:
        bump("P0", "unresponsive",
             "Unresponsive — this alone sets P0", forced=True)
    if r.bleeding == "severe":
        bump("P0", "severe_bleeding",
             "Severe bleeding — this alone sets P0", forced=True)
    for f in r.findings:
        if f in P0_FINDINGS:
            bump("P0", f, f"{P0_FINDINGS[f]} — this alone sets P0", forced=True)

    # ---- serious, time-critical --------------------------------------------
    if r.breathing == "difficult":
        bump("P1", "breathing_difficult", "Difficulty breathing")
    for f in r.findings:
        if f in P1_FINDINGS:
            bump("P1", f, P1_FINDINGS[f])

    # ---- urgent but stable --------------------------------------------------
    for f in r.findings:
        if f in P2_FINDINGS:
            bump("P2", f, P2_FINDINGS[f])
    if r.bleeding == "minor":
        bump("P2", "minor_bleeding", "Bleeding, described as minor")

    # ---- modifiers ----------------------------------------------------------
    # Unknowns are treated as risk, never as reassurance. Someone who cannot
    # tell whether the person is breathing is describing a worse situation than
    # someone who can confirm they are.
    if r.responsive is None and r.breathing == "unknown" and priority == "P3":
        bump("P2", "unknown_state",
             "Reporter cannot confirm responsiveness or breathing — treated as urgent")

    if r.people_affected >= 3 and RANK[priority] > RANK["P1"]:
        bump("P1", "multiple_casualties",
             f"{r.people_affected} people affected — needs more than one responder")

    if r.age_group in ("child", "older_adult") and RANK[priority] > RANK["P1"]:
        bump("P1", "vulnerable_age",
             f"Patient is a {r.age_group.replace('_', ' ')} — escalated one level")

    if "fainted_now_recovered" in r.findings and priority == "P3":
        bump("P2", "fainted", "Fainted but has recovered — still needs assessment")

    if not reasons:
        reasons.append(Reason(code="no_red_flags",
                              detail="No red flags reported — routine response"))
    return priority, reasons


def required_skills(priority: str, r: MedicalReportIn) -> list[str]:
    skills = ["first_aid"]
    if priority == "P0":
        skills.append("aed_trained")
    if r.people_affected >= 3:
        skills.append("incident_command")
    return skills
