// Editable masthead/staff list. Nothing about the hierarchy is hard-coded here:
// both the group order (the tiers on the staff page) and the members come from
// editable data — shipped defaults (window.WL_STAFF_GROUPS / window.WL_STAFF in
// staff-data.js) merged with editor changes in localStorage.
//
// Member: { id, name, role, year, group, email, slug, photo }
//   group = the name of one of the editor-defined groups.
window.WLStaff = (function () {
  const LS_MEMBERS = "wl_staff";
  const LS_GROUPS = "wl_staff_groups";

  function readArr(key) {
    try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : null; }
    catch { return null; }
  }
  function fire() { document.dispatchEvent(new CustomEvent("wl-staff-change")); }

  // ===== Members =====
  function getAll() {
    const stored = readArr(LS_MEMBERS);
    if (stored) return stored;
    return Array.isArray(window.WL_STAFF) ? window.WL_STAFF.map(m => ({ ...m })) : [];
  }
  function saveAllMembers(list) { localStorage.setItem(LS_MEMBERS, JSON.stringify(list)); fire(); }
  function get(id) { return getAll().find(m => m.id === id) || null; }
  function save(member) {
    const list = getAll();
    const i = list.findIndex(m => m.id === member.id);
    if (i >= 0) list[i] = member; else list.push(member);
    saveAllMembers(list);
  }
  function remove(id) { saveAllMembers(getAll().filter(m => m.id !== id)); }

  // Reorder a member within its own group (dir = -1 up, +1 down).
  function move(id, dir) {
    const list = getAll();
    const i = list.findIndex(m => m.id === id);
    if (i < 0) return;
    const group = list[i].group;
    let j = i + dir;
    while (j >= 0 && j < list.length && list[j].group !== group) j += dir;
    if (j < 0 || j >= list.length) return;
    const t = list[i]; list[i] = list[j]; list[j] = t;
    saveAllMembers(list);
  }

  // ===== Groups (the hierarchy) =====
  function getGroups() {
    const stored = readArr(LS_GROUPS);
    if (stored) return stored;
    if (Array.isArray(window.WL_STAFF_GROUPS)) return window.WL_STAFF_GROUPS.slice();
    // Last resort: derive from whatever members exist.
    const g = [];
    getAll().forEach(m => { if (m.group && !g.includes(m.group)) g.push(m.group); });
    return g;
  }
  function saveGroups(list) { localStorage.setItem(LS_GROUPS, JSON.stringify(list)); fire(); }

  function addGroup(name) {
    name = String(name || "").trim();
    if (!name) return false;
    const g = getGroups();
    if (g.includes(name)) return false;
    g.push(name); saveGroups(g);
    return true;
  }
  function renameGroup(oldName, newName) {
    newName = String(newName || "").trim();
    if (!newName) return false;
    const g = getGroups();
    const i = g.indexOf(oldName);
    if (i < 0) return false;
    if (newName !== oldName && g.includes(newName)) return false;
    g[i] = newName;
    const members = getAll();
    members.forEach(m => { if (m.group === oldName) m.group = newName; });
    localStorage.setItem(LS_MEMBERS, JSON.stringify(members));
    saveGroups(g); // fires once
    return true;
  }
  function removeGroup(name) { saveGroups(getGroups().filter(x => x !== name)); }
  function moveGroup(name, dir) {
    const g = getGroups();
    const i = g.indexOf(name);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= g.length) return;
    const t = g[i]; g[i] = g[j]; g[j] = t;
    saveGroups(g);
  }

  // Full render order: editor-defined groups first, then any orphan groups that
  // members still reference (so nobody silently disappears).
  function orderedGroups() {
    const g = getGroups().slice();
    getAll().forEach(m => { if (m.group && !g.includes(m.group)) g.push(m.group); });
    return g;
  }
  function countIn(group) { return getAll().filter(m => m.group === group).length; }

  function reset() {
    localStorage.removeItem(LS_MEMBERS);
    localStorage.removeItem(LS_GROUPS);
    fire();
  }

  return {
    getAll, get, save, remove, move, saveAllMembers,
    getGroups, saveGroups, addGroup, renameGroup, removeGroup, moveGroup,
    orderedGroups, countIn, reset
  };
})();
