---
title: "Circular Doubly linked list 實作 bubble sort "
date: 2021-08-25T04:16:48+08:00
draft: false
tags: 
    - c
categories: ["c"]
description: "jserv Linux 核心設計課程延伸題目：在 Circular Doubly Linked List 上實作 Bubble Sort，練習雙向指標操作與排序邏輯。"
---

## 前言

本問題出自於 [jserv - Linux 核心設計講座](http://wiki.csie.ncku.edu.tw/linux/schedule) 第一周 [linked list 和非連續記憶體操作](https://hackmd.io/@sysprog/c-linked-list) 底下[題目一](https://hackmd.io/@jserv/SyK-WApKM?type=view)的延伸題目 

![](https://i.imgur.com/mHpjpNG.png)

本篇記錄 bubble sort 在 circular doubly linked list 上的實作。

## node 結構

```c
struct node {
    int data;
    struct node *next, *prev;
};
```

本題的 linked list 屬於 circular doubly linked list，因此 swap 時需要額外處理 `prev` 指標，還要考慮循環結構帶來的邊界問題。


## Bubble sort

```c
void bubble_sort(int *arr, const int length) 
{
    for(int i = 0; i < length-1; i++) {
        int flag = 0;
        for(int j = 0; j < length-i-1; j++) {
            if(arr[j] > arr[j+1]) {
                int t = arr[j];
                arr[j] = arr[j+1];
                arr[j+1] = t;
                flag = 1;
            }
        }
        if(!flag) break;
    }
}
```


在實作 linked list 版本之前，先看一下一般 array 版本的實現。bubble sort 本身邏輯容易理解，這裡比較大的挑戰是需要先實作一個 `swap_node` 來交換兩個 node。

### swap_node

```c
void swap_node(struct node *n1, struct node *n2) {
    n1->prev->next = n2;
    n2->prev = n1->prev;
    
    n1->next = n2->next;
    n2->next->prev = n1;
    
    n1->prev = n2;
    n2->next = n1;
}
```

因為採用 doubly linked list，swap 時需要額外處理 `prev` 指標。下面用示意圖說明 swap 的運作過程：

![](https://i.imgur.com/qNOURXT.png)


假設要 swap `node_2` 和 `node_3`，swap 完之後應該變成這樣：

![](https://i.imgur.com/3WEADJB.png)

回顧 swap function 的定義：

```c
swap_node(node_2, node_3);
```

傳入的是 `node_2` 和 `node_3` 的地址，`node_1` 和 `node_4` 無法直接存取。

接著一步一步來解析，先處理 `node_1` 和 `node_3` 之間的連結：

```c
node_1->next = node_3;
node_3->prev = node_1;
```

由於無法直接存取 `node_1`，要透過 `node_2->prev` 來表示：

```c
node_2->prev->next = node_3;
node_3->prev = node_2->prev;
```

![](https://i.imgur.com/j0Gyabk.png)

接著處理 `node_2` 和 `node_4` 之間的連結：

```c
node_2->next = node_4;
node_4->prev = node_2;
```

由於無法直接存取 `node_4`，要表示成 `node_3->next`：

```c
node_2->next = node_3->next;
node_3->next->prev = node_2;
```

處理完之後的狀態如下，最後只需要調整 `node_2` 和 `node_3` 之間的連結：

![](https://i.imgur.com/I6PkLqk.png)

讓 `node_2->prev` 指向 `node_3`、`node_3->next` 指向 `node_2`，完成最後的交換：


```c
node_2->prev = node_3;
node_3->next = node_2;
```

最後完成如下

![](https://i.imgur.com/3WEADJB.png)

如果對指標操作還不熟悉，建議拿紙筆自己畫一遍，會清楚很多。

## Bubble sort with Circular doubly linked list

```c
void bubble_sort(struct node **head, const int length) {
    if(!*head) return;
    struct node *tnode; // temp
    struct node *lnode = *head;
    struct node *rnode = lnode->next;

    for(int i = 0; i < length - 1; i++) {
        int flag = 0;
        for(int j = 0; j < length - i - 1; j++) {
            if(lnode->data > rnode->data) {
                swap_node(lnode, rnode);
                tnode = rnode;
                rnode = lnode;
                lnode = tnode;
                flag = 1;
            }
            lnode = lnode->next;
            rnode = rnode->next;
        }
        for(int j = 0; j < i+1; j++)
            lnode = lnode->next;
        rnode = lnode->next;
        if(!flag) break;
    }
    *head = lnode;
}
```

接著說明 bubble sort 在 circular doubly linked list 上的實現。根據 array 版本的邏輯，我們需要兩個指標指向要比較的相鄰節點：

```c
struct node *lnode;
struct node *rnode;
```

整體邏輯與一般 bubble sort 相同，但因為資料結構是 circular doubly linked list，有幾個細節需要注意：

```c
if(lnode->data > rnode->data) {
    swap_node(lnode, rnode);
    tnode = rnode;
    rnode = lnode;
    lnode = tnode;
}
```

繼續用剛才的例子，假設要交換 `node_2` 和 `node_3`，此時 `lnode` 指向 `node_2`、`rnode` 指向 `node_3`：

![](https://i.imgur.com/Dc26hSg.png)

交換完之後會變成

![](https://i.imgur.com/AfCCDhB.png)

swap 完成後，為了讓後續的比較能從正確位置繼續，需要把 `lnode` 和 `rnode` 重新指向正確的節點：
```c
tnode = rnode;
rnode = lnode;
lnode = tnode;
```

![](https://i.imgur.com/u7MylD9.png)


傳統 bubble sort 每輪比完都要從 arr[0] 重新開始。在 circular doubly linked list 中，每輪結束後需要把 `lnode` 重新移回起點，再讓 `rnode` 指向 `lnode->next`：



```c
for(int j = 0; j < i+1; j++)
    lnode = lnode->next;
rnode = lnode->next;
```

完整的程式碼放在 [GitHub](https://github.com/davidleitw/linked_list/blob/master/question/bubblesort.c)

之後也會補上延伸題目的 `merge sort`。

## reference

- [舌尖上的演算法系列: Day7 -- Brute Force - Bubble Sort](https://ithelp.ithome.com.tw/articles/10236214)