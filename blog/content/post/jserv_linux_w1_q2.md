---
title: "jserv - linux 核心設計 第一周題目二解題紀錄"
date: 2021-09-01T01:04:53+08:00
draft: false
tags: 
    - c
categories: ["c"]
description: "jserv Linux 核心設計課程第一週第二題解題紀錄，練習以函式指標操作單向 linked list 的各種運算。"
---

題目使用的是單向 linked list：
```c
typedef struct __list {
    int data;
    struct __list *next;
} list;
```

在不存在環狀結構的狀況下，以下函式能夠對 linked list 元素從小到大排序:
請補完 LL0 ~ LL6 程式碼。

```c
list *sort(list *start) {
    if (!start || !start->next)
        return start;
    list *left = start;
    list *right = left->next;
    /*
        LL0;
        (a): left->next = NULL;
        (b): right->next = NULL;
        (c): left = left->next;
        (d): left = right->next;
    */

    left = sort(left);
    right = sort(right);

    for (list *merge = NULL; left || right; ) {
        if (!right || (left && left->data < right->data)) {
            if (!merge) {
                /*
                    LL1:
                    (a): start = left;  
                    (b): start = right;
                    (c): merge = left;
                    (d): merge = right;
                    (e): start = merge = left;
                    (f): start = merge = right;
                */
            } else {
                /*
                    LL2;
                    (a): merge->next = left;
                    (b): merge->next = right;
                */
                merge = merge->next;
            }
            /*
                LL3;
                (a): left = left->next;
                (b): right = right->next;
                (c): left = right->next;
                (d): right = left->next;
            */
        } else {
            if (!merge) {
                /*
                    LL4;
                    (a): start = left
                    (b): start = right;
                    (c): merge = left;
                    (d): merge = right;
                    (e): start = merge = left;
                    (f): start = merge = right;
                */
            } else {
                /*
                    LL5;
                    (a): merge->next = left;
                    (b): merge->next = right;
                */
                merge = merge->next;
            }
            /*
                LL6;
                (a): left = left->next;
                (b): right = right->next;
                (c): left = right->next;
                (d): right = left->next;
            */
        }
    }
    return start;
}
```

### 解題思路

觀察 `sort` 函式可以發現它在內部呼叫了自身，因此這是一個遞迴函式。確認這點之後，首先要找出**遞迴的終止條件**：

```c
if(!start || !start->next) {
    return start;
}
```

開頭的 if 有兩種中止條件：
- `start == NULL`：list 為空，回傳 NULL
- `start && !start->next`：list 只有一個元素，直接回傳自身

接著看函式的宣告：
```c
list *sort(list *start);
```

回傳型別是 `list*`，也就是說 `sort` 呼叫後會回傳一個已排序好的 list head。

繼續往下看：

```c
list *left = start;
list *right = left->next;
/*
    LL0;
    (a): left->next = NULL;
    (b): right->next = NULL;
    (c): left = left->next;
    (d): left = right->next;
*/

left = sort(left);
right = sort(right);
```

可以看出 list 被分成了兩部分：
- `list *left = start;`
- `list *right = left->next;`

之後再分別呼叫 `sort` 排序。根據 merge sort 的經驗，這裡應該要先把 list 切成兩條獨立的 list，因此推斷 **`LL0: left->next = NULL;`**：

```c
list *left = start;
list *right = left->next;
left->next = NULL;

left = sort(left);
right = sort(right);
```

### 遞迴呼叫思考

假設 input 的 list 有五筆資料：
```
1 -> -3 -> 2 -> -4 -> 5
```

先不看 merge 的邏輯，依照上面推斷的部分呼叫 `sort`：

```c
list *head;
// append datas

head = sort(head);
```

呼叫之後展開

```c
if(!head || !head->next)
    return head;
    
list *left = head;
list *right = left->next;
left->next = NULL;

```


根據假設的資料，`left` 和 `right` 分別是：

- **left**：`1`
- **right**：`-3` &rarr; `2` &rarr; `-4` &rarr; `5`

```c
left = sort(left);
right = sort(right);
```

`left` 只有一個元素，所以直接 return。`right` 有四個元素，不符合終止條件，繼續遞迴展開：

```
1 -> -3 -> 2 -> -4 -> 5

left = 1
right = -3 -> 2 -> -4 -> 5

    left = -3
    right = 2 -> -4 -> 5
    
        left = 2
        right = -4 -> 5
        
            left = -4
            right = 5 // 遞迴中止
```

思考一下遞迴中止後會發生什麼：

`left = -4`, `right = 5` 先合併 &rarr; `-4 -> 5`

&darr;

再跟上層的 `left = 2` 合併會變成這樣
`left = 2`, `right = -4 -> 5` &rarr; `-4 -> 2 -> 5`

&darr;

繼續 `return` 跟上層 `left = -3` 合併
`left = -3`, `right = -4 -> 2 -> 5` &rarr; `-4 -> -3 -> 2 -> 5`

&darr;

繼續 `return` 跟上層 `left = 1` 合併
`left = 1`, `right = -4 -> -3 -> 2 -> 5`

合併成最終排序完成的 list: `-4 -> -3 -> 1 -> 2 -> 5`

有沒有發現每次合併的過程都很像 insert sort？只是這裡是從右側一個一個 insert 到最左邊的元素上。

遞迴呼叫的邏輯到這裡差不多清楚了，接下來思考 merge 的邏輯：如何把 `left` 和 `right` 合併，並回傳排序好的 list head。

### merge 邏輯

```c
left = sort(left);
right = sort(right);

for (list *merge = NULL; left || right; ) {
        if (!right || (left && left->data < right->data)) {
            if (!merge) {
                /*
                    LL1:
                    (a): start = left;  
                    (b): start = right;
                    (c): merge = left;
                    (d): merge = right;
                    (e): start = merge = left;
                    (f): start = merge = right;
                */
            } else {
                /*
                    LL2;
                    (a): merge->next = left;
                    (b): merge->next = right;
                */
                merge = merge->next;
            }
            /*
                LL3;
                (a): left = left->next;
                (b): right = right->next;
                (c): left = right->next;
                (d): right = left->next;
            */
        } else {
            if (!merge) {
                /*
                    LL4;
                    (a): start = left
                    (b): start = right;
                    (c): merge = left;
                    (d): merge = right;
                    (e): start = merge = left;
                    (f): start = merge = right;
                */
            } else {
                /*
                    LL5;
                    (a): merge->next = left;
                    (b): merge->next = right;
                */
                merge = merge->next;
            }
            /*
                LL6;
                (a): left = left->next;
                (b): right = right->next;
                (c): left = right->next;
                (d): right = left->next;
            */
        }
    }
```

經過遞迴之後：

```c
left = sort(left);
right = sort(right);
```

可以假設 `left` 和 `right` 目前都已經是排序好的狀態，兩個指標所指向的 `data` 都是該 list 的**最小值**。

接下來透過 for loop 的 merge 邏輯，把較小的 `data` 接到正確的位置，並以此作為新的起點：

```c
for(list *merge = NULL; left || right) {
    if(!right || (left && left->data < right->data)) {
        if(!merge) {
            /*
                LL1:
                (a): start = left;  
                (b): start = right;
                (c): merge = left;
                (d): merge = right;
                (e): start = merge = left;
                (f): start = merge = right;
            */
        } else {
             /*
                    LL2;
                    (a): merge->next = left;
                    (b): merge->next = right;
            */
            merge = merge->next;
        }
        /*
            LL3;
            (a): left = left->next;
            (b): right = right->next;
            (c): left = right->next;
            (d): right = left->next;
        */
    } else {
        ...
    }
}
```

```c
if(!right || (left && left->data < right->data)) {
    if(!merge) {
        LL1
    } else {
        LL2
        merge = merge->next;
    }
    LL3
} else {
    if(!merge) {
        LL4
    } else {
        LL5
        merge = merge->next;
    }
    LL6
}
```

先看進入 `if(!right || (left && left->data < right->data))` 的情況：當 `left->data < right->data` 時，`left` 是當前兩條 list 的最小值，應該讓 `start` 指向它。

剛進入 for loop 時 `merge` 尚未初始化，會進入 `if(!merge)` 的區塊。可以推測 `LL1` 需要同時做兩件事：

- 初始化 `merge`
- 將 `start` 指向 `left`

因此 **`LL1: start = merge = left;`**

```c
for(list *merge = NULL; left || right) {
    if(!right || (left && left->data < right->data)) {
        if(!merge) {
            start = merge = left;
        } else {
            LL2
            merge = merge->next;
        }
        LL3
    }
}
```

`LL3` 的部分：`left` 的第一個元素已暫存在 `merge`，所以 **`LL3: left = left->next;`**，移動到下一個節點。

```c
for(list *merge = NULL; left || right) {
    if(!right || (left && left->data < right->data)) {
        if(!merge) {
            start = merge = left;
        } else {
            LL2
            merge = merge->next;
        }
        left = left->next;
    } else {
        if(!merge) {
            LL4
        } else {
            LL5
            merge = merge->next;
        }
        LL6
    }
}
```
接著考慮 `left->data > right->data` 的情況，此時不滿足 if 條件，進入下方的 else 區域：

- `!merge` 的情況下，與 LL1 思路相同，需要同時做兩件事：
    - 初始化 `merge`
    - 將 `start` 指向 `right`

因此 **`LL4: start = merge = right;`**

同理，**`LL6: right = right->next;`** 和 LL3 的思路一致。


```c
for(list *merge = NULL; left || right) {
    if(!right || (left && left->data < right->data)) {
        if(!merge) {
            start = merge = left;
        } else {
            LL2
            merge = merge->next;
        }
        left = left->next;
    } else {
        if(!merge) {
            start = merge = right;
        } else {
            LL5
            merge = merge->next;
        }
        right = right->next;
    }
}
```

最後只剩 `LL2` 和 `LL5` 需要說明。

回顧遞迴的過程，function 呼叫到最右側後開始 return，往左合併，過程類似 insert sort。每次進入 merge 邏輯時，通常是 `left` 只有一個元素，`right` 則是已排好的一段 list。

假設 `left = -3`、`right = 2->5` 進入 for loop：

經過第一輪的 `for loop` 情況會變成
- `start` = `merge` = `left(-3)`
    - `left` = `left->next` (NULL)
- `right` = `2->5`

此時不滿足 if 條件，進入 else 區塊；又因為 `merge` 已初始化，所以最終會走到 `LL5`。

這時候需要把已 merge 好的部分接上 `right` 那側已排好的 list，因此 **`LL5: merge->next = right;`**

```c
for(list *merge = NULL; left || right) {
    if(!right || (left && left->data < right->data)) {
        if(!merge) {
            start = merge = left;
        } else {
            LL2
            merge = merge->next;
        }
        left = left->next;
    } else {
        if(!merge) {
            start = merge = right;
        } else {
            merge->next = right;
            merge = merge->next;
        }
        right = right->next;
    }
}
```

執行後的狀態：

- `start` 仍指向 `-3`，將作為回傳值（`sort` 的設計是每次回傳已排好的 list head，所以需要 `start` 記錄起點）
- `merge`：`-3->2->5`，`merge = merge->next`（現在指向 `2`）
- `right = right->next`（現在指向 `5`）

因為 `left` 和 `right` 其中一個不為空，迴圈繼續執行。

同理，**`LL2: merge->next = left;`**

至此所有空格都填完了，完整程式碼如下：

```c
list *sort(list *start) {
    if (!start || !start->next)
        return start;
    list *left = start;
    list *right = left->next;
    left->next = NULL;
    
    left = sort(left);
    right = sort(right);

    for (list *merge = NULL; left || right; ) {
        if (!right || (left && left->data < right->data)) {
            if (!merge) {
                start = merge = left;
            } else {
                merge->next = left;
                merge = merge->next;
            }
            left = left->next;
        } else {
            if (!merge) {
                start = merge = right;
            } else {
                merge->next = right;
                merge = merge->next;
            }
            right = right->next;
        }
    }
    return start;
}
```

### 思考過程

如果還是不太清楚，建議代入實際的值，用紙筆跑一遍流程。數字不用複雜，例如：

`left: -4`，`right: -5->2->8`

可以先試 `right` 開頭比 `left` 小的 case，再試一個 `left` 開頭較小的 case，這樣會對演算法的運作流程更有感覺。

### 驗證正確性

> 此章節尚未補完，有興趣可以參考 reference。

目前完整的檔案可以參考 [GitHub](https://github.com/davidleitw/linked_list/blob/master/question/question3.c)


### reference 
<!-- - [snprintf 妙無窮](https://wirelessr.gitbooks.io/working-life/content/snprintf_miao_wu_qiong.html) -->