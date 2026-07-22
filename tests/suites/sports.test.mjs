// Sports: teams, playoff brackets and scheduled games, from both the Sports
// dashboard and the Content tab.
//
// Includes a regression test for the bracket editor crashing on a stale row.

import { loadPage, sectionCard, Check } from "../harness.mjs";

export async function run() {
  const check = new Check();

  // ===== The three forms, driven from the Sports dashboard =====
  {
    const ctx = await loadPage("editor-sports.html");
    const { document, click, type, $ } = ctx;

    check.ok("modals are not in the DOM until needed", !$("#team-modal"));

    // Team
    click($("#add-team"));
    check.ok("team modal opens", $("#team-modal").classList.contains("visible"));
    click($("#t-save"));
    check.ok("team slug is validated", $("#t-error").textContent.length > 0);
    type($("#t-slug"), "jv-soccer");
    type($("#t-name"), "JV Soccer");
    type($("#t-sport"), "Soccer");
    type($("#t-w"), "4");
    type($("#t-l"), "1");
    click($("#t-save"));
    const team = ctx.window.WLTeams.getTeam("jv-soccer");
    check.ok("team saved", !!team);
    check.equal("record saved", team.record, { w: 4, l: 1, t: 0 });
    check.ok("dashboard refreshed", document.body.textContent.includes("JV Soccer"));

    // Bracket
    click($("#add-bracket"));
    type($("#b-slug"), "spring-cup");
    type($("#b-title"), "Spring Cup");
    type($("#b-sport"), "Soccer");
    click($("#add-round"));
    click($("#b-save"));
    check.ok("a round with no matches is rejected", $("#b-error").textContent.length > 0);
    type($("#bracket-rounds [data-round-name]"), "Semifinal");
    click($("#bracket-rounds [data-add-match]"));
    const matchInputs = ctx.$$("#bracket-rounds input").filter(i => !i.hasAttribute("data-round-name"));
    type(matchInputs[0], "JV Soccer");
    type(matchInputs[1], "Rivals");
    click($("#b-save"));
    const bracket = ctx.window.WLTeams.getBracket("spring-cup");
    check.ok("bracket saved", !!bracket);
    check.equal("round and match stored", bracket.rounds,
      [{ name: "Semifinal", matches: [{ team1: "JV Soccer", team2: "Rivals" }] }]);

    // Game
    click($("#sched-add"));
    check.ok("game modal opens", $("#sched-modal").classList.contains("visible"));
    ctx.pick($("#sg-team"), "jv-soccer");
    type($("#sg-opp"), "Northside");
    type($("#sg-date"), "2026-05-08");
    type($("#sg-time"), "4:00 PM");
    click($("#sg-save"));
    const upcoming = ctx.window.WLTeams.getTeam("jv-soccer").upcoming;
    check.equal("game added to the team's schedule", upcoming.length, 1);
    check.equal("opponent stored", upcoming[0].opponent, "Northside");

    check.clean("no errors across the sports forms", ctx);
  }

  // ===== Regression: a stale bracket row must not crash the modal =====
  // Removing a round used to leave handlers indexing a round that no longer
  // existed, which threw and took the rest of the modal's wiring with it.
  {
    const ctx = await loadPage("editor-sports.html");
    const { click, type, $ } = ctx;

    click($("#add-bracket"));
    click($("#add-round"));
    click($("#add-round"));
    const staleAdd = ctx.$$("[data-add-match]").find(b => b.dataset.round === "1");
    click(ctx.$('[data-remove-round][data-round="1"]'));

    click(staleAdd);                       // fires against a round that is gone
    check.ok("clicking a removed round's button does not throw", ctx.errors.length === 0,
      ctx.errors.slice(0, 2).join(" | "));

    // The form must still be usable afterwards.
    click($("[data-add-match]"));
    const inputs = ctx.$$("#bracket-rounds input").filter(i => !i.hasAttribute("data-round-name"));
    type(inputs[0], "Alpha");
    type(inputs[1], "Beta");
    type($("#b-slug"), "guard-cup");
    type($("#b-title"), "Guard Cup");
    type($("#b-sport"), "Soccer");
    click($("#b-save"));
    check.ok("the modal still saves after a stale click",
      !!ctx.window.WLTeams.getBracket("guard-cup"));
    check.clean("no errors after stale interaction", ctx);
  }

  // ===== Reaching the same forms from the Content tab =====
  {
    const ctx = await loadPage("editor-content.html");
    const { click, type, $ } = ctx;

    click(sectionCard(ctx, "Sports").querySelector('[data-c="add"]'));
    click($('#acm-list [data-acm="Sports stats"]'));
    const kinds = ctx.$$("#acm-list [data-sk]").map(b => b.textContent);
    check.equal("three kinds of sports record are offered", kinds.length, 3);

    click($('#acm-list [data-sk="0"]'));   // Team
    check.ok("the team form opens in place", $("#team-modal").classList.contains("visible"));
    type($("#t-slug"), "varsity-golf");
    type($("#t-name"), "Varsity Golf");
    type($("#t-sport"), "Golf");
    click($("#t-save"));
    check.ok("saved from the Content tab", !!ctx.window.WLTeams.getTeam("varsity-golf"));
    check.equal("no navigation away", ctx.window.location.pathname, "/editor-content.html");
    check.clean("no errors from the Content tab", ctx);
  }

  // ===== Per-block visibility =====
  {
    const ctx = await loadPage("editor-sports.html");
    const cb = ctx.$(".sports-visibility [data-block]");
    check.ok("per-block visibility toggles exist", !!cb);
    if (cb) {
      cb.checked = false;
      cb.dispatchEvent(new ctx.window.Event("change", { bubbles: true }));
      check.ok(`turning off "${cb.dataset.block}" is stored`,
        ctx.window.WLTeams.blockEnabled(cb.dataset.block) === false);
    }
    check.clean("no errors toggling blocks", ctx);
  }

  return check;
}
