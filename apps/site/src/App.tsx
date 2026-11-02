import { useEffect, useState } from 'react';
import { LEVEL_LABELS, RUBRIC_GUIDES } from '@progressflow/shared';
import type { PerformanceLevel } from '@progressflow/shared';
import { HintDiagram } from './components/HintDiagram';
import { site } from './config';

const SECTIONS = [
  ['abstract', 'Abstract'],
  ['screens', 'Screenshots'],
  ['how', 'How it works'],
  ['rubric', 'The rubric'],
  ['status', 'What works'],
  ['privacy', 'Privacy'],
  ['pilot', 'Pilot'],
  ['faq', 'Questions'],
  ['contact', 'Contact'],
] as const;

const LEVELS: PerformanceLevel[] = [1, 2, 3, 4];
const mailto = `mailto:${site.contactEmail}?subject=ProgressFlow`;

/** Marks the contents link for whichever section is on screen. */
function useActiveSection(): string {
  const [active, setActive] = useState<string>(SECTIONS[0][0]);
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = SECTIONS.find(([id]) => seen.get(id));
        if (first) setActive(first[0]);
      },
      { rootMargin: '-10% 0px -70% 0px' },
    );
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return active;
}

function Contents({ active }: { active: string }) {
  const items = SECTIONS.map(([id, label]) => (
    <li key={id}>
      <a href={`#${id}`} aria-current={active === id ? 'true' : undefined}>
        {label}
      </a>
    </li>
  ));
  return (
    <>
      <nav className="toc" aria-label="On this page">
        <h2>On this page</h2>
        <ol>{items}</ol>
      </nav>
      <details className="toc-mobile">
        <summary>On this page</summary>
        <nav aria-label="On this page, mobile">
          <ol>{items}</ol>
        </nav>
      </details>
    </>
  );
}

function H2({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id}>
      <a href={`#${id}`}>{children}</a>
    </h2>
  );
}

export function App() {
  const active = useActiveSection();

  return (
    <>
      <a className="skip" href="#main">
        Skip to the content
      </a>

      <header className="masthead">
        <div className="wrap">
          <h1>{site.name}</h1>
          <p className="sub">
            A phone app and web dashboard for assessing art and design work in Indian classrooms.
          </p>
          <p className="meta">
            Research prototype · version {site.version} · updated {site.updated}
          </p>
          <ul className="links">
            <li>
              <a className="btn solid" href={site.appUrl}>
                Teacher dashboard
              </a>
            </li>
            <li>
              <a className="btn" href={site.studentUrl}>
                Student portal
              </a>
            </li>
            <li>
              <a className="btn" href={mailto}>
                Ask for the Android app
              </a>
            </li>
            <li>
              <a className="btn" href="#contact">
                Contact
              </a>
            </li>
          </ul>
          <p className="note">
            The source code will be released when the project ends. The Android app is not on the
            Play Store yet; we send it to teachers directly.
          </p>
        </div>
      </header>

      <div className="wrap cols">
        <Contents active={active} />

        <main id="main">
          <section aria-labelledby="abstract">
            <H2 id="abstract">Abstract</H2>
            <p>
              Art teachers get very little help with assessment. Marking drawings and paintings is
              slow, rubrics mean different things to different people, and most apps assume English
              and a reliable internet connection.
            </p>
            <p>
              ProgressFlow is our attempt at something that fits an Indian classroom. A teacher
              photographs student work on a phone, scores it against a rubric that explains each
              level, draws on the image if they want to point something out, and records a spoken
              comment in Hindi, Telugu or English. All of this works offline. When the phone is next
              connected, the scores and photos upload to a web dashboard, where the teacher can
              follow each student over a term.
            </p>
            <p>
              It is a six-month research prototype (August to December 2026). A small classroom
              pilot is planned for the end of the term.
            </p>
            <div className="tldr">
              <h3>In short</h3>
              <ul>
                <li>
                  The camera works like a document scanner: it finds the page edges, captures when
                  the phone is steady, and takes a whole class set in one go.
                </li>
                <li>It warns you about blurry, dark or cropped photos before you save them.</li>
                <li>
                  It reads the roll number written on the page and suggests which student the work
                  belongs to.
                </li>
                <li>
                  The rubric has short descriptions, diagrams and prompts for each level. Markup on
                  the image can be switched off.
                </li>
                <li>
                  Voice notes in <span lang="hi">हिन्दी</span>, <span lang="te">తెలుగు</span> and
                  English.
                </li>
                <li>Android only so far. The iPhone version has not been built.</li>
              </ul>
            </div>
          </section>

          <section aria-labelledby="screens">
            <H2 id="screens">Screenshots</H2>
            <p>
              These are screenshots of the working app and dashboard, using sample data. No real
              students appear anywhere on this page.
            </p>

            <figure className="phone">
              <img
                src="/shots/app-review.jpg"
                width={1080}
                height={2215}
                loading="lazy"
                alt="The app's review screen on a phone. It shows a scanned exercise-book cover, a green box reading Good scan with the image size, sharpness and brightness, a row of retake, rotate and delete buttons, and Keep scanning and Save buttons at the bottom."
              />
              <figcaption>
                <strong>Figure 1.</strong> The review screen right after scanning. The page is an
                exercise-book cover, not student work. The numbers under “Good scan” are the raw
                readings the app uses to decide whether to ask for a retake.
              </figcaption>
            </figure>

            <figure>
              <img
                src="/shots/dash-class.jpg"
                width={800}
                height={528}
                loading="lazy"
                alt="The web dashboard page for Class 7-B. Four summary boxes show 5 students, 6 submissions, 0 to evaluate and an average level of 2.8. Below are horizontal bars for the class average on each of four criteria, and the start of a line chart of the class trend."
              />
              <figcaption>
                <strong>Figure 2.</strong> Class page in the web dashboard: class averages for each
                criterion and the trend over time.
              </figcaption>
            </figure>

            <figure>
              <img
                src="/shots/dash-submission.jpg"
                width={800}
                height={536}
                loading="lazy"
                alt="A single submission in the dashboard. A pencil drawing of two round fruit and a bowl has a red circle, a blue arrow and a yellow highlight drawn over it. On the right, four rubric criteria show their level from one to four with a short description."
              />
              <figcaption>
                <strong>Figure 3.</strong> One submission: the drawing with the teacher’s markup on
                the left, the score for each criterion on the right. The drawing is a test image we
                made.
              </figcaption>
            </figure>
          </section>

          <section aria-labelledby="how">
            <H2 id="how">How it works</H2>
            <ol>
              <li>
                <strong>Scan.</strong> Open a class and tap Scan artwork. The camera finds the edges
                of the page and captures when the phone is steady. You can scan a whole stack, then
                crop, rotate or retake any page.
              </li>
              <li>
                <strong>Check.</strong> Before anything is saved, each page is checked for blur, low
                light, glare, cut-off corners and sideways orientation. A problem comes with a plain
                explanation and a retake button. You can also accept it as it is.
              </li>
              <li>
                <strong>Identify.</strong> The app reads the text on the page and looks for a roll
                number or a name from the class list. It shows who it thinks the work belongs to and
                how it decided. You can change it.
              </li>
              <li>
                <strong>Score and mark up.</strong> Give each of four criteria a level from 1 to 4.
                Circle, highlight, point with an arrow or draw on the image. A switch hides all the
                markup without deleting it.
              </li>
              <li>
                <strong>Add feedback.</strong> Record a voice note, and attach an example image, a
                link or a short note if it helps.
              </li>
              <li>
                <strong>Review.</strong> The dashboard shows every class and student, with scans,
                scores and charts over time.
              </li>
            </ol>
          </section>

          <section aria-labelledby="rubric">
            <H2 id="rubric">The rubric</H2>
            <p>
              The app ships with one rubric of four criteria and four levels. The wording below is a
              draft that we wrote. During the pilot it will be replaced with descriptions written by
              art teachers, with example images for each level.
            </p>

            <div className="scroll">
              <table className="rubric">
                <caption>Default rubric, as shown in the app</caption>
                <thead>
                  <tr>
                    <th scope="col">Criterion</th>
                    {LEVELS.map((l) => (
                      <th scope="col" key={l}>
                        {l}. {LEVEL_LABELS[l]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RUBRIC_GUIDES.map((g) => (
                    <tr key={g.key}>
                      <th scope="row">{g.name}</th>
                      {LEVELS.map((l) => (
                        <td key={l} data-label={`${l}. ${LEVEL_LABELS[l]}`}>
                          {g.levels[l]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p>
              Each criterion also has a hint sheet in the app, with a diagram, three things to look
              for and a question to ask the student. Open one to see it.
            </p>
            {RUBRIC_GUIDES.map((g) => (
              <details key={g.key}>
                <summary>{g.name}: what to look for</summary>
                <div className="body hint">
                  <HintDiagram kind={g.key} />
                  <div>
                    <ul>
                      {g.lookFor.map((l) => (
                        <li key={l.title}>
                          <strong>{l.title}.</strong> {l.text}
                        </li>
                      ))}
                    </ul>
                    <p>Ask the student: “{g.askStudent}”</p>
                  </div>
                </div>
              </details>
            ))}
          </section>

          <section aria-labelledby="status">
            <H2 id="status">What works, and what doesn’t yet</H2>
            <p>
              This is the honest list. Where something has a catch, the catch is in the last column.
            </p>
            <div className="scroll">
              <table>
                <caption>Status of each part, as of {site.updated}</caption>
                <thead>
                  <tr>
                    <th scope="col">Part</th>
                    <th scope="col">State</th>
                    <th scope="col">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Scanning and review</th>
                    <td className="state good">Works</td>
                    <td>
                      Needs Google Play services on the phone. The blur and light thresholds were
                      tuned on a small number of photos, so expect some wrong calls.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Roll number and name matching</th>
                    <td className="state good">Works, with limits</td>
                    <td>
                      Reads Latin script and Devanagari only. Telugu names are not read, and
                      handwriting is hit and miss. Writing the roll number in digits works best.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Rubric, markup, voice notes, attachments</th>
                    <td className="state good">Works</td>
                    <td>The rubric wording is a draft.</td>
                  </tr>
                  <tr>
                    <th scope="row">Web dashboard</th>
                    <td className="state good">Works</td>
                    <td>Read-only. Work is entered on the phone.</td>
                  </tr>
                  <tr>
                    <th scope="row">Sync from phone to dashboard</th>
                    <td className="state warn">Being tested</td>
                    <td>Works on our test setup. Not yet tried on a school’s network.</td>
                  </tr>
                  <tr>
                    <th scope="row">iPhone app</th>
                    <td className="state todo">Not built</td>
                    <td>The code is shared with Android but has never been compiled for iOS.</td>
                  </tr>
                  <tr>
                    <th scope="row">Automatic transcripts of voice notes</th>
                    <td className="state todo">Not started</td>
                    <td>Audio is saved; nothing turns it into text yet.</td>
                  </tr>
                  <tr>
                    <th scope="row">Student self-review and peer review</th>
                    <td className="state todo">Not started</td>
                    <td>Students cannot use the app yet.</td>
                  </tr>
                  <tr>
                    <th scope="row">Screens in Hindi and Telugu</th>
                    <td className="state todo">Not started</td>
                    <td>Voice notes are trilingual. The interface is English.</td>
                  </tr>
                  <tr>
                    <th scope="row">Guardian consent and stronger encryption</th>
                    <td className="state todo">Not started</td>
                    <td>Needed before any school uses it. See Privacy.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="privacy">
            <H2 id="privacy">Privacy</H2>
            <p>
              The app handles photographs, voices and assessments of children, so we are designing
              around India’s Digital Personal Data Protection Act, 2023. We have not had it
              reviewed, and nothing here should be read as a compliance claim.
            </p>
            <h3>Done</h3>
            <ul>
              <li>
                The phone is locked with a PIN. It is stored in the device’s secure keystore,
                repeated wrong guesses cause a lockout, and the app locks itself after five minutes
                away.
              </li>
              <li>Each teacher’s classes and scans are kept separate, even on a shared phone.</li>
              <li>
                Nothing leaves the phone until the teacher links a web account. App data is excluded
                from cloud backups.
              </li>
              <li>
                Web passwords are salted and hashed. The server checks that every record belongs to
                the signed-in teacher before reading or writing it.
              </li>
            </ul>
            <h3>Not done</h3>
            <ul>
              <li>
                Recording guardian consent for each student, and refusing to photograph a student
                without it.
              </li>
              <li>
                Encrypting stored photos and recordings ourselves, rather than relying on the
                phone’s own encryption.
              </li>
              <li>
                Choosing where to host the data, with the pilot schools, and serving everything over
                HTTPS.
              </li>
              <li>Giving students access to their own work and nobody else’s.</li>
            </ul>
          </section>

          <section aria-labelledby="pilot">
            <H2 id="pilot">Pilot</H2>
            <p>
              The pilot is planned for late November and December 2026. These are the targets we
              set, not results.
            </p>
            <ul>
              <li>
                Halve the time a teacher spends assessing each student, measured during the pilot.
              </li>
              <li>An average of 4 out of 5 or better on an end-of-pilot teacher survey.</li>
              <li>Three to five teachers and at least 20 students in Classes 6 to 8.</li>
            </ul>
            <p>
              When the project ends we plan to publish the code under an open-source licence, an
              implementation guide for schools, and a write-up of the method and what we found,
              including what did not work.
            </p>
          </section>

          <section aria-labelledby="faq">
            <H2 id="faq">Questions</H2>
            <details open>
              <summary>Does it work without internet?</summary>
              <div className="body">
                <p>
                  Yes. Scanning, scoring, markup and voice notes are all stored on the phone first.
                  If you have linked a web account, everything uploads the next time the phone is
                  online.
                </p>
              </div>
            </details>
            <details>
              <summary>Which phones does it run on?</summary>
              <div className="body">
                <p>
                  Android 7 or newer, today. The scanner needs Google Play services. The dashboard
                  works in any modern browser, including on an iPhone.
                </p>
              </div>
            </details>
            <details>
              <summary>Can it read Telugu names?</summary>
              <div className="body">
                <p>
                  No. The text recogniser we use handles Latin and Devanagari scripts, not Telugu.
                  That is why matching leans on the roll number written in digits, and why the app
                  always shows its guess and lets the teacher change it.
                </p>
              </div>
            </details>
            <details>
              <summary>How do students sign in?</summary>
              <div className="body">
                <p>
                  With a 6-character code. The teacher finds each student’s code on the class page
                  of the dashboard and can print or replace it. The student opens the{' '}
                  <a href={site.studentUrl}>student portal</a> in any phone browser, types the code,
                  and sees only their own work. They can review their own work and, if the teacher
                  allows it, a classmate’s.
                </p>
              </div>
            </details>
            <details>
              <summary>Can I use my own rubric?</summary>
              <div className="body">
                <p>
                  Not yet. There is one built-in rubric. Custom rubrics are part of the pilot work.
                </p>
              </div>
            </details>
            <details>
              <summary>What does it cost?</summary>
              <div className="body">
                <p>
                  Nothing during the pilot. We intend to release the code as open source at the end.
                </p>
              </div>
            </details>
            <details>
              <summary>Who is building it?</summary>
              <div className="body">
                <p>
                  A small research team working on assessment in art and design education.{' '}
                  {site.affiliation ||
                    'We will add the institution and funder here once they are confirmed.'}
                </p>
              </div>
            </details>
          </section>

          <section aria-labelledby="contact">
            <H2 id="contact">Contact</H2>
            <p>
              If you teach art or design in Classes 6 to 8 and would try the app, or you work on
              assessment and want to compare notes, write to{' '}
              <a href={mailto}>{site.contactEmail}</a>.
            </p>
            <p>
              If you already have an account, <a href={site.appUrl}>sign in to the dashboard</a>.
            </p>
            <p>
              Students: open the <a href={site.studentUrl}>student portal</a> and type the
              6-character code your teacher gave you.
            </p>
          </section>
        </main>
      </div>

      <footer>
        <div className="wrap">
          <p>
            {site.name} {site.version}. Updated {site.updated}.
          </p>
          <p>
            This page sets no cookies, runs no analytics and makes no requests to other sites. Fonts
            are served from here.
          </p>
        </div>
      </footer>
    </>
  );
}
