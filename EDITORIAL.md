# Editorial policy — The Woodley Leaves online

This page answers the questions an adviser, a subject of a story, or next
year's editor-in-chief will actually ask. It is about people and decisions, not
software.

**Status: proposed.** Written by the online editors for the faculty adviser to
approve, amend, or replace. Nothing here binds the school until the adviser
says it does.

---

## Who publishes

**The online edition carries the print edition's stories.** They are the same
articles. They have already been reported, edited and approved as part of
putting out the paper, and they do not go through a second screening to appear
online. Publishing online is republishing, not deciding.

That is worth saying plainly, because it answers the question people usually ask
first — *who checks it before it goes up?* — and the answer is: the same people
who checked it before it went to print, in the same process, before it ever
reached this site.

So the sequence that matters is the print one:

| Step | Who |
|---|---|
| Write and file | The writer |
| Edit — accuracy, fairness, clarity | The section editor |
| The decision to run it | The Editor-in-Chief |
| Put it on the site | Any editor with publish access |

**Everyone with publish access has the same rights: students and the adviser
alike.** The adviser is not a separate tier with special powers, and does not
have to ask a student to act. They can publish and they can pull, directly and
immediately, exactly as any editor can. There is no approval queue, no override
button, and no technical distinction anywhere in the software — `role: "editor"`
is one role, and it means the same thing for a teacher as for a senior.

This is deliberate. An adviser who has to text a sixteen-year-old to get
something taken down does not really have the authority everyone assumes they
have. Giving them the same access removes that gap instead of papering over it.

### The one thing that is genuinely different online

Some of what this site carries has no print edition behind it — video, puzzles
and games, and anything posted as breaking news between issues. Those have not
been through the print process, because there was no print process for them.

**Who reads those before they go up is the open question, and it is the
adviser's to answer, not ours.** Until it is answered, the working assumption is
that they follow the same path as print: the Editor-in-Chief decides, and
anything in the list below goes to the adviser first.

### What goes to the adviser before publishing

Independence is not the same as recklessness. These go to the adviser *before*
publishing — not for permission, but so nobody is surprised:

- A story accusing a **named** student, teacher, or staff member of wrongdoing
- Anything involving discipline, an investigation, or a police matter
- Anything involving a student's health, family, immigration status, sexuality,
  or anything else that is theirs to disclose and not ours
- Anything relying on an **anonymous source**
- Anything a subject has already asked us not to run

For print stories this is settled before the issue goes out, so it is rarely a
question by the time the story reaches the site. For online-only material it is
the whole of the check.

The test is not "is this allowed." It is: *if this is wrong, who gets hurt, and
can that be undone?* Where the answer is a person and "no," we ask first.

---

## Corrections

**We correct in public. We do not quietly edit.**

- A **typo, broken link, or formatting fix** can be changed silently.
- **Anything that changes what a story says** — a fact, a name, a number, a
  quote, a headline's meaning — gets a correction note appended to the story,
  dated, saying what was wrong and what it now says. The original error is
  described, not hidden.
- If the error was serious enough that someone acted on it, the correction goes
  on the front page for one publication cycle.

Corrections are not an admission that the paper is bad. A paper that never
corrects anything is one that isn't checking.

**Ask for a correction:** email the Editor-in-Chief (address in the footer of
every page). We answer every request, including the ones we decline, and we say
why. A request left unanswered is the failure — not a request we say no to.

---

## Unpublishing and takedown requests

The default is **no**. A published story is part of the record, and a paper
that removes stories on request isn't one.

The exceptions, which are real:

1. **The adviser or the school says so.** Immediate, no debate — and the adviser
   does not have to ask anyone to do it, because they have the same publish and
   unpublish access every other editor has.
2. **It is false and we cannot fix it.** Then it comes down and a note says
   the story was removed and why.
3. **It endangers someone.** Safety outranks the archive, always.
4. **A source who was a minor at the time asks**, and the material is
   sensitive, and there is no public interest in keeping their name attached.
   We prefer to **unname** rather than **unpublish** — remove the name, keep
   the story.

We say no to: "it's embarrassing now," "I've changed my mind about the quote I
gave on the record," and "a college might see it." We will say that kindly, and
we will say it in writing.

### One thing everybody needs to know about deletion

**The site's content lives in a git repository, and git keeps history.**
Removing a story from the live site removes it from what readers see. It does
**not** erase it from the repository's history, where anyone with access to the
repo can still find it.

If a story ever needs to be *genuinely* gone — a safety case, or a legal
demand — removing the file is not enough, and whoever maintains the site has to
purge it from the history and force-push. Do not promise a subject that
something has been erased until that has actually been done.

While the Maret repository stays private, this is a small circle. If it is ever
made public, this becomes a live problem, and it should be settled before then.

---

## Bylines, anonymity, and photographs

- **Stories carry a byline.** A student who writes something takes their name
  with it — that is most of what makes it journalism.
- **A byline may be withheld** if publishing it would put the writer at real
  risk. The Editor-in-Chief and the adviser both have to agree, and the story
  says a byline was withheld rather than pretending it had none.
- **Anonymous sources** are a last resort, never used to let someone criticise
  a named person without accountability. The Editor-in-Chief must know who the
  source is. If the EIC can't know, the story doesn't run.
- **Photographs of students** follow whatever the school's existing media-consent
  rules are — the paper does not get its own looser standard. A student who
  asks not to be photographed for the paper isn't photographed for the paper.

---

## Reader data

The newsletter collects **an email address and nothing else**. No phone
numbers, deliberately — see `setup/README.md`.

- The subscriber list lives in a **school-owned** Google account, not a
  student's.
- It is used for one thing: sending the paper. Nothing else, ever, without
  asking subscribers first.
- Anyone can get off it by asking any editor. Someone has to actually answer.
- When the editor who set it up graduates, the account survives. That's the
  point of it being school-owned.

---

## Who holds what

Every account this paper depends on should be owned by the school or the
publication, not by a student who graduates.

| Thing | Should be owned by | Shared with |
|---|---|---|
| The site repository | The paper / school | Current online editors, the adviser |
| The subscriber Sheet and its script | The paper / school | Current EIC |
| The shared-editing service (Cloudflare) | The paper / school | Current online editors |
| The editor key for shared editing | — | Every editor; change it when one leaves |
| The GitHub token the service publishes with | — | Nobody. It lives in the service. |
| The domain or subdomain, if any | The school | — |

The shared-editing service now holds the paper's working content. If it is on a
student's personal account, the paper loses shared editing the day that account
goes — move it to one the publication keeps.

**Review this list every August.** Add the incoming editors, remove the ones
who graduated. An account nobody can get into is the normal way a student
publication loses its archive.

---

## Succession

The two editors who built this site graduate in **June 2027**. A paper that
depends on them is a paper with an expiry date.

Before then:

- **Name a Web Editor from the rising class**, this school year, with real
  publish access and real stories published under supervision. Not a shadow —
  someone who has actually done it.
- **Put "Web Editor" in the masthead** as a standing role, so it is filled every
  year the way Sports Editor is.
- **Hold a training session each August**, on the masthead calendar, run by the
  outgoing Web Editor for the incoming one.
- **The adviser keeps access** independently of any student, so a lost password
  is never the end of the paper.

If exactly one person understands how to publish, the paper is one bad week
from silence. Two people, minimum, at all times.

---

## When something goes wrong

1. **Take it down first if anyone could be harmed.** Argue about whether that
   was right afterwards. Nobody is ever in trouble for pulling something too
   fast.
2. **Tell the adviser** the same day. Not a draft of what you'll say — tell them.
3. **Write down what happened** while it's fresh.
4. **Correct in public** if readers saw the mistake.

The failure mode that ends student papers isn't publishing something wrong.
It's an adviser finding out from somebody else.

---

*Adopted: [FILL IN — date the adviser approves this]*
*Reviewed annually each August by the incoming masthead.*
