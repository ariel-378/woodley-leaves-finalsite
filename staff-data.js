// Default masthead/staff for the site. Editors manage this from the dashboard
// (Staff tab); their changes are stored in localStorage and override these
// defaults. "Reset staff to defaults" restores this list.
//
// The people below are placeholders, so their addresses are placeholders too —
// a real address on an invented name misroutes mail and reads as a leak. The
// paper's actual contacts live in config.js (`contacts`), which is what the
// footer publishes. Enter the real masthead from the Staff tab.
window.WL_STAFF_GROUPS = [
  "Leadership",
  "Section Editors",
  "Writers & Contributors",
  "Photography & Design",
  "Faculty Adviser"
];

window.WL_STAFF = [
  {
    id: "jordan-marsh",
    name: "Jordan Marsh",
    role: "Online Editor-in-Chief",
    year: "Class of 2027",
    group: "Leadership",
    email: "jordan.marsh@example.org",
    slug: "jordan-marsh",
    photo: ""
  },
  {
    id: "harper-l",
    name: "Harper L.",
    role: "Online Managing Editor",
    year: "Class of 2027",
    group: "Leadership",
    email: "harper.l@example.org",
    slug: "harper-l",
    photo: ""
  }
];
