---
title: Discussions
description: "Every comment thread on a review in one list: filter, reply, resolve and jump to the code."
opens: "++4++ from a review"
---

The Discussion tab lists every comment thread on a review as a card. The diff
shows threads next to their lines; this tab shows all of them in one
scrollable list. Press ++4++ from any review to open it.

## Discussion cards

Each card shows:

- the file and line for an inline thread, or `[general]` for a thread on the
  whole review
- the reply count and when the thread started
- a few lines of the diff around an inline thread, with the commented line
  marked
- the whole thread, each comment with its author and rendered as Markdown
- the keys that apply to it, including Resolve or Unresolve when the forge
  allows resolving that thread

Open threads come first, sorted by file and line. General threads follow the
inline ones, and resolved threads come last, dimmed.

## Navigation

| Key | Action |
|-----|--------|
| ++j++ / ++k++ | Move between cards (++down++ and ++up++ work too) |
| ++close-bracket++ / ++open-bracket++ | Jump to the next or previous unresolved thread |
| ++enter++ | Jump to the thread in the diff (inline threads only) |

++enter++ on an inline thread switches to the Diff tab and moves to the line
the comment is on.

## Filtering

Press ++f++ to cycle the filter:

| Filter | Shows |
|--------|-------|
| All | Every thread |
| Unresolved | Only unresolved threads |
| Resolved | Only resolved threads |

## Replying

Press ++r++ on a card to open the comment editor and reply to that thread.
Press ++ctrl+s++ to post the reply. tongs confirms it with a notification, and
the thread shows the reply the next time the tab loads.

## Resolving threads

Press ++shift+r++ on a card to resolve the thread, or to reopen a resolved one.
tongs asks you to press ++shift+r++ a second time to confirm. Resolving works
on both GitHub and GitLab, for threads the forge allows you to resolve.

## General comments

To comment on the review as a whole rather than a line, press ++c++ on the
Overview tab (++1++).

## A review pass through the threads

1. Open the Discussion tab and press ++f++ to show unresolved threads.
2. Press ++enter++ on a thread to jump to its line in the diff.
3. Read the code around it.
4. Press ++r++ to reply, or ++shift+r++ twice to resolve.
5. Press ++4++ to return to the Discussion tab and move to the next thread.

:::tip[Review drafts]
While a review draft is open (++ctrl+g++), replies go into the draft and are
posted when you submit it. See [Review drafts](/guides/review-drafts/).
:::
