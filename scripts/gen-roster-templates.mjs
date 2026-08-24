/* ============================================================
   Downloadable roster templates.
   Run: node scripts/gen-roster-templates.mjs

   Someone searching "canteen roster template" wants a file they
   can open, fill in and pin to the wall — not a web app. The tool
   at /volunteer-roster/ is the better answer once they have used
   it, but the file is what the search asked for, and turning up
   with only the app is why that traffic goes elsewhere.

   Every template is a real starting roster with the shifts and
   jobs already laid out, not an empty grid. Filling in names is
   the only work left.
   ============================================================ */
import { mkdirSync } from "node:fs";
import { writeXlsx, writeCsv } from "./xlsx.mjs";

const OUT = "public/volunteer-roster/templates";
mkdirSync(OUT, { recursive: true });

const HEAD = { cells: ["Shift", "Time", "Job", "Name", "Phone", "Confirmed?"], style: 1 };

/* A block of rows for one shift: the first row carries the shift
   name and a top border, the rest are blank in those columns so
   the shift reads as one group rather than repeating itself. */
function block(shift, time, jobs) {
  return jobs.map((job, i) => ({
    cells: [i === 0 ? shift : "", i === 0 ? time : "", job, "", "", ""],
    style: i === 0 ? 2 : 0,
  }));
}

const TEMPLATES = [
  {
    file: "school-canteen-roster",
    sheet: "Canteen roster",
    title: "School canteen roster — one week",
    note: "Two volunteers a day covers recess and lunch in most primary canteens. Add a third on the busiest day.",
    blocks: [
      ...["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].flatMap((d) =>
        block(d, "9:00am – 1:30pm", ["Prep and serving", "Serving and cleanup"])),
    ],
  },
  {
    file: "school-fete-roster",
    sheet: "Fete roster",
    title: "School fete roster — one day",
    note: "Short shifts fill. Four-hour shifts do not. Set-up and pack-down are the two nobody volunteers for, so ask for those first and by name.",
    blocks: [
      ...block("Set-up", "7:00am – 9:00am", ["Marquees and tables", "Marquees and tables", "Signage and bunting", "Stall setup runner"]),
      ...["BBQ", "Cake stall", "Drinks", "Devonshire tea", "Second-hand books", "Plants", "Showbags", "Face painting", "Lucky dip"].flatMap((stall) => [
        ...block(stall, "10:00am – 12:00pm", ["Convenor", "Helper", "Helper"]),
        ...block(stall, "12:00pm – 2:00pm", ["Convenor", "Helper", "Helper"]),
      ]),
      ...block("Floats and cash", "9:30am – 2:30pm", ["Cash runner", "Count and bank"]),
      ...block("Pack-down", "2:00pm – 4:00pm", ["Marquees down", "Marquees down", "Rubbish and bins", "Lost property and returns"]),
    ],
  },
  {
    file: "sausage-sizzle-roster",
    sheet: "Sausage sizzle",
    title: "Sausage sizzle roster — one day",
    note: "Four people a shift is the workable minimum: two cooking, one on bread and onions, one on money. Rotate whoever is on the barbecue — it is the hot job.",
    blocks: [
      ...["8:00am – 10:00am", "10:00am – 12:00pm", "12:00pm – 2:00pm", "2:00pm – 4:00pm"].flatMap((t, i) =>
        block(`Shift ${i + 1}`, t, ["Cooking", "Cooking", "Bread, onions and sauce", "Money and orders"])),
      ...block("Set-up", "7:15am – 8:00am", ["Barbecue and gas", "Esky, stock and float"]),
      ...block("Pack-down", "4:00pm – 5:00pm", ["Clean barbecue", "Rubbish and leftovers"]),
    ],
  },
  {
    file: "club-canteen-roster",
    sheet: "Club canteen",
    title: "Sports club canteen roster — a Saturday",
    note: "Tie shifts to the game times, not the clock. Parents will do the shift either side of their own kid's game and resent anything else.",
    blocks: [
      ...["8:30am – 10:30am", "10:30am – 12:30pm", "12:30pm – 2:30pm", "2:30pm – 4:30pm"].flatMap((t, i) =>
        block(`Game ${i + 1}`, t, ["Canteen", "Canteen", "BBQ"])),
      ...block("Open up", "8:00am – 8:30am", ["Unlock, float, urn on"]),
      ...block("Close", "4:30pm – 5:15pm", ["Cash up and lock", "Clean and restock list"]),
    ],
  },
  {
    file: "working-bee-roster",
    sheet: "Working bee",
    title: "Working bee roster",
    note: "List the jobs, not the hours. People pick a job they can do and stay until it is done, which is not how a shift roster behaves.",
    blocks: [
      ...block("Grounds", "8:00am – 12:00pm", ["Mowing", "Whipper snipper", "Garden beds", "Mulch spreading"]),
      ...block("Buildings", "8:00am – 12:00pm", ["Painting", "Painting", "Repairs", "Gutters"]),
      ...block("Inside", "8:00am – 12:00pm", ["Clean out storeroom", "Windows"]),
      ...block("Support", "8:00am – 12:00pm", ["Morning tea", "Tools and trailer", "Rubbish run to the tip"]),
    ],
  },
];

let n = 0;
for (const t of TEMPLATES) {
  const rows = [
    { cells: [t.title, "", "", "", "", ""], style: 1 },
    [t.note, "", "", "", "", ""],
    ["", "", "", "", "", ""],
    HEAD,
    ...t.blocks,
    ["", "", "", "", "", ""],
    ["Made with bitibybit.com/volunteer-roster/ — free, no accounts.", "", "", "", "", ""],
  ];
  writeXlsx(`${OUT}/${t.file}.xlsx`, { sheetName: t.sheet, rows, widths: [16, 20, 26, 22, 16, 12] });
  writeCsv(`${OUT}/${t.file}.csv`, rows);
  n++;
  console.log(`  ${t.file}.xlsx + .csv — ${t.blocks.length} rows`);
}
console.log(`\n${n} templates written to ${OUT}/`);
