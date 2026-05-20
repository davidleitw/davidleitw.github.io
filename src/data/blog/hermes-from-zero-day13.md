---
title: "Day 13:怎麼測試一個會講話的東西"
description: "「分離水管與水」的測試哲學,以及他們刻意沒測的那塊。"
pubDatetime: 2026-05-17T22:00:00+08:00
tags:
  - hermes-from-zero
  - ai
  - agent
  - ironman
  - llm
draft: false
---

測試一個會講話的東西,是 agent 工程裡最尷尬的問題之一。

LLM 本身是 non-deterministic,同樣一段 input 跑十次可能有兩三次行為不一樣。傳統的 `assert result == expected` 整個沒用——prompt 動一個字輸出就完全不一樣,你 assert 字串比對嗎?你 assert「看起來合理」嗎?那叫做測試嗎?

更尷尬的是,一個 agent 不只是 LLM。它是「LLM 輸出 → 自己 parse → 跑 tool → 把結果丟回去 → 再 LLM」這種一層套一層的東西。中間任何一段 streaming chunk 邊界沒切好、某個 `<think>` 標籤的關閉沒被認出來,後面整段 tool call 就會炸。這種 bug 通常是機率性的——十次裡偶爾兩三次壞,加 log、加重試、加例外處理也只是把頻率壓低,壓不到零。

你看坊間大家怎麼解?常見三招都有問題:**mock 整個 LLM 回應**——那你測的是 mock 不是模型;**錄一段真實 response 然後 replay**(VCR 那種)——LLM 的 wire format 一直變,錄影過幾週就跟你現在的 prompt 對不起來;**snapshot 整個 trajectory**——第一次跑就過,改一個字 prompt 全部炸,review 到瘋掉。

到底要怎麼測一個非確定的東西?昨天看完 Hermes 的三套介面,你應該擔心一件更基本的事——這麼複雜的系統怎麼測?今天就拆 Hermes 的答案。

---

## 第一招:把「水管」跟「水」分開

這是整個 Hermes 測試策略的核心。先把這句話釘在牆上:

> **Hermes 徹底測試了「水管邏輯」——streaming、tool 修復、recovery cascade、parser、compression。但它不測試 agent 的「品質」——這道菜好不好吃,它不管。**

`tests/` 目錄底下有 **1,131 個檔案、約 23,500 個測試函式**。聽起來很多吧?但你打開一看會發現,絕大多數測的都是「**給定一段 fake 的 LLM response,系統會怎麼處理**」,而**不是**「**這個 agent 給定一個任務,能不能完成**」。

這個區分非常重要。我一開始覺得這是缺陷——「你都做這麼大一個 agent 了,怎麼不做 eval?」後來我慢慢理解他們的選擇:**水管邏輯是確定性的,可以、也應該用 assertion 鎖死;agent 的決策品質是非確定的,assertion 鎖不住,硬要鎖只會做出一堆 flaky test**。

水管要鋸齒分明、不能晃;流體本身會晃,接受它會晃,別假裝你能用 unit test 抓出來。

這個想法救了我後來寫自己 agent 的命。我不再糾結「怎麼測 LLM 輸出對不對」,而是把所有「拿到 LLM 輸出之後我自己做的事」全部抽出來變純函式,然後狂測那些。

---

## 第二招:怎麼測 streaming?手工捏一串 chunk

回到我那個 `<think>` 標籤的 bug。Hermes 是怎麼避免這種事的?

答案有點反直覺:**他們不錄影,也不用 VCR**。他們手工捏 chunk。

打開 `tests/run_agent/` 隨便挑一個 streaming 相關的測試,你會看到類似這樣的東西——測試裡面自己用 `SimpleNamespace` 拼出一個長得像 `ChatCompletionChunk` 的物件,設定 `choices[0].delta.content = "<thi"`,下一個 chunk 是 `"nk>"`,再下一個是 `"hello</think>"`。然後 patch 掉 `OpenAI` client,讓 `create.return_value = iter([chunk1, chunk2, chunk3])`,跑 agent,assert 最終 parser 拿到的結果是對的。

重點在哪?**chunk 邊界是故意切在最尷尬的位置的**。

Streaming 的 bug 幾乎全部來自 partial chunk 邊界:tag 被切成兩半、JSON 被切到一半、tool call 的 arguments 在 chunk 之間斷裂。如果你只用「正常的」chunk 切法測試,生產環境一進來不同的切法就炸。所以 Hermes 的 streaming 測試,基本上是一堆「**對抗性的 chunk 切法**」——專門找 parser 最容易壞的地方切下去。

像 `test_repair_tool_call_arguments`、`test_streaming_tool_call_repair`、`test_empty_response_recovery` 這些檔案,全部就是在做這件事。每個檔案手工定義 `_make_stream_chunk` helper,專門用來構造對抗性的 chunk 序列。

> **Note**:這個做法有個明顯代價——OpenAI 的 wire format 在這個 codebase 裡被**複製了幾十次**。SDK 改一個欄位名,28 個 mock 測試全綠,生產壞掉。Hermes **沒有** contract test 把這些 fake 釘到真實的 `ChatCompletionChunk`。這是測試策略最大的缺口之一。我們明天會再回來罵這件事。

但反過來說,好處也很實在:**對模型漂移免疫**。OpenAI 把 GPT-4 換成 GPT-4-turbo 換成 GPT-5,跟這些測試一點關係都沒有,因為測試裡的 LLM 從來就是合成的。

---

## 第三招:怎麼測 recovery cascade?用 fake provider 丟錯誤

Day 5 我們講過 provider 抽象,Day 11 講過子代理。中間還有一塊很重要——agent 跑 LLM 出錯了怎麼辦?Hermes 有一整套 recovery cascade:context 太長就壓縮、provider 掛了就降級、JSON 壞了就修、空回應就重試。

這套東西怎麼測?

招數一樣是**手工 fake**,但這次 fake 的不是 chunk,是錯誤。測試裡建一個 fake provider,故意在第一次呼叫的時候 raise 一個特定的 error code——比如 Anthropic 的 429 rate limit、或是 context_length_exceeded、或是 5xx——然後 assert 三件事:

1. 系統有沒有觸發**對應的恢復動作**(壓縮?降級?重試?)
2. `*_retry_attempted` 這類 flag 有沒有被設(避免無限重試)
3. 最後有沒有**成功降級**到 fallback path

關鍵在於:**`error_classifier` 在 Hermes 是純函式**。給定一個 exception,它告訴你這屬於哪一類錯誤、該觸發哪一個恢復路徑。純函式好測——丟 100 種錯誤進去,assert 100 個分類結果。

`tests/run_agent/test_anthropic_error_handling.py`、`test_anthropic_truncation_continuation.py`、`test_compression_boundary.py`、`test_413_compression.py` 這些檔案,全部就是在做這件事——把每一個歷史上踩過的錯誤路徑,變成一個對應的 regression test。

我特別喜歡 `test_413_compression.py` 這種命名,光看名字你就猜得到背後故事:**有一天有人收到 HTTP 413(payload too large),壓縮路徑沒觸發,生產炸了,修完之後留一個測試確保這事不會再發生**。Hermes 大量的測試都是這種「事故 → fix → 留 regression test」的疤痕組織。

---

## 第四招:怎麼測 context compression?fixture 一段對話就好

Day 4 講過 context 壓縮——對話太長要壓成結構化摘要,而且 active task 要 verbatim 保留(整段一字不漏)。

這玩意怎麼測?其實是這套裡面最好測的部分:

1. 準備一段超長對話的 fixture(json 檔丟在 `tests/fixtures/` 之類的地方)
2. 跑 `compressor.compress(messages)`
3. assert 結構化 template 的每個欄位都有出現
4. assert active task 那段字串**逐字符**保留在輸出裡
5. assert token 數有降(用 tokenizer 算一遍輸入和輸出)

`test_context_compressor.py`、`test_context_compressor_summary_continuity.py`、`test_compress_focus.py` 都是在做這件事。

這裡的精髓是:**compressor 本身的「品質」(壓得好不好讀)他們不測**——那是 LLM 決定的。他們只測**結構性的不變式**:欄位要在、active task 要保留、token 要降。不變式測得緊、品質讓 LLM 自己負責。

這是我覺得最值得抄的一招。我自己後來寫東西,只要遇到「LLM 做完一件事,輸出有結構」的場景,我就學這套——**assert 結構,不 assert 內容**。

---

## 第五招:純函式控制器是測試友善的天堂

Day 7 講工具系統的時候,我們提過 `tool_guardrails.py` 的三個計數器——exact-failure、same-tool-failure、idempotent no-progress,門檻分別是 2/5、3/8、2/5。

這玩意是這整套系統裡**最好測**的東西。為什麼?因為它是個純函式控制器:**丟一系列 `ToolCallSignature` 進去,吐一個決定出來**(警告 / 阻擋 / 通過)。沒有 LLM、沒有 I/O、沒有狀態洩漏。

`test_agent_guardrails.py` 就是把這個控制器當成純函式測:

- 連續丟 2 個一模一樣的失敗 → assert 出來是 warning
- 連續丟 5 個一模一樣的失敗 → assert 出來是 block
- 中間穿插一個成功 → assert 計數器被重置
- 不同 tool 的失敗交錯 → assert 兩個計數器各自獨立

這就是純測試樂園的樣子。**這也是為什麼 Day 7 我特別強調「工具系統做得不錯」——它有獨立模組、邊界清楚,所以測得起來**。對比一下 `cli.py` 那個 657KB 的怪物(Day 14 會狂罵),裡面塞了 30 種 slash command 處理,每個都半綁在 UI 半綁在邏輯,**那種東西根本沒辦法寫單元測試**——你只能跑整個 CLI、輸入字串、assert 輸出,然後祈禱。

**寫程式的時候多花十分鐘把純邏輯抽出來,測試的時候會少花十小時**。Hermes 的測試覆蓋率分布,基本上就是這條規則的活體證明:抽得乾淨的地方測得密,糾纏的地方測不動。

---

## CI/CD 的細節:三層防禦

光寫測試還不夠,你得讓它**在 CI 裡也能跑、跑得跟本機一樣**。Hermes 在 `.github/workflows/tests.yml` 跟 `scripts/run_tests.sh` 裡做了三件我覺得很值得抄的事:

**第一,密封性的三層防禦**。CI 裡 `tests.yml` 把所有 API key env var 設成空字串;`conftest.py` 在 fixture 層級再 unset 一次;`run_tests.sh` 在 bash 層級又 blank 一次。為什麼這麼偏執?因為「**真的 API key 不小心被測試吃進去**」會發生很 ironic 的事——你的測試會去打真的 OpenAI,測試會「過」(因為 LLM 回的東西看起來合理),但**你的信用卡會莫名其妙被刷**。三層防禦的成本是 30 行 code,收益是不會「某天醒來發現帳單比上個月多了一個量級」。

**第二,本機 / CI 一致性是被強制的**。`run_tests.sh` 釘住 `-n 4`(平行 worker 數),因為 CI 機器是 4 核;如果在 20 核工作站用 `-n auto`,會跑出 CI 從沒見過的順序組合,然後出現「本機綠、CI 紅」的 flake。釘死 worker 數,本機跟 CI 才會看到一樣的東西。

**第三,事故驅動的護欄**。`.github/workflows/` 裡有兩個有趣的 workflow:
- `history-check.yml`:拒絕沒有共同 merge-base 的 PR。為什麼有這條?因為某天有個 PR 接上了第二個無父根 commit,導致 1500 個檔案的 `git blame` 崩潰。
- `contributor-check.yml`:作者 email 不在 `scripts/release.py` 的 `AUTHOR_MAP` 就讓 PR 失敗。

**這兩個 workflow 不是「最佳實踐」教科書教的,是被事故撞出來的疤痕組織**——一次特定的災難,留下一個自動化的護欄。整個 `.github/workflows/` 讀起來像考古挖掘,每個檔案都對應一個曾經很痛的故事。

---

## 趣聞:trajectory 格式的 migration test

Hermes 從某個版本之後改了 trajectory 的儲存格式(壓縮、結構化、加欄位),但他們留了 migration test——保證**舊版本存的 session 還能被新版本讀進來**。

這聽起來很基本對吧?但我看過太多 side project 是這樣:格式一改、舊 session 全廢、使用者罵翻、開發者道歉、最後乾脆禁用舊資料。Hermes 沒這麼做的原因很實際——他們的 trajectory 是真實使用者跑 agent 累積出來的,**那是訓練 self-improvement loop(Day 6 講的)的原料**,丟掉等於丟掉好幾個月的資產。

所以他們把「舊格式 → 新格式的 migration」也寫成 test,每個 release 都跑一遍。這也是一個小到容易忽略、但長期會省很多事的習慣。

---

## 但他們沒測到什麼?最大的缺口

到這裡你應該感覺 Hermes 的測試很猛吧?但**這套東西有一個大到誇張的洞**——

**沒有 agent eval 層**。

Hermes **沒有**任何一個測試在做這件事:「給 100 個任務,跑這個 agent,看通過率多少」。沒有 SWE-bench 風格的 benchmark、沒有 golden trajectory regression、沒有多輪任務完成評分、沒有跑分。

換句話說:**這套 23,500 個測試證明了 Hermes 的程式碼很穩健——streaming 不會壞、recovery 會觸發、壓縮會壓——但完全沒證明 Hermes 是一個好的 agent**。

「水管」測得鋸齒分明,「流體本身好不好喝」這件事被整個跳過。

我講這個不是要踩 Hermes。我自己寫東西也沒做 eval。**因為 eval 真的很貴**——你要先有一組標註好的任務、要有一個 reproducible 的環境、要有一個自動化的 scoring 機制,而且 LLM 隨便變一下,你整套 eval 都要重跑。對一個三個月內衝到 22 平台的專案來說,優先級永遠排不到。

但這就是 Day 14 我要正面開砲的點之一:**一個叫做 "agent" 的產品,沒有 agent quality 的 eval,本質上是在賭信仰**。今天先記在這。

---

## 這對你寫自己 agent 的啟發

收一下這篇學到的東西,變成可以直接帶走的規則:

1. **早期 agent 不要追求 100% 自動化測試**。LLM 的部分讓人工驗收,但**水管的部分要確定性、要嚴**。
2. **把純邏輯抽出來**。任何一段 code 只要寫成「給定 input,吐 output,沒有 side effect」,測試就會自己長出來。Hermes 的 tool guardrails 是模範生,`cli.py` 是反面教材。
3. **assert 結構,不 assert 內容**。LLM 輸出有結構的時候,測欄位有沒有在、不變式有沒有守住——不要去 assert「文字看起來對」。
4. **手工捏對抗性 fixture**,特別是 streaming 的 chunk 邊界。bug 都藏在「正常測試不會切到」的邊界。
5. **每一個生產事故,留一個 regression test**。Hermes 那種 `test_413_compression.py`、`test_1630_context_overflow_loop.py` 的命名就是疤痕組織——名字直接指向當時的 bug。
6. **CI 跟本機要對齊**。worker 數釘死、env var 三層清空、密封環境檢查。這些都不貴,長期省命。

最後一條最重要:**先承認你不可能測 agent 的「智慧」,然後把所有不需要靠智慧也能保證的東西測爆**。剩下不能測的部分,靠人類眼睛 + 真實使用驗收。

不要假裝自動化覆蓋率能取代品味。

---

講了 13 天,Hermes 怎麼做核心迴圈、怎麼接 model、怎麼記住、怎麼動手、怎麼接 MCP、怎麼開介面、怎麼測試,都看過了。

但講到這你應該有感覺——這東西**不是完美的**。`cli.py` 657KB、`run_agent.py` 4,123 行(內含 `AIAgent` god object,64 個 kwargs)、沒有 agent eval、Windows CI 從來沒被執行過。明天我們不再護航,正面開砲——**Hermes 哪裡做得不夠好,如果你要寫自己的 agent,哪些坑你應該繞開**。

---

## 想自己翻原始碼?

| 檔案 / 目錄 | 在幹嘛 |
|---|---|
| `tests/conftest.py` | 973 行的密封環境 fixture,每個測試前剝掉 env var、reset 模組狀態 |
| `tests/run_agent/test_repair_tool_call_arguments.py` | 對抗性 chunk 邊界測試的範例 |
| `tests/run_agent/test_413_compression.py` | 事故驅動 regression test 的範例 |
| `tests/run_agent/test_compression_boundary.py` | context 壓縮的不變式測試 |
| `tests/agent/test_context_compressor.py` | compression 的結構欄位 assertion |
| `tests/test_live_system_guard_self_test.py` | 防止測試誤殺開發者本機 gateway 程序 |
| `tests/fakes/fake_ha_server.py` | 真實 aiohttp server,測 Home Assistant adapter |
| `tests/stress/` | 並行 / property fuzzing 測試,opt-in |
| `scripts/run_tests.sh` | 釘住 `-n 4`、三層密封性的 entry point |
| `.github/workflows/tests.yml` | CI 主要測試 workflow |
| `.github/workflows/history-check.yml` | 事故驅動的 git history 護欄 |
| `.github/workflows/contributor-check.yml` | 事故驅動的 contributor 護欄 |

從 `tests/conftest.py` 開始讀,理解七個 autouse fixture 各自關掉什麼;然後挑一個 `test_*_recovery.py` 看 fake LLM 怎麼構造;最後讀 `scripts/run_tests.sh` 理解本機跟 CI 怎麼對齊。
