/* ============================================================
   Team Picker — OG image, hero art, shelf icon.
   Two little squads in sage and terracotta jerseys face off
   across the halfway line on park grass; the ball sits on the
   paint between them. Icon: the two jerseys, side by side.
   Run:  node scripts/art-teams.mjs
   ============================================================ */
import { mkdirSync } from "node:fs";
import { Grid, drawText, textWidth, P, mulberry } from "./pixel-lib.mjs";

const SKINS = ["#c99b73", "#e0b68f", "#8a6d4f", "#5d4832"];

/* One player, 4 wide × 8 tall; (x, y) = left edge, feet row. */
function player(g, x, y, jersey, skin) {
  g.rect(x + 1, y - 7, x + 2, y - 6, skin);            // head
  g.rect(x, y - 5, x + 3, y - 4, jersey);              // shoulders + arms
  g.rect(x + 1, y - 3, x + 2, y - 3, jersey);          // waist
  g.px(x, y - 3, skin); g.px(x + 3, y - 3, skin);      // hands
  g.rect(x + 1, y - 2, x + 2, y - 2, P.white);         // shorts
  g.px(x + 1, y - 1, skin); g.px(x + 2, y - 1, skin);  // legs
  g.px(x + 1, y, P.ink); g.px(x + 2, y, P.ink);        // boots
}

/* Park footy at team-picking o'clock: sun, clouds, mown grass,
   dashed halfway line, sage mob left, terracotta mob right, and
   a chalk sideline strip along the bottom (which doubles as the
   clear ground the OG wordmark sits on). */
function faceOffScene(w, h, { grassFrac = 0.40 } = {}) {
  const g = new Grid(w, h, P.paper);
  const rng = mulberry(17);
  const grassTop = Math.floor(h * grassFrac);
  const lineY = h - 7;                                  // sideline strip top
  const mid = Math.floor(w / 2);

  // sun and a couple of clouds
  g.disc(Math.floor(w * 0.08), 4, 3, P.gold);
  const cloud = (cx, cy) => {
    g.rect(cx, cy, cx + 6, cy + 1, P.paper2);
    g.rect(cx + 2, cy - 1, cx + 4, cy - 1, P.paper2);
  };
  cloud(Math.floor(w * 0.26), 4);
  cloud(Math.floor(w * 0.74), 6);

  // grass with mow stripes
  for (let x = 0; x < w; x++)
    g.rect(x, grassTop, x, lineY - 1, Math.floor(x / 8) % 2 ? P.grass : P.grassDark);

  // dashed halfway line
  for (let y = grassTop + 1; y < lineY; y += 2) g.px(mid, y, P.paper2);

  // chalk sideline strip along the bottom
  g.rect(0, lineY, w - 1, h - 1, P.paper3);
  g.rect(0, lineY, w - 1, lineY, P.paper2);

  // the two squads, mirrored around the halfway line
  const frontFeet = lineY - 1;
  const backFeet = Math.min(frontFeet - 5, grassTop + 7);
  const skin = () => SKINS[Math.floor(rng() * SKINS.length)];
  const pair = (dx, feet) => {
    player(g, mid - dx - 4, feet, P.sage, skin());      // left team
    player(g, mid + dx, feet, P.terra, skin());         // right team
  };
  for (const dx of [10, 20]) pair(dx, frontFeet);       // front rows
  for (const dx of [6, 16, 26]) pair(dx, backFeet);     // back rows

  // the ball, on the paint, nobody's yet
  g.rect(mid - 2, frontFeet, mid + 1, frontFeet, P.red);
  g.rect(mid - 1, frontFeet - 1, mid, frontFeet - 1, P.red);
  g.px(mid - 1, frontFeet, P.white); g.px(mid, frontFeet, P.white);

  return g;
}

/* Shelf icon: two jerseys side by side, sage and terracotta. */
function iconTeams() {
  const g = new Grid(16, 16);
  const jersey = (x, main, dark) => {
    g.rect(x + 1, 3, x + 2, 3, main);                   // shoulders,
    g.rect(x + 4, 3, x + 5, 3, main);                   // neck gap between
    g.rect(x, 4, x + 6, 6, main);                       // sleeves + chest
    g.rect(x + 1, 7, x + 5, 12, main);                  // body
    g.px(x, 6, dark); g.px(x + 6, 6, dark);             // sleeve ends
    g.rect(x + 1, 8, x + 5, 8, dark);                   // hoop
    g.rect(x + 1, 12, x + 5, 12, dark);                 // hem
  };
  jersey(0, P.sage, P.sageDark);
  jersey(9, P.terra, P.terraDark);
  return g;
}

/* ---------- build -------------------------------------------- */
mkdirSync("public/art", { recursive: true });
mkdirSync("public/icons", { recursive: true });

iconTeams().toPng("public/icons/teams.png", 8);

/* hero: 112x32 @10 = 1120x320 */
faceOffScene(112, 32).toPng("public/art/teams-hero.png", 10);

/* og: 120x63 @10 = 1200x630 */
{
  const g = new Grid(120, 63, P.paper);
  const t1 = "TEAM PICKER";
  drawText(g, Math.floor((120 - textWidth(t1, 2)) / 2), 4, t1, P.ink, 2);
  const t2 = "FAIR TEAMS IN ONE CLICK";
  drawText(g, Math.floor((120 - textWidth(t2, 1)) / 2), 16, t2, P.terraDark, 1);
  const t3 = "FREE - NOTHING STORED";
  drawText(g, Math.floor((120 - textWidth(t3, 1)) / 2), 23, t3, P.inkSoft, 1);
  g.blit(faceOffScene(120, 34, { grassFrac: 0.30 }), 0, 29, 1);
  // wordmark blocks bottom-left, on the clear sideline strip
  g.rect(3, 57, 4, 58, P.sageDark); g.rect(6, 57, 7, 58, P.terra); g.rect(3, 60, 4, 61, P.gold);
  drawText(g, 10, 57, "BITIBYBIT.COM", P.inkSoft, 1);
  g.toPng("public/art/og-teams.png", 10);
}

console.log("done");
