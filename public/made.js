/* bbb:made:v1 — one shared list of things made in this browser, across every
 * tool, up to five entries: {tool, title, editUrl, at}.
 *
 * Written ALONGSIDE each tool's own per-tool key (bbb:<tool>-made:v1 / etc,
 * unchanged, still written by each tool's own script) so nothing that
 * already reads those breaks. This file is the only thing that reads the
 * shared key, and it renders into any element with id="madeStrip", wherever
 * the page puts one. It renders IN PLACE and never moves the element: the
 * page owns the position, this file owns the contents.
 *
 * That division is not stylistic. The strip used to sit in the hero of every
 * tool page, above the builder form, hidden until this file found something
 * in the browser to put in it. Measured at 375x812 with two entries, it is
 * 157px tall including its margin, and it pushed the submit button that
 * scripts/builder-above-fold.mjs exists to keep above the fold below it on
 * every builder — /kris-kringle/ 699px -> 856px against an 812px viewport.
 * The builder worked above the fold for a stranger and below it for a
 * regular. That script now lifts the strip below the builder panel and
 * refuses to build if anything above the form is hidden; read its header for
 * the argument. Nothing here needs to know about any of it, and the moment
 * this file starts relocating the element, that guarantee is gone again.
 *
 * The homepage keeps its strip high, above the seasonal card, per
 * docs/review/03-ia.md C.3 — retrieval failure is worse than discovery
 * failure, and on the homepage there is no form to bury.
 *
 * Not an account: nothing goes to the server, nothing syncs between
 * browsers, nothing identifies anyone, and clearing this browser clears it
 * — the same deal the site already states in fine print on every builder,
 * said once here, in the place it's actually useful.
 */
(function () {
  var KEY = "bbb:made:v1";
  var MAX = 5;

  var LABEL = {
    sweep: "Grand Final Sweep", cup: "Melbourne Cup Sweep",
    kringle: "Kris Kringle", roles: "Secret Role Dealer",
    plate: "Bring a Plate", bracket: "Tournament Bracket",
    card: "Group Card", registry: "Pixel Gift Registry",
    fact: "Fact Matcher", baby: "Baby Guess Pool",
    roster: "Volunteer Roster", meal: "Meal Train",
    poll: "Group Vote", recipe: "Recipe Collection",
    giftidea: "Gift Idea Board", hens: "Hens & Shower Planner",
    qotd: "Question of the Day", coffee: "Coffee Roulette",
    pulse: "Weekly Pulse", kudos: "Kudos Wall", poker: "Scrum Poker"
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch (e) { return []; }
  }

  /* Call right after a successful create, alongside each tool's own
     per-tool savePrev(). tool must be a LABEL key above. */
  window.bbbRemember = function (tool, title, editUrl) {
    try {
      var entry = { tool: tool, title: title || "", editUrl: editUrl, at: new Date().toISOString() };
      var next = [entry].concat(load()).slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch (e) { /* private mode */ }
  };

  function render() {
    var el = document.getElementById("madeStrip");
    if (!el) return;
    var list = load();
    if (!list.length) return;
    var ul = el.querySelector("ul");
    if (!ul) return;
    ul.innerHTML = "";
    list.forEach(function (b) {
      var label = LABEL[b.tool] || "Something";
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = b.editUrl;
      a.textContent = (b.title ? b.title + " · " : "") + label;
      var when = document.createElement("span");
      when.className = "fine";
      var d = new Date(b.at);
      when.textContent = isNaN(d) ? "" : " · " + d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
      li.appendChild(a);
      li.appendChild(when);
      ul.appendChild(li);
    });
    el.hidden = false;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
