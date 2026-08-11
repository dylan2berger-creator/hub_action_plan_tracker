/* ============================================================
   The Hub — Action Plans / KPIs config
   Single source of truth for every threshold, target, and
   direction used by the KPIs dashboard. Change a number here and
   the dashboard, challenged flagging, and shop detail all follow.
   The formatting logic reads `direction` — nothing hardcodes
   "green when above target".
   ============================================================ */
window.HUB_CONFIG = {
  /* Primary: revenue attainment.
     revenue_variance_pct = (actual_revenue - target_revenue) / target_revenue
     A shop is Challenged when revenue_variance_pct <= challengedVariancePct. */
  revenue: {
    challengedVariancePct: -0.10
  },

  /* Diagnostic: the opportunity funnel. All three are denominated on
     opportunities received in the period. `direction` drives pass/fail. */
  funnel: [
    { key: "estimate", label: "Opportunity to Estimate", definition: "estimates written ÷ opportunities received",       target: 80, unit: "%",    direction: "higher" },
    { key: "ro",       label: "Opportunity to RO",       definition: "repair orders opened ÷ opportunities received",     target: 70, unit: "%",    direction: "higher" },
    { key: "arrive",   label: "Opportunity to Arrive",   definition: "days from opportunity created to vehicle arrival",       target: 7,  unit: "days", direction: "lower"  }
  ],

  /* Insurance partner (DRP) score. 0–100; higher means more volume from
     that carrier. The four contributing variables are shown against the
     shop's own trailing average (no weighting into the score is assumed). */
  drp: {
    scoreMin: 0,
    scoreMax: 100,
    variables: [
      { key: "estAccuracy", label: "Estimate accuracy",       unit: "%",    direction: "higher" },
      { key: "rulesAdherence", label: "Rules Adherence %",     unit: "%",     direction: "higher" },
      { key: "cycleTime",   label: "Total cycle time",         unit: "days", direction: "lower"  },
      { key: "csi",         label: "CSI",                      unit: "",     direction: "higher" }
    ]
  }
};
