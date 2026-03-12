---
title: "Stop Letting AI Review Its Own Code — Why I Built xreview"
description: "When the same model writes and reviews code, how strict can it really be? xreview uses codex for cross-model verification to solve the self-review blind spot."
pubDatetime: 2026-03-13T00:00:00.000Z
tags:
  - ai
  - claude-code
  - code-review
  - golang
  - developer-tools
draft: false
---

> 也有[中文版](/posts/xreview)。

When one model writes the code and the same model reviews it, how strict do you think it's going to be with itself?

## The Problem with Self-Review

I rely heavily on Claude Code for my daily development. After writing something, it feels natural to say "review this for me." It seemed fine at first, but over time I noticed something awkward: when Claude Code reviews code it just wrote, it tends to go easy on itself.

A while back, I used Claude Code to build several features in a row. After finishing, I ran Everything Claude Code's code-reviewer on the results — everything passed. But later, when I continued discussing certain behaviors with Claude Code, it realized on its own that several pieces of logic were actually wrong. It completely missed them during the review, only catching the issues when the conversation happened to touch on related scenarios.

When the same model that produced the code also reviews it, it's naturally more lenient toward its own patterns. For small changes this is fine, but for complex changes the quality gap in self-review becomes very noticeable.

This got me thinking: the review process should involve a different model as an impartial third party. I saw someone on X say that if you tell codex "this was written by Claude Code," it reviews the code extra thoroughly. After trying it myself, I think there might be some truth to it — codex really does not hold back when reviewing Claude's code.

So my thinking was straightforward: if reviewing your own work isn't reliable, get someone else to do it.

## What xreview Does

xreview is a Claude Code plugin that delegates code review to codex (OpenAI), while Claude Code handles verification and applies fixes.

The workflow is a three-party loop. codex independently reads your code, looking for bugs, security vulnerabilities, and logic issues. When Claude Code receives the findings, it doesn't just accept them blindly — it reads the actual source code line by line to confirm whether each issue truly exists, and actively challenges suspicious findings. All verified issues are then presented to you at once, each with a proposed fix, and you choose which ones to apply.

After fixes are applied, codex runs another verification round. If something isn't resolved, the cycle continues — up to five rounds. When it's done, a markdown report is generated automatically.

## Why the Verification Layer Matters

The earliest version had no verification layer — codex findings were passed directly to you. After a few runs, I found the false positive rate was too high. It would see `fmt.Sprintf` and flag SQL injection, even though that code might never touch user input. You'd spend all your time filtering noise, making the whole thing less efficient than not using it at all.

So I added Claude Code as a filter in the middle. It actually reads the lines of code codex flagged and judges whether the issue genuinely exists. When something looks questionable, it pushes back on codex: "You say there's a race condition here, but I've checked the lock scope — these two goroutines never hold this lock simultaneously. Are you sure?"

codex might stand its ground, or it might retract. Either way, what reaches you has been cross-verified, not an unfiltered laundry list.

## Real Test: 11 Planted Bugs

Concepts are cheap, so I set up a proper test.

I wrote a Go task management API (JWT auth, team management, task CRUD, notifications) and deliberately planted 11 bugs: reversed bcrypt parameter order, hardcoded JWT secret, CORS reflecting arbitrary origins, off-by-one errors, integer division truncation, `||` that should be `&&`, a race condition in the rate limiter, and soft-deleted users still being able to log in. These spanned security, logic, concurrency, and design categories.

Then I ran xreview and measured what it could catch.

### Results

| Metric | Number |
|--------|--------|
| Planted bug detection rate | 9/11 (81.8%) |
| Missed | 2, both Low severity |
| Additional real issues found | +8 |
| False positives | 0 |
| Fix correctness rate | 16/16 (100%) |

The two misses were: JSON injection in error messages (code smell level — the error strings are all internal constants) and missing JWT revocation (more of an architectural design trade-off than a bug). Every issue that would actually break functionality or create a security vulnerability was caught.

### Those 8 Extra Findings

These weren't deliberately planted — they were real issues I accidentally introduced while writing the test project. `GetTask` had no authorization check, letting anyone fetch other users' tasks (IDOR). There was a race condition between the email uniqueness check and insert (TOCTOU). A type assertion without a safe check that would panic. The store returning internal pointers, allowing external code to directly modify internal state (shallow copy issue).

This is what real development looks like — you don't know what bugs you've written. The ones I deliberately planted almost weren't the point. These unintentional mistakes are where xreview proves its real value.

The zero false positive rate is also worth highlighting. The problem with many static analysis tools isn't that they can't find bugs — it's that the noise is so overwhelming you stop looking. The three-party verification does an excellent job of filtering out false positives.

## Technical Details

xreview is a Go CLI that sits between Claude Code and codex. A single binary, no extra runtime needed.

```
Claude Code (host)          xreview (CLI)           codex (reviewer)
     |                          |                        |
     |-- skill trigger -------->|                        |
     |                          |-- codex exec --------->|
     |                          |<-- findings (JSON) ----|
     |<-- findings (XML) ------|                        |
     |                          |                        |
     |  [Claude Code verifies]  |                        |
     |  [challenges suspect] -->|-- codex resume ------->|
     |                          |<-- re-evaluation ------|
     |                          |                        |
     |  [present Fix Plan]      |                        |
     |  [you decide what to fix]|                        |
     |  [Claude Code applies]   |                        |
     |                          |                        |
     |-- request verify ------->|-- codex resume ------->|
     |                          |<-- verify result ------|
     |<-- verify (XML) --------|                        |
```

Session state is stored in `.xreview/sessions/`, so codex can resume previous sessions and verification rounds don't have to start from scratch.

To install, two commands in Claude Code:

```bash
/plugin marketplace add davidleitw/xreview
/plugin install xreview@xreview-marketplace
```

Prerequisites: codex CLI installed and OpenAI API key configured.

## How It Compares

This question is inevitable, so let me address it upfront.

Anthropic launched their official Code Review on March 9, 2026. Their approach uses multiple Claude agents reviewing the same PR in parallel. It's probably effective, but at its core it's still different instances of the same model family reviewing the code. xreview takes a different angle — cross-verification using a different vendor's model (codex). Also, the official solution costs $15-25 per PR and is only available for Team and Enterprise plans. xreview just costs whatever the codex API charges, accessible to individual developers.

CodeRabbit, Copilot Code Review, and similar SaaS products are more feature-complete, with GitHub integration, PR comments, and team dashboards. If you need something plugged into your CI/CD pipeline running on every PR automatically, those are better suited. xreview doesn't do any of that. It's a local CLI tool — run it when you want, skip it when you don't. No monthly fee, no CI setup required.

As for skill-based review within the Claude Code ecosystem (like Superpowers' code-reviewer), it's fundamentally still Claude reviewing Claude's own code. Compared to just asking Claude Code to "review this," there's more structured process, but the model hasn't changed, so the core self-review problem remains.

Honestly, xreview does something very narrow. It doesn't handle CI/CD, PR workflows, or team collaboration. It does one thing: gets a different model to review your code, then uses Claude Code to filter the noise. If that's exactly what you need, it works well.

What's next on the roadmap is language-specific review context. Currently xreview reviews all languages the same way, but different languages have different pitfall zones — Go's error handling conventions, Rust's ownership model, C++'s lifetime management. The plan is to have xreview include a language-specific review guide when calling codex. The core flow stays the same; it's just an extra prompt segment.

If you also find self-review unreliable, give it a try: [github.com/davidleitw/xreview](https://github.com/davidleitw/xreview)

---

*MIT License. Issues and PRs welcome — contributions of any kind are appreciated.*
