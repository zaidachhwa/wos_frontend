````md
# WorkOS Design System

> This document defines the complete UI/UX guidelines for the WorkOS platform. Every page, component, layout, and interaction should follow these standards. The goal is to create a modern, clean, highly productive interface that minimizes cognitive load while maximizing information density.

---

# Design Philosophy

The platform should feel like a professional productivity tool rather than a traditional admin panel.

## Primary Principles

- Clean
- Minimal
- Fast
- Consistent
- Information First
- Accessibility Focused
- Responsive
- Scalable

Avoid unnecessary decorations.

The interface should communicate information, not showcase animations.

---

# Inspiration

## Primary Inspiration

- Linear
- Notion
- Jira
- ClickUp
- GitHub
- Vercel Dashboard

Do **not** copy any product directly.

Use them only as references for:

- Spacing
- Typography
- Hierarchy
- Productivity
- Navigation

---

# Overall Feel

The application should feel:

- Premium
- Calm
- Focused
- Modern
- Lightweight
- Enterprise Ready

### Avoid

- Excessive gradients
- Glassmorphism
- Neumorphism
- Oversized shadows

---

# Theme

## Default Theme

- Light Mode

## Future

- Dark Mode

Both themes should use design tokens instead of hardcoded colors.

---

# Layout

The application consists of:

```text
+------------------------------------------------------+
| Header                                               |
+----------+-------------------------------------------+
| Sidebar  |                                           |
|          |                                           |
|          |             Main Content                  |
|          |                                           |
|          |                                           |
|          |                                           |
+----------+-------------------------------------------+
````

## Sidebar

* Fixed
* Collapsible
* Icon + Label
* Smooth collapse animation

## Header

Contains:

* Search
* Notifications
* User Menu
* Organization Switcher
* Current Page Title

## Content Area

Scrollable independently.

---

# Grid System

## Desktop

* 12 Column Grid

## Tablet

* 8 Column Grid

## Mobile

* 4 Column Grid

## Maximum Content Width

* 1600px

## Content Padding

* Desktop: 32px
* Tablet: 24px
* Mobile: 16px

---

# Border Radius

| Component | Radius |
| --------- | ------ |
| Cards     | 16px   |
| Buttons   | 10px   |
| Inputs    | 10px   |
| Dialogs   | 18px   |
| Dropdowns | 12px   |
| Badges    | 999px  |

---

# Spacing System

Use an **8-point spacing system**.

## Allowed Values

* 4
* 8
* 12
* 16
* 20
* 24
* 32
* 40
* 48
* 56
* 64
* 80
* 96

Never use arbitrary spacing.

---

# Shadows

Use subtle shadows only.

| Component | Shadow |
| --------- | ------ |
| Card      | Small  |
| Modal     | Medium |
| Dropdown  | Medium |

Avoid heavy shadows.

---

# Typography

## Font

* Inter

## Fallback

* System UI

## Scale

| Style      | Size |
| ---------- | ---- |
| Display    | 48   |
| Heading 1  | 36   |
| Heading 2  | 30   |
| Heading 3  | 24   |
| Heading 4  | 20   |
| Body Large | 18   |
| Body       | 16   |
| Small      | 14   |
| Caption    | 12   |

## Font Weights

* 400
* 500
* 600
* 700

Avoid ultra-bold fonts.

---

# Color Philosophy

Use semantic color tokens.

* primary
* primaryForeground
* background
* surface
* border
* success
* warning
* danger
* info

Never reference raw hex values directly inside components.

---

# Sidebar

## Width

* Expanded: 280px
* Collapsed: 80px

## Navigation

* Dashboard
* Calendar
* Projects
* Tasks
* Follow-ups
* Team
* Notifications
* Settings

Current page should have:

* Left indicator
* Background highlight

---

# Dashboard

The dashboard should answer:

> What needs my attention?

## Widgets

* Today's Schedule
* Morning Follow-ups
* Pending Tasks
* Deadlines
* Recent Activity
* Project Overview
* Workload
* Blocked Members
* Upcoming Meetings

Cards should be reorderable in the future.

---

# Cards

Each card contains:

* Title
* Optional Description
* Actions
* Content
* Footer (optional)

Padding: **24px**

---

# Tables

Features:

* Sorting
* Filtering
* Searching
* Pagination
* Sticky Header
* Row Selection
* Bulk Actions
* Hover State
* Status Badges

Avoid heavy borders.

---

# Buttons

## Variants

* Primary
* Secondary
* Outline
* Ghost
* Danger

## Sizes

* Small
* Medium
* Large

## States

* Default
* Hover
* Pressed
* Disabled
* Loading

Icons should always align correctly.

---

# Forms

## Inputs

* Text
* Email
* Password
* Textarea
* Select
* Combobox
* Multi Select
* Date Picker
* Time Picker

## Validation

* Real-time
* Error below input
* Success state
* Required indicator

---

# Dialogs

Support:

* Create
* Edit
* Delete
* Confirmation

Maximum Width: **720px**

Requirements:

* Trap keyboard focus
* ESC closes dialog

---

# Drawers

Used for:

* Quick View
* Task Details
* Project Details
* User Profile
* Notifications

Slides from the right.

---

# Kanban Board

## Columns

* Backlog
* To Do
* In Progress
* Review
* Testing
* Completed
* Blocked

Each card displays:

* Title
* Priority
* Deadline
* Assigned User
* Labels
* Estimated Hours

Supports:

* Drag & Drop
* Filters
* Search

---

# Calendar

## Views

* Day
* Week
* Month
* Agenda

## Events

* Projects
* Meetings
* Deadlines
* Personal Tasks
* Follow-ups
* Time Blocks

Use semantic colors.

---

# Timeline

Display:

* Project
* Modules
* Tasks
* Progress Bars
* Milestones
* Deadlines
* Dependencies

---

# Task Details

Contains:

* Description
* Status
* Priority
* Assignee
* Deadline
* Estimated Hours
* Actual Hours
* Comments
* Attachments
* Activity Timeline

---

# Project Details

Sections:

* Overview
* Modules
* Tasks
* Members
* Timeline
* Activity
* Progress
* Calendar

---

# User Profile

Displays:

* Profile Information
* Designation
* Department
* Reporting Manager
* Projects
* Current Workload
* Availability
* Activity

---

# Badges

Examples:

* Low
* Medium
* High
* Critical
* Completed
* Blocked
* Planning
* Review

---

# Notifications

Grouped by:

* Today
* Yesterday
* Older

Features:

* Unread indicator
* Mark All Read

Types:

* Task Assigned
* Deadline
* Comment
* Follow-up
* Project Update

---

# Empty States

Every empty page should include:

* Illustration placeholder
* Heading
* Description
* Primary Action

Example:

> No projects created yet.

Button:

> Create Project

---

# Loading States

* Use skeleton loaders.
* Avoid full-screen spinners whenever possible.

---

# Error States

Include:

* Friendly message
* Retry button

Hide technical details from users.

---

# Search

Global search accessible via:

**Ctrl + K**

Search:

* Projects
* Tasks
* Users
* Calendar Events
* Commands

---

# Accessibility

Requirements:

* WCAG AA minimum contrast
* Full keyboard navigation
* Visible focus rings
* ARIA labels
* Keyboard-accessible interactive elements

---

# Responsiveness

## Desktop

* Sidebar expanded

## Tablet

* Sidebar collapsible

## Mobile

* Drawer navigation
* Cards stack vertically
* Responsive tables

---

# Animations

## Philosophy

* Fast
* Purposeful
* Subtle

Duration:

* 150ms–250ms

Allowed:

* Fade
* Slide
* Scale
* Collapse

Avoid:

* Bounce
* Elastic
* Complex transitions

---

# Icons

Use:

* lucide-react

Style:

* Outline only

Standard sizes:

* 16
* 18
* 20
* 24

---

# Component Naming

Examples:

* Button
* Card
* Dialog
* Input
* Select
* Badge
* Avatar
* Calendar
* TaskCard
* ProjectCard
* UserCard
* FollowupCard
* DashboardWidget

---

# Component Rules

Components must:

* Be reusable
* Accept variants
* Be composable
* Avoid duplicated logic
* Support loading state
* Support disabled state
* Be accessible

---

# Page Structure

Every page follows:

1. Header
2. Toolbar
3. Filters
4. Content
5. Pagination (if required)

---

# UX Principles

Reduce clicks whenever possible.

Common actions should require **no more than two interactions**.

Important information should be visible without opening additional dialogs.

Managers should never navigate more than **three levels deep** to find project status.

Every dashboard should answer:

* What needs attention?
* What is overdue?
* What is blocked?
* What should I do next?

---

# Future Ready

The design system must support future additions without redesign.

Planned future modules:

* AI Assistant
* Mobile App
* Analytics
* Reporting
* Knowledge Base
* File Management
* Integrations

All future features should inherit the same design language.

---

# Final Design Principles

Every screen should satisfy the following checklist:

* Clean visual hierarchy
* Minimal distractions
* Consistent spacing
* Responsive layout
* Accessible interactions
* Fast loading
* Reusable components
* Clear user feedback
* High information density
* Enterprise-grade appearance

The UI should always prioritize **productivity over aesthetics**. Every design decision should reduce friction, improve discoverability, and help users complete tasks with minimal effort.

```
```
