---
title: "Circular Doubly linked list 實作 bubble sort "
date: 2021-08-25T04:16:48+08:00
draft: false
tags: 
    - c
categories: ["c"]
---

## 前言

本問題出自於 [jserv - Linux 核心設計講座](http://wiki.csie.ncku.edu.tw/linux/schedule) 第一周 [linked list 和非連續記憶體操作](https://hackmd.io/@sysprog/c-linked-list) 底下[題目一](https://hackmd.io/@jserv/SyK-WApKM?type=view)的延伸題目 

![](https://i.imgur.com/mHpjpNG.png)

在這篇文章會紀錄關於 `bubble sort` 的實現。

## node 結構

```c
struct node {
    int data;
    struct node *next, *prev;
};
```

本題目 `linked list` 屬於 `circular doubly linked list`, 所以處理上還需要考慮循環的問題。

`swap` 之後要把 `node` 的 `prev` 跟 `next pointer` 處理好。


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


在寫 `linked list` 版本的 `sort` 之前，先來看一下一般 `array` 版本的實現方式。
基本上 `bubble sort` 算是一個容易理解的演算法，現在比較大的問題是要先實現一個 `swap` 來對兩個 `node` 交換。

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

因為我們 `linked list` 是採用 `doubly linked list`，所以還要額外處理 `prev` 指標。


以下用簡單的示意圖解釋一下這個 swap 是怎麼運作的

![](https://i.imgur.com/qNOURXT.png)


今天我們想要 swap `node_2`, `node_3`，經過 swap 之後應該要變成這樣:

![](https://i.imgur.com/3WEADJB.png)

先複習一下我們 `swap function` 的定義

```c
swap_node(node_2, node_3);
```

所以我們傳入的是 `node_2`, `node_3` 的地址，`node_1`, `node_4` 則不能直接存取。


接著我們一步一步來解析，先處理 `node_1`, `node_3` 之間的連結

```c
node_1->next = node_3;
node_3->prev = node_1;
```

因為我們沒辦法直接存取 `node_1`，所以要透過 `node_2->prev` 來表示

```c
node_2->prev->next = node_3;
node_3->prev = node_2->prev;
```

![](https://i.imgur.com/j0Gyabk.png)

接著處理 `node_2`, `node_4` 之間的連結

```c
node_2->next = node_4;
node_4->prev = node_2;
```

因為我們無法直接存取 `node_4`, 所以要表示成 `node_3->next`;

```c
node_2->next = node_3->next;
node_3->next->prev = node_2;
```

處理完之後變成這樣，最後只需要處理 `node_2`, `node_3` 之間的連結


![](https://i.imgur.com/I6PkLqk.png)

讓 `node_2->prev` 指向 `node_3`, `node_3->next` 指向 `node2`，實現最後的交換。


```c
node_2->prev = node_3;
node_3->next = node_2;
```

最後完成如下

![](https://i.imgur.com/3WEADJB.png)

建議如果對指標不熟悉的最好自己拿紙筆畫一次，會清楚很多。

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

接著來介紹 `bubble sort` 在 `circular doubly linked list` 中的實現
根據剛剛 `array` 版本的 `bubble sort`，我們需要兩個指標指向要比較的兩點。

```c
struct node *lnode;
struct node *rnode;
```

跟一般的 `bubble sort` 實現原理基本相同，只是因為我們的資料結構是 `circular doubly linked list`，所以有幾個需要注意的地方

```c
if(lnode->data > rnode->data) {
    swap_node(lnode, rnode);
    tnode = rnode;
    rnode = lnode;
    lnode = tnode;
}
```

繼續用剛剛的例子，假設今天是 `node_2`, `node_3` 要交換
此時 `lnode` 指向 `node_2`, `rnode` 指向 `node_3`

![](https://i.imgur.com/Dc26hSg.png)

交換完之後會變成

![](https://i.imgur.com/AfCCDhB.png)

這時候為了後續的交換，需要把 `lnode`, `rnode` 指向正確的地方

才需要這段程式碼
```c
tnode = rnode;
rnode = lnode;
lnode = tnode;
```

![](https://i.imgur.com/u7MylD9.png)


傳統的 `bubble sort` 每一輪比完都要從 arr[0] 開始重新比較，在 `circular doubly linked list` 中，我們每輪結束都要把 `lnode` 重新指向起點，並將 `rnode` 指向 `lnode->next`。



```c
for(int j = 0; j < i+1; j++)
    lnode = lnode->next;
rnode = lnode->next;
```

完整的程式碼放在 [GitHub](https://github.com/davidleitw/linked_list/blob/master/q1/bubblesort.c)

之後也會補上延伸題目的 `merge sort`。

## reference

- [舌尖上的演算法系列: Day7 -- Brute Force - Bubble Sort](https://ithelp.ithome.com.tw/articles/10236214)