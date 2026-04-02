---
title: "讓 AI 不再自己改自己看 — 我為什麼做了 xreview"
description: "一個模型寫的 code，再用同一個模型 review，它會對自己多嚴格？xreview 用 codex 做交叉驗證，解決 self review 放水問題。"
pubDatetime: 2026-03-12T16:00:00.000Z
tags:
  - ai
  - claude-code
  - code-review
  - golang
  - developer-tools
draft: false
---

> Also available in [English](/posts/xreview-en).

一個模型寫的 code，再用同一個模型 review，你覺得它會對自己多嚴格？

## Self review 的問題

我日常開發蠻依賴 Claude Code 的。寫完之後很自然會說「幫我 review 一下」，一開始覺得還行，但用久了就發現一個很尷尬的事：它 review 自己剛寫的 code 的時候，真的很容易放水。

前陣子我連續用 Claude Code 開發了幾個功能，做完之後拿 Everything Claude Code 的 code-reviewer 跑了一輪，結果全部 pass。但後來我跟 Claude Code 繼續延伸討論某些行為的時候，它自己才發現之前寫錯了好幾段邏輯。review 的時候完全沒察覺，聊到相關情境才反應過來。

同一個模型產出的 code 再用同一個模型去看，它天然就對自己的 pattern 比較寬容。小改動還好，碰到比較複雜的變更，self review 的品質落差就非常明顯。

這件事讓我開始覺得，review 的時候應該要引入不同的模型來當公正的第三方。之前在 X 上看到有人說只要跟 codex 說「這是 Claude Code 寫的」它就會 review 得格外認真，用下來我覺得搞不好是真的，codex 根本是最嚴厲的父親，review 起 Claude 的 code 是真的不留情面。

所以我的想法很直接：既然自己看自己不靠譜，那就找別人來看。

## xreview 做的事情

xreview 是一個 coding agent plugin，把 code review 丟給 codex（OpenAI），讓你的 coding agent 負責驗證跟執行修正。目前支援 Claude Code 跟 Codex CLI 作為 host agent。

流程是一個三方迴圈。codex 獨立讀你的 code，找 bug、安全漏洞、邏輯問題。你的 agent 收到結果之後不是照單全收，而是逐一去讀原始碼確認問題是不是真的存在，遇到可疑的 finding 會主動挑戰 codex。最後所有確認過的問題一次呈現給你，每個都附修復方案，你選要修哪些。

修完之後 codex 再驗證一輪，不 OK 就繼續，最多五輪。

## 為什麼中間需要驗證層

最早的版本其實沒有驗證層，就是直接把 codex 的結果丟給你。跑了幾次之後發現 false positive 太多，它看到 `fmt.Sprintf` 就喊 SQL injection，但那段 code 可能根本沒碰使用者輸入。你花一堆時間在過濾噪音，效率反而更差。

所以後來加了 agent 在中間做過濾。它會實際去讀 codex 指出的那幾行 code，判斷問題是不是真的存在。覺得有疑慮的會跟 codex 來回討論：「你說這邊有 race condition，但我看了 lock 的 scope，這兩個 goroutine 不會同時持有這個 lock，你確定嗎？」

codex 可能堅持，也可能撤回。不管結果怎樣，最後到你手上的是交叉驗證過的東西，不是一份落落長的未過濾清單。

## 實測：埋了 11 個 bug 來測

光講概念沒用，所以我做了一個比較認真的測試。

我寫了一個 Go 的 task management API（JWT auth、team 管理、task CRUD、notification），在裡面刻意埋了 11 個 bug：bcrypt 參數順序反了、JWT secret 硬編碼、CORS 反射任意 Origin、off-by-one、整數除法截斷、`||` 該用 `&&`、rate limiter 的 race condition、soft delete 沒擋登入，涵蓋 security、邏輯、併發、設計各類。

然後跑 xreview，看它能抓到多少。

### 結果

| 指標 | 數字 |
|------|------|
| 植入 bug 命中率 | 9/11（81.8%） |
| 漏掉的 | 2 個，都是 Low severity |
| 額外發現的真實問題 | +8 個 |
| 誤報 | 0 |
| 修正正確率 | 16/16（100%） |

漏掉的兩個分別是 error message 的 JSON injection（code smell 等級，因為 error 都是內部固定字串）和 JWT 缺少 revocation 機制（這比較像架構設計取捨，不算 bug）。真正會造成功能壞掉或安全漏洞的問題都抓到了。

### 那 8 個額外發現

這些不是我刻意埋的，是我在寫測試專案時無意間寫出來的真實問題。`GetTask` 沒做授權檢查，任何人都能撈別人的 task（IDOR）。Email uniqueness check 跟 insert 之間有 race condition（TOCTOU）。Type assertion 沒做 safe check，會 panic。Store 回傳內部指標，外部可以直接改到內部狀態（淺拷貝問題）。

這就是真實開發的狀況，你不知道自己寫了什麼 bug。我刻意埋的那些反而不是重點，這些無意間犯的錯才是 xreview 最有價值的地方。

另外零誤報值得一提。很多 static analysis 工具的問題不是抓不到 bug，是噪音太多讓你懶得看。三方驗證確實把 false positive 過濾得很乾淨。

## 技術面

xreview 是 Go 寫的 CLI，跑在你的 coding agent 跟 codex 之間。一個 binary，不需要額外 runtime。

```
Host Agent                  xreview (CLI)           codex (reviewer)
(Claude Code / Codex CLI)
     |                          |                        |
     |-- skill 觸發 ----------->|                        |
     |                          |-- codex exec --------->|
     |                          |<-- findings (JSON) ----|
     |<-- findings (XML) ------|                        |
     |                          |                        |
     |  [agent 逐一驗證]         |                        |
     |  [挑戰可疑項目] --------->|-- codex resume ------->|
     |                          |<-- 重新評估 ------------|
     |                          |                        |
     |  [呈現 Fix Plan]         |                        |
     |  [你決定要修什麼]         |                        |
     |  [agent 修正]            |                        |
     |                          |                        |
     |-- 請求驗證 -------------->|-- codex resume ------->|
     |                          |<-- verify result ------|
     |<-- verify (XML) --------|                        |
```

Session 狀態存在 `/tmp/xreview/sessions/`，codex 可以 resume 之前的 session，驗證輪不用從頭跑。

安裝的話，Claude Code 裡兩行：

```bash
/plugin marketplace add davidleitw/xreview
/plugin install xreview@xreview-marketplace
```

Codex CLI 的話，直接在 session 裡貼這段就好：

```
Fetch and follow instructions from https://raw.githubusercontent.com/davidleitw/xreview/master/.codex/INSTALL.md
```

前提是裝好 codex CLI 跟設好 OpenAI API key。

## 跟現有方案的差異

這個問題一定會被問到，所以先講。

Anthropic 在 2026 年 3 月 9 日上了官方的 Code Review，做法是多個 Claude agent 並行看同一個 PR。效果應該不差，但本質上還是同一個模型家族的不同 instance 在看。xreview 的出發點不一樣，是讓不同廠商的模型（codex）做交叉驗證。另外官方方案是 $15-25/PR，只有 Team 跟 Enterprise 能用。xreview 就是 codex API 的費用，個人開發者就能跑。

CodeRabbit、Copilot Code Review 這類 SaaS 做得比較完整，有 GitHub 整合、PR comment、團隊 dashboard。如果你的需求是接進 CI/CD pipeline 讓每個 PR 自動跑，那它們更適合。xreview 不做這些，它就是一個本地 CLI 工具，你想跑的時候跑，不想跑就不跑。沒有月費，不需要設定 CI。

至於 Claude Code 生態裡的 skill-based review（像 Superpowers 的 code-reviewer），本質上還是 Claude 在看 Claude 自己寫的東西。跟直接叫 Claude Code「幫我 review」比起來有多一些結構化的流程，但模型沒換，self review 的根本問題還是在。

坦白說 xreview 做的事情很窄。它不管 CI/CD，不管 PR workflow，不管團隊協作。它就做一件事：拿一個不同的模型來看你的 code，然後用你的 agent 過濾噪音。如果你需要的剛好是這個，它很好用。

後來做的一個比較有感的改進是語言特化的 review context。不同語言有不同的地雷區，像 Go 的 error handling 慣例、C++ 的 lifetime 管理，用同一套方式看不夠精準。現在 xreview 支援 `--language` flag，打 codex 之前會多帶一段語言對應的 review 指引。目前支援 Go 跟 C++，之後會繼續加 Rust、TypeScript、Python。

如果你也覺得 self review 不太靠譜，試試看：[github.com/davidleitw/xreview](https://github.com/davidleitw/xreview)

---

*MIT License。歡迎開 issue 或直接發 PR，什麼形式的貢獻都歡迎。*
