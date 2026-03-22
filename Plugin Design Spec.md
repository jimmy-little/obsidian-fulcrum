# Obsidian Project Manager — Plugin Design Spec

**Version:** 0.1 (Draft)
**Date:** 2026-03-21
**Status:** In Design

---

## 1. Overview

A personal-first, full-featured project management plugin for Obsidian. Built around the user's existing vault patterns (TaskNotes, Tasks plugin inline todos, dated meeting notes, and scattered project notes), this plugin introduces a coherent **Area → Project → Task** hierarchy with custom views, stat dashboards, and optional charts — all configurable to accommodate different vault layouts.

The plugin reads and writes standard Obsidian frontmatter, keeps data portable (plain markdown, no proprietary database), and integrates with the Tasks and TaskNotes ecosystem already in use.

### Design Principles

- **Vault-native:** All data lives in markdown files with frontmatter. Nothing is stored externally.
- **Non-destructive:** The plugin reads existing notes without requiring migration. Frontmatter schemas are additive.
- **Configurable paths and fields:** Folder locations and frontmatter key names are all configurable in settings.
- **Personal first:** Opinionated defaults for a single-user vault. Team features are out of scope for Phase 1.
- **Progressive disclosure:** Simple by default, powerful when needed.

---

## 2. Data Model

The plugin organizes vault content into five entity types. Each maps to one or more note types in the vault.

### 2.1 Area

The broadest unit of organization. An Area groups related Projects under a theme (e.g., *Work*, *Home*, *Health*). Areas are long-running and don't have due dates or completion states.

**Storage:** Configurable folder (default: `40 Projects/`). Identified by `type: area` in frontmatter.

**Frontmatter schema:**
```yaml
type: area
name: Health & Fitness
status: active          # active | archived
color: "#4ECDC4"        # optional hex color for UI theming
icon: 🏋️               # optional emoji icon
description: "..."      # optional summary shown in area overview
```

**Migration note:** Existing notes like `Health & Fitness.md` and `Home Maintenance.md` already act as Areas — adding `type: area` to their frontmatter is the only change required.

---

### 2.2 Project

A scoped, completable initiative belonging to an Area. Has a status, optional dates, and links to tasks, meetings, and notes.

**Storage:** Configurable folder (default: `40 Projects/`). Identified by `type: project` in frontmatter.

**Frontmatter schema:**
```yaml
type: project
name: Kitchen Renovation
area: "[[Health & Fitness]]"   # wikilink to Area note
status: active                 # planning | active | on-hold | completed | archived
priority: medium               # high | medium | low
startDate: 2026-01-01
dueDate: 2026-06-30
completedDate:
tags: []
description: "..."
```

**Migration note:** Existing project notes already have `name`, `status`, and `uuid` fields. The plugin will treat any note with `type: project` as a project; existing notes can be opted in by adding that field.

---

### 2.3 Task

Individual actionable items. The plugin supports **two task sources** simultaneously:

#### Mode A — TaskNotes
Standalone markdown files in the TaskNotes folder. Identified by `tags: task` (current convention) or configurable frontmatter field.

**Relevant frontmatter (current + additions):**
```yaml
tags:
  - task
title: Write ticket for ITM team
status: todo              # todo | in-progress | done | cancelled
priority: medium
project: "[[Kitchen Renovation]]"   # ADD: link to project
area: "[[Home Maintenance]]"        # ADD: optional area link
dueDate: 2026-04-01
completedDate:
dateModified: 2026-03-16T14:51:38.665-07:00
```

#### Mode B — Inline Tasks (Tasks plugin)
Checkbox todos embedded anywhere in the vault, parsed by the Tasks plugin. The plugin reads these via the Tasks plugin's API (if available) or by scanning file content directly.

Format: `- [ ] Task description 📅 2026-04-01 #project/kitchen-renovation`

**Settings allow:**
- Enabling either or both modes
- Configuring how inline tasks are associated with a project (e.g., via file location, tags, or Tasks plugin metadata)

---

### 2.4 Meeting

Time-bounded notes created from calendar events. Already have a rich frontmatter schema.

**Storage:** `30 Work/Meetings/YYYY/MM/` (configurable)

**Relevant frontmatter (current + additions):**
```yaml
date: "2026-01-05"
project: "[[Kitchen Renovation]]"   # POPULATE: links meeting to a project
entry: Meeting title
startTime: "2026-01-05T11:30:00"
endTime: "2026-01-05T12:04:00"
duration: 34
attendees: []
```

The `project` field is already present in the schema but often blank. Filling it in (manually or via a command) is the primary integration point.

---

### 2.5 Note

Any vault note associated with a project via frontmatter. No special note type required — if a note has a `project` field pointing to a project, it appears in that project's related notes panel.

**Frontmatter (minimal):**
```yaml
project: "[[Kitchen Renovation]]"
```

---

## 3. Plugin Architecture

### 3.1 Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Required for Obsidian plugins |
| UI Framework | Svelte | Most common in Obsidian plugin ecosystem; lightweight; reactive |
| Build | esbuild (via Obsidian plugin template) | Standard toolchain |
| Querying | In-memory index over MetadataCache | Fast; no external DB; leverages Obsidian's existing cache |
| Charts | Chart.js or D3.js (bundled) | Wide support; customizable |

### 3.2 Core Systems

**Index Service**
Maintains an in-memory map of all entities (Areas, Projects, Tasks, Meetings, Notes). Built on vault open and updated on file modify/create/delete events via Obsidian's `vault.on('modify', ...)` API. Enables sub-millisecond queries without disk reads.

**MetadataCache Reader**
Uses `app.metadataCache.getFileCache()` to read frontmatter without opening files. Falls back to `vault.cachedRead()` for inline task scanning.

**Tasks Plugin Bridge**
Checks for the Tasks plugin at startup. If present, uses its query API for inline task resolution. If absent, the plugin scans file content directly using a configurable regex pattern.

**Settings Manager**
Persists user configuration to `data.json` (standard Obsidian plugin storage). Settings are read once at startup and on change.

### 3.3 Views (Custom Leaf Types)

| View | Leaf Type | Description |
|---|---|---|
| Dashboard | `pm-dashboard` | Global overview of all Areas and active Projects |
| Area Overview | `pm-area` | All projects within an area + aggregate stats |
| Project Summary | `pm-project` | Full project detail view (stat cards, tasks, meetings, notes) |
| Task Board | `pm-taskboard` | Kanban board view for tasks within a project or area |
| Timeline | `pm-timeline` | Gantt-style view across projects |

Views are opened as Obsidian workspace leaves (sidepanel or main area, configurable). Each view registers its own `ItemView` subclass.

### 3.4 Commands (Command Palette)

- `PM: Open Dashboard`
- `PM: Open Project Summary` (prompts for project or reads from active note context)
- `PM: Open Task Board`
- `PM: New Project` (creates project note with template)
- `PM: New Task` (creates TaskNote or inline, configurable)
- `PM: Link Meeting to Project` (sets `project` field on active meeting note)
- `PM: Link Note to Project` (sets `project` field on active note)
- `PM: Reindex Vault` (force refresh of the index)

### 3.5 Ribbon Icons

- Dashboard icon → opens Dashboard view
- (Optional) New Task quick-add → opens minimal task creation modal

---

## 4. Views — Detailed Design

### 4.1 Dashboard

**Purpose:** Global entry point. Shows the state of the entire vault at a glance.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  [🏠 Dashboard]            ⚙ Settings    🔄 Refresh     │
├─────────────────────────────────────────────────────────┤
│  TODAY                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Tasks Due│ │Overdue   │ │Meetings  │ │Completed │   │
│  │    4     │ │   2      │ │Today: 2  │ │This week │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────┤
│  AREAS                                                   │
│  ▸ Work (3 active projects)                ████░ 72%    │
│  ▸ Home Maintenance (2 active)             ██░░░ 40%    │
│  ▸ Health & Fitness (1 active)             █████ 90%    │
├─────────────────────────────────────────────────────────┤
│  ACTIVE PROJECTS                                         │
│  • Kitchen Renovation [high] due Jun 30   ████░ 60%    │
│  • RADAR Deprecation [high] due Apr 15    ██░░░ 35%    │
│  • Learn JavaScript [low]                 █░░░░ 15%    │
├─────────────────────────────────────────────────────────┤
│  TODAY'S TASKS                                           │
│  ☐ Write ticket for ITM team  [Work]                    │
│  ☐ Alt label modernization review  [Work]               │
│  ☑ Annual computer attestation  [Work]                  │
├─────────────────────────────────────────────────────────┤
│  UPCOMING MEETINGS (next 7 days)                        │
│  Mon 3/23  10:00  TIA Standup             [Work]        │
│  Tue 3/24  11:30  Taxonomy Planning       [Work]        │
└─────────────────────────────────────────────────────────┘
```

**Stat cards (top row):** Clickable — clicking "Tasks Due Today" opens a filtered task view.

---

### 4.2 Area Overview

**Purpose:** Zoom into a single Area to see all its projects and their collective health.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  🏗 Home Maintenance                    [Edit] [Archive] │
├────────────┬────────────┬────────────┬───────────────────┤
│ Projects   │ Open Tasks │ Overdue    │ Completion Rate   │
│    4       │    12      │    3       │     58%           │
├────────────┴────────────┴────────────┴───────────────────┤
│  PROJECTS                                  Sort: Priority▼│
│  ┌──────────────────────────────────────────────────┐   │
│  │ Kitchen Renovation          active  ████░ 60%    │   │
│  │ Garage Purge                active  ██░░░ 40%    │   │
│  │ Main Bedroom Punch List     on-hold █░░░░ 10%    │   │
│  │ Patch Basement Ceiling      planning ░░░░░  0%    │   │
│  └──────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────┤
│  COMPLETION TREND (last 12 weeks)                        │
│  [line chart — tasks completed per week]                 │
└──────────────────────────────────────────────────────────┘
```

---

### 4.3 Project Summary Page

The centerpiece view. Opened by clicking a project anywhere in the plugin, or from a project note directly.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Kitchen Renovation                   [Edit] [Archive]   │
│  Area: Home Maintenance  •  Due: Jun 30, 2026           │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Tasks    │ Complete │ Overdue  │ Meetings │ Time Logged  │
│  12      │  7 (58%) │   2      │   4      │   6.2 hrs   │
├──────────┴──────────┴──────────┴──────────┴─────────────┤
│  NEXT UP  (due soonest / highest priority)               │
│  ☐ Finalize tile selection        due 3/28  [high]      │
│  ☐ Schedule plumber               due 4/01  [high]      │
│  ☐ Order backsplash material      due 4/10  [medium]    │
├──────────────────────────────────────────────────────────┤
│  ALL TASKS               [List | Board]   Filter: all▼  │
│  ☐ Finalize tile selection     high  due 3/28           │
│  ☐ Schedule plumber            high  due 4/01           │
│  ☑ Demo old counters           done  completed 3/15     │
│  ...                                                     │
├──────────────────────────────────────────────────────────┤
│  MEETINGS  (4 total)                        [View all]   │
│  2026-03-10  Contractor Walkthrough  45m                 │
│  2026-02-22  Design Review           60m                 │
├──────────────────────────────────────────────────────────┤
│  RELATED NOTES  (2)                                      │
│  [[Flooring Dimensions]]  •  [[Tile Options Research]]   │
├──────────────────────────────────────────────────────────┤
│  ACTIVITY  (recent changes)                              │
│  3/21  Task completed: Demo old counters                 │
│  3/18  Meeting logged: Contractor Walkthrough            │
└──────────────────────────────────────────────────────────┘
```

**Stat card detail:**
- **Tasks:** Total task count (TaskNotes + inline). Clicking opens filtered task list.
- **Complete:** Count and percentage. Progress bar visual.
- **Overdue:** Count of past-due incomplete tasks. Shown in red if > 0.
- **Meetings:** Total meetings linked to this project.
- **Time Logged:** Sum of `duration` from linked meetings (uses `totalMinutesTracked` field from existing meeting schema).

**Next Up logic:** Tasks sorted by: (1) due date ascending, (2) priority descending, (3) status = `todo` or `in-progress` only.

---

### 4.4 Task Board (Kanban)

**Purpose:** Visual task management within a project or area.

**Columns (configurable):** `Backlog | To Do | In Progress | Done`

Each card shows: title, priority badge, due date, project (if area-level board).

Drag-and-drop to change status. Updates frontmatter on drop.

**Filter bar:** By priority, due date range, area/project (when viewing globally).

---

### 4.5 Timeline View

**Purpose:** Gantt-style view for seeing project schedules and milestones across time.

- X-axis: time (weeks or months, zoomable)
- Y-axis: Projects (grouped by Area)
- Bars: `startDate` → `dueDate`
- Milestones: tasks marked with a milestone flag
- Color: by Area color or status

Phase 2 feature; requires `startDate` and `dueDate` to be populated.

---

## 5. Settings Panel

Accessible via Obsidian Settings → Plugin Name.

### 5.1 Folder Configuration

| Setting | Default | Description |
|---|---|---|
| Areas & Projects folder | `40 Projects` | Where Area and Project notes live |
| TaskNotes folder | `35 Tasks/TaskNotes` | Where standalone task files live |
| Meetings folder | `30 Work/Meetings` | Root of the meeting hierarchy |
| Completed projects folder | `40 Projects/Completed` | Where completed projects are moved |

### 5.2 Frontmatter Field Names

| Setting | Default | Description |
|---|---|---|
| Note type field | `type` | Field that identifies note as area/project/task |
| Project link field | `project` | Field that links a note to a project |
| Area link field | `area` | Field that links a project to an area |
| Task status field | `status` | Field containing task status |
| Task priority field | `priority` | Field containing task priority |
| Task due date field | `dueDate` | Field containing due date |
| Task completed date | `completedDate` | Field for completion timestamp |

### 5.3 Task Sources

| Setting | Default | Description |
|---|---|---|
| Enable TaskNotes | `true` | Scan TaskNotes folder for tasks |
| Enable inline tasks | `true` | Parse inline todos from all notes |
| Inline task regex | Tasks plugin format | Pattern for detecting inline todos |
| Tasks plugin integration | `auto-detect` | Use Tasks plugin API if available |

### 5.4 Status Values

Configurable comma-separated lists for each entity type:

- **Task statuses:** `todo, in-progress, done, cancelled` (maps to checkbox states)
- **Project statuses:** `planning, active, on-hold, completed, archived`
- **Priority levels:** `high, medium, low`

### 5.5 Display

| Setting | Default | Description |
|---|---|---|
| Default project view | `summary` | View opened when clicking a project |
| Open views in | `main area` | `main area` or `sidebar` |
| Show ribbon icon | `true` | Dashboard button in left ribbon |
| Date format | `YYYY-MM-DD` | Display format for dates |
| Completion threshold | `100%` | % at which a project is marked done |

---

## 6. Charts & Analytics

Available on Project Summary and Area Overview pages, toggleable.

### 6.1 Task Completion Trend
Line chart. X-axis: weeks. Y-axis: tasks completed. Useful for tracking velocity. Data sourced from `completedDate` fields on TaskNotes.

### 6.2 Task Burndown
Bar chart. Tasks remaining per day/week vs. ideal burndown line. Requires `dueDate` on project and tasks.

### 6.3 Status Distribution (Donut)
Pie/donut chart showing breakdown of tasks by status. Quick health indicator.

### 6.4 Meeting Frequency
Bar chart: meetings per week over the project lifetime. Uses `date` from meeting frontmatter.

### 6.5 Time Tracked
Bar chart of `totalMinutesTracked` from meeting notes, grouped by week. Leverages existing meeting schema.

### 6.6 Priority Breakdown
Stacked bar of open tasks by priority. Highlights if too many high-priority tasks are open.

All charts are powered by Chart.js, bundled with the plugin. Data is computed from the in-memory index at render time.

---

## 7. Feature Roadmap

### Phase 1 — Core (MVP)
- [ ] Plugin scaffold (TypeScript, esbuild, Svelte)
- [ ] Settings panel with all path/field configuration
- [ ] In-memory index (Areas, Projects, TaskNotes, Meetings, Notes)
- [ ] Project Summary Page view with stat cards and task list
- [ ] `PM: Open Project Summary` command
- [ ] Dashboard view (basic)
- [ ] `PM: New Project` command with template
- [ ] `PM: Link Meeting to Project` command

### Phase 2 — Views
- [ ] Area Overview view
- [ ] Task Board (Kanban) view
- [ ] Inline Tasks plugin integration
- [ ] `PM: New Task` command
- [ ] Global task list with filtering
- [ ] Dashboard — today's tasks and meetings

### Phase 3 — Analytics
- [ ] Chart.js integration
- [ ] Task completion trend chart
- [ ] Status distribution donut chart
- [ ] Meeting frequency chart
- [ ] Time tracked chart (from meeting duration)
- [ ] Export to CSV (tasks, project summary)

### Phase 4 — Advanced
- [ ] Timeline / Gantt view
- [ ] Recurring task support
- [ ] Task dependencies
- [ ] AI-assisted project summary (uses Obsidian Copilot or local model)
- [ ] Mobile-optimized layouts
- [ ] Optional: public plugin release (README, docs, settings polish)

---

## 8. Must-Have Features (from PM Tool Research)

The following features from across the PM landscape have been prioritized for this plugin's design:

**Included in Phase 1–2:**
- Area → Project → Task hierarchy
- Task status tracking (todo / in-progress / done / cancelled)
- Priority levels (high / medium / low)
- Due dates
- Project progress visualization (% complete)
- Multiple task sources (file-based + inline)
- Meeting integration
- Related notes panel
- Custom views per entity type
- Command palette integration
- Keyboard-first navigation

**Included in Phase 3:**
- Velocity / completion trend charts
- Burndown charts
- Time tracking (from meeting logs)
- Status distribution

**Not in scope (personal tool, single user):**
- Real-time collaboration
- Role-based permissions
- Team workload views
- SSO / OAuth
- Email-to-task
- Native mobile app
- AI scheduling (Motion-style)

**Deferred / Optional:**
- Gantt/Timeline view
- Task dependencies
- Recurring tasks
- Natural language task input
- External calendar sync

---

## 9. Open Questions

1. **Area vs. Folder:** Should Areas be note files (type: area) or just folder structure? Notes-as-areas are more flexible; folders are simpler. **Current proposal:** notes-as-areas, since existing `Health & Fitness.md` etc. already function this way.

2. **Inline task project linking:** How should inline todos in non-project files be associated with a project? Options: (a) file has `project:` frontmatter, (b) tag on the task itself, (c) tasks in a project note are automatically linked. **Recommendation:** (a) + (c).

3. **Project note co-location:** Should the Project Summary view be a custom leaf only, or should it also enhance the rendering of the project note itself (as a block or callout at the top)? A hybrid "embed in note" approach is more Obsidian-native.

4. **Work vs. personal tasks:** Meetings are currently in `30 Work/Meetings`. Should home/personal projects also get meeting support, or is that a work-only concept in this vault?

5. **Plugin name:** "Obsidian Project Manager" is descriptive but generic. Consider a more distinctive name for eventual public release.

---

*This spec is a living document. Update version and date on each revision.*
