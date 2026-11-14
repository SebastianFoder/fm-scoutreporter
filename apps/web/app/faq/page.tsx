import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { JsonLd, breadcrumbLd } from "@/components/JsonLd";
import { FORMATIONS } from "@scoutreporter/core/best-xi/formations";
import { AGE_BENCHMARK, PRIME_BENCHMARK } from "@scoutreporter/core/fm27/benchmarks";
import { GRADE_SCALE, PRIME_GRADE } from "@scoutreporter/core/grades";
import { VIEW_HIDDEN, VIEW_STANDARD } from "@scoutreporter/core/view-files";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "FAQ: FM27 and FM26 scouting, exports and scores",
  description:
    "Answers about Scout Reporter: exporting Football Manager 27 and 26 players to CSV, which view to use, privacy, how scores, grades and vs Age work, finding wonderkids from CA and PA, Best XI and scouting staff.",
  path: "/faq",
});

interface Faq {
  q: string;
  /** Plain text, so the same words go into the page and the FAQPage structured data. */
  a: string;
  more?: { href: string; label: string };
}

const youngest = Math.min(...Object.keys(AGE_BENCHMARK).map(Number));
const lowestGraded = GRADE_SCALE[GRADE_SCALE.length - 2];
const formationCount = FORMATIONS.length;

const GROUPS: { title: string; items: Faq[] }[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "What is Scout Reporter?",
        a: "Scout Reporter is a free scouting tool for Football Manager. You import a CSV export of a player list from FM27 or FM26, and it scores every player on weighted attributes, grades them from S++ to F, compares them side by side, estimates wonderkids' attributes at full potential and picks a Best XI within a budget.",
      },
      {
        q: "Does it work with FM27 and FM26?",
        a: "Yes. Both games export the same attributes through the Scout Reporter views, so imports from either work in every mode. FM27 exports with FM View Exporter; FM26 exports with BepInEx and the FM26 Player CSV Export plugin. The scoring profiles and growth estimates are calibrated on FM27 data.",
        more: { href: "/how-to-use", label: "Setup guide for both versions" },
      },
      {
        q: "How do I export players from Football Manager to CSV?",
        a: "Install an exporter plugin (FM View Exporter for FM27, or BepInEx with the FM26 Player CSV Export plugin), download a Scout Reporter view file and put it in your FM views folder. In the Player Database, right-click a column header, choose Import View, select the view, filter the players you want and press F9. Then import the CSV here.",
        more: { href: "/how-to-use", label: "Step-by-step export guide" },
      },
      {
        q: "Which view file should I use?",
        a: `The ${VIEW_HIDDEN.name} is recommended: it exports every attribute plus the hidden Professionalism, Current Ability (CA) and Potential Ability (PA), which unlocks Potential scores for finding wonderkids. The ${VIEW_STANDARD.name} exports the visible attributes only, which is enough for the player list and Best XI.`,
      },
      {
        q: "Does it work on Mac or Linux?",
        a: "The website runs in any modern browser. The export happens inside Football Manager: FM View Exporter for FM27 needs the Steam version on Windows 10 or 11, and the FM26 guide includes the Steam launch option needed to run BepInEx under Linux.",
      },
      {
        q: "Is Scout Reporter free?",
        a: "Yes. It is free to use, has no account or sign-up, and the source code is public on GitHub.",
      },
    ],
  },
  {
    title: "Privacy",
    items: [
      {
        q: "Is my CSV or save file uploaded anywhere?",
        a: "No. The CSV is read and scored in your browser and never sent to a server. The last import is kept in your browser's local storage so it survives a reload, along with your weight, highlight and threshold profiles. Importing a new file replaces it, and clearing site data removes it.",
      },
    ],
  },
  {
    title: "Scores and grades",
    items: [
      {
        q: "How are players scored?",
        a: "Each attribute gets a weight. A player's score is the weighted average of their attributes on FM's 1 to 20 scale, and the 100-point score divides that average by 13 (a solid professional) and multiplies by 100. Change the weights and the list re-ranks instantly.",
        more: { href: "/how-to-use/players", label: "How players are scored" },
      },
      {
        q: "What are the FM27 benchmark role profiles?",
        a: "Five weight profiles, Centre-back, Wing-back / DM (6), Attacker / Winger (10), Striker (9) and Goalkeeper, taken from fm-scoring's FM27 weights. They are tuned toward an FM27 match-engine attribute test, where pace, acceleration and jumping reach matter most. You can edit them and reset them to the benchmark at any time.",
      },
      {
        q: "What do the S++ to F grades mean?",
        a: `Grades read the weighted average on the 1 to 20 scale and step every 0.5: S++ starts at ${GRADE_SCALE[0].min.toFixed(1)}, ${lowestGraded.grade} at ${lowestGraded.min.toFixed(1)}, and anything lower is an F. The prime benchmark of ${PRIME_BENCHMARK.toFixed(1)}, a high-end Championship or low-end Premier League player in their prime, is a ${PRIME_GRADE}.`,
      },
      {
        q: "What does vs Age mean?",
        a: `vs Age divides a player's score by the FM27 benchmark for their age, from ${AGE_BENCHMARK[youngest].toFixed(1)} at ${youngest} up to ${PRIME_BENCHMARK.toFixed(1)} at 24 and older. 100% means the player is on track to be a high-end Championship or low-end Premier League player in their prime, so it is the fairest way to compare young players with each other.`,
      },
    ],
  },
  {
    title: "Wonderkids, Best XI and squads",
    items: [
      {
        q: "How does Scout Reporter find wonderkids?",
        a: "With a Hidden Attributes export it fits CA as a position-weighted sum of attributes, works out how many attribute points the gap between CA and PA buys, and spreads them over the attributes that can still grow, following how fast each one grew in an FM27 training test. It then ranks prospects on the FM27 roles at full potential. Filter by age, professionalism and best role.",
        more: { href: "/how-to-use/wonderkids", label: "How the potential estimate works" },
      },
      {
        q: "Will a player actually reach the potential shown?",
        a: "Not necessarily. The estimate is the ceiling if the player reaches their PA. Professionalism, playing time, training and coaching decide how much of it they reach, which is why every player page includes a development plan with an individual focus, training role and the sessions that matter most.",
      },
      {
        q: "How does the Best XI picker work?",
        a: `Choose one of ${formationCount} FM preset formations, or build your own on an FM-style tactics pitch and save it, and Scout Reporter picks the eleven players from your import with the highest combined score, with each position scored on a weight profile you choose (the FM27 benchmark roles by default). You can set a minimum and maximum total transfer value, and exclude players to see the next best option.`,
        more: { href: "/players/best-xi", label: "Open Best XI" },
      },
      {
        q: "How does Squad analysis work?",
        a: "Import the Scout Reporter Squad view (or Squad Hidden Attributes view) on your squad screen, export it and import the CSV in Squad analysis. It is stored separately from your player import, so your scouting list stays loaded. Pick your formation and it builds your strongest eleven, then the strongest eleven from everyone left as cover, and flags positions nobody plays, starters well below the team's average, positions with no backup or a big drop to the backup, and starters aged 31 or over (34 for keepers). The Squad view also exports your team sheet, squad status, injuries and the coach's star ratings: players out on loan are left out (injured ones too if you choose), players promised a starting place who miss the eleven and low-status players who start are flagged, your FM starting eleven is compared with the suggested one, and youngsters the coach rates well above a starter are pointed out. With the hidden view those prospects come from projected attributes instead. If your player import holds scouting targets, it lists the ones who would beat your weakest starter at each position.",
        more: { href: "/squad", label: "Open Squad analysis" },
      },
    ],
  },
  {
    title: "Staff",
    items: [
      {
        q: "How do I scout staff?",
        a: "Import the Scout Reporter Staff view in an FM staff search (right-click a column header, then Import View), select the staff and export a CSV the same way as players. Import that CSV under Staff. It is stored separately from your player import, so both can be loaded at once.",
        more: { href: "/staff", label: "Open Staff" },
      },
      {
        q: "FM26 shows staff attributes as words. How are they scored?",
        a: "Each word covers a fixed range of the old 1 to 20 scale: Unsuited 1 to 3, Reasonable 4 to 6, Competent 7 to 9, Average 10 to 11, Good 12 to 14, Very Good 15 to 17, Outstanding 18 to 19 and Elite 20. Scout Reporter scores each word at the middle of its range, and uses exact numbers when an export has them.",
      },
      {
        q: "How are staff role scores worked out?",
        a: "Each role is a weighted average of its attributes, using the 17 staff roles and weights from fm-scoring, checked against the key attributes FM27 highlights on staff profiles. Coaches are split into FM's nine coaching groups (each scored on its two coaching attributes plus authority, determination, motivating, people management and working with youngsters), alongside manager, assistant manager, director of football, head of youth development, scout, performance analyst, physio and sports scientist. Every role score gets the same S++ to F grade stamp as player scores. Filter by preferred job to see only the attributes that job is weighted on, or open a staff member to see every role ranked.",
      },
      {
        q: "How does Best backroom pick my staff?",
        a: "Choose how many of each staff role you need, or start from a preset (full backroom, coaching staff, recruitment team, medical team). Best backroom fills every role from your staff import with the combination that has the highest total role score, never using one person twice, so an all-rounder goes where they add the most. You can limit it to free agents, to staff whose preferred job is the role, and exclude anyone to see the next best pick.",
        more: { href: "/staff/backroom", label: "Open Best backroom" },
      },
    ],
  },
];

const FAQ_LD = {
  "@type": "FAQPage",
  mainEntity: GROUPS.flatMap((g) => g.items).map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function FaqPage() {
  return (
    <div className="text-ink">
      <JsonLd data={[FAQ_LD, breadcrumbLd([{ name: "FAQ", path: "/faq" }])]} />
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-6 md:py-8">
        <PageHeader title="Frequently asked questions">
          Exporting from FM27 and FM26, privacy, and how the scores work. Still stuck? The{" "}
          <Link href="/how-to-use" className="link">
            setup guide
          </Link>{" "}
          walks through every step.
        </PageHeader>

        {GROUPS.map((group) => {
          const id = `faq-${group.title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
          return (
            <section key={group.title} aria-labelledby={id}>
              <h2 id={id} className="section-title mb-2">
                {group.title}
              </h2>
              <div className="panel">
                {group.items.map((item) => (
                  <div key={item.q} className="border-b border-line px-4 py-3.5 last:border-0">
                    <h3 className="text-base font-semibold">{item.q}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink/85">{item.a}</p>
                    {item.more && (
                      <p className="mt-1.5 text-sm">
                        <Link href={item.more.href} className="link">
                          {item.more.label}
                        </Link>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
