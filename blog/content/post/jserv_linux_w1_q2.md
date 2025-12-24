---
title: "jserv - linux 核心設計 第一周題目二解題紀錄"
date: 2021-09-01T01:04:53+08:00
draft: false
tags: 
    - c
categories: ["c"]
---

單向 linked list
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

先觀察 `sort` 會看到該函式在內部會呼叫 `sort`，所以為遞迴函式。
知道是遞迴函式就要先關注遞迴的**終止條件**。

```c
if(!start || !start->next) {
    return start;
}
```

先觀察開頭的 if 敘述，有兩種情況會導致遞迴中止
- `start == NULL` &rarr; 表示該 list 為空，`return NULL;`
- `start && !start->next` &rarr; 表示該 list 只有一個元素，直接 return 自身。

再來觀察回傳的部份，先看一下函式的宣告
```c
list *sort(list *start);
```

回傳的資料型態是 `list*`，所以可以得知呼叫 `sort` 之後會得到一串已經排序好的 list。

接著繼續往下看

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

這段可以知道我們的 list 被分成了兩部份
- `list *left = start;`
- `list *right = left->next;`

之後再分別呼叫 `sort` 排序，根據以前寫 `merge sort` 的經驗，這邊先認定要把 `list` 分成兩條獨立的 `list`，先判斷 **`LL0: left->next = NULL;`**

```c
list *left = start;
list *right = left->next;
left->next = NULL;

left = sort(left);
right = sort(right);
```

### 遞迴呼叫思考

接著思考一下今天我們 input 的 `list` 有五筆資料好了
```
1 -> -3 -> 2 -> -4 -> 5
```

我們現在先不要看下面的邏輯，依照我們上面推斷的部份呼叫看看 `sort`

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


根據上面假設的資料，現在我們 `left`, `right` 應該分別長這樣

- **left** : `1`
- **right** : `-3` &rarr; `2` &rarr; `-4` &rarr; `5`


```c
left = sort(left);
right = sort(right);
```

因為我們 `left` 只有一個元素，所以會直接 `return` 
`right` 呢？ 目前 `right` 有四個元素，所以不符合終止條件，會繼續呼叫遞迴下去。

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

試著思考一下，遞迴中止之後會發生什麼

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

有發現嗎？ 每次合併的時候都像是在做 `insert sort`，但是比較不一樣的是我們是從右邊開始一個一個元素 `insert` 到最左邊的元素。

所以上面我們已經完成了呼叫遞迴的邏輯，下面要來思考怎麼 `merge`，才可以把 `left` 跟 `right` 組合，並且回傳以排序好的 `list's head`。

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

由於我們上面經過了遞迴的過程

```c
left = sort(left);
right = sort(right);
```

所以我們可以先假設，`left`, `right` 目前都已經是排序好的狀態
`left`, `right` 指標所指的 `data` 都是該 `list` 的**最小值**。

之後要透過 `for loop` 的 `merge` 邏輯，把比較小的 `data` 當作 start 並接到正確的位置。

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

首先來觀察進入 `if(!right || (left && left->data < right->data))` 這個區域的情況
- `left->data < right->data` 成立時，我們應該要想辦法將 `start` 指向 `left`，因為 `left` 此時擁有 `left`, `right` 兩條 `list` 的最小值。

一開始進入 `for loop` 的時候 `merge` 還沒有經過初始化，會進入 `if(!merge)` 的區塊，可以合理推測 `LL1` 需要做到兩件事情

- 初始化 `merge`
- 將 `start` 指向 `left`

所以 **`LL1: start = merge = left;`**

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

`LL3` 的部分，因為已經處理好 `left` 的第一個元素了(`暫存在 merge`)，所以 **`LL3: left = left->next;`**，移動到下一個節點。

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
接著先考慮 `left->data > right->data` 的情況，這時不符合 `if(!right || (left && left->data < right->data))`的敘述，所以會進入下方的 `else` 區域

- `!merge` 的情況下，照著上面的思路(同LL1思考邏輯)，應該需要同時做到兩件事情
    - 初始化 `merge`
    - 將 `start` 指向 `right`
 
所以可以推論出 **`LL4: start = merge = right;`**

同理 **`LL6: right = right->next;`** 與上方 `LL3` 思路一致。


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

最後只剩下 `LL2`, `LL5` 需要解釋

根據一開始我們思考遞迴過程的部份，我們的 `function` 呼叫到最右側的時候就會開始 `return` 開始往左做類似 `insert sort` 的動作。

所以每次進入 `merge` 這段邏輯的時候，通常的情況都是 `left` 有一個元素，`right` 有一段已經排列好的 `list`

今天假設 `left` = `-3`, `right` = `2->5` 進入 `for loop` 之中

經過第一輪的 `for loop` 情況會變成
- `start` = `merge` = `left(-3)`
    - `left` = `left->next` (NULL)
- `right` = `2->5`

這時候因為不滿足 `if(!right || (left && left->data < right->data))` 的條件所以進入 `else` 區塊，又因為 `merge` 已經經過初始化，所以最終會跑到 `LL5` 的區域

這時候我們需要把已經 `merge` 好的部份接上 `right` 那邊已經排列好的 `list`
所以 **`LL5: merge->next = right;`**

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

經過這行之後

- `start` 依舊指向 `-3` 的位置，將會作為之後的回傳值
    - 因為我們 `sort` 的設計是每次都會把排序好的 `list head` 回傳，所以才需要 `start` 紀錄開頭。
- `merge`: `-3->2->5`
    - `merge` = `merge->next`(此時指向`2`)
- `right` = `right->next`(此時指向`5`)

因為`left`, `right` 其中之一不為空，所以迴圈會繼續。

所以 `LL2` 跟 `LL5` 的思路同理，**`LL2: merge->next = left;`**

這樣我們基本上就把整個 `sort` 的空格填完了，以下是完整程式碼:

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

如果沒辦法理解上面的內容，也可以嘗試著代入實際的值，用紙筆簡單跑過一次流程
不用太複雜的數字，可以用

`left: -4`, `right: -5->2->8`

這種 `right` 開頭比 `left` 小的 `case`，再想一個 `left` 開頭比較小的 `case`等等..
這樣子就能更清楚的思考出該演算法的運作流程。


### 驗證正確性

// 待補充

之後會補上測試正確性的程式碼，目前完整的檔案可以參考 [GitHub](https://github.com/davidleitw/linked_list/blob/master/question/question3.c)


### reference 
<!-- - [snprintf 妙無窮](https://wirelessr.gitbooks.io/working-life/content/snprintf_miao_wu_qiong.html) -->