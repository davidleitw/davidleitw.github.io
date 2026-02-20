---
title: "Linux schedule 原始碼解讀"
date: 2022-01-07T03:12:53+08:00
draft: false
tags: 
    - linux_kernel
    - system_call
    - scheduler
categories: ["linux_kernel"]
description: "追蹤 Linux kernel v4.14 排程器 schedule() 的原始碼，梳理從 preempt_disable 到 __schedule 的完整 context switch 執行流程。"
---

> 本文章環境基於 Linux v4.14.259

第一次完整 trace 排程的流程，kernel 真的是個大坑，很多概念都還不熟，只能整理出大致的脈絡。許多 function 的作用目前還無法說得很透徹，希望之後能持續閱讀 source code，慢慢把相關知識補齊，拼湊成完整的理解。

## [schedule](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/core.c#L3424)

要 trace 排程器，首先找到 `schedule` 的入口，定義在 `kernel/sched/core.c`：

```c
asmlinkage __visible void __sched schedule(void)
{
	struct task_struct *tsk = current;
    
    // 避免 deadlock
	sched_submit_work(tsk);
	do {
        // 排程本身無法搶佔，等排程完畢再開啟
	preempt_disable();
		
        __schedule(false);
        
        // 排程完成，開啟搶佔功能
	sched_preempt_enable_no_resched();
	} while (need_resched()); // 檢查是不是被設置 TIF_NEED_RESCHED，如果被設置就重新排程
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

`sched_submit_work` 首先檢查 `tsk->state` 是否為 0（runnable），如果是就直接返回。`tsk_is_pi_blocked` 則是檢查 `tsk` 的 deadlock 偵測器是否為空。

`schedule` 的 while 迴圈中呼叫了 `__schedule(false)`，它才是真正執行排程的地方，繼續往下 trace。

## [_schedule](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/core.c#L3299)

`__schedule()` 定義上方有一段很有價值的註解，說明了 task 被排程的各種時機，大致可以分成以下幾種情境：


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
- 自願切換（Voluntary）
    - sleep、定時任務等場景
    - mutex、semaphore、waitqueue 等阻塞操作
    - 呼叫 [do_exit](https://elixir.bootlin.com/linux/latest/source/kernel/exit.c#L727) 時，主動釋放資源，最後會呼叫一次主排程器
- 強制切換（Involuntary），也稱為搶佔（Preemption）
    - `TIF_NEED_RESCHED`：`TIF` 開頭代表 thread information flags，kernel 透過這個 flag 判斷 task 是否應該被搶佔。詳細的 flag 清單可以參考 [arch/x86/include/asm/thread_info.h](https://elixir.bootlin.com/linux/latest/source/arch/x86/include/asm/thread_info.h#L80)
        - `TIF_NEED_RESCHED` 的細節可以參考[這篇文章](http://linuxperf.com/?p=211)
        - 被設置後不會立即排程，而是在最近的**排程點**才觸發
- `wake_up` 只是把 task 加入 runqueue，後續根據 preempt 的設置走不同路徑

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


`task_struct` 中 `nivcsw` 記錄被搶佔的排程次數，`nvcsw` 則記錄主動放棄 CPU 的次數（非搶佔排程）。


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

接下來是呼叫排程器，選出下一個優先度最高的 task：

```c
// 選擇一個優先度最高的 task 放入 runqueue 中
next = pick_next_task(rq, prev, &rf);
// 清除 prev 的 TIF_NEED_RESCHED flag
clear_tsk_need_resched(prev);
```

自 Linux v2.6.23 起，kernel 引入了 scheduling class 的概念，大幅提升排程器的擴展性，讓使用者可以實作自己的 interface 並直接插入 kernel。同版本中，Completely Fair Scheduler（CFS）也取代了原先的 O(1) scheduler，成為系統預設的排程器。`pick_next_task` 會根據排程器選出優先度最高的 task，但這部分細節較多，之後再另開文章深入研究。

處理完 `prev` 並選定 `next` 之後，接下來就是實際執行 context switch 的部分。

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
    
    // 增加一次被排程的次數
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

回到作業題目（一）的需求。Trace 完這段之後可以發現，其實不需要額外加 counter——直接把 `task_struct` 中的 `tsk->nivcsw + tsk->nvcsw` 相加，就能得到這個 task 被 context switch 的總次數。

驗證時我們會參考 `/proc/{pid}/sched` 中的 `nr_switches`，找到 [proc_sched_show_task](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/debug.c#L924) 的實作，可以確認 `nr_switches` 確實是用 `nivcsw + nvcsw` 計算的。

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

這裡使用 `SYSCALL_DEFINE1` macro 展開 `get_number_of_context_switches`，直接讀取 `task_struct` 的 `nvcsw` 與 `nivcsw` 相加，得到 context switch 的總次數。

之所以用 `SYSCALL_DEFINE1` 而不是直接定義函式，是因為過去有個 [CVE-2009-0029](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2009-0029)，攻擊者可以利用 32/64 bit 的型別差異存取非法地址。使用 `SYSCALL_DEFINE` 系列 macro 可以避免這類人為疏失，是比較安全的做法。

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

最後的 `getchar()` 是用來卡住程式，方便觀察結果。不過這會導致 `cnt` 的數值與 `/proc/{pid}/sched` 觀察到的結果差 1，如下圖所示：

![](https://i.imgur.com/LY8Nujr.png)


### reference
- [CFS调度器（1）-基本原理](http://www.wowotech.net/process_management/447.html)
- [一篇文章让你了解Linux进程调度器](https://zhuanlan.zhihu.com/p/112203100)
- [深入理解Linux内核之主调度器（上)](https://zhuanlan.zhihu.com/p/395606426)