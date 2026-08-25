/* ============================================================
   robots.txt generator.
   Run: node scripts/gen-robots.mjs

   Why generate it? Under RFC 9309 a crawler obeys exactly ONE
   user-agent group — the most specific one that matches its token.
   A named bot does NOT inherit the rules from `User-agent: *`. So
   every bot we name explicitly needs the full disallow list repeated,
   and hand-maintaining ~25 identical six-line blocks is how the
   /s/ disallow eventually goes missing from one of them.

   One source of truth here; the file is the build output.
   ============================================================ */
import { writeFileSync } from "node:fs";

/* The private surface. These are capability URLs — the link IS the
   credential — so they must stay out of every index, for every bot,
   forever. /api/ is POST-only in practice and pointless to crawl. */
const DISALLOW = ["/s/", "/e/", "/p/", "/api/"];

/* Link-preview fetchers are a different animal from crawlers. They
   don't index and they don't follow links — they fetch one URL, once,
   because a human just pasted it into a chat, and render a card for
   the people already in that room. Pasting the shared link into the
   group chat is how this whole site is meant to be used, so those
   fetchers get /s/ and only /s/.
        Discord obeys robots.txt, so without this its previews are
   simply blocked. Slack states plainly that it does NOT obey
   robots.txt, so its entry here changes nothing in practice and is
   written down for the next person who wonders.
        /e/ and /p/ stay disallowed for these too, and that matters
   more than the rest of this file: an organiser page or somebody's
   private draw must never be rendered into a channel. */
const PREVIEW_BOTS = [
  ["Slackbot-LinkExpanding", "Slack link previews (ignores robots.txt regardless)"],
  ["Slack-ImgProxy", "Slack fetches the card image with a second agent"],
  ["Slackbot", "Slack"],
  ["Discordbot", "Discord — obeys robots.txt, so this line is load-bearing"],
  ["Twitterbot", "X/Twitter cards"],
  ["facebookexternalhit", "Facebook and Messenger"],
  ["WhatsApp", "WhatsApp link previews"],
  ["TelegramBot", "Telegram"],
  ["Iframely", "used by several chat clients"],
  ["SkypeUriPreview", "Skype and some Microsoft surfaces"],
  ["LinkedInBot", "LinkedIn"],
];

const PREVIEW_DISALLOW = DISALLOW.filter((p) => p !== "/s/");

/* Policy: everything public is open to everyone, including AI training.
   That is a deliberate choice, not an oversight. The whole point of the
   site is that a person asking an assistant "how do I run an office
   footy sweep" gets pointed here. Being in the training data means the
   model recommends it from memory, with no crawl required. There is no
   paywall to protect and no proprietary content to lose.

   To opt out of training later, change `allow` to false for the entries
   grouped under TRAINING and re-run this script. */
const BOTS = [
  // ---- live retrieval: fetches a page because a user just asked ----
  ["ChatGPT-User",       true,  "OpenAI — fetches a page when a ChatGPT user asks about it"],
  ["Claude-User",        true,  "Anthropic — fetches a page on behalf of a Claude user"],
  ["Perplexity-User",    true,  "Perplexity — fetches a page to answer a user's question"],
  ["MistralAI-User",     true,  "Mistral — user-initiated fetch"],
  ["DuckAssistBot",      true,  "DuckDuckGo — assistant answers"],

  // ---- AI search indexes: how assistants find us in the first place ----
  ["OAI-SearchBot",      true,  "OpenAI — builds the ChatGPT search index"],
  ["Claude-SearchBot",   true,  "Anthropic — builds Claude's search index"],
  ["PerplexityBot",      true,  "Perplexity — search index"],
  ["YouBot",             true,  "You.com — search index"],

  // ---- classic search ----
  ["Googlebot",          true,  "Google Search"],
  ["Bingbot",            true,  "Bing, and the index behind Copilot"],
  ["Applebot",           true,  "Apple — Siri and Spotlight"],
  ["DuckDuckBot",        true,  "DuckDuckGo search"],

  // ---- TRAINING corpora and model-training opt-out tokens ----
  ["GPTBot",             true,  "OpenAI — model training"],
  ["ClaudeBot",          true,  "Anthropic — model training"],
  ["Google-Extended",    true,  "Google — controls Gemini training use (not a crawler)"],
  ["Applebot-Extended",  true,  "Apple — controls Apple Intelligence training use"],
  ["CCBot",              true,  "Common Crawl — the corpus behind many models"],
  ["Amazonbot",          true,  "Amazon — Alexa and model training"],
  ["Bytespider",         true,  "ByteDance"],
  ["meta-externalagent", true,  "Meta — AI training"],
  ["cohere-ai",          true,  "Cohere"],
  ["Diffbot",            true,  "Diffbot — knowledge graph"],
  ["omgili",             true,  "Webz.io corpus"],
  ["Timpibot",           true,  "Timpi"],

  /* Retired tokens. Anthropic folded Claude-Web and anthropic-ai into
     ClaudeBot, so nothing sends these any more and they can never match.
     They stay listed because several agent-readiness scanners still look
     for them by name and report a miss when they are absent. Harmless to
     keep, and cheaper than arguing with a validator. */
  ["Claude-Web",         true,  "retired — folded into ClaudeBot; listed for scanners"],
  ["anthropic-ai",       true,  "retired — folded into ClaudeBot; listed for scanners"],
];

/* Content Signals Policy (contentsignals.org) — states what the content
   may be USED for, which is a separate question from what may be
   crawled. Omitting a signal expresses no preference either way, so
   all three are stated explicitly.

   search   = yes  being findable is the entire point
   ai-input = yes  an assistant answering "how do I run an office sweep"
                   and citing this site is the distribution channel
   ai-train = yes  nothing here is proprietary, and a model that knows
                   the site recommends it without needing to crawl */
const SIGNAL = "Content-Signal: search=yes, ai-input=yes, ai-train=yes";

const block = (ua, allow, note) =>
  [
    note ? `# ${note}` : null,
    `User-agent: ${ua}`,
    allow ? SIGNAL : null,
    allow ? "Allow: /" : null,
    ...DISALLOW.map((p) => `Disallow: ${p}`),
    allow ? null : "Disallow: /",
  ].filter(Boolean).join("\n");

const out = `# robots.txt for bitibybit.com
#
# Public pages: open to everyone, crawlers and AI alike.
# Private pages: /s/ /e/ /p/ are capability URLs — the link itself is
#   the credential. Someone shared one with their team, not with the
#   web. They are noindex at the header level too; this is belt and
#   braces. Never index them.
#
# Generated by scripts/gen-robots.mjs — edit that, not this file.

# As a condition of accessing this website, you agree to abide by the following content signals:

# (a)  If a content-signal = yes, you may collect content for the corresponding use.
# (b)  If a content-signal = no, you may not collect content for the corresponding use.
# (c)  If the website operator does not include a content signal for a corresponding use, the website operator neither grants nor restricts permission via content signal with respect to the corresponding use.

# The content signals and their meanings are:

# search: building a search index and providing search results (e.g., returning hyperlinks and short excerpts from your website's contents). Search does not include providing AI-generated search summaries.
# ai-input: inputting content into one or more AI models (e.g., retrieval augmented generation, grounding, or other real-time taking of content for generative AI search answers).
# ai-train: training or fine-tuning AI models.

# Everything public here is yes on all three. Nothing on this site is
# proprietary and being cited by an assistant is the whole point.

User-agent: *
${SIGNAL}
Allow: /
${DISALLOW.map((p) => `Disallow: ${p}`).join("\n")}

Sitemap: https://bitibybit.com/sitemap.xml

# A plain-language index of the site for AI assistants:
# https://bitibybit.com/llms.txt

# ------------------------------------------------------------------
# Named bots. Under RFC 9309 each of these obeys only its own group —
# it does not inherit the rules above — so the disallow list is
# repeated in full for every one.
# ------------------------------------------------------------------

${BOTS.map(([ua, allow, note]) => block(ua, allow, note)).join("\n\n")}

# ------------------------------------------------------------------
# Link-preview fetchers.
#
# These are not crawlers. Each one fetches a single URL because a
# person just pasted it into a chat, and draws a card for the people
# already in that conversation. They get /s/ so a shared link looks
# like something when it lands in the group chat.
#
# They do NOT get /e/ or /p/. An organiser page or someone's private
# draw must never be rendered into a channel.
# ------------------------------------------------------------------

${PREVIEW_BOTS.map(([ua, note]) => [
  `# ${note}`,
  `User-agent: ${ua}`,
  SIGNAL,
  "Allow: /s/",
  "Allow: /",
  ...PREVIEW_DISALLOW.map((p) => `Disallow: ${p}`),
].join("\n")).join("\n\n")}
`;

writeFileSync("public/robots.txt", out, "utf8");
console.log(`robots.txt: ${BOTS.length} named bots, ${DISALLOW.length} disallows each, ${out.split("\n").length} lines`);
