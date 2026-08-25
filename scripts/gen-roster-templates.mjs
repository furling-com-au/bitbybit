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
    note: "Offer all day first, because a split shift costs a handover mid-prep. Offer the split anyway, because it is what fills. Keep the ten minutes of overlap — it is the only reason the afternoon volunteer knows what is in the warmer.",
    head: ["Day", "Shift", "Job", "Name", "Phone", "Signed in", "Signed out"],
    widths: [14, 22, 26, 22, 16, 12, 12],
    blocks: (() => {
      const out = [];
      for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) {
        const jobs = [
          ["Morning 9.10 – 11.50am", "Orders, prep, recess counter"],
          ["Morning 9.10 – 11.50am", "Prep and recess counter"],
          ["Afternoon 11.40am – 2.00pm", "Lunch bagging and counter"],
          ["Afternoon 11.40am – 2.00pm", "Counter, wash-up, clean-down"],
        ];
        if (day === "Friday") jobs.push(["Bagging 12.30 – 2.30pm", "Bagging and basket packing"]);
        jobs.forEach(([shift, job], i) =>
          out.push({ cells: [i === 0 ? day : "", shift, job, "", "", "", ""], style: i === 0 ? 2 : 0 }));
      }
      out.push({ cells: ["Any day", "At home", "Tea towels and aprons washed", "", "", "", ""], style: 2 });
      out.push({ cells: ["Reserves", "", "Named, not \"ring around\"", "", "", "", ""], style: 2 });
      out.push(["", "", "", "", "", "", ""]);
      out.push(["", "", "", "", "", "", ""]);
      return out;
    })(),
  },
  {
    file: "school-fete-roster",
    sheet: "Fete roster",
    title: "School fete roster — one day",
    note: "Short shifts fill; four-hour shifts do not. Bump-in and pack-down are the two nobody volunteers for, so ask for those first and by name.",
    head: ["Stall or job", "Hours", "Needed", "Name", "Phone", "Confirmed?"],
    widths: [30, 18, 10, 22, 16, 12],
    blocks: (() => {
      const STALLS = [
        ["Bump-in: marquees, mark out the oval", "Fri 4 – 7pm", 8],
        ["Setup crew", "7 – 10am", 12],
        ["Gate and wristbands", "9am – 3pm", 12],
        ["BBQ (five through the 12 – 2pm rush)", "9am – 3pm", 26],
        ["Cake stall", "9am – 3pm", 18],
        ["Trash and treasure", "9am – 3pm", 24],
        ["Drinks and slushies", "10am – 3pm", 15],
        ["Devonshire tea", "10am – 3pm", 15],
        ["Rides and wristband check", "10am – 3pm", 15],
        ["Face painting", "10am – 3pm", 15],
        ["Floats, cash runs and counting", "9.30am – 4pm", 4],
        ["Pack-down", "3 – 5pm", 12],
      ];
      const out = [];
      for (const [stall, hours, slots] of STALLS) {
        for (let i = 0; i < slots; i++) {
          out.push({
            cells: [i === 0 ? stall : "", i === 0 ? hours : "", i === 0 ? String(slots) : "", "", "", ""],
            style: i === 0 ? 2 : 0,
          });
        }
      }
      return out;
    })(),
  },
  {
    file: "sausage-sizzle-roster",
    sheet: "Sausage sizzle",
    title: "Sausage sizzle roster — one day",
    note: "12 to 14 people plus a coordinator covers a full day, weighted to the middle. A hardware car park fills from about 10.30am, so overstaff the shift starting at 10 — not the one at 8.",
    head: ["When", "Slot", "Job", "Name", "Phone", "Confirmed?"],
    widths: [18, 26, 26, 22, 16, 12],
    blocks: (() => {
      const SHIFTS = [
        ["All day", "BBQ Captain", ["7.30am – 5pm. Not rostered on the grill"]],
        ["7.30 – 8am", "Bump-in", ["Unload and gazebo", "Sandbags", "Plate hot, onions on", "Stock and float"]],
        ["8 – 10am", "Shift 1", ["Cook (18+)", "Bread and onions", "Money"]],
        ["10am – 12pm", "Shift 2 — peak starts here", ["Cook (18+)", "Cook (18+)", "Bread and serving", "Bread and serving", "Money"]],
        ["12 – 2pm", "Shift 3", ["Cook (18+)", "Cook (18+)", "Bread and serving", "Bread and serving", "Money"]],
        ["2 – 4pm", "Shift 4", ["Cook (18+)", "Bread", "Money and drinks"]],
        ["10am – 3pm", "Restock runner", ["Has a car. Ice, stock, emergency bread run"]],
        ["4 – 5pm", "Pack-down", ["Degrease the pad", "Bag rubbish", "Cash up", "Load out"]],
      ];
      const out = [];
      for (const [when, slot, jobs] of SHIFTS) {
        jobs.forEach((job, i) =>
          out.push({ cells: [i === 0 ? when : "", i === 0 ? slot : "", job, "", "", ""], style: i === 0 ? 2 : 0 }));
      }
      return out;
    })(),
  },
  {
    file: "club-canteen-roster",
    sheet: "Club canteen",
    title: "Sports club canteen roster — a Saturday",
    note: "Tie shifts to the game times, not the clock. Parents will do the shift either side of their own kid's game and resent anything else.",
    head: ["Shift", "Time", "Job", "Name", "Phone", "Confirmed?"],
    widths: [16, 20, 26, 22, 16, 12],
    blocks: (() => {
      const out = [];
      out.push(...block("Open up", "8:00am – 8:30am", ["Unlock, float, urn on"]));
      ["8:30am – 10:30am", "10:30am – 12:30pm", "12:30pm – 2:30pm", "2:30pm – 4:30pm"].forEach((t, i) =>
        out.push(...block(`Game ${i + 1}`, t, ["Canteen", "Canteen", "BBQ"])));
      out.push(...block("Close", "4:30pm – 5:15pm", ["Cash up and lock", "Clean and restock list"]));
      return out;
    })(),
  },
  {
    file: "working-bee-roster",
    sheet: "Working bee",
    title: "Working bee roster",
    note: "List the jobs, not the hours. People pick a job they can do and stay until it is done, which is not how a shift roster behaves.",
    head: ["Area", "Time", "Job", "Name", "Phone", "Confirmed?"],
    widths: [16, 20, 26, 22, 16, 12],
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
  const cols = t.head.length;
  const pad = (arr) => { const a = arr.slice(); while (a.length < cols) a.push(""); return a; };
  const rows = [
    { cells: pad([t.title]), style: 1 },
    pad([t.note]),
    pad([]),
    { cells: t.head, style: 1 },
    ...t.blocks.map((r) => (Array.isArray(r) ? pad(r) : { cells: pad(r.cells), style: r.style })),
    pad([]),
    pad(["Made with bitibybit.com/volunteer-roster/ — free, no accounts."]),
  ];
  writeXlsx(`${OUT}/${t.file}.xlsx`, { sheetName: t.sheet, rows, widths: t.widths });
  writeCsv(`${OUT}/${t.file}.csv`, rows);
  n++;
  console.log(`  ${t.file} — ${t.blocks.length} roster rows, ${cols} columns`);
}
console.log(`
${n} templates written to ${OUT}/`);
