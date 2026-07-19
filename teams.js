// Sports data: teams, records, past games, upcoming schedule, and brackets.
// Editors (or coders) update this file to keep records and schedules current.
window.WL_TEAMS = {
  "boys-soccer": {
    name: "Boys' Soccer",
    sport: "Soccer",
    season: "Spring 2026",
    coach: "Aiden Brooks",
    league: "Mid-Atlantic Athletic Conference",
    record: { w: 9, l: 3, t: 1 },
    games: [
      { date: "April 16, 2026", opponent: "Westlake", result: "W", score: "2-1", home: false, note: "OT — Hernandez 98'" },
      { date: "April 11, 2026", opponent: "Potomac",  result: "W", score: "3-0", home: true },
      { date: "April 9, 2026",  opponent: "Riverside", result: "L", score: "0-2", home: false },
      { date: "April 4, 2026",  opponent: "Carver",   result: "W", score: "4-1", home: true },
      { date: "March 30, 2026", opponent: "Edison",   result: "T", score: "1-1", home: false },
      { date: "March 26, 2026", opponent: "Jefferson", result: "W", score: "2-0", home: true }
    ],
    upcoming: [
      { date: "April 26, 2026", opponent: "Riverside", time: "2:00 PM", home: true, note: "Conference Semifinal", theme: "Whiteout" },
      { date: "April 30, 2026", opponent: "TBD",       time: "6:00 PM", home: true, note: "If advance — Conference Final" }
    ]
  },

  "girls-soccer": {
    name: "Girls' Soccer",
    sport: "Soccer",
    season: "Spring 2026",
    coach: "Margaret Finch",
    league: "Mid-Atlantic Athletic Conference",
    record: { w: 7, l: 4, t: 2 },
    games: [
      { date: "April 17, 2026", opponent: "Westlake",  result: "W", score: "2-0", home: true },
      { date: "April 12, 2026", opponent: "Riverside", result: "L", score: "1-3", home: false },
      { date: "April 8, 2026",  opponent: "Carver",    result: "W", score: "3-1", home: true },
      { date: "April 3, 2026",  opponent: "Potomac",   result: "T", score: "2-2", home: false },
      { date: "March 28, 2026", opponent: "Edison",    result: "W", score: "4-2", home: true }
    ],
    upcoming: [
      { date: "April 25, 2026", opponent: "Jefferson", time: "4:00 PM", home: true },
      { date: "May 2, 2026",    opponent: "Edison",    time: "2:00 PM", home: false }
    ]
  },

  "baseball": {
    name: "Baseball",
    sport: "Baseball",
    season: "Spring 2026",
    league: "Mid-Atlantic Athletic Conference",
    record: { w: 9, l: 6, t: 0 },
    games: [
      { date: "April 21, 2026", opponent: "St. Andrew's Episcopal",   result: "W", score: "9-0",  home: true,  note: "League" },
      { date: "April 17, 2026", opponent: "Potomac School",           result: "L", score: "1-9",  home: true,  note: "League" },
      { date: "April 13, 2026", opponent: "Jackson-Reed",             result: "L", score: "0-2",  home: true },
      { date: "April 9, 2026",  opponent: "Georgetown Day",           result: "W", score: "19-6", home: true,  note: "League" },
      { date: "April 7, 2026",  opponent: "Georgetown Day",           result: "W", score: "12-1", home: true,  note: "League" },
      { date: "April 4, 2026",  opponent: "School Without Walls",     result: "L", score: "2-3",  home: false },
      { date: "April 2, 2026",  opponent: "Flint Hill",               result: "L", score: "5-14", home: false, note: "League" },
      { date: "March 31, 2026", opponent: "Flint Hill",               result: "W", score: "6-4",  home: true,  note: "League" },
      { date: "March 22, 2026", opponent: "Burgettstown",             result: "W", score: "13-3", home: true },
      { date: "March 19, 2026", opponent: "DC International",         result: "W", score: "12-2", home: true,  note: "Barrett Field" },
      { date: "March 17, 2026", opponent: "Sidwell Friends",          result: "W", score: "6-0",  home: true,  note: "League" },
      { date: "March 14, 2026", opponent: "Sidwell Friends",          result: "W", score: "13-3", home: false, note: "League" },
      { date: "March 10, 2026", opponent: "Eastern",                  result: "W", score: "15-2", home: true },
      { date: "March 7, 2026",  opponent: "St. Albans",               result: "L", score: "2-6",  home: true,  note: "Doubleheader — game 2" },
      { date: "March 7, 2026",  opponent: "St. Albans",               result: "L", score: "2-16", home: true,  note: "Doubleheader — game 1" }
    ],
    upcoming: [
      { date: "April 23, 2026", opponent: "St. Andrew's Episcopal",   time: "4:30 PM", home: false, note: "League" },
      { date: "April 24, 2026", opponent: "Potomac School",           time: "4:30 PM", home: false, note: "League" },
      { date: "April 28, 2026", opponent: "Saint James",              time: "4:45 PM", home: false, note: "League · Hagerstown, MD" },
      { date: "April 30, 2026", opponent: "Saint James",              time: "4:30 PM", home: false, note: "League · Hagerstown, MD" },
      { date: "May 2, 2026",    opponent: "Washington Latin Public Charter School", time: "1:30 PM", home: true }
    ]
  },

  "softball": {
    name: "Softball",
    sport: "Softball",
    season: "Spring 2026",
    coach: "Dana Krieger",
    league: "Mid-Atlantic Athletic Conference",
    record: { w: 8, l: 2, t: 0 },
    games: [
      { date: "April 16, 2026", opponent: "Westlake",  result: "W", score: "10-3", home: false },
      { date: "April 12, 2026", opponent: "Potomac",   result: "W", score: "6-4",  home: true },
      { date: "April 8, 2026",  opponent: "Riverside", result: "L", score: "2-5",  home: false },
      { date: "April 4, 2026",  opponent: "Carver",    result: "W", score: "8-1",  home: true }
    ],
    upcoming: [
      { date: "April 24, 2026", opponent: "Jefferson", time: "4:00 PM", home: true },
      { date: "April 29, 2026", opponent: "Edison",    time: "5:30 PM", home: false }
    ]
  },

  "track": {
    name: "Track & Field",
    sport: "Track & Field",
    season: "Spring 2026",
    coach: "Lina Ramirez",
    league: "Mid-Atlantic Athletic Conference",
    record: { w: 4, l: 1, t: 0 },
    games: [
      { date: "April 13, 2026", opponent: "Northside Invitational", result: "W", score: "1st of 12", home: false },
      { date: "April 6, 2026",  opponent: "Dual: Westlake",         result: "W", score: "68-52",    home: true },
      { date: "March 29, 2026", opponent: "Edison Classic",          result: "W", score: "2nd of 8", home: false }
    ],
    upcoming: [
      { date: "April 24, 2026", opponent: "Woodley Relays",   time: "10:00 AM", home: true, note: "Home meet — 14 schools", theme: "Green Out" },
      { date: "May 1, 2026",    opponent: "Conference Champs", time: "9:00 AM", home: false }
    ]
  },

  "lacrosse-boys": {
    name: "Boys' Lacrosse",
    sport: "Lacrosse",
    season: "Spring 2026",
    coach: "Cole Matthews",
    league: "Mid-Atlantic Athletic Conference",
    record: { w: 5, l: 4, t: 0 },
    games: [
      { date: "April 14, 2026", opponent: "Riverside", result: "W", score: "11-8", home: true },
      { date: "April 10, 2026", opponent: "Jefferson", result: "L", score: "6-9",  home: false },
      { date: "April 5, 2026",  opponent: "Carver",    result: "W", score: "13-4", home: true }
    ],
    upcoming: [
      { date: "April 23, 2026", opponent: "Westlake",  time: "4:30 PM", home: false },
      { date: "April 28, 2026", opponent: "Potomac",   time: "5:00 PM", home: true }
    ]
  },

  "lacrosse-girls": {
    name: "Girls' Lacrosse",
    sport: "Lacrosse",
    season: "Spring 2026",
    coach: "Jess Reyna (interim)",
    league: "Mid-Atlantic Athletic Conference",
    record: { w: 7, l: 3, t: 0 },
    games: [
      { date: "April 17, 2026", opponent: "Edison",    result: "W", score: "12-6", home: true },
      { date: "April 13, 2026", opponent: "Jefferson", result: "W", score: "9-7",  home: false },
      { date: "April 9, 2026",  opponent: "Westlake",  result: "L", score: "5-11", home: true }
    ],
    upcoming: [
      { date: "April 23, 2026", opponent: "Potomac",   time: "4:00 PM", home: true },
      { date: "April 30, 2026", opponent: "Riverside", time: "4:30 PM", home: false }
    ]
  }
};

// Brackets — one per sport currently in playoffs. Each bracket has rounds
// (array of arrays). Each matchup has team1, team2, and optionally a result.
window.WL_BRACKETS = {
  "boys-soccer-spring-2026": {
    title: "Boys' Soccer — Conference Playoffs",
    sport: "Soccer",
    season: "Spring 2026",
    rounds: [
      {
        name: "Quarterfinals",
        matches: [
          { team1: "Maret",     team2: "Westlake",  result: { winner: "Maret",     score: "2-1 OT" } },
          { team1: "Riverside", team2: "Carver",    result: { winner: "Riverside", score: "3-0"    } },
          { team1: "Jefferson", team2: "Potomac",   result: { winner: "Jefferson", score: "2-1"    } },
          { team1: "Edison",    team2: "Hillcrest", result: { winner: "Edison",    score: "4-2"    } }
        ]
      },
      {
        name: "Semifinals",
        matches: [
          { team1: "Maret",     team2: "Riverside", result: null, scheduled: "April 26, 2026 · 2:00 PM · Home" },
          { team1: "Jefferson", team2: "Edison",    result: null, scheduled: "April 26, 2026 · 2:00 PM · Away" }
        ]
      },
      {
        name: "Final",
        matches: [
          { team1: "TBD", team2: "TBD", result: null, scheduled: "April 30, 2026 · 6:00 PM" }
        ]
      }
    ]
  },

  "softball-spring-2026": {
    title: "Softball — Conference Playoffs",
    sport: "Softball",
    season: "Spring 2026",
    rounds: [
      {
        name: "Semifinals",
        matches: [
          { team1: "Maret",     team2: "Jefferson", result: null, scheduled: "April 24, 2026 · 4:00 PM · Home" },
          { team1: "Potomac",   team2: "Edison",    result: null, scheduled: "April 24, 2026 · 4:00 PM · Away" }
        ]
      },
      {
        name: "Final",
        matches: [
          { team1: "TBD", team2: "TBD", result: null, scheduled: "April 29, 2026 · 6:00 PM" }
        ]
      }
    ]
  }
};
