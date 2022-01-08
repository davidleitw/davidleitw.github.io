---
title: "Linux schedule 原始碼解讀"
date: 2022-01-07T03:12:53+08:00
draft: false
tags: 
    - linux_kernel
    - system_call
    - scheduler
categories: ["linux_kernel"]
---

> 本文章環境基於 Linux v4.14.259

第一次 `trace` 整個調度的流程，`kernel` 真的是個大坑，有很多概念都還不熟，只能整理大概的流程，具體很多 `function` 的作用都沒辦法很好的說明，希望之後可以多閱讀 `source code`，把相關的知識慢慢補齊，拼湊成完整的知識。

## [schedule](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/core.c#L3424)

要 `trace` 調度器要先找到 `schedule` 的入口，定義在 `kernel/sched/core.c`，函式定義如下

```c
asmlinkage __visible void __sched schedule(void)
{
	struct task_struct *tsk = current;
    
    // 避免 deadlock
	sched_submit_work(tsk);
	do {
        // 調度本身無法搶佔，等調度完畢再開啟
	preempt_disable();
		
        __schedule(false);
        
        // 調度完成，開啟搶佔功能
	sched_preempt_enable_no_resched();
	} while (need_resched()); // 檢查是不是被設置 TIF_NEED_RESCHED，如果被設置就重新調度
}
EXPORT_SYMBOL(schedule);
```



### [sched_submit_work](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/core.c#L3412)

```c
static inline void sched_submit_work(struct task_struct *tsk)
{
	if (!tsk->state || tsk_is_pi_blocked(tsk))
		return;
	/*
	 * If we are going to sleep and we have plugged IO queued,
	 * make sure to submit it to avoid deadlocks.
	 */
	if (blk_needs_flush_plug(tsk))
		blk_schedule_flush_plug(tsk);
}
```

在 `sched_submit_work` 中先檢查 `tsk->state` 是否為 0(`runnable`)，如果是就直接返回。
`tsk_is_pi_blocked` 檢查 `tsk` 的 `deadlock` 檢測器是否為空。

注意到 `schedule` 的 `while` 迴圈中的 `__schedule(false)`，`__schedule` 是真正調度執行的地方，所以繼續往下 `trace`

## [_schedule](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/core.c#L3299)

在 `__schedule()` 定義上方有一段註解說明**調度時機**，主要是說明 `task_struct` 在什麼情況會被調度，底下會大概敘述一下調度器在什麼情況下會考慮調度。


```c
/*
 * __schedule() is the main scheduler function.
 *
 * The main means of driving the scheduler and thus entering this function are:
 *
 *   1. Explicit blocking: mutex, semaphore, waitqueue, etc.
 *
 *   2. TIF_NEED_RESCHED flag is checked on interrupt and userspace return
 *      paths. For example, see arch/x86/entry_64.S.
 *
 *      To drive preemption between tasks, the scheduler sets the flag in timer
 *      interrupt handler scheduler_tick().
 *
 *   3. Wakeups don't really cause entry into schedule(). They add a
 *      task to the run-queue and that's it.
 *
 *      Now, if the new task added to the run-queue preempts the current
 *      task, then the wakeup sets TIF_NEED_RESCHED and schedule() gets
 *      called on the nearest possible occasion:
 *
 *       - If the kernel is preemptible (CONFIG_PREEMPT=y):
 *
 *         - in syscall or exception context, at the next outmost
 *           preempt_enable(). (this might be as soon as the wake_up()'s
 *           spin_unlock()!)
 *
 *         - in IRQ context, return from interrupt-handler to
 *           preemptible context
 *
 *       - If the kernel is not preemptible (CONFIG_PREEMPT is not set)
 *         then at the next:
 *
 *          - cond_resched() call
 *          - explicit schedule() call
 *          - return from syscall or exception to user-space
 *          - return from interrupt-handler to user-space
 *
 * WARNING: must be called with preemption disabled!
 */
```
在這段註解中大致說明了幾個調度的場景跟時機

- 自願切換(`Voluntary`)
    - `sleep`，定時任務場景
    - `mutex`, `semaphore` `waitqueue` 等
    - 在呼叫 [do_exit](https://elixir.bootlin.com/linux/latest/source/kernel/exit.c#L727) 時，主動釋放資源，並且最後會調用一次`主調度器`。
- 強制切換(`Involuntary`), 也被稱為搶佔(`Preemption`)
    - `TIF_NEED_RESCHED`, `TIF` 開頭代表是 `thread information flags`，詳細有哪些 `flag` 可以參考 [arch/x86/include/asm/thread_info.h](https://elixir.bootlin.com/linux/latest/source/arch/x86/include/asm/thread_info.h#L80)，`kernel` 透過這個 `flag` 來判斷這個 `task_struct` 是否要被**搶佔(`Preemption`)**
        - 具體 `TIF_NEED_RESCHED` 的細節可以參考[這篇文章](http://linuxperf.com/?p=211)
        - 當 `TIF_NEED_RESCHED` 被設置後並不是馬上被調度，而是會在最近的**調度點**被調度
- `wake_up` 只是把 `task` 加入 `runqueue` 中，之後根據 `preempts` 的設置會有不同的處理方式。

```c
static void __sched notrace __schedule(bool preempt)
{
	struct task_struct *prev, *next;
	unsigned long *switch_count;
	struct rq_flags rf;
	struct rq *rq;
	int cpu;

	cpu = smp_processor_id();
	rq = cpu_rq(cpu);
	prev = rq->curr;

	schedule_debug(prev);

	if (sched_feat(HRTICK))
		hrtick_clear(rq);

	local_irq_disable();
	rcu_note_context_switch(preempt);

	/*
	 * Make sure that signal_pending_state()->signal_pending() below
	 * can't be reordered with __set_current_state(TASK_INTERRUPTIBLE)
	 * done by the caller to avoid the race with signal_wake_up().
	 */
	rq_lock(rq, &rf);
	smp_mb__after_spinlock();

	/* Promote REQ to ACT */
	rq->clock_update_flags <<= 1;
	update_rq_clock(rq);

	switch_count = &prev->nivcsw;
	if (!preempt && prev->state) {
		if (unlikely(signal_pending_state(prev->state, prev))) {
			prev->state = TASK_RUNNING;
		} else {
			deactivate_task(rq, prev, DEQUEUE_SLEEP | DEQUEUE_NOCLOCK);
			prev->on_rq = 0;

			if (prev->in_iowait) {
				atomic_inc(&rq->nr_iowait);
				delayacct_blkio_start();
			}

			/*
			 * If a worker went to sleep, notify and ask workqueue
			 * whether it wants to wake up a task to maintain
			 * concurrency.
			 */
			if (prev->flags & PF_WQ_WORKER) {
				struct task_struct *to_wakeup;

				to_wakeup = wq_worker_sleeping(prev);
				if (to_wakeup)
					try_to_wake_up_local(to_wakeup, &rf);
			}
		}
		switch_count = &prev->nvcsw;
	}

	next = pick_next_task(rq, prev, &rf);
	clear_tsk_need_resched(prev);
	clear_preempt_need_resched();

	if (likely(prev != next)) {
		rq->nr_switches++;
		rq->curr = next;
		/*
		 * The membarrier system call requires each architecture
		 * to have a full memory barrier after updating
		 * rq->curr, before returning to user-space. For TSO
		 * (e.g. x86), the architecture must provide its own
		 * barrier in switch_mm(). For weakly ordered machines
		 * for which spin_unlock() acts as a full memory
		 * barrier, finish_lock_switch() in common code takes
		 * care of this barrier. For weakly ordered machines for
		 * which spin_unlock() acts as a RELEASE barrier (only
		 * arm64 and PowerPC), arm64 has a full barrier in
		 * switch_to(), and PowerPC has
		 * smp_mb__after_unlock_lock() before
		 * finish_lock_switch().
		 */
		++*switch_count;
		trace_sched_switch(preempt, prev, next);

		/* Also unlocks the rq: */
		prev->cs_cnt++;
		rq = context_switch(rq, prev, next, &rf);
	} else {
		rq->clock_update_flags &= ~(RQCF_ACT_SKIP|RQCF_REQ_SKIP);
		rq_unlock_irq(rq, &rf);
	}

	balance_callback(rq);
}
```


`task_struct` 中 `nivcsw` 變數來計算搶佔的調度次數，`nvcsw` 代表非搶佔調度。


```c
switch_count = &prev->nivcsw;

// scheduler 會檢查 prev 的狀態以及是否允許 kernel preempt
if (!preempt && prev->state) {
    // 如果 prev 的狀態是 TASK_INTERRUPTIBLE
    // 而且 prev 有非阻塞等待訊號
    // 這樣就不應該將 prev 從 runqueu 刪掉
    // 而是把它的狀態改成 TASK_RUNNING, 等待下一次的排程
    if (unlikely(signal_pending_state(prev->state, prev))) {
        prev->state = TASK_RUNNING;
    } else {
        // 將 prev 從 runqueue 中移除
        deactivate_task(rq, prev, DEQUEUE_SLEEP | DEQUEUE_NOCLOCK);
        // 標記 prev 不在 runqueue 中
        prev->on_rq = 0;

        if (prev->in_iowait) {
            atomic_inc(&rq->nr_iowait);
            delayacct_blkio_start();
        }

        /*
         * If a worker went to sleep, notify and ask workqueue
         * whether it wants to wake up a task to maintain
         * concurrency.
         */
        if (prev->flags & PF_WQ_WORKER) {
            struct task_struct *to_wakeup;

            to_wakeup = wq_worker_sleeping(prev);
            if (to_wakeup)
                try_to_wake_up_local(to_wakeup, &rf);
        }
    }
    // 如果不是被搶佔的，就應該要累加 nvcsw, 代表主動放棄資源的排程
    switch_count = &prev->nvcsw;
}
```

接下來則是呼叫調度器選擇下一個優先度最高的 `task` 排進 `runqueue`。

```c
// 選擇一個優先度最高的 task 放入 runqueue 中
next = pick_next_task(rq, prev, &rf);
// 清除 prev 的 TIF_NEED_RESCHED flag
clear_tsk_need_resched(prev);
```

自從 `Linux v2.6.23` 開始，`Linux` 引入了 `scheduling class` 的概念，大大提昇的調度器的擴展性，用戶可以依照自己的需求實現 `interface` 直接放入 `kernel` 中進行調度， 同樣在 `Linux v2.6.23` 之後 `Completely Fair Scheduler(CFS)` 取代原先的 `O(1) scheduler` 成為系統預設的調度器，在 `pick_next_task` 中就會實際根據調度器選擇出一個優先度最高的 `task`，但因為篇幅問題，之後有機會再深入研究調度器的實現。
 
處理完 `prev`，也選擇了 `next`，接著就是要進行 `context switch` 的部份。

```c
// 如果 prev 不是 next (也有機率 prev 放入 runqueue 中之後又被挑選到)
if (likely(prev != next)) {
    rq->nr_switches++; // 計算 number of context switches.
    rq->curr = next;   // 將 curr 指向被排程的新 task
    /*
     * The membarrier system call requires each architecture
     * to have a full memory barrier after updating
     * rq->curr, before returning to user-space. For TSO
     * (e.g. x86), the architecture must provide its own
     * barrier in switch_mm(). For weakly ordered machines
     * for which spin_unlock() acts as a full memory
     * barrier, finish_lock_switch() in common code takes
     * care of this barrier. For weakly ordered machines for
     * which spin_unlock() acts as a RELEASE barrier (only
     * arm64 and PowerPC), arm64 has a full barrier in
     * switch_to(), and PowerPC has
     * smp_mb__after_unlock_lock() before
     * finish_lock_switch().
     */
    
    // 增加一次被調度的次數
    // 上面的判斷可以得知，如果是搶佔會加 nivcsw，非搶佔則是會加 nvcsw 
    ++*switch_count; 
    trace_sched_switch(preempt, prev, next);

    /* Also unlocks the rq: */
    prev->cs_cnt++;
    // 實際進行 context switch 的 function
    rq = context_switch(rq, prev, next, &rf);
} else {
    // 如果 prev == next 則不進行 context switch
    rq->clock_update_flags &= ~(RQCF_ACT_SKIP|RQCF_REQ_SKIP);
    rq_unlock_irq(rq, &rf);
}
```

## get the number of context switches

回到作業題目(一)的需求，其實可以發現沒有必要再自己加上一個 `counter` 來計算被調度的次數，只要把 `task_struct` 中的 `tsk->nivcsw + tsk->nvcse` 就可以得到這個 `task_struct` 被 `context switch` 的次數了，甚至可以用 `nr_switches` 這個變數來直接獲得答案。

在驗證自己程式的正確性時，我們會參考 `/proc/{pid}/sched` 中的 `nr_switches`，實際找到 [proc_sched_show_task](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/debug.c#L924) 就會發現 `nr_switches` 也是用 `nivcsw + nvcse` 來實現。

```c
void proc_sched_show_task(struct task_struct *p, struct pid_namespace *ns,
						  struct seq_file *m) 
{
    unsigned long nr_switches;
    .
    .
    .
    nr_switches = p->nvcsw + p->nivcsw;
    .
    .
    .
    __P(nr_switches);
}
```

所以題目一的實現如下:

### kernel space

```c
#include <linux/sched.h>
#include <linux/kernel.h>
#include <linux/uaccess.h>
#include <linux/syscalls.h>
#include <linux/resource.h>

#include <asm/errno.h>

SYSCALL_DEFINE1(get_number_of_context_switches, unsigned int*, cnt) {
    unsigned int cs_cnt = current->nvcsw + current->nivcsw;
    printk("context switches counter = %u\n", cs_cnt);
    
    if (copy_to_user(cnt, &cs_cnt, sizeof(unsigned int))) {
        return -EFAULT;
    }

    return 0;
}
```

利用 `SYSCALL_DEFINE1` 的 `macro` 來展開我們定義的 `get_number_of_context_switches`，利用 `task_struct` 的 `nvcse, nivcsw` 來獲得 `number of context switches`。

之所以要用 `SYSCALL_DEFINE1` 來定義 `system call` 是因為之前有個 [CVE-2009-0029](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2009-0029)，攻擊者可以藉由 `32 跟 64 bits` 回傳的一些漏洞，設法存取非法的地址，為了避免人為疏失，所以保險的方式還是用 `SYSCALL_DEFINE` 來定義會比較安全。

### user space

```c
#include <stdio.h>
#include <syscall.h>
#include <unistd.h>

#define NUMBER_OF_ITERATIONS 99999999

int main() {
    int i, t=2, u=3, v;
    unsigned int cnt;
    printf("pid = %d\n", getpid());
     
    for(i = 0; i < NUMBER_OF_ITERATIONS*3; i++)
        v = (++t)*(u++) * 3;

    if (syscall(333, &cnt)) 
        printf("Error\n");
    else 
        printf("context switch counter = %d\n", cnt);

    getchar();
}
```

用 `getchar()` 卡住最後面方便觀察，但是為導致 `cnt` 與觀察 `proc/{pid}/sched` 的結果差1，如下圖所示:

![](https://i.imgur.com/LY8Nujr.png)


### refernece
- [CFS调度器（1）-基本原理](http://www.wowotech.net/process_management/447.html)
- [一篇文章让你了解Linux进程调度器](https://zhuanlan.zhihu.com/p/112203100)
- [深入理解Linux内核之主调度器（上)](https://zhuanlan.zhihu.com/p/395606426)