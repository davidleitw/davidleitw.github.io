---
title: "Linux waitqueue 原始碼解讀"
date: 2022-01-08T03:12:53+08:00
draft: false
tags: 
    - linux_kernel
    - system_call
    - wait_queue
categories: ["linux_kernel"]
---

> 本文章環境基於 Linux v4.14.259

## 概述

`waitqueue` 如同其名，是 `kernel` 中管理一些在**等待資源**的 `task` 的資料結構，在 `task` 還沒辦法獲得資源時，會先將其放入 `waitqueue` 等待特定條件或者資源準備就緒才會把該 `task` 喚醒。

`waitqueue` 有定義兩種資料結構
- `wait_queue_head`: `waitqueue` 的 `head`
- `wait_queue_entry`: 來表示每個在 `waitqueue` 的元素

`waitqueue` 所有的實現都是基於 `kernel` 內建的 `double circular linked list` 來實現，所以本身的設計非常簡潔。 以下為 `waitqueue` 基本的 `data struct` 定義，位在 `/include/linux/wait.h`

![](https://i.imgur.com/jMSsGuq.png)


## [wait_queue_head_t](https://elixir.bootlin.com/linux/v4.14.259/source/include/linux/wait.h#L34)

```c
struct wait_queue_head {
	spinlock_t		lock;  // 自旋鎖
	struct list_head	head;  // 指向 prev, next entry.
};
typedef struct wait_queue_head wait_queue_head_t;
```

### 初始化 `waitqueue`

要建立新的 `waitqueue`，必須要先初始化 `wait_queue_head_t` 結構，透過 [init_waitqueue_head](https://elixir.bootlin.com/linux/v4.14.259/source/include/linux/wait.h#L63)，定義如下

```c
#define init_waitqueue_head(wq_head)						\
	do {									\
		static struct lock_class_key __key;				\
										\
		__init_waitqueue_head((wq_head), #wq_head, &__key);		\
	} while (0)
```

`init_waitqueue_head` 這個 `macro` 展開後會呼叫 [__init_waitqueue_head](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/wait.c#L16)

```c
void __init_waitqueue_head(struct wait_queue_head *wq_head, const char *name, struct lock_class_key *key)
{
	spin_lock_init(&wq_head->lock);
	lockdep_set_class_and_name(&wq_head->lock, key, name);
	INIT_LIST_HEAD(&wq_head->head);
}
```

但是看了一下好像也可以使用 [DECLARE_WAIT_QUEUE_HEAD](https://elixir.bootlin.com/linux/v5.15.13/source/include/linux/wait.h#L61) 來初始化的樣子，實現如下:

```c
#define __WAITQUEUE_INITIALIZER(name, tsk) {					\
	.private	= tsk,							\
	.func		= default_wake_function,				\
	.entry		= { NULL, NULL } }

#define DECLARE_WAITQUEUE(name, tsk)						\
	struct wait_queue_entry name = __WAITQUEUE_INITIALIZER(name, tsk)
```

我的理解是如果使用 `DECLARE_WAITQUEUE` 的話可以直接當成宣告，像是以下的寫法，如果我想宣告一個 `wait_queue_head_t` 變數名稱為 `wq_head`，可以直接寫成

```c
DECLARE_WAITQUEUE(wq_head);
```

至於 `init_waitqueue_head` 的話可能需要自己先宣告好變數，才能調用，像是以下的寫法

```c
struct wait_queue_head_t wq_head;
init_waitqueue_head(&wq_head);
```


## [wait_queue_entry](https://elixir.bootlin.com/linux/v4.14.259/source/include/linux/wait.h#L27)

```c
/*
 * A single wait-queue entry structure:
 */
struct wait_queue_entry {
	unsigned int		flags;
	void			*private; // 通常指向正在等待事件的 task_struct
	wait_queue_func_t	func;     // 喚醒函數(wake_up)
	struct list_head	entry;    // 指向 prev, next entry
};
```

一般來說喚醒函數是由調度器實現，所以如果沒有特殊需求，預設的喚醒函數是 [kernel/sched/core.c 中的 try_to_wake_up](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/core.c#L1989)，`try_to_wake_up` 在後續會有詳細的介紹。

### 新增 wait_queue_entry

`task_struct` 會封裝在 `wait_queue_entry` 的 `private` 成員內，所以在新增等待事件之前，需要先把 `task_struct` 包裝成 `wait_queue_entry` 的形式，可以通過 `DECLARE_WAITQUEUE` 這個 `macro` 來包裝，在建立的過程會把喚醒函數設為 `default_wake_function`，對於喚醒函數後面會有更詳細的說明。

### [DECLARE_WAITQUEUE](https://elixir.bootlin.com/linux/v4.14.259/source/include/linux/wait.h#L51)

```c
#define __WAITQUEUE_INITIALIZER(name, tsk) {					\
	.private	= tsk,							\
	.func		= default_wake_function,				\
	.entry		= { NULL, NULL } }

#define DECLARE_WAITQUEUE(name, tsk)						\
	struct wait_queue_entry name = __WAITQUEUE_INITIALIZER(name, tsk)
```

把 `task` 封裝成 `wait_queue_entry` 之後還需要添加到 `waitqueue` 當中，可以透過 `add_wait_queue` 來實現，定義如下:

### [add_wait_queue](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/wait.c#L25)

```c
void add_wait_queue(struct wait_queue_head *wq_head, struct wait_queue_entry *wq_entry)
{
	unsigned long flags;

	wq_entry->flags &= ~WQ_FLAG_EXCLUSIVE;
	spin_lock_irqsave(&wq_head->lock, flags);
	__add_wait_queue(wq_head, wq_entry);
	spin_unlock_irqrestore(&wq_head->lock, flags);
}
EXPORT_SYMBOL(add_wait_queue);
```

真正操作 `linked list` 是在 [__add_wait_queue](https://elixir.bootlin.com/linux/v4.14.259/source/include/linux/wait.h#L154) 當中，`__add_wait_queue` 會使用 `kernel` 操作 `linked list` 的 `api` 來添加 `wait_queue_entry` 到 `wait_queue` 當中。

```c
static inline void __add_wait_queue(struct wait_queue_head *wq_head, struct wait_queue_entry *wq_entry)
{
	list_add(&wq_entry->entry, &wq_head->head);
}
```

移除 `wait_queue_entry` 則是會呼叫 `remove_wait_queue`，具體實現如下:

### [remove_wait_queue](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/wait.c#L47)

```c
void remove_wait_queue(struct wait_queue_head *wq_head, struct wait_queue_entry *wq_entry)
{
	unsigned long flags;

	spin_lock_irqsave(&wq_head->lock, flags);
	__remove_wait_queue(wq_head, wq_entry);
	spin_unlock_irqrestore(&wq_head->lock, flags);
}
EXPORT_SYMBOL(remove_wait_queue);
```

## 休眠

### [wait_event](https://elixir.bootlin.com/linux/v4.14.259/source/include/linux/wait.h#L310)

```c
/**
 * wait_event - sleep until a condition gets true
 * @wq_head: the waitqueue to wait on
 * @condition: a C expression for the event to wait for
 *
 * The process is put to sleep (TASK_UNINTERRUPTIBLE) until the
 * @condition evaluates to true. The @condition is checked each time
 * the waitqueue @wq_head is woken up.
 *
 * wake_up() has to be called after changing any variable that could
 * change the result of the wait condition.
 */
#define wait_event(wq_head, condition)						\
do {										\
	might_sleep();								\
	if (condition)								\
		break;								\
	__wait_event(wq_head, condition);					\
} while (0)
```

如果要讓一個 `task` 睡眠直到某個條件達成，會使用 `wait_event` 這個 `macro`，因為 `macro` 的關係，可以做到直接把 `condition` 傳進去的這種靈活度，繼續往下看 `__wait_event(wq_head, condition)` 的展開，`__wait_event()` 同樣也是一個 `macro`。

```c
#define __wait_event(wq_head, condition)					\
	(void)___wait_event(wq_head, condition, TASK_UNINTERRUPTIBLE, 0, 0,	\
			    schedule())
```

值得注意的是展開後發現呼叫 `___wait_event()` 時傳入了 **TASK_UNINTERRUPTIBLE**，所以說 `wait_event` 中的事件等待是無法中斷的。

在 `include/linux/wait.h` 中也定義了各種不同的 `wait` 事件，像是:

- [wait_event_timeout](https://elixir.bootlin.com/linux/v4.14.259/source/include/linux/wait.h#L382): 帶有超時時間的等待，不可中斷。
- [wait_event_interruptible](https://elixir.bootlin.com/linux/v4.14.259/source/include/linux/wait.h#L466): 可中斷的等待。
- [wait_event_interruptible_timeout](https://elixir.bootlin.com/linux/v4.14.259/source/include/linux/wait.h#L500): 可中斷又帶有超時的等待。

接著來仔細看一下展開到最後的 `___wait_event` 內部實作

```c
/*
 * The below macro ___wait_event() has an explicit shadow of the __ret
 * variable when used from the wait_event_*() macros.
 *
 * This is so that both can use the ___wait_cond_timeout() construct
 * to wrap the condition.
 *
 * The type inconsistency of the wait_event_*() __ret variable is also
 * on purpose; we use long where we can return timeout values and int
 * otherwise.
 */

#define ___wait_event(wq_head, condition, state, exclusive, ret, cmd)		\
({										\
	__label__ __out;							\
	struct wait_queue_entry __wq_entry;					\
	long __ret = ret;	/* explicit shadow */				\
										\
	init_wait_entry(&__wq_entry, exclusive ? WQ_FLAG_EXCLUSIVE : 0);	\
	for (;;) {								\
		long __int = prepare_to_wait_event(&wq_head, &__wq_entry, state);\
										\
		if (condition)							\
			break;							\
		
               // 如果有待處理的 signal 而且 task 的狀態為 TASK_INTERRUPTIBLE 或 TASK_KILLABLE，跳出 loop			
		if (___wait_is_interruptible(state) && __int) {			\
			__ret = __int;						\
			goto __out;						\
		}								\
										\
		cmd; // schedule()，進入睡眠狀態 
	}									\
	finish_wait(&wq_head, &__wq_entry);	// 移出 waitqueue
__out:	__ret;									\
})

```

`prepare_to_wait_event` 是會檢查 `wait` 事件是不是有放到 `waitqueue` 中避免無法喚醒，本文章是閱讀 `Linux v4.14.259` 版本，但是看到後面的版本對於 `prepare_to_wait_event` 好像有稍微修改，有興趣可以去研究一下修改了什麼地方。

### [prepare_to_wait_event](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/wait.c#L273)

```c
long prepare_to_wait_event(struct wait_queue_head *wq_head, struct wait_queue_entry *wq_entry, int state)
{
	unsigned long flags;
	long ret = 0;

	spin_lock_irqsave(&wq_head->lock, flags);
	if (unlikely(signal_pending_state(state, current))) {
		/*
		 * Exclusive waiter must not fail if it was selected by wakeup,
		 * it should "consume" the condition we were waiting for.
		 *
		 * The caller will recheck the condition and return success if
		 * we were already woken up, we can not miss the event because
		 * wakeup locks/unlocks the same wq_head->lock.
		 *
		 * But we need to ensure that set-condition + wakeup after that
		 * can't see us, it should wake up another exclusive waiter if
		 * we fail.
		 */
		list_del_init(&wq_entry->entry);
		ret = -ERESTARTSYS;
	} else {
		if (list_empty(&wq_entry->entry)) {
			if (wq_entry->flags & WQ_FLAG_EXCLUSIVE)
				__add_wait_queue_entry_tail(wq_head, wq_entry);
			else
				__add_wait_queue(wq_head, wq_entry);
		}
		set_current_state(state); // 設置不可中斷
	}
	spin_unlock_irqrestore(&wq_head->lock, flags);

	return ret;
}
EXPORT_SYMBOL(prepare_to_wait_event);
```

所以總結 `wait_event` 就是可以讓 `task` 進入睡眠狀態直到 `condition` 為 `true`，在過程中狀態為 **TASK_UNINTERRUPTIBLE**。

## 喚醒函數

在前面介紹 `DECLARE_WAITQUEUE` 的時候有講到一個 `task` 包裝成 `wait_queue_entry` 時會一併設置喚醒函數為 `default_wake_function`，用於喚醒一個正在睡眠的 `task`。

### [default_wake_function](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/core.c#L3622)

```c
int default_wake_function(wait_queue_entry_t *curr, unsigned mode, int wake_flags,
			  void *key)
{
	return try_to_wake_up(curr->private, mode, wake_flags);
}
EXPORT_SYMBOL(default_wake_function);
```

看完定義之後會發現 `default_wake_function` 會呼叫 `try_to_wake_up`，繼續往下 `trace`

### [try_to_wake_up](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/core.c#L1972)

```c
/**
 * try_to_wake_up - wake up a thread
 * @p: the thread to be awakened
 * @state: the mask of task states that can be woken
 * @wake_flags: wake modifier flags (WF_*)
 *
 * If (@state & @p->state) @p->state = TASK_RUNNING.
 *
 * If the task was not queued/runnable, also place it back on a runqueue.
 *
 * Atomic against schedule() which would dequeue a task, also see
 * set_current_state().
 *
 * Return: %true if @p->state changes (an actual wakeup was done),
 *	   %false otherwise.
 */
static int
try_to_wake_up(struct task_struct *p, unsigned int state, int wake_flags)
{
	unsigned long flags;
	int cpu, success = 0;

	/*
	 * If we are going to wake up a thread waiting for CONDITION we
	 * need to ensure that CONDITION=1 done by the caller can not be
	 * reordered with p->state check below. This pairs with mb() in
	 * set_current_state() the waiting thread does.
	 */
        // 關閉本地中斷
	raw_spin_lock_irqsave(&p->pi_lock, flags);
	smp_mb__after_spinlock();
        // 如果 task 的 state 屬於不能喚醒的狀態
        // 則無法喚醒該 task
	if (!(p->state & state))
		goto out;

	trace_sched_waking(p);

	/* We're going to change ->state: */
	success = 1;
	cpu = task_cpu(p);

	/*
	 * Ensure we load p->on_rq _after_ p->state, otherwise it would
	 * be possible to, falsely, observe p->on_rq == 0 and get stuck
	 * in smp_cond_load_acquire() below.
	 *
	 * sched_ttwu_pending()                 try_to_wake_up()
	 *   [S] p->on_rq = 1;                  [L] P->state
	 *       UNLOCK rq->lock  -----.
	 *                              \
	 *				 +---   RMB
	 * schedule()                   /
	 *       LOCK rq->lock    -----'
	 *       UNLOCK rq->lock
	 *
	 * [task p]
	 *   [S] p->state = UNINTERRUPTIBLE     [L] p->on_rq
	 *
	 * Pairs with the UNLOCK+LOCK on rq->lock from the
	 * last wakeup of our task and the schedule that got our task
	 * current.
	 */
	smp_rmb();
        // 如果 task 已經在 runqueue 當中，則不需要再喚醒
        // 只要更新狀態即可
	if (p->on_rq && ttwu_remote(p, wake_flags))
		goto stat;

#ifdef CONFIG_SMP
	/*
	 * Ensure we load p->on_cpu _after_ p->on_rq, otherwise it would be
	 * possible to, falsely, observe p->on_cpu == 0.
	 *
	 * One must be running (->on_cpu == 1) in order to remove oneself
	 * from the runqueue.
	 *
	 *  [S] ->on_cpu = 1;	[L] ->on_rq
	 *      UNLOCK rq->lock
	 *			RMB
	 *      LOCK   rq->lock
	 *  [S] ->on_rq = 0;    [L] ->on_cpu
	 *
	 * Pairs with the full barrier implied in the UNLOCK+LOCK on rq->lock
	 * from the consecutive calls to schedule(); the first switching to our
	 * task, the second putting it to sleep.
	 */
	smp_rmb();

	/*
	 * If the owning (remote) CPU is still in the middle of schedule() with
	 * this task as prev, wait until its done referencing the task.
	 *
	 * Pairs with the smp_store_release() in finish_lock_switch().
	 *
	 * This ensures that tasks getting woken will be fully ordered against
	 * their previous state and preserve Program Order.
	 */
	smp_cond_load_acquire(&p->on_cpu, !VAL);

	p->sched_contributes_to_load = !!task_contributes_to_load(p);
	p->state = TASK_WAKING;

	if (p->in_iowait) {
		delayacct_blkio_end(p);
		atomic_dec(&task_rq(p)->nr_iowait);
	}

	cpu = select_task_rq(p, p->wake_cpu, SD_BALANCE_WAKE, wake_flags);
	if (task_cpu(p) != cpu) {
		wake_flags |= WF_MIGRATED;
		set_task_cpu(p, cpu);
	}

#else /* CONFIG_SMP */

	if (p->in_iowait) {
		delayacct_blkio_end(p);
		atomic_dec(&task_rq(p)->nr_iowait);
	}

#endif /* CONFIG_SMP */

	ttwu_queue(p, cpu, wake_flags);
stat:
	ttwu_stat(p, cpu, wake_flags);
out:
        // 開啟本地中斷
	raw_spin_unlock_irqrestore(&p->pi_lock, flags);

	return success;
}
```

這段程式碼中我們聚焦在 `ttwu_queue`, `ttwu_stat` 中，中間有很大一段在處理 `SMP` 的機制，不是本文探討的重點，先介紹一下 `ttmu`，在 `kernel/sched/core.c` 中有很多 `ttmu` 開頭的 `function`，到這邊才理解到其實是 `try to wake up` 的縮寫。

### [ttwu_queue](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/core.c#L1862)

```c
static void ttwu_queue(struct task_struct *p, int cpu, int wake_flags)
{
	struct rq *rq = cpu_rq(cpu); // 獲得現在 cpu 的 runqueue
	struct rq_flags rf;

#if defined(CONFIG_SMP)
	if (sched_feat(TTWU_QUEUE) && !cpus_share_cache(smp_processor_id(), cpu)) {
		sched_clock_cpu(cpu); /* Sync clocks across CPUs */
		ttwu_queue_remote(p, cpu, wake_flags);
		return;
	}
#endif

	rq_lock(rq, &rf);
	update_rq_clock(rq);
	ttwu_do_activate(rq, p, wake_flags, &rf);
	rq_unlock(rq, &rf);
}
```

在 `try_to_wake_up` 中會調用 `select_task_rq` 來為要喚醒的 `task` 選擇一個 `runqueue`，並且回傳該 `runqueue` 對應的 `cpu` 編號。 `ttwu_queue` 會判斷這個 `runqueue` 的 `cpu` 編號是否與正在執行 `try_to_wake_up` 的 `cpu` 編號相同，會根據不同情況走不同的路徑喚醒 `task`，因為具體的機制太複雜了，本篇會先介紹單處理器下的處理方式，繼續往下看 `ttwu_do_activate` 的實現。

> [reference](http://oliveryang.net/2016/03/linux-scheduler-2/#22-wakeup-preemption)

### [ttwu_do_activate](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/core.c#L1714)

為了節省空間，底下的 `code` 把 `ttwu_do_activate` 呼叫的 `function` 實現也放在一起。

```c
static void
ttwu_do_activate(struct rq *rq, struct task_struct *p, int wake_flags,
		 struct rq_flags *rf)
{
	int en_flags = ENQUEUE_WAKEUP | ENQUEUE_NOCLOCK;

	lockdep_assert_held(&rq->lock);

#ifdef CONFIG_SMP
	if (p->sched_contributes_to_load)
		rq->nr_uninterruptible--;

	if (wake_flags & WF_MIGRATED)
		en_flags |= ENQUEUE_MIGRATED;
#endif

	ttwu_activate(rq, p, en_flags);
	ttwu_do_wakeup(rq, p, wake_flags, rf);
}


static inline void ttwu_activate(struct rq *rq, struct task_struct *p, int en_flags)
{
	activate_task(rq, p, en_flags); // 將 task 放入 runqueue 當中
	p->on_rq = TASK_ON_RQ_QUEUED;   // 設置 task 的 state 為 TASK_ON_RQ_QUEUED

	/* If a worker is waking up, notify the workqueue: */
	if (p->flags & PF_WQ_WORKER)
		wq_worker_waking_up(p, cpu_of(rq)); 
}

/*
 * Mark the task runnable and perform wakeup-preemption.
 */
static void ttwu_do_wakeup(struct rq *rq, struct task_struct *p, int wake_flags,
			   struct rq_flags *rf)
{
	check_preempt_curr(rq, p, wake_flags);
	p->state = TASK_RUNNING; // 把 task 的 state 改為 TASK_RUNNING
	trace_sched_wakeup(p);

#ifdef CONFIG_SMP
	if (p->sched_class->task_woken) {
		/*
		 * Our task @p is fully woken up and running; so its safe to
		 * drop the rq->lock, hereafter rq is only used for statistics.
		 */
		rq_unpin_lock(rq, rf);
		p->sched_class->task_woken(rq, p);
		rq_repin_lock(rq, rf);
	}

	if (rq->idle_stamp) {
		u64 delta = rq_clock(rq) - rq->idle_stamp;
		u64 max = 2*rq->max_idle_balance_cost;

		update_avg(&rq->avg_idle, delta);

		if (rq->avg_idle > max)
			rq->avg_idle = max;

		rq->idle_stamp = 0;
	}
#endif
}
```

`try_to_wake_up` 可以理解成最後會將 `task` 的 `state` 由 `TASK_INTERRUPTIBLE || TASK_UNIMTERRUPTIBLE` 改成 `TASK_RUNNING`，並將其加入 `rq` 中等待調度器選擇。


## get the number of entering a wait queue

~~扯遠了~~，回到這次作業題目(二)的需求，要寫一個 `system call` 來獲得 `task_struct` 進入 `wait queue` 的次數，先在 `task_struct` 中加入 `wq_cnt` 變數

```c
    // include/linux/sched.h 中加入 wq_cnt
    unsigned int wq_cnt;
    /*
     * New fields for task_struct should be added above here, so that
     * they are included in the randomized portion of task_struct.
     */
    randomized_struct_fields_end

    /* CPU-specific state of this task: */
    struct thread_struct		thread;

    /*
     * WARNING: on x86, 'thread_struct' contains a variable-sized
     * structure.  It *MUST* be at the end of 'task_struct'.
     *
     * Do not put anything below here!
     */
};
```

在 `copy_process` 中對 `wq_cnt` 初始化。

```c
// kernel/fork.c copy_process
p->wq_cnt = 0;
```

進入 `wait queue` 中一定會 `wake up`，因為 `wait` 的事件有很多不同的種類，所以我們換個想法把 `wq_cnt` 加在 `try_to_wake_up` 這個 `function` 內，無論是用哪種方式進入睡眠，最後都會呼叫 `try_to_wake_up` 來喚醒 `task`。


插入點如下所示

```c
// kernel/sched/core.c

static int
try_to_wake_up(struct task_struct *p, unsigned int state, int wake_flags)
{
    unsigned long flags;
    int cpu, success = 0;

    /*
     * If we are going to wake up a thread waiting for CONDITION we
     * need to ensure that CONDITION=1 done by the caller can not be
     * reordered with p->state check below. This pairs with mb() in
     * set_current_state() the waiting thread does.
     */
    raw_spin_lock_irqsave(&p->pi_lock, flags);
    smp_mb__after_spinlock();
    if (!(p->state & state))
        goto out;

    trace_sched_waking(p);

    /* We're going to change ->state: */
    success = 1;
    p->wq_cnt++;
        .
        .
        .
}
```

### system call definition

```c
#include <linux/sched.h>
#include <linux/kernel.h>
#include <linux/uaccess.h>
#include <linux/syscalls.h>
#include <linux/resource.h>

#include <asm/errno.h>

SYSCALL_DEFINE1(get_number_of_entering_a_wait_queue, unsigned int*, cnt) {
    unsigned int wq_cnt = current->wq_cnt;
    printk("entering wait queue counter = %u\n", wq_cnt);
    
    if (copy_to_user(cnt, &wq_cnt, sizeof(unsigned int))) {
        return -EFAULT;
    }

    return 0;
}
```

### user space 

```c
#include <unistd.h>
#include <stdio.h>
#include <syscall.h>
#define  NUMBER_OF_IO_ITERATIONS     6
#define  NUMBER_OF_ITERATIONS        99999999

int main()
{
    char         c;
    int          i, t = 2, u = 3, v;
    unsigned int cnt;
    printf("pid = %u\n", getpid());
    for (i = 0; i < NUMBER_OF_IO_ITERATIONS; i++) { 
        v = 1;
        c = getchar();
    }

    for (i = 0; i < NUMBER_OF_ITERATIONS; i++)
        v = (++t) * (u++);
        
    if (syscall(333, &cnt))
        printf("Error (1)!\n");
    else
        printf("This process encounters %u times context switches.\n", cnt);

    if (syscall(334, &cnt))
        printf("Error (2)!\n");
    else
        printf("This process enters a wait queue %u times.\n", cnt);


    for (i = 0; i < NUMBER_OF_IO_ITERATIONS; i++) { 
        v = 1;
        printf("I love my home.\n");
    }

    
    if (syscall(334, &cnt))
        printf("Error (3)!\n");
    else
        printf("This process enters a wait queue %u times.\n", cnt);

    if (syscall(333, &cnt))
        printf("Error (1)!\n");
    else
        printf("This process encounters %u times context switches.\n", cnt);

    getchar(); // 在最後加入一個 getchar 方便觀察結果
}

```

### 驗證

利用 `/proc/{pid}/sched` 中的 `se_statistics.nr_wakeups` 來比對結果，如下圖所示

![](https://i.imgur.com/FAvy2t5.png)

其實這個值是在 `ttwu_stat` 這個 `function` 去更新的，在 `try_to_wake_up` 的後面會呼叫 `ttwu_stat` 來更新相關的資料，~~其實題目二也不用另外加 counter~~，具體實現如下

### [ttwu_stat](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/core.c#L1630)

```c
static void
ttwu_stat(struct task_struct *p, int cpu, int wake_flags)
{
	struct rq *rq;

	if (!schedstat_enabled())
		return;

	rq = this_rq();

#ifdef CONFIG_SMP
	if (cpu == rq->cpu) {
		schedstat_inc(rq->ttwu_local);
		schedstat_inc(p->se.statistics.nr_wakeups_local);
	} else {
		struct sched_domain *sd;

		schedstat_inc(p->se.statistics.nr_wakeups_remote);
		rcu_read_lock();
		for_each_domain(rq->cpu, sd) {
			if (cpumask_test_cpu(cpu, sched_domain_span(sd))) {
				schedstat_inc(sd->ttwu_wake_remote);
				break;
			}
		}
		rcu_read_unlock();
	}

	if (wake_flags & WF_MIGRATED)
		schedstat_inc(p->se.statistics.nr_wakeups_migrate);
#endif /* CONFIG_SMP */

	schedstat_inc(rq->ttwu_count);
	schedstat_inc(p->se.statistics.nr_wakeups);

	if (wake_flags & WF_SYNC)
		schedstat_inc(p->se.statistics.nr_wakeups_sync);
}
```

在 `schedstat_inc` 的部份會更新 `nr_wakeups` 的值，這個值也被用來驗證我們的答案對不對。

值得注意的是我一開始編譯完之後使用 `cat /proc/{pid}/sched` 發現漏了很多資料沒有顯示，後來去 `trace` 一下 `proc` 的顯示，定義在 [proc_sched_show_task](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/debug.c#L955) 中

```c
void proc_sched_show_task(struct task_struct *p, struct pid_namespace *ns,
						  struct seq_file *m)
{
	unsigned long nr_switches;

	SEQ_printf(m, "%s (%d, #threads: %d)\n", p->comm, task_pid_nr_ns(p, ns),
						get_nr_threads(p));
	SEQ_printf(m,
		"---------------------------------------------------------"
		"----------\n");
#define __P(F) \
	SEQ_printf(m, "%-45s:%21Ld\n", #F, (long long)F)
#define P(F) \
	SEQ_printf(m, "%-45s:%21Ld\n", #F, (long long)p->F)
#define P_SCHEDSTAT(F) \
	SEQ_printf(m, "%-45s:%21Ld\n", #F, (long long)schedstat_val(p->F))
#define __PN(F) \
	SEQ_printf(m, "%-45s:%14Ld.%06ld\n", #F, SPLIT_NS((long long)F))
#define PN(F) \
	SEQ_printf(m, "%-45s:%14Ld.%06ld\n", #F, SPLIT_NS((long long)p->F))
#define PN_SCHEDSTAT(F) \
	SEQ_printf(m, "%-45s:%14Ld.%06ld\n", #F, SPLIT_NS((long long)schedstat_val(p->F)))

	PN(se.exec_start);
	PN(se.vruntime);
	PN(se.sum_exec_runtime);

	nr_switches = p->nvcsw + p->nivcsw;

	P(se.nr_migrations);

	if (schedstat_enabled()) {
		u64 avg_atom, avg_per_cpu;

		PN_SCHEDSTAT(se.statistics.sum_sleep_runtime);
		PN_SCHEDSTAT(se.statistics.wait_start);
		PN_SCHEDSTAT(se.statistics.sleep_start);
		PN_SCHEDSTAT(se.statistics.block_start);
		PN_SCHEDSTAT(se.statistics.sleep_max);
		PN_SCHEDSTAT(se.statistics.block_max);
		PN_SCHEDSTAT(se.statistics.exec_max);
		PN_SCHEDSTAT(se.statistics.slice_max);
		PN_SCHEDSTAT(se.statistics.wait_max);
		PN_SCHEDSTAT(se.statistics.wait_sum);
		P_SCHEDSTAT(se.statistics.wait_count);
		PN_SCHEDSTAT(se.statistics.iowait_sum);
		P_SCHEDSTAT(se.statistics.iowait_count);
		P_SCHEDSTAT(se.statistics.nr_migrations_cold);
		P_SCHEDSTAT(se.statistics.nr_failed_migrations_affine);
		P_SCHEDSTAT(se.statistics.nr_failed_migrations_running);
		P_SCHEDSTAT(se.statistics.nr_failed_migrations_hot);
		P_SCHEDSTAT(se.statistics.nr_forced_migrations);
		P_SCHEDSTAT(se.statistics.nr_wakeups);
		P_SCHEDSTAT(se.statistics.nr_wakeups_sync);
		P_SCHEDSTAT(se.statistics.nr_wakeups_migrate);
		P_SCHEDSTAT(se.statistics.nr_wakeups_local);
		P_SCHEDSTAT(se.statistics.nr_wakeups_remote);
		P_SCHEDSTAT(se.statistics.nr_wakeups_affine);
		P_SCHEDSTAT(se.statistics.nr_wakeups_affine_attempts);
		P_SCHEDSTAT(se.statistics.nr_wakeups_passive);
		P_SCHEDSTAT(se.statistics.nr_wakeups_idle);

		avg_atom = p->se.sum_exec_runtime;
		if (nr_switches)
			avg_atom = div64_ul(avg_atom, nr_switches);
		else
			avg_atom = -1LL;

		avg_per_cpu = p->se.sum_exec_runtime;
		if (p->se.nr_migrations) {
			avg_per_cpu = div64_u64(avg_per_cpu,
						p->se.nr_migrations);
		} else {
			avg_per_cpu = -1LL;
		}

		__PN(avg_atom);
		__PN(avg_per_cpu);
	}

	略
        
	sched_show_numa(p, m);
}
```

可以看到比較進階的資訊都要 `schedstat_enabled()` 才能看，不知道為什麼我第一次編譯的時候可能不小心調整到，導致這個 `config` 為 0。

要修正這個問題可以不用重新編譯 `kernel`，直接用

```shell
sudo sysctl kernel.sched_schedstats=1
```

### reference
- [【译文】Linux 平均负载：解决这个奥秘](https://vflong.github.io/sre/linux/2020/03/12/linux-load-averages.html)
- [linux 内核 wait queue源码分析](https://blog.csdn.net/lian494362816/article/details/111188298)
- [Linux Preemption - 2](http://oliveryang.net/2016/03/linux-scheduler-2/#22-wakeup-preemption)
- [源码解读Linux等待队列](http://gityuan.com/2018/12/02/linux-wait-queue/) 