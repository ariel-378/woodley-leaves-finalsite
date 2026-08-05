// Default masthead/staff for the site. Editors manage this from the dashboard
// (Staff tab); their changes are stored in localStorage and override these
// defaults. "Reset staff to defaults" restores this list.
//
// This is the real online masthead, and it is deliberately short: only the two
// online editors are listed, because those are the roles whose addresses the
// footer already publishes from config.js. Section editors, writers,
// photography and the faculty adviser are NOT listed yet — add them from the
// Staff tab rather than inventing entries here. The groups below are the
// headings they will file under.
window.WL_STAFF_GROUPS = [
  "Leadership",
  "Section Editors",
  "Writers & Contributors",
  "Photography & Design",
  "Faculty Adviser"
];

window.WL_STAFF = [
  {
    id: "ariel-pollard",
    name: "Ariel Pollard",
    role: "Online Editor-in-Chief",
    year: "Class of 2027",
    group: "Leadership",
    email: "arielp2027@maret.org",
    slug: "ariel-pollard",
    photo: ""
  },
  {
    id: "farryn-b",
    name: "the Online Managing Editor",
    role: "Online Managing Editor",
    year: "Class of 2027",
    group: "Leadership",
    email: "farrynb2027@maret.org",
    slug: "farryn-b",
    photo: ""
  }
];
