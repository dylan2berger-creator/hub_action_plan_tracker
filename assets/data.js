/* ============================================================
   The Hub — Action Plans mock dataset
   Boyd Group / Gerber Collision challenged-store remediation.
   Synthetic data. Metrics are referenced BY NAME ONLY — no KPI
   values, targets, scores, or dollar figures anywhere.
   "As of" reference date drives all aging/overdue logic.
   ============================================================ */
window.HUB_DATA = {
  referenceDate: "2026-08-10",

  personas: ["Market Manager (CPM)", "RDO", "Shop GM", "National Account Manager", "RVP", "Sales"],

  rootCauses: [
    { key: "drp-scorecard",     label: "DRP Scorecard",        dot: "#00529b", bg: "#dbe8f5", fg: "#0b3d6b" },
    { key: "drp-participation", label: "DRP Participation",     dot: "#2b7a8e", bg: "#d5e9ec", fg: "#0f3a44" },
    { key: "personnel",         label: "Personnel / Skill Mix",dot: "#c1660f", bg: "#f6e3cf", fg: "#6b3f10" },
    { key: "equipment",         label: "Equipment",            dot: "#ba1a1a", bg: "#f6dcdc", fg: "#5b1414" },
    { key: "revenue-leakage",   label: "Revenue Leakage",      dot: "#36832f", bg: "#dcecdc", fg: "#1e4620" },
    { key: "market-demand",     label: "Market Demand",        dot: "#6a4c93", bg: "#e6e1f0", fg: "#3a2d5a" }
  ],

  stores: [
    { id: "s1",  name: "Naperville, IL",        cbsa: "Chicago–Naperville CBSA" },
    { id: "s2",  name: "Aurora, IL",            cbsa: "Chicago–Naperville CBSA" },
    { id: "s3",  name: "Joliet, IL",            cbsa: "Chicago–Naperville CBSA" },
    { id: "s4",  name: "Schaumburg–Woodfield, IL", cbsa: "Chicago–Naperville CBSA" },
    { id: "s5",  name: "Elmhurst, IL",          cbsa: "Chicago–Naperville CBSA" },
    { id: "s6",  name: "Hammond, IN",           cbsa: "Chicago–Naperville CBSA" },
    { id: "s7",  name: "Munster, IN",           cbsa: "Chicago–Naperville CBSA" },
    { id: "s8",  name: "Oak Forest, IL",        cbsa: "Chicago–Naperville CBSA" },
    { id: "s9",  name: "Gambrills, MD",         cbsa: "Baltimore–Columbia CBSA" },
    { id: "s10", name: "Schererville, IN",      cbsa: "Chicago–Naperville CBSA" },
    { id: "s11", name: "Grand Rapids, MI",      cbsa: "Grand Rapids–Kentwood CBSA" },
    { id: "s12", name: "Brandon, FL",           cbsa: "Tampa–St. Petersburg CBSA" },
    { id: "s13", name: "Mesa, AZ",              cbsa: "Phoenix–Mesa CBSA" },
    { id: "s14", name: "Orland Park, IL",       cbsa: "Chicago–Naperville CBSA" }
  ],

  /* Default the board to the flagship cross-link store (Aurora). */
  defaultStoreId: "s2",

  plans: [
    /* ===================== AURORA (s2) — cross-link cluster =====================
       One upstream equipment failure (AP-201) shows up as four separate
       symptoms on the scorecard and capture. parentPlanId ties them together. */
    {
      id: "AP-201", storeId: "s2", rootCauseCategory: "equipment",
      owningPersona: "RDO", openedDate: "2026-06-20", targetCloseDate: "2026-09-15",
      diagnosis: "Downdraft booth #2 compressor failed; the shop is curing on a single booth. Every refinish job now queues behind one booth — this is the upstream constraint driving the store's cycle time, CSI, and capture misses. Fix the booth, most of the rest follows.",
      tasks: [
        { id: "AP-201-t1", title: "Submit capex for booth #2 compressor replacement", description: "Package quotes for a like-for-like compressor swap and expedited install; route through regional finance for emergency capex.",
          ownerName: "Vince Russo", ownerRole: "Facilities / Capex", column: "blocked", createdDate: "2026-06-21", dueDate: "2026-08-14", priority: "urgent",
          risk: "Emergency capex competes with other markets; monthly committee cadence adds delay.",
          blockedReason: "Awaiting capex approval — regional finance committee meets monthly; next review Aug 18.",
          verificationSignal: { metric: "Refinish Cycle Time", lagDays: 30 },
          activityLog: [
            { date: "2026-06-21", note: "Two vendor quotes attached; expedited install requested." },
            { date: "2026-07-19", note: "Committee deferred to August cycle pending a third quote." },
            { date: "2026-08-05", note: "Third quote in; RDO escalated as shop-stopping to move it up." }
          ] },
        { id: "AP-201-t2", title: "Stand up interim sublet refinish with vetted partner", description: "Route overflow refinish to a qualified sublet paint partner to keep WIP moving while booth #2 is down.",
          ownerName: "Renee Fontaine", ownerRole: "Shop GM", column: "inprogress", createdDate: "2026-06-22", dueDate: "2026-08-12", priority: "high",
          risk: "Sublet quality variance and added transport days can hurt CSI further.",
          verificationSignal: { metric: "Refinish Cycle Time", lagDays: 30 },
          activityLog: [
            { date: "2026-06-24", note: "Partner shop vetted; sublet handling process drafted." },
            { date: "2026-07-30", note: "Two batches routed weekly; transport is adding a day each way." }
          ] },
        { id: "AP-201-t3", title: "Triage WIP and re-sequence promise dates on the single booth", description: "Reflow the paint schedule around one booth and reset customer promise dates so the constraint is managed, not hidden.",
          ownerName: "Renee Fontaine", ownerRole: "Shop GM", column: "closed", createdDate: "2026-06-21", dueDate: "2026-06-28", priority: "high",
          risk: "Re-sequencing helps flow but cannot add booth capacity — a stopgap only.",
          verificationSignal: { metric: "Cycle Time (keys-to-keys)", lagDays: 30 }, outcome: "Superseded",
          activityLog: [
            { date: "2026-06-23", note: "Paint schedule rebuilt around one booth; promise dates reset with CSRs." },
            { date: "2026-07-02", note: "Superseded by sublet arrangement (AP-201-t2) as WIP kept climbing." }
          ] }
      ]
    },
    {
      id: "AP-202", storeId: "s2", rootCauseCategory: "drp-scorecard", parentPlanId: "AP-201",
      carrier: "State Farm", owningPersona: "Market Manager (CPM)", openedDate: "2026-06-25", targetCloseDate: "2026-09-30",
      diagnosis: "Keys-to-keys cycle time is out of tolerance on the State Farm Select Service scorecard. The cause is the booth outage (AP-201), not process — documenting the linkage so the carrier sees remediation in flight instead of a process failure.",
      tasks: [
        { id: "AP-202-t1", title: "Meet State Farm field rep to review scorecard metrics", description: "Walk the rep through the booth root cause and the remediation timeline so the cycle-time miss is understood in context.",
          ownerName: "Marcus Delgado", ownerRole: "Market Manager (CPM)", column: "inprogress", createdDate: "2026-06-26", dueDate: "2026-08-15", priority: "high",
          risk: "Rep may still hold the store to program tolerance regardless of cause.",
          verificationSignal: { metric: "Cycle Time (keys-to-keys)", lagDays: 60 },
          activityLog: [
            { date: "2026-06-30", note: "Intro call held; rep asked for a written remediation timeline." },
            { date: "2026-07-28", note: "On-site review scheduled; booth quotes and sublet plan shared ahead." }
          ] },
        { id: "AP-202-t2", title: "Request temporary scorecard annotation for booth outage", description: "Ask State Farm to annotate the cycle-time metric for the outage window so the store is not routed down while the fix lands.",
          ownerName: "Jamal Carter", ownerRole: "National Account Manager", column: "closed", createdDate: "2026-06-27", dueDate: "2026-07-20", priority: "medium",
          risk: "Annotations are discretionary; not all regions grant them.",
          verificationSignal: { metric: "DRP Assignment Volume", lagDays: 30 }, outcome: "Improved",
          activityLog: [
            { date: "2026-07-01", note: "Annotation requested via national account channel with root-cause memo." },
            { date: "2026-07-18", note: "Granted for the outage window; routing hold lifted." }
          ] },
        { id: "AP-202-t3", title: "Re-baseline WIP and confirm cycle-time reporting once booth returns", description: "After the booth is restored, verify the cycle-time metric on the scorecard reflects the recovered flow.",
          ownerName: "Marcus Delgado", ownerRole: "Market Manager (CPM)", column: "verifying", createdDate: "2026-07-02", dueDate: "2026-09-20", priority: "medium",
          risk: "Signal lags the fix by weeks; premature reads will look flat.",
          verificationSignal: { metric: "Cycle Time (keys-to-keys)", lagDays: 60 },
          activityLog: [
            { date: "2026-07-05", note: "Reporting cadence set to monthly scorecard pull." },
            { date: "2026-08-04", note: "Holding for booth restoration before reading the trend." }
          ] }
      ]
    },
    {
      id: "AP-203", storeId: "s2", rootCauseCategory: "drp-scorecard", parentPlanId: "AP-201",
      carrier: "State Farm", owningPersona: "Shop GM", openedDate: "2026-06-26", targetCloseDate: "2026-09-30",
      diagnosis: "CSI survey score is sliding as booth delays push promise dates. Same upstream cause as AP-201 — protect the customer experience with proactive communication until the constraint clears.",
      tasks: [
        { id: "AP-203-t1", title: "Roll out proactive delay-communication script for CSRs", description: "Give front office a script to call customers ahead of any revised promise date so delays don't surface as surprises on the survey.",
          ownerName: "Megan O'Rourke", ownerRole: "CSR", column: "inprogress", createdDate: "2026-06-28", dueDate: "2026-08-13", priority: "high",
          risk: "Script adoption slips when the front counter is slammed.",
          verificationSignal: { metric: "CSI Survey Score", lagDays: 45 },
          activityLog: [
            { date: "2026-06-30", note: "Script drafted and reviewed with the two CSRs." },
            { date: "2026-07-25", note: "Daily call list started for jobs with reset promise dates." }
          ] },
        { id: "AP-203-t2", title: "Call open customers with revised, realistic promise dates", description: "Work the active WIP list and reset expectations honestly rather than rolling dates silently.",
          ownerName: "Megan O'Rourke", ownerRole: "CSR", column: "inprogress", createdDate: "2026-06-29", dueDate: "2026-08-16", priority: "medium",
          risk: "Repeated resets on the same job still frustrate customers.",
          verificationSignal: { metric: "CSI Survey Score", lagDays: 45 },
          activityLog: [
            { date: "2026-07-02", note: "First pass of calls completed on aged WIP." },
            { date: "2026-08-01", note: "Second pass underway as sublet transport shifts a few dates again." }
          ] },
        { id: "AP-203-t3", title: "Monitor survey verbatims for delay-related themes", description: "Track the open-text survey comments for promise-date and communication themes to confirm the script is landing.",
          ownerName: "Renee Fontaine", ownerRole: "Shop GM", column: "verifying", createdDate: "2026-07-06", dueDate: "2026-09-15", priority: "low",
          risk: "Verbatim volume is thin week to week; trend needs weeks to read.",
          verificationSignal: { metric: "CSI Survey Score", lagDays: 45 },
          activityLog: [
            { date: "2026-07-08", note: "Verbatim review added to the weekly GM huddle." },
            { date: "2026-08-03", note: "Early comments shifting from 'no updates' toward 'kept informed'." }
          ] }
      ]
    },
    {
      id: "AP-204", storeId: "s2", rootCauseCategory: "revenue-leakage", parentPlanId: "AP-201",
      owningPersona: "RDO", openedDate: "2026-06-27", targetCloseDate: "2026-09-30",
      diagnosis: "Sublet refinish is eroding capture — in-house refinish labor and blend operations aren't being written on the sublet ROs. The booth outage is upstream, but the leakage is fixable now with estimating discipline.",
      tasks: [
        { id: "AP-204-t1", title: "Audit sublet ROs for missed blend and clearcoat operations", description: "Review recent sublet paint ROs against the estimate to catch blend, clear, and cavity-wax operations that weren't captured.",
          ownerName: "Tyler Brooks", ownerRole: "Estimator", column: "inprogress", createdDate: "2026-06-29", dueDate: "2026-08-18", priority: "medium",
          risk: "Sublet paperwork lags, so audits trail the work by days.",
          verificationSignal: { metric: "Labor Hours per RO", lagDays: 30 },
          activityLog: [
            { date: "2026-07-01", note: "Pulled the first batch of sublet ROs for line-by-line review." },
            { date: "2026-07-29", note: "Found blend and corrosion ops routinely omitted on sublet files." }
          ] },
        { id: "AP-204-t2", title: "Add a sublet-handling labor line to the estimating template", description: "Standardize a handling/administration line so sublet coordination time is captured rather than absorbed.",
          ownerName: "Tyler Brooks", ownerRole: "Estimator", column: "identified", createdDate: "2026-07-03", dueDate: "2026-08-22", priority: "low",
          risk: "Must stay within carrier rules on allowable sublet handling.",
          verificationSignal: { metric: "Labor Hours per RO", lagDays: 30 },
          activityLog: [
            { date: "2026-07-03", note: "Template change drafted; checking rules adherence before rollout." }
          ] },
        { id: "AP-204-t3", title: "Coach estimators on refinish operations on sublet files", description: "Short working session on writing complete refinish operations even when paint is sublet out.",
          ownerName: "Rob Mancini", ownerRole: "Regional Fixed Ops", column: "identified", createdDate: "2026-07-10", dueDate: "2026-08-26", priority: "low",
          risk: "Coaching sticks only if reinforced in file reviews.",
          verificationSignal: { metric: "Estimate Accuracy", lagDays: 45 },
          activityLog: [
            { date: "2026-07-10", note: "Flagged for coaching after the sublet audit findings." }
          ] }
      ]
    },
    {
      id: "AP-205", storeId: "s2", rootCauseCategory: "personnel", parentPlanId: "AP-201",
      owningPersona: "Shop GM", openedDate: "2026-06-28", targetCloseDate: "2026-10-15",
      diagnosis: "One painter can't clear the queue on a single booth, and even when booth #2 returns the refinish department is thin. Department-level capacity gap surfaced by the outage — needs a second painter, not just overtime.",
      tasks: [
        { id: "AP-205-t1", title: "Approve painter overtime as an interim capacity stopgap", description: "Authorize scheduled overtime for the current painter to hold the line while the booth and staffing are resolved.",
          ownerName: "Renee Fontaine", ownerRole: "Shop GM", column: "inprogress", createdDate: "2026-06-29", dueDate: "2026-08-11", priority: "medium",
          risk: "Overtime burns out the one painter and isn't sustainable.",
          verificationSignal: { metric: "Refinish Cycle Time", lagDays: 30 },
          activityLog: [
            { date: "2026-06-30", note: "OT approved through the outage window." },
            { date: "2026-07-27", note: "Painter flagging fatigue; pushing to add a body." }
          ] },
        { id: "AP-205-t2", title: "Contract a temporary painter through staffing partner", description: "Bring in a temp painter to add booth throughput while a permanent hire is worked.",
          ownerName: "Bianca Torres", ownerRole: "HR Recruiter", column: "blocked", createdDate: "2026-07-01", dueDate: "2026-08-20", priority: "high",
          risk: "Qualified temp painters are scarce in this market.",
          blockedReason: "No qualified temp painters available through the staffing agency; only unvetted candidates offered.",
          verificationSignal: { metric: "Refinish Cycle Time", lagDays: 30 },
          activityLog: [
            { date: "2026-07-06", note: "Requisition opened with staffing partner." },
            { date: "2026-07-31", note: "Agency came back empty on vetted painters; widening radius." }
          ] },
        { id: "AP-205-t3", title: "Cross-train a prep tech toward booth operation", description: "Begin cross-training a prepper to run the booth for simpler jobs and relieve the painter.",
          ownerName: "Alicia Moreno", ownerRole: "Refinish Technician", column: "identified", createdDate: "2026-07-08", dueDate: "2026-09-01", priority: "low",
          risk: "Cross-training pulls the prepper off the line short term.",
          verificationSignal: { metric: "Refinish Cycle Time", lagDays: 30 },
          activityLog: [
            { date: "2026-07-08", note: "Candidate identified; plan to start once OT pressure eases." }
          ] }
      ]
    },

    /* ===================== NAPERVILLE (s1) ===================== */
    {
      id: "AP-101", storeId: "s1", rootCauseCategory: "drp-participation",
      carrier: "Allstate", owningPersona: "National Account Manager", openedDate: "2026-03-05", targetCloseDate: "2026-10-01",
      diagnosis: "Store is I-CAR Gold and has open capacity but simply isn't on Allstate's Good Hands Repair Network in this CBSA — a competitor holds the slot. This is a 'not on the program at all' participation gap, pursued through the national account channel.",
      tasks: [
        { id: "AP-101-t1", title: "Petition Allstate to add the store to the CBSA repair network", description: "Formally request network addition for this CBSA through the Allstate national account contact.",
          ownerName: "Jamal Carter", ownerRole: "National Account Manager", column: "blocked", createdDate: "2026-03-06", dueDate: "2026-08-25", priority: "medium",
          risk: "Carrier network is capacity-managed; add may wait for an open slot.",
          blockedReason: "Allstate holding CBSA additions until their next network capacity review.",
          verificationSignal: { metric: "DRP Assignment Volume", lagDays: 90 },
          activityLog: [
            { date: "2026-03-12", note: "Formal add request submitted with store profile." },
            { date: "2026-06-15", note: "Carrier acknowledged; queued for capacity review, no date." }
          ] },
        { id: "AP-101-t2", title: "Compile store capability packet for the carrier", description: "Assemble certifications, equipment list, capacity, and CBSA coverage into a packet supporting the add request.",
          ownerName: "Dan Kowalski", ownerRole: "Shop GM", column: "identified", createdDate: "2026-03-08", dueDate: "2026-08-20", priority: "low",
          risk: "Packet goes stale if the review slips further.",
          verificationSignal: { metric: "DRP Assignment Volume", lagDays: 90 },
          activityLog: [
            { date: "2026-03-15", note: "Certifications and equipment list gathered." }
          ] },
        { id: "AP-101-t3", title: "Prepare RVP escalation letter for network review", description: "Draft an RVP-level letter reinforcing the business case for the CBSA add ahead of the carrier's capacity review.",
          ownerName: "Lauren Petrakis", ownerRole: "RVP", column: "identified", createdDate: "2026-06-18", dueDate: "2026-09-05", priority: "low",
          risk: "Escalation is only useful timed to the carrier's review window.",
          verificationSignal: { metric: "DRP Assignment Volume", lagDays: 90 },
          activityLog: [
            { date: "2026-06-18", note: "Flagged to RVP to hold ready for the review window." }
          ] }
      ]
    },

    /* ===================== JOLIET (s3) — second cross-link (personnel → scorecard) ===================== */
    {
      id: "AP-104", storeId: "s3", rootCauseCategory: "personnel",
      owningPersona: "Shop GM", openedDate: "2026-02-18", targetCloseDate: "2026-09-01",
      diagnosis: "Lead estimator left in February and a junior is writing complex files solo. Estimate accuracy and supplement frequency are both slipping — this is a skill-mix gap, not a headcount number. Upstream of the Progressive scorecard miss (AP-103).",
      tasks: [
        { id: "AP-104-t1", title: "Pair junior estimator with a regional estimating trainer", description: "Set a standing weekly file-review with a regional trainer to raise blueprint completeness on complex jobs.",
          ownerName: "Rob Mancini", ownerRole: "Regional Fixed Ops", column: "inprogress", createdDate: "2026-02-20", dueDate: "2026-08-15", priority: "high",
          risk: "Trainer covers multiple markets; cadence can slip.",
          verificationSignal: { metric: "Estimate Accuracy", lagDays: 60 },
          activityLog: [
            { date: "2026-02-25", note: "Weekly file review started with regional trainer." },
            { date: "2026-07-22", note: "Complex-file completeness improving; supplements still lumpy." }
          ] },
        { id: "AP-104-t2", title: "Recruit an experienced estimator for the store", description: "Open and work a requisition for a seasoned estimator to restore the department's skill mix.",
          ownerName: "Bianca Torres", ownerRole: "HR Recruiter", column: "blocked", createdDate: "2026-02-22", dueDate: "2026-08-10", priority: "high",
          risk: "Experienced estimators are scarce and comp expectations run high.",
          blockedReason: "Two candidates declined offers; compensation band under review with HR before re-posting.",
          verificationSignal: { metric: "Estimate Accuracy", lagDays: 60 },
          activityLog: [
            { date: "2026-03-01", note: "Requisition posted; first candidates screened." },
            { date: "2026-05-30", note: "Second candidate declined on comp; band escalated to HR." }
          ] },
        { id: "AP-104-t3", title: "Interim RDO file review on high-severity jobs", description: "Have the RDO spot-review high-severity estimates until the department is back to strength.",
          ownerName: "Priya Nair", ownerRole: "RDO", column: "inprogress", createdDate: "2026-03-04", dueDate: "2026-08-30", priority: "medium",
          risk: "RDO bandwidth is limited across the region.",
          verificationSignal: { metric: "Supplement Frequency", lagDays: 45 },
          activityLog: [
            { date: "2026-03-06", note: "High-severity files flagged for RDO review before finalizing." },
            { date: "2026-07-18", note: "Catching missed operations before they become supplements." }
          ] }
      ]
    },
    {
      id: "AP-103", storeId: "s3", rootCauseCategory: "drp-scorecard", parentPlanId: "AP-104",
      carrier: "Progressive", owningPersona: "Market Manager (CPM)", openedDate: "2026-05-20", targetCloseDate: "2026-09-15",
      diagnosis: "Supplement frequency is high on the Progressive scorecard because initial estimates are incomplete — the same estimating skill-mix gap as AP-104. Blueprinting discipline should pull it back.",
      tasks: [
        { id: "AP-103-t1", title: "Stand up full-teardown blueprinting SOP", description: "Require complete disassembly and blueprint before the estimate is finalized on all but the lightest hits.",
          ownerName: "Doug Ferreira", ownerRole: "Shop GM", column: "identified", createdDate: "2026-05-22", dueDate: "2026-08-19", priority: "high",
          risk: "Teardown adds a step that can pressure cycle time if not staffed.",
          verificationSignal: { metric: "Supplement Frequency", lagDays: 45 },
          activityLog: [
            { date: "2026-05-24", note: "SOP drafted; teardown bay and photo standard defined." }
          ] },
        { id: "AP-103-t2", title: "Calibrate estimators to Progressive estimating guidelines", description: "Working session aligning line-item practice to Progressive's guidelines to reduce downstream supplements.",
          ownerName: "Sofia Marquez", ownerRole: "Estimator", column: "inprogress", createdDate: "2026-05-25", dueDate: "2026-08-16", priority: "medium",
          risk: "Guideline nuances vary by adjuster; consistency takes reps.",
          verificationSignal: { metric: "Supplement Frequency", lagDays: 45 },
          activityLog: [
            { date: "2026-05-28", note: "First calibration session held using recent Progressive files." },
            { date: "2026-07-20", note: "Second pass scheduled focusing on structural line items." }
          ] },
        { id: "AP-103-t3", title: "Add a pre-supplement QC gate before parts ordering", description: "Insert a quick QC check to catch missed operations before supplements are filed and parts are ordered.",
          ownerName: "Sofia Marquez", ownerRole: "Estimator", column: "identified", createdDate: "2026-06-05", dueDate: "2026-08-28", priority: "low",
          risk: "Adds a checkpoint that must not become a bottleneck.",
          verificationSignal: { metric: "Supplement Frequency", lagDays: 45 },
          activityLog: [
            { date: "2026-06-05", note: "Proposed as part of the blueprinting rollout." }
          ] }
      ]
    },

    /* ===================== SCHAUMBURG–WOODFIELD (s4) ===================== */
    {
      id: "AP-105", storeId: "s4", rootCauseCategory: "drp-scorecard",
      carrier: "USAA", owningPersona: "RDO", openedDate: "2026-04-15", targetCloseDate: "2026-08-31",
      diagnosis: "Severity & Cost Performance is out of tolerance on the USAA scorecard — the store is writing heavier than peers on comparable damage. Calibration to USAA severity guidance, not process failure.",
      tasks: [
        { id: "AP-105-t1", title: "RDO file review of high-severity USAA repair orders", description: "Sample recent high-severity USAA files to find where severity is running above peer norms.",
          ownerName: "Priya Nair", ownerRole: "RDO", column: "identified", createdDate: "2026-04-17", dueDate: "2026-08-18", priority: "medium",
          risk: "Small file sample can mislead; needs enough volume to be fair.",
          verificationSignal: { metric: "Severity & Cost Performance", lagDays: 60 },
          activityLog: [
            { date: "2026-04-20", note: "Sample of high-severity files pulled for review." }
          ] },
        { id: "AP-105-t2", title: "Calibrate estimators to USAA severity guidance", description: "Align estimating decisions on repair-vs-replace and included operations to USAA guidance.",
          ownerName: "Yusuf Rahman", ownerRole: "Estimator", column: "verifying", createdDate: "2026-04-22", dueDate: "2026-09-05", priority: "medium",
          risk: "Over-correcting swings the store into estimate-accuracy problems.",
          verificationSignal: { metric: "Severity & Cost Performance", lagDays: 60 },
          activityLog: [
            { date: "2026-04-25", note: "Calibration session completed; repair-vs-replace examples reviewed." },
            { date: "2026-07-15", note: "Practice adjusted; now watching the scorecard for movement." }
          ] },
        { id: "AP-105-t3", title: "Monitor Severity & Cost Performance for movement", description: "Track the USAA scorecard metric monthly to confirm the calibration moved the number without hurting accuracy.",
          ownerName: "Priya Nair", ownerRole: "RDO", column: "verifying", createdDate: "2026-05-02", dueDate: "2026-09-10", priority: "low",
          risk: "Signal lags; a flat early read doesn't mean failure.",
          verificationSignal: { metric: "Severity & Cost Performance", lagDays: 60 },
          activityLog: [
            { date: "2026-05-05", note: "Monthly scorecard pull scheduled." },
            { date: "2026-08-02", note: "First post-calibration read pending the next scorecard." }
          ] }
      ]
    },

    /* ===================== ELMHURST (s5) — under-equipped (not broken) ===================== */
    {
      id: "AP-107", storeId: "s5", rootCauseCategory: "equipment",
      owningPersona: "RDO", openedDate: "2026-05-28", targetCloseDate: "2026-11-01",
      diagnosis: "Nothing is broken here — the store simply isn't equipped for in-house ADAS calibration and sublets every one. That adds days to cycle time and gives away the calibration labor. This is a capability gap, not a repair.",
      tasks: [
        { id: "AP-107-t1", title: "Build the business case for an in-house ADAS calibration rig", description: "Model in-house calibration versus sublet on cycle time and captured labor to support a capex request.",
          ownerName: "Elaine Cho", ownerRole: "Market Manager (CPM)", column: "identified", createdDate: "2026-05-29", dueDate: "2026-08-22", priority: "medium",
          risk: "Case must account for training and floor space, not just the rig.",
          verificationSignal: { metric: "Cycle Time (keys-to-keys)", lagDays: 60 },
          activityLog: [
            { date: "2026-05-30", note: "Started tallying subletted calibrations and added days per RO." }
          ] },
        { id: "AP-107-t2", title: "Submit capex for calibration rig and technician training", description: "Package the rig, targets, and I-CAR/OEM calibration training into a single capex request.",
          ownerName: "Vince Russo", ownerRole: "Facilities / Capex", column: "blocked", createdDate: "2026-06-05", dueDate: "2026-08-29", priority: "medium",
          risk: "Capability capex ranks below shop-stopping repairs for funding.",
          blockedReason: "Capex request pending RVP sign-off; queued behind shop-stopping equipment requests in-region.",
          verificationSignal: { metric: "Cycle Time (keys-to-keys)", lagDays: 60 },
          activityLog: [
            { date: "2026-06-08", note: "Capex drafted with rig quote and training plan." },
            { date: "2026-07-24", note: "RVP asked to prioritize against Gambrills frame capex first." }
          ] },
        { id: "AP-107-t3", title: "Evaluate in-house rig versus a mobile calibration vendor", description: "Compare owning a rig against a scheduled mobile-calibration vendor as a lower-capex bridge.",
          ownerName: "Elaine Cho", ownerRole: "Market Manager (CPM)", column: "identified", createdDate: "2026-06-12", dueDate: "2026-09-02", priority: "low",
          risk: "Mobile vendors still add scheduling days versus in-house.",
          verificationSignal: { metric: "Cycle Time (keys-to-keys)", lagDays: 60 },
          activityLog: [
            { date: "2026-06-12", note: "Two mobile vendors identified for a bridge comparison." }
          ] }
      ]
    },

    /* ===================== HAMMOND (s6) — on program, no assignments ===================== */
    {
      id: "AP-108", storeId: "s6", rootCauseCategory: "drp-participation",
      carrier: "GEICO", owningPersona: "Market Manager (CPM)", openedDate: "2026-06-02", targetCloseDate: "2026-08-05",
      diagnosis: "The store is on GEICO ARX but assignment volume dried up. The portal capacity flag is stuck at 'full' and aged open files are suppressing routing — an administrative participation problem, not a capacity one.",
      tasks: [
        { id: "AP-108-t1", title: "Correct the stuck capacity flag in the GEICO portal", description: "Reset the portal availability flag so the store shows open for routing.",
          ownerName: "Theo Nakamura", ownerRole: "Shop GM", column: "inprogress", createdDate: "2026-06-03", dueDate: "2026-08-12", priority: "urgent",
          risk: "Flag can revert if aged files aren't also cleared.",
          verificationSignal: { metric: "DRP Assignment Volume", lagDays: 30 },
          activityLog: [
            { date: "2026-06-04", note: "Found availability flag stuck at full in the portal." },
            { date: "2026-06-05", note: "Reset submitted; confirming it holds after aged files close." }
          ] },
        { id: "AP-108-t2", title: "Close the aged open-file backlog in the portal", description: "Work the aged open-file list to completion so routing logic stops deprioritizing the store.",
          ownerName: "Megan O'Rourke", ownerRole: "CSR", column: "inprogress", createdDate: "2026-06-04", dueDate: "2026-07-31", priority: "urgent",
          risk: "Some aged files are stalled on total-loss paperwork outside the store.",
          verificationSignal: { metric: "Aged Open File Count", lagDays: 15 },
          activityLog: [
            { date: "2026-06-06", note: "Aged-file list pulled; split into closeable vs total-loss-blocked." },
            { date: "2026-07-28", note: "Closeable files worked down; a handful stuck on total-loss docs." }
          ] },
        { id: "AP-108-t3", title: "Confirm routing restored with GEICO rep", description: "Verify with the GEICO rep that assignments resume once the flag and aged files are cleared.",
          ownerName: "Marcus Delgado", ownerRole: "Market Manager (CPM)", column: "verifying", createdDate: "2026-06-10", dueDate: "2026-08-20", priority: "medium",
          risk: "Routing can take a cycle to normalize after cleanup.",
          verificationSignal: { metric: "DRP Assignment Volume", lagDays: 30 },
          activityLog: [
            { date: "2026-06-12", note: "Rep confirmed cleanup is the blocker; will recheck routing after." },
            { date: "2026-08-01", note: "Awaiting a full routing cycle to confirm recovery." }
          ] }
      ]
    },

    /* ===================== MUNSTER (s7) — expired certification ===================== */
    {
      id: "AP-109", storeId: "s7", rootCauseCategory: "drp-participation",
      owningPersona: "Shop GM", openedDate: "2026-05-01", targetCloseDate: "2026-08-31",
      diagnosis: "The store dropped out of carrier routing when its I-CAR Gold Class certification lapsed. Recertification is the whole plan — restore the credential and notify carriers to reinstate routing.",
      tasks: [
        { id: "AP-109-t1", title: "Complete outstanding I-CAR role-based training hours", description: "Get body, refinish, and estimating roles back to current on required training hours for Gold Class.",
          ownerName: "Andre Whitfield", ownerRole: "Body Technician", column: "inprogress", createdDate: "2026-05-03", dueDate: "2026-08-05", priority: "high",
          risk: "Techs on the floor struggle to find training time during backlog.",
          verificationSignal: { metric: "Certification Status", lagDays: 15 },
          activityLog: [
            { date: "2026-05-06", note: "Training gap by role identified; sessions scheduled after shifts." },
            { date: "2026-07-15", note: "Refinish role complete; body role short a few hours." }
          ] },
        { id: "AP-109-t2", title: "Submit Gold Class recertification package", description: "File the recertification once role hours are complete to restore the credential.",
          ownerName: "Theo Nakamura", ownerRole: "Shop GM", column: "identified", createdDate: "2026-05-05", dueDate: "2026-08-20", priority: "high",
          risk: "Submission blocked until the last role hours are logged.",
          verificationSignal: { metric: "Certification Status", lagDays: 15 },
          activityLog: [
            { date: "2026-05-08", note: "Package prepared; holding on final body-role hours." }
          ] },
        { id: "AP-109-t3", title: "Notify carriers and OEM programs of reinstated status", description: "Once recertified, notify affected carriers and OEM programs to restore routing eligibility.",
          ownerName: "Jamal Carter", ownerRole: "National Account Manager", column: "identified", createdDate: "2026-05-12", dueDate: "2026-09-05", priority: "medium",
          risk: "Reinstatement in carrier systems can lag the credential by weeks.",
          verificationSignal: { metric: "DRP Assignment Volume", lagDays: 45 },
          activityLog: [
            { date: "2026-05-12", note: "Carrier and OEM contacts listed for the reinstatement notice." }
          ] }
      ]
    },

    /* ===================== OAK FOREST (s8) — turnover ===================== */
    {
      id: "AP-110", storeId: "s8", rootCauseCategory: "personnel",
      owningPersona: "Shop GM", openedDate: "2026-05-12", targetCloseDate: "2026-09-30",
      diagnosis: "Two body techs left within a month and WIP is aging as the remaining techs absorb the load. Capacity gap from turnover — stabilize the team and backfill, don't just push overtime.",
      tasks: [
        { id: "AP-110-t1", title: "Redistribute WIP and triage aging repair orders", description: "Rebalance jobs across remaining techs and prioritize the oldest WIP to stop files from aging further.",
          ownerName: "Doug Ferreira", ownerRole: "Shop GM", column: "inprogress", createdDate: "2026-05-13", dueDate: "2026-08-14", priority: "high",
          risk: "Load-balancing only stretches so far with fewer hands.",
          verificationSignal: { metric: "Cycle Time (keys-to-keys)", lagDays: 45 },
          activityLog: [
            { date: "2026-05-15", note: "Oldest WIP reassigned to senior techs; daily standup added." },
            { date: "2026-07-20", note: "Aging slowed but touch time still elevated." }
          ] },
        { id: "AP-110-t2", title: "Expedite recruiting for two body technicians", description: "Open and actively work requisitions to backfill the departed body techs.",
          ownerName: "Bianca Torres", ownerRole: "HR Recruiter", column: "blocked", createdDate: "2026-05-14", dueDate: "2026-08-18", priority: "high",
          risk: "Local body-tech market is tight; pipeline is thin.",
          blockedReason: "Requisitions open; local technician market tight, few qualified applicants in pipeline.",
          verificationSignal: { metric: "Cycle Time (keys-to-keys)", lagDays: 45 },
          activityLog: [
            { date: "2026-05-16", note: "Two requisitions posted; referral bonus promoted internally." },
            { date: "2026-07-10", note: "Handful of applicants, none qualified yet; expanding sourcing." }
          ] },
        { id: "AP-110-t3", title: "Hold retention conversations with remaining technicians", description: "Meet 1:1 with the remaining techs to protect against further attrition under the added load.",
          ownerName: "Doug Ferreira", ownerRole: "Shop GM", column: "identified", createdDate: "2026-05-20", dueDate: "2026-08-16", priority: "medium",
          risk: "Added workload itself is a flight risk if it drags on.",
          verificationSignal: { metric: "Cycle Time (keys-to-keys)", lagDays: 45 },
          activityLog: [
            { date: "2026-05-22", note: "1:1s scheduled; workload and OT concerns to be addressed." }
          ] }
      ]
    },

    /* ===================== GAMBRILLS (s9) — frame down (shop-stopping) ===================== */
    {
      id: "AP-111", storeId: "s9", rootCauseCategory: "equipment",
      owningPersona: "RDO", openedDate: "2026-06-10", targetCloseDate: "2026-09-10",
      diagnosis: "The frame bench hydraulics failed; all structural pulls are stalled or sublet. Shop-stopping for structural work — every measurable metric on those jobs is frozen until it's repaired or replaced.",
      tasks: [
        { id: "AP-111-t1", title: "Engage emergency repair vendor for the frame bench", description: "Get a service vendor on-site to repair the frame bench hydraulics as fast as possible.",
          ownerName: "Vince Russo", ownerRole: "Facilities / Capex", column: "blocked", createdDate: "2026-06-11", dueDate: "2026-08-01", priority: "urgent",
          risk: "Repair depends on a long-lead OEM part.",
          blockedReason: "Hydraulic ram backordered from the OEM; vendor quoting a 4–6 week ETA.",
          verificationSignal: { metric: "Cycle Time (keys-to-keys)", lagDays: 45 },
          activityLog: [
            { date: "2026-06-12", note: "Vendor diagnosed failed hydraulic ram; part on backorder." },
            { date: "2026-07-15", note: "Chasing a reman ram to beat the OEM lead time." }
          ] },
        { id: "AP-111-t2", title: "Submit capex for a replacement frame bench", description: "Prepare a capex option for a replacement bench in case the repair lead time is unacceptable.",
          ownerName: "Priya Nair", ownerRole: "RDO", column: "identified", createdDate: "2026-06-14", dueDate: "2026-08-22", priority: "high",
          risk: "Replacement is a large capex versus a cheaper repair.",
          verificationSignal: { metric: "Cycle Time (keys-to-keys)", lagDays: 45 },
          activityLog: [
            { date: "2026-06-16", note: "Replacement quote requested as a parallel path to the repair." }
          ] },
        { id: "AP-111-t3", title: "Route structural repairs to a sister store interim", description: "Sublet or transfer structural jobs to a nearby store to keep customers moving while the bench is down.",
          ownerName: "Renee Fontaine", ownerRole: "Shop GM", column: "inprogress", createdDate: "2026-06-13", dueDate: "2026-08-16", priority: "high",
          risk: "Transfers add tow and coordination days and split ownership.",
          verificationSignal: { metric: "Cycle Time (keys-to-keys)", lagDays: 45 },
          activityLog: [
            { date: "2026-06-15", note: "Sister store agreed to take structural overflow." },
            { date: "2026-07-30", note: "Handful of jobs transferred; coordinating tows weekly." }
          ] }
      ]
    },

    /* ===================== SCHERERVILLE (s10) ===================== */
    {
      id: "AP-112", storeId: "s10", rootCauseCategory: "drp-scorecard",
      carrier: "Liberty Mutual", owningPersona: "Market Manager (CPM)", openedDate: "2026-03-20", targetCloseDate: "2026-08-15",
      diagnosis: "Estimate accuracy is low against Liberty Mutual guidelines, driving rework and supplements. Calibration and a first-estimate QC gate should bring it back.",
      tasks: [
        { id: "AP-112-t1", title: "Calibrate estimators to Liberty Mutual guidelines", description: "Align estimating practice to Liberty's guidelines to lift first-estimate accuracy.",
          ownerName: "Sofia Marquez", ownerRole: "Estimator", column: "closed", createdDate: "2026-03-22", dueDate: "2026-05-15", priority: "high",
          risk: "Guideline drift returns without periodic reinforcement.",
          verificationSignal: { metric: "Estimate Accuracy", lagDays: 45 }, outcome: "Improved",
          activityLog: [
            { date: "2026-03-25", note: "Calibration completed against recent Liberty files." },
            { date: "2026-06-10", note: "First-estimate rework visibly down in file reviews." }
          ] },
        { id: "AP-112-t2", title: "Run a first-estimate QC review on complex files", description: "Add a quick second set of eyes on complex first estimates before they go out.",
          ownerName: "Elaine Cho", ownerRole: "Market Manager (CPM)", column: "verifying", createdDate: "2026-03-28", dueDate: "2026-08-22", priority: "medium",
          risk: "QC step can slow throughput if it's not lightweight.",
          verificationSignal: { metric: "Estimate Accuracy", lagDays: 45 },
          activityLog: [
            { date: "2026-04-01", note: "Lightweight QC checklist adopted for complex files." },
            { date: "2026-07-28", note: "Watching the scorecard to confirm accuracy holds." }
          ] },
        { id: "AP-112-t3", title: "Monitor Estimate Accuracy on the Liberty scorecard", description: "Track the metric to confirm the calibration and QC gate moved and held the number.",
          ownerName: "Elaine Cho", ownerRole: "Market Manager (CPM)", column: "verifying", createdDate: "2026-04-05", dueDate: "2026-08-25", priority: "low",
          risk: "Improvement can regress if calibration isn't refreshed.",
          verificationSignal: { metric: "Estimate Accuracy", lagDays: 45 },
          activityLog: [
            { date: "2026-04-08", note: "Monthly scorecard tracking in place." }
          ] }
      ]
    },
    {
      id: "AP-113", storeId: "s10", rootCauseCategory: "revenue-leakage",
      owningPersona: "Shop GM", openedDate: "2026-07-01", targetCloseDate: "2026-10-01",
      diagnosis: "The store has the volume but leaves money on every RO — included operations like corrosion protection, cavity wax, and feather-prime-block are routinely omitted from estimates. A rules-adherence and checklist fix.",
      tasks: [
        { id: "AP-113-t1", title: "Build an included-operations checklist into the estimating system", description: "Add a standard op checklist so included refinish and corrosion operations aren't skipped on the estimate.",
          ownerName: "Yusuf Rahman", ownerRole: "Estimator", column: "identified", createdDate: "2026-07-02", dueDate: "2026-08-24", priority: "medium",
          risk: "Checklist only helps if estimators actually work it every file.",
          verificationSignal: { metric: "Rules Adherence Score", lagDays: 30 },
          activityLog: [
            { date: "2026-07-03", note: "Draft op checklist assembled from carrier rule sets." }
          ] },
        { id: "AP-113-t2", title: "Audit a sample of ROs for omitted included operations", description: "Review a sample of closed ROs to quantify which included operations are being missed.",
          ownerName: "Doug Ferreira", ownerRole: "Shop GM", column: "identified", createdDate: "2026-07-05", dueDate: "2026-08-27", priority: "medium",
          risk: "Findings need to feed coaching or the leak continues.",
          verificationSignal: { metric: "Rules Adherence Score", lagDays: 30 },
          activityLog: [
            { date: "2026-07-06", note: "Sample of recent ROs selected for the omission audit." }
          ] },
        { id: "AP-113-t3", title: "Coach estimators on the missed included operations", description: "Targeted coaching on the specific operations the audit shows are being left off.",
          ownerName: "Rob Mancini", ownerRole: "Regional Fixed Ops", column: "identified", createdDate: "2026-07-12", dueDate: "2026-09-05", priority: "low",
          risk: "Without reinforcement in reviews, habits revert.",
          verificationSignal: { metric: "Rules Adherence Score", lagDays: 30 },
          activityLog: [
            { date: "2026-07-12", note: "Coaching queued to follow the RO audit results." }
          ] }
      ]
    },

    /* ===================== GRAND RAPIDS (s11) — market demand (no shop remedy) ===================== */
    {
      id: "AP-114", storeId: "s11", rootCauseCategory: "market-demand",
      owningPersona: "RVP", openedDate: "2026-04-02", targetCloseDate: "2026-06-30",
      diagnosis: "PIF volume decline traces to a new MSO competitor opening in the CBSA and a softer local market — there is no shop-level operational fix here. The plan is to document the market shift and escalate for a marketing and carrier-steering response, then close.",
      tasks: [
        { id: "AP-114-t1", title: "Document the CBSA PIF trend and competitor opening", description: "Compile the market picture — PIF trend and the competitor open — as the evidence packet for escalation.",
          ownerName: "Grant Feldman", ownerRole: "Sales Rep", column: "closed", createdDate: "2026-04-03", dueDate: "2026-05-01", priority: "medium",
          risk: "Market data trails reality by a reporting cycle.",
          verificationSignal: { metric: "PIF Volume", lagDays: 90 }, outcome: "No Change — market driven",
          activityLog: [
            { date: "2026-04-06", note: "Competitor opening confirmed; CBSA PIF trend compiled." },
            { date: "2026-04-28", note: "Packet finalized for RVP and marketing review." }
          ] },
        { id: "AP-114-t2", title: "Request market/BD marketing support for the CBSA", description: "Escalate to marketing/business development for local demand-generation support in the affected CBSA.",
          ownerName: "Lauren Petrakis", ownerRole: "RVP", column: "closed", createdDate: "2026-04-08", dueDate: "2026-05-20", priority: "medium",
          risk: "Marketing spend is prioritized across many markets.",
          verificationSignal: { metric: "PIF Volume", lagDays: 90 }, outcome: "No Change — market driven",
          activityLog: [
            { date: "2026-04-10", note: "Support request submitted with the market packet." },
            { date: "2026-05-18", note: "Marketing acknowledged; no shop-level action available." }
          ] },
        { id: "AP-114-t3", title: "Escalate for carrier-steering review in the CBSA", description: "Ask national accounts to review whether carrier steering can offset some of the volume loss.",
          ownerName: "Jamal Carter", ownerRole: "National Account Manager", column: "closed", createdDate: "2026-04-12", dueDate: "2026-06-01", priority: "low",
          risk: "Steering is carrier-controlled and slow to move.",
          verificationSignal: { metric: "DRP Assignment Volume", lagDays: 90 }, outcome: "No Change — market driven",
          activityLog: [
            { date: "2026-04-15", note: "Steering review requested through national accounts." },
            { date: "2026-06-20", note: "Closed as market-driven; no operational remedy at the store." }
          ] }
      ]
    },

    /* ===================== BRANDON (s12) ===================== */
    {
      id: "AP-115", storeId: "s12", rootCauseCategory: "drp-scorecard",
      carrier: "Nationwide", owningPersona: "Shop GM", openedDate: "2026-07-08", targetCloseDate: "2026-10-15",
      diagnosis: "CSI survey score is below program threshold on Nationwide, driven by communication gaps rather than repair quality. A status-update cadence should move the number over the survey lag.",
      tasks: [
        { id: "AP-115-t1", title: "Implement milestone status-update cadence to customers", description: "Set automatic milestone updates (drop-off, teardown, paint, ready) so customers aren't left in the dark.",
          ownerName: "Megan O'Rourke", ownerRole: "CSR", column: "inprogress", createdDate: "2026-07-09", dueDate: "2026-08-15", priority: "high",
          risk: "Automated messages feel generic if not paired with real calls.",
          verificationSignal: { metric: "CSI Survey Score", lagDays: 45 },
          activityLog: [
            { date: "2026-07-11", note: "Milestone message points defined and turned on." },
            { date: "2026-08-01", note: "Adding a personal call at the paint milestone for complex jobs." }
          ] },
        { id: "AP-115-t2", title: "CSR call-back on recently closed repair orders", description: "Call recently delivered customers to catch issues before the survey and close the loop.",
          ownerName: "Megan O'Rourke", ownerRole: "CSR", column: "verifying", createdDate: "2026-07-12", dueDate: "2026-08-30", priority: "medium",
          risk: "Call-backs compete with front-counter load.",
          verificationSignal: { metric: "CSI Survey Score", lagDays: 45 },
          activityLog: [
            { date: "2026-07-14", note: "Post-delivery call-back list started." },
            { date: "2026-08-04", note: "Early call-backs surfacing small fit issues to fix pre-survey." }
          ] },
        { id: "AP-115-t3", title: "Monitor survey verbatims and CSI trend", description: "Track survey comments and the CSI trend to confirm the cadence is moving the metric.",
          ownerName: "Theo Nakamura", ownerRole: "Shop GM", column: "verifying", createdDate: "2026-07-16", dueDate: "2026-09-25", priority: "low",
          risk: "CSI lags; needs several survey cycles to read.",
          verificationSignal: { metric: "CSI Survey Score", lagDays: 45 },
          activityLog: [
            { date: "2026-07-18", note: "Verbatim tracking added to weekly review." }
          ] }
      ]
    },
    {
      id: "AP-116", storeId: "s12", rootCauseCategory: "drp-participation",
      carrier: "Nationwide", owningPersona: "Market Manager (CPM)", openedDate: "2026-07-10", targetCloseDate: "2026-08-01",
      diagnosis: "Nationwide routing share slipped as aged open files piled up and the portal began deprioritizing the store. On the program, but assignments are drying up — an administrative cleanup, distinct from the CSI plan.",
      tasks: [
        { id: "AP-116-t1", title: "Reconcile portal file statuses against shop management system", description: "Sync the carrier portal statuses to the true state of files so routing logic sees accurate availability.",
          ownerName: "Elaine Cho", ownerRole: "Market Manager (CPM)", column: "inprogress", createdDate: "2026-07-11", dueDate: "2026-08-13", priority: "high",
          risk: "Portal and management-system mismatches recur without a routine.",
          verificationSignal: { metric: "DRP Assignment Volume", lagDays: 30 },
          activityLog: [
            { date: "2026-07-13", note: "Status mismatch found on several files; reconciliation started." }
          ] },
        { id: "AP-116-t2", title: "Close the aged open-file backlog", description: "Work the aged open files to completion to stop the portal from deprioritizing the store.",
          ownerName: "Theo Nakamura", ownerRole: "Shop GM", column: "inprogress", createdDate: "2026-07-12", dueDate: "2026-08-03", priority: "urgent",
          risk: "A few files are stalled on customer or carrier action.",
          verificationSignal: { metric: "Aged Open File Count", lagDays: 15 },
          activityLog: [
            { date: "2026-07-14", note: "Aged-file list worked; several waiting on customer sign-off." },
            { date: "2026-07-31", note: "Chasing remaining sign-offs to clear the list." }
          ] },
        { id: "AP-116-t3", title: "Confirm routing recovery with Nationwide rep", description: "Verify with the rep that routing normalizes after the portal cleanup.",
          ownerName: "Marcus Delgado", ownerRole: "Market Manager (CPM)", column: "identified", createdDate: "2026-07-18", dueDate: "2026-08-22", priority: "medium",
          risk: "Routing may take a cycle to reflect the cleanup.",
          verificationSignal: { metric: "DRP Assignment Volume", lagDays: 30 },
          activityLog: [
            { date: "2026-07-18", note: "Rep check-in scheduled once the aged files are cleared." }
          ] }
      ]
    },

    /* ===================== MESA (s13) ===================== */
    {
      id: "AP-117", storeId: "s13", rootCauseCategory: "revenue-leakage",
      carrier: "Farmers", owningPersona: "Market Manager (CPM)", openedDate: "2026-07-15", targetCloseDate: "2026-10-10",
      diagnosis: "The store under-captures on Farmers work — alternative parts usage and supplements run below program expectations, and rules-driven operations are missed. Volume is fine; capture discipline is the gap.",
      tasks: [
        { id: "AP-117-t1", title: "Stand up a parts-sourcing workflow for recycled/aftermarket", description: "Give estimators a sourcing step so alternative parts are considered and captured per Farmers rules.",
          ownerName: "Hector Salas", ownerRole: "Parts Manager", column: "identified", createdDate: "2026-07-16", dueDate: "2026-08-26", priority: "medium",
          risk: "Alternative parts availability varies by job and region.",
          verificationSignal: { metric: "Alternative Parts Usage", lagDays: 45 },
          activityLog: [
            { date: "2026-07-17", note: "Sourcing step drafted for the estimate workflow." }
          ] },
        { id: "AP-117-t2", title: "Coach estimators on Farmers rules adherence", description: "Coaching on the specific Farmers rules where the store is under-writing operations and parts.",
          ownerName: "Elaine Cho", ownerRole: "Market Manager (CPM)", column: "inprogress", createdDate: "2026-07-18", dueDate: "2026-08-19", priority: "medium",
          risk: "Coaching needs audit reinforcement to hold.",
          verificationSignal: { metric: "Rules Adherence Score", lagDays: 45 },
          activityLog: [
            { date: "2026-07-20", note: "First coaching session held against recent Farmers files." }
          ] },
        { id: "AP-117-t3", title: "Add a weekly rules-adherence audit on Farmers files", description: "Sample Farmers files weekly to confirm parts and operations are being captured to rule.",
          ownerName: "Marcus Delgado", ownerRole: "Market Manager (CPM)", column: "identified", createdDate: "2026-07-22", dueDate: "2026-08-29", priority: "low",
          risk: "Audit only helps if findings loop back to coaching.",
          verificationSignal: { metric: "Rules Adherence Score", lagDays: 45 },
          activityLog: [
            { date: "2026-07-22", note: "Weekly audit cadence proposed for the store." }
          ] }
      ]
    },
    {
      id: "AP-118", storeId: "s13", rootCauseCategory: "personnel",
      owningPersona: "Shop GM", openedDate: "2026-07-20", targetCloseDate: "2026-10-20",
      diagnosis: "The body shop out-produces paint — a single painter can't clear the refinish queue and WIP ages in front of the booth. This is a department capacity gap, not an equipment failure; the store needs a second painter.",
      tasks: [
        { id: "AP-118-t1", title: "Open a requisition for a second painter", description: "Post and work a requisition to add refinish capacity and unblock the paint queue.",
          ownerName: "Bianca Torres", ownerRole: "HR Recruiter", column: "blocked", createdDate: "2026-07-21", dueDate: "2026-08-28", priority: "high",
          risk: "Painter candidates are scarce in this market.",
          blockedReason: "Requisition approved; no qualified painter applicants yet in the local pipeline.",
          verificationSignal: { metric: "Refinish Cycle Time", lagDays: 30 },
          activityLog: [
            { date: "2026-07-22", note: "Requisition approved and posted; sourcing started." }
          ] },
        { id: "AP-118-t2", title: "Authorize interim overtime for the current painter", description: "Approve limited overtime to hold refinish throughput while recruiting runs.",
          ownerName: "Theo Nakamura", ownerRole: "Shop GM", column: "inprogress", createdDate: "2026-07-22", dueDate: "2026-08-14", priority: "medium",
          risk: "Overtime is a stopgap and a burnout risk on one painter.",
          verificationSignal: { metric: "Refinish Cycle Time", lagDays: 30 },
          activityLog: [
            { date: "2026-07-24", note: "Interim OT approved for the paint department." }
          ] },
        { id: "AP-118-t3", title: "Cross-train a body tech on refinish prep", description: "Cross-train a willing body tech on prep to feed the booth and relieve the painter.",
          ownerName: "Doug Ferreira", ownerRole: "Shop GM", column: "identified", createdDate: "2026-07-28", dueDate: "2026-09-05", priority: "low",
          risk: "Cross-training temporarily reduces body-side capacity.",
          verificationSignal: { metric: "Refinish Cycle Time", lagDays: 30 },
          activityLog: [
            { date: "2026-07-28", note: "Identified a body tech interested in prep cross-training." }
          ] }
      ]
    }
  ]
};

/* ============================================================
   KPI dashboard data (KPIs tab)
   Capture-funnel snapshots (80/70/7) plus per-store sales-forecast
   pacing inputs. Values here are illustrative mockups.
   ============================================================ */
window.HUB_DATA.kpiMetrics = [
  { key: "estimate", label: "Opportunity to Estimate", group: "funnel", unit: "%",    goal: 80, dir: "higher", info: "Write an estimate on at least 80% of all opportunities" },
  { key: "ro",       label: "Opportunity to RO",       group: "funnel", unit: "%",    goal: 70, dir: "higher", info: "Capture / arrive at least 70% of all opportunities" },
  { key: "arrive",   label: "Opportunity to Arrive",   group: "funnel", unit: "days", goal: 7,  dir: "lower",  info: "Maximum of 7 days between opportunity and arrived" }
];

window.HUB_DATA.kpisByStore = {
  s1:  { estimate: 84, ro: 72, arrive: 6.1 },
  s2:  { estimate: 81, ro: 64, arrive: 7.4 },
  s3:  { estimate: 82, ro: 69, arrive: 6.8 },
  s4:  { estimate: 83, ro: 66, arrive: 6.37 },
  s5:  { estimate: 82, ro: 68, arrive: 7.1 },
  s6:  { estimate: 83, ro: 67, arrive: 6.5 },
  s7:  { estimate: 82, ro: 69, arrive: 6.6 },
  s8:  { estimate: 80, ro: 68, arrive: 7.2 },
  s9:  { estimate: 81, ro: 67, arrive: 7.3 },
  s10: { estimate: 82, ro: 70, arrive: 6.4 },
  s11: { estimate: 84, ro: 68, arrive: 6.9 },
  s12: { estimate: 82, ro: 66, arrive: 6.7 },
  s13: { estimate: 83, ro: 69, arrive: 6.5 },
  s14: { estimate: 83, ro: 71, arrive: 6.3 }
};

/* MTD pacing window ("as of" the reference date) and per-store sales-forecast
   inputs. Targets, variance, %, days-behind, DNC, and weekly rows derive from
   these at render time (see computePacing in app.js). */
window.HUB_DATA.mtd = { day: 10, daysInMonth: 31 };
window.HUB_DATA.pacingByStore = {
  s1:  { budget: 560000, closedPace: 1.03, forecastFactor: 1.02 },
  s2:  { budget: 555000, closedPace: 0.87, forecastFactor: 0.92 },
  s3:  { budget: 520000, closedPace: 0.95, forecastFactor: 0.98 },
  s4:  { budget: 540000, closedPace: 0.94, forecastFactor: 0.96 },
  s5:  { budget: 505000, closedPace: 0.91, forecastFactor: 0.95 },
  s6:  { budget: 470000, closedPace: 0.98, forecastFactor: 0.99 },
  s7:  { budget: 480000, closedPace: 1.01, forecastFactor: 1.00 },
  s8:  { budget: 500000, closedPace: 0.90, forecastFactor: 0.94 },
  s9:  { budget: 498000, closedPace: 0.89, forecastFactor: 0.93 },
  s10: { budget: 525000, closedPace: 0.99, forecastFactor: 1.00 },
  s11: { budget: 455000, closedPace: 0.93, forecastFactor: 0.95 },
  s12: { budget: 510000, closedPace: 0.96, forecastFactor: 0.97 },
  s13: { budget: 515000, closedPace: 1.00, forecastFactor: 1.01 },
  s14: { budget: 495000, closedPace: 1.02, forecastFactor: 1.01 }
};

/* Market Manager's book — ~10 shops in one market (Chicago metro). */
window.HUB_DATA.market = {
  id: "m-chi", name: "Chicago Metro", manager: "Marcus Delgado",
  storeIds: ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s10", "s14"]
};
