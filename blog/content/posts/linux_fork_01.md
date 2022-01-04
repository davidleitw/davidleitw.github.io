---
title: "Linux fork() 底層實作流程整理"
date: 2022-01-05T00:12:53+08:00
draft: false
tags: 
    - linux_kernel
    - system_call
    - fork
categories: ["linux_kernel"]
---

因為作業需要在 `task_struct` 中加入 `counter` 並且觀察調度器的行為，所以在這邊寫一份筆記來紀錄一下在 `linux` 中一個 `process` 建立的時候在哪裡初始化，從 `fork()` 開始慢慢 `trace` 下去。

> kernel 版本使用 `v4.14.259`

在 `Linux` 中並沒有明確區分 `process` 跟 `thread`, `task_struct` 可以根據創立條件的不同代表 `process` 或者 `thread`。

從實作的角度看可以有以下幾種 `system call` 建立新的 `task_struct`:
- 建立 **user process**: `fork`, `vfork`, `clone`
- 建立 **kernel thread**: `kernel_thread`, `kthread_create`


以上這些 `API` 最後都會呼叫 `/kernel/fork.c` 中的 [`_do_fork`](https://elixir.free-electrons.com/linux/v4.14.54/source/kernel/fork.c#L2019) 來進行 `create task_struct` 的操作，只是會根據給的參數不同，來決定建立出來的 `task_struct` 的性質，以上幾個 `system call` 的差別也可以參考 [The difference between fork(), vfork(), exec() and clone()](https://stackoverflow.com/questions/4856255/the-difference-between-fork-vfork-exec-and-clone)


但是如果看最新幾版的 `kernel source code` 會發現怎麼樣都沒辦法找到 `_do_fork` 這個 `function` 了，仔細找了一下原因，發現在 `linux v5.10` 之後因為命名規則的不同，把 `_do_fork()` 改名為 `kernel_thread()`，不過實作並沒有大幅度的更改，所以以下在研究 `source code` 的時候還是會以 `v4.14.259` 為準。

`_do_fork()` 更改為 `kernel_thread()` 的原因可以參考 [fork: introduce kernel_clone()](https://patchwork.kernel.org/project/linux-kselftest/patch/20200818173411.404104-2-christian.brauner@ubuntu.com/)

在深入看 `source code` 之前最重要的就是先把 `man page` 看過一次，看完 `man page` 會對要研究的 `system call` 有初步的了解，接著再往下看 `source code` 才不會沒有概念的死讀程式碼。

## [fork - create a child process](https://man7.org/linux/man-pages/man2/fork.2.html)

```c
// kernel/fork.c
// https://elixir.bootlin.com/linux/v4.14.259/source/kernel/fork.c#L2159
#ifdef __ARCH_WANT_SYS_FORK
SYSCALL_DEFINE0(fork)
{
#ifdef CONFIG_MMU
    return _do_fork(SIGCHLD, 0, 0, NULL, NULL, 0);
#else
    /* can not support in nommu mode */
    return -EINVAL;
#endif
}
#endif
```

`fork` 在 `kernel/fork.c` 的定義，可以看到它使用了 `SIGCHLD` 的 `flag`，這代表如果 `child process` 終止會發送 `SIGCHLD` 通知 `parent process`.

### _do_fork

第一段有簡單提到，不論是使用 `fork` 或者 `clone` 等方式，到最後都會呼叫 `_do_fork()` 來建立一個新的 `task struct`，`_do_fork()` 在 `kernel v4.14.259` 中定義在 [kernel/fork.c line.2063](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/fork.c#L2063)，定義如下

```c++
long _do_fork(unsigned long clone_flags, 
			  unsigned long stack_start,
			  unsigned long stack_size,
			  int __user *parent_tidptr,
			  int __user *child_tidptr,
			  unsigned long tls)
```


因為在 `linux` 中 `process` 跟 `thread` 沒有明確的區分，都是以 `task_struct` 的形式存在，所以 `task_struct` 的性質就要在呼叫 `system call` 的時候藉由傳入的 `clone flags` 來決定性質。

`clone flags` 定義在 [/include/uapi/linux/sched.h](https://elixir.bootlin.com/linux/v4.14.259/source/include/uapi/linux/sched.h#L5)中，定義如下

```c
/*
* cloning flags:
*/
#define CSIGNAL 0x000000ff /* signal mask to be sent at exit */
#define CLONE_VM 0x00000100 /* set if VM shared between processes */
#define CLONE_FS 0x00000200 /* set if fs info shared between processes */
#define CLONE_FILES 0x00000400 /* set if open files shared between processes */
#define CLONE_SIGHAND 0x00000800 /* set if signal handlers and blocked signals shared */
#define CLONE_PIDFD 0x00001000 /* set if a pidfd should be placed in parent */
#define CLONE_PTRACE 0x00002000 /* set if we want to let tracing continue on the child too */
#define CLONE_VFORK 0x00004000 /* set if the parent wants the child to wake it up on mm_release */
#define CLONE_PARENT 0x00008000 /* set if we want to have the same parent as the cloner */
#define CLONE_THREAD 0x00010000 /* Same thread group? */
#define CLONE_NEWNS 0x00020000 /* New mount namespace group */
#define CLONE_SYSVSEM 0x00040000 /* share system V SEM_UNDO semantics */
#define CLONE_SETTLS 0x00080000 /* create a new TLS for the child */
#define CLONE_PARENT_SETTID 0x00100000 /* set the TID in the parent */
#define CLONE_CHILD_CLEARTID 0x00200000 /* clear the TID in the child */
#define CLONE_DETACHED 0x00400000 /* Unused, ignored */
#define CLONE_UNTRACED 0x00800000 /* set if the tracing process can't force CLONE_PTRACE on this clone */
#define CLONE_CHILD_SETTID 0x01000000 /* set the TID in the child */
#define CLONE_NEWCGROUP 0x02000000 /* New cgroup namespace */
#define CLONE_NEWUTS 0x04000000 /* New utsname namespace */
#define CLONE_NEWIPC 0x08000000 /* New ipc namespace */
#define CLONE_NEWUSER 0x10000000 /* New user namespace */
#define CLONE_NEWPID 0x20000000 /* New pid namespace */
#define CLONE_NEWNET 0x40000000 /* New network namespace */
#define CLONE_IO 0x80000000 /* Clone io context */
```


透過組合不同的 `clone flag` 可以決定 `task_struct` 的一些特性，詳細解說每個 `clone flag` 有什麼用途可以參考  [clone(2)](https://man7.org/linux/man-pages/man2/clone.2.html)，之後有機會再針對 `clone` 整理一篇文章。

接下來繼續看 `_do_fork` 的實現

```c
long _do_fork(unsigned long clone_flags,
			unsigned long stack_start,
			unsigned long stack_size,
			int __user *parent_tidptr,
			int __user *child_tidptr,
			unsigned long tls)
{
	struct task_struct *p;
	int trace = 0;
	long nr;

	/*
	* Determine whether and which event to report to ptracer. When
	* called from kernel_thread or CLONE_UNTRACED is explicitly
	* requested, no event is reported; otherwise, report if the event
	* for the type of forking is enabled.
	*/

	if (!(clone_flags & CLONE_UNTRACED)) {
		if (clone_flags & CLONE_VFORK)
			trace = PTRACE_EVENT_VFORK;
		else if ((clone_flags & CSIGNAL) != SIGCHLD)
			trace = PTRACE_EVENT_CLONE;
		else
			trace = PTRACE_EVENT_FORK;
		
		if (likely(!ptrace_event_enabled(current, trace)))
			trace = 0;
	}

	// 回傳新創立的 task_struct 指標
	p = copy_process(clone_flags, stack_start, stack_size,
					 cild_tidptr, NULL, trace, tls, NUMA_NO_NODE);
	add_latent_entropy();
	.
	.
	.
}
```


一開始的段落是有關於 `ptrace` 的邏輯處理，`trace` 變數代表 `child process` 是否可以被追蹤，如果可以，則 `trace` 代表這個 `child process` 是由哪個 `system call` 創立的(`vfork`, `clone`, `fork`)，重點在於後面的 `copy_process`，其實講的直觀一點，`copy_process` 做的事情就是回傳一個新的 `task_struct`，但是在回傳新的 `task_struct` 的時候，該 `task_struct` 是還沒有開啟的狀態，我們先繼續往 `copy_process` 去 `trace`。

### _do_fork() -> copy_process

`copy_process` 同樣定義在 [`/kerenl/fork.c`](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/fork.c#L1575)內，底下是它的實現

```c
/*
* This creates a new process as a copy of the old one,
* but does not actually start it yet.
*
* It copies the registers, and all the appropriate
* parts of the process environment (as per the clone
* flags). The actual kick-off is left to the caller.
*/
static __latent_entropy struct task_struct *copy_process(
								unsigned long clone_flags,
								unsigned long stack_start,
								unsigned long stack_size,
								int __user *child_tidptr,
								struct pid *pid,
								int trace,
								unsigned long tls,
								int node)
```

由於 `copy_process` 牽扯到 `linux` 中非常多子系統，所以這邊就簡單的討論一下整個執行 `copy_process` 的流程，關於錯誤處理相關的程式碼則是會快速帶過。

```c
// kernel/fork.c/copy_process 內部

int retval;
struct task_struct *p;

if ((clone_flags & (CLONE_NEWNS|CLONE_FS)) == (CLONE_NEWNS|CLONE_FS))
	return ERR_PTR(-EINVAL);

if ((clone_flags & (CLONE_NEWUSER|CLONE_FS)) == (CLONE_NEWUSER|CLONE_FS))
	return ERR_PTR(-EINVAL);

/*
* Thread groups must share signals as well, and detached threads
* can only be started up within the thread group.
*/
if ((clone_flags & CLONE_THREAD) && !(clone_flags & CLONE_SIGHAND))
	return ERR_PTR(-EINVAL);

/*
* Shared signal handlers imply shared VM. By way of the above,
* thread groups also imply shared VM. Blocking this case allows
* for various simplifications in other code.
*/
if ((clone_flags & CLONE_SIGHAND) && !(clone_flags & CLONE_VM))
	return ERR_PTR(-EINVAL);

/*
* Siblings of global init remain as zombies on exit since they are
* not reaped by their parent (swapper). To solve this and to avoid
* multi-rooted process trees, prevent global and container-inits
* from creating siblings.
*/
if ((clone_flags & CLONE_PARENT) &&
		current->signal->flags & SIGNAL_UNKILLABLE)
	return ERR_PTR(-EINVAL);

/*
* If the new process will be in a different pid or user namespace
* do not allow it to share a thread group with the forking task.
*/
if (clone_flags & CLONE_THREAD) {
	if ((clone_flags & (CLONE_NEWUSER | CLONE_NEWPID)) ||
	(task_active_pid_ns(current) !=
		current->nsproxy->pid_ns_for_children))
	return ERR_PTR(-EINVAL);
}
```

一開始都是一些有關於 `clone_flags` 的處理，之後會呼叫 `dup_task_struct(current, node);`，`dup_task_struct` 是真正建立 `task_struct` 的地方，`parent process` 會初始化 `child process` 之後回傳指標 `p`。

### _do_fork() -> copy_process -> dup_task_struct

```c
// kernel/fork.c/copy_process 內

// 獲得實際的 task_struct 實例
p = dup_task_struct(current, node);
if (!p)
	goto fork_out;
```

[`dup_task_struct`](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/fork.c#L506)同樣也定義在 `kernel/fork.c` 之中。具體實現如下:

```c
static struct task_struct *dup_task_struct(struct task_struct *orig, int node)
{
	struct task_struct *tsk;
	unsigned long *stack;
	struct vm_struct *stack_vm_area;
	int err;
		
	if (node == NUMA_NO_NODE)
		node = tsk_fork_get_node(orig);

	// 申請一塊新的 memory 空間給 task_struct
	tsk = alloc_task_struct_node(node);
	if (!tsk)
		return NULL;

	stack = alloc_thread_stack_node(tsk, node);
	if (!stack)
		goto free_tsk;
	
	stack_vm_area = task_stack_vm_area(tsk);

	// 可以想成 tsk = orig, 把 current process memcpy to tsk.
	// 其實看過 source code 就會發現 4.14.259 版本中根本沒有在這段做錯誤處理，不太清楚這個 return err 的用意在哪
	err = arch_dup_task_struct(tsk, orig);
	/*
	* arch_dup_task_struct() clobbers the stack-related fields. Make
	* sure they're properly initialized before using any stack-related
	* functions again.
	*/
	tsk->stack = stack;	
#ifdef CONFIG_VMAP_STACK
	tsk->stack_vm_area = stack_vm_area;
#endif
#ifdef CONFIG_THREAD_INFO_IN_TASK
	atomic_set(&tsk->stack_refcount, 1);
#endif
		
	if (err)
		goto free_stack;
#ifdef CONFIG_SECCOMP
	/*
	* We must handle setting up seccomp filters once we're under
	* the sighand lock in case orig has changed between now and
	* then. Until then, filter must be NULL to avoid messing up
	* the usage counts on the error path calling free_task.
	*/
	
	tsk->seccomp.filter = NULL;
#endif

	// 將 current 的 threadinfo 複製給 tsk
	setup_thread_stack(tsk, orig);
	clear_user_return_notifier(tsk);
	clear_tsk_need_resched(tsk);
	// 設置 stack 結束位置，為了檢測 stack overflow
	set_task_stack_end_magic(tsk);

#ifdef CONFIG_CC_STACKPROTECTOR
	tsk->stack_canary = get_random_canary();	
#endif
	/*
	* One for us, one for whoever does the "release_task()" (usually
	* parent)
	*/
	atomic_set(&tsk->usage, 2);
	
#ifdef CONFIG_BLK_DEV_IO_TRACE
	tsk->btrace_seq = 0;
#endif
	tsk->splice_pipe = NULL;
	tsk->task_frag.page = NULL;
	tsk->wake_q.next = NULL;
	
	account_kernel_stack(tsk, 1);
	
	kcov_task_init(tsk);
	
#ifdef CONFIG_FAULT_INJECTION
	tsk->fail_nth = 0;
#endif
	// 最終回傳一個指向新的 task_struct 的指標
	return tsk;

free_stack:
	free_thread_stack(tsk);
free_tsk:
	free_task_struct(tsk);
	return NULL;
}
```

接著從 `copy_process` 呼叫 `dup_task_struct` 之後繼續往下看，因為篇幅問題所以只把重要的標記出來

```c
// kernel/fork.c/copy_process 內

// 複製 parent process 的權限
retval = copy_creds(p, clone_flags);

// delays 成員紀錄等待的統計資料
delayacct_tsk_init(p);

// 設定 process 為 非 super user, 非 worker, idle 狀態
p->flags &= ~(PF_SUPERPRIV | PF_WQ_WORKER | PF_IDLE);
p->flags |= PF_FORKNOEXEC;

// Initial child process list and sibling process list
INIT_LIST_HEAD(&p->children);
INIT_LIST_HEAD(&p->sibling);

// 初始化 PREMPT_RCU, TASKS_RCU
rcu_copy_process(p);

.
. 大量相關初始化，作業要添加的 counter 可以寫在這邊
.

// 調度器相關的初始化，之後會再研究這部份整理一篇文章
// 初始化的時候還會一併將此 process 分派到某個 cpu 上
retval = sched_fork(clone_flags, p);

copy_semundo(clone_flags, p);

// 複製 parent process 的 files_strcut 相關資料
copy_files(clone_flags, p); 
// 複製 parent process 的 fs_struct
copy_fs(clone_flags, p);

// 複製 parent process 訊號系統
copy_sighand(clone_flags, p);
copy_signal(clone_flags, p);

// 複製 parent process 的 mm struct
// copy_mm 其實跟後續 copy on write 機制有點關係，但不是本篇的重點
copy_mm(clone_flags, p);

// 複製 parent process namespace
copy_namespaces(clone_flags, p);

// 複製 parent process io 相關
copy_io(clone_flags, p);

copy_thread(clone_flags, args->stack, args->stack_size, p, args->tls);
```

上面的段落帶過了 `copy_process` 的資源分配流程，可以看到幾乎每個 `copy_` 開頭的 `function` 都必須要把 `clone_flags` 傳入，藉由傳入不同的 `clone_flags`，最後 `fork/clone` 出來的 `process` 會有不同的性質。接下來繼續往下看到發配 `pid` 的段落

```c
// kernel/fork.c/copy_process 內

// 為新的 process 分配 struct pid
if (pid != &init_struct_pid) {
	pid = alloc_pid(p->nsproxy->pid_ns_for_children);
	if (IS_ERR(pid)) {
		retval = PTR_ERR(pid);
		goto bad_fork_cleanup_thread;
	}
}


p->pid = pid_nr(pid);

// 設定新的 process 的 process groups
if (clone_flags & CLONE_THREAD) { 
	p->group_leader = current->group_leader;
	p->tgid = current->tgid; 
} else {
	p->group_leader = p;
	p->tgid = p->pid;
}

// 設定 parent process 相關資料
if (clone_flags & (CLONE_PARENT|CLONE_THREAD)) {
	p->real_parent = current->real_parent;
	p->parent_exec_id = current->parent_exec_id;
	if (clone_flags & CLONE_THREAD)
		p->exit_signal = -1;
	else
		p->exit_signal = current->group_leader->exit_signal;
} else {
	p->real_parent = current;
	p->parent_exec_id = current->self_exec_id;
	p->exit_signal = (clone_flags & CSIGNAL);
}
```

到這邊為止新的 `process` 基本的屬性大致上都配置完成了，接下來初始化 `p` 的 `pid` 結構，這部份因為沒有仔細研究過所以不是很熟，只要知道很可能會有多個 `process` 使用同一個 `pid`，一定要有個 `struct pid` 負責管理，要達到的目的只有兩點:

- 從 `task_struct` 中快速找到對應的 `struct pid`
- 從 `struct pid` 能夠走訪所有使用該 `pid` 的 `task_struct`

![](https://www.pianshen.com/images/530/0c4ac21f0f941205b191d98081227a6a.png)

[來源](https://blog.csdn.net/weijitao/article/details/79918013)

這種設計可以讓一個 `process` 屬於多個不同的 `namespace`, 同一個 `process` 可以在不同的 `namespace` 有不同的局部 `pid`，多個 `task_struct` 可以共用一個 `pid`，關於 `copy_process` 中有關於 `pid struct` 初始化的程式如下:

```c
// kernel/fork.c/copy_process 內

if (likely(p->pid)) {
	ptrace_init_task(p, (clone_flags & CLONE_PTRACE) || trace);
	
	init_task_pid(p, PIDTYPE_PID, pid);
	// 如果建立的 process 是 thread group 的 leader
	if (thread_group_leader(p)) {
		init_task_pid(p, PIDTYPE_PGID, task_pgrp(current));
		init_task_pid(p, PIDTYPE_SID, task_session(current));

		if (is_child_reaper(pid)) {
			ns_of_pid(pid)->child_reaper = p;
			p->signal->flags |= SIGNAL_UNKILLABLE;
		}
		
		p->signal->leader_pid = pid;
		p->signal->tty = tty_kref_get(current->signal->tty);
		
		/*
		* Inherit has_child_subreaper flag under the same
		* tasklist_lock with adding child to the process tree
		* for propagate_has_child_subreaper optimization.
		*/
		p->signal->has_child_subreaper = p->real_parent->signal->has_child_subreaper ||
						p->real_parent->signal->is_child_subreaper;
		
		list_add_tail(&p->sibling, &p->real_parent->children);
		list_add_tail_rcu(&p->tasks, &init_task.tasks);
		attach_pid(p, PIDTYPE_PGID);
		attach_pid(p, PIDTYPE_SID);
		__this_cpu_inc(process_counts);
	} else {
	// 不是 thread group leader
		current->signal->nr_threads++;
		atomic_inc(&current->signal->live);
		atomic_inc(&current->signal->sigcnt);
		list_add_tail_rcu(&p->thread_group,
		&p->group_leader->thread_group);
		list_add_tail_rcu(&p->thread_node,
		&p->signal->thread_head);
	}
	attach_pid(p, PIDTYPE_PID);
	nr_threads++;
}

.
.
.

// 回傳新的 task_struct
return p;
```


之後會找時間好好研究再來整理成文章(~~又在挖坑~~)

接下來又回到 `_do_fork()` 的部份，上面已經大概介紹了 `copy_process` 從 `parent process` 建立一個新的 `task_struct` 的流程，最後回傳了新的 `task_struct`。

```c
// kernel/fork.c/do_fork

long _do_fork(unsigned long clone_flags,
		unsigned long stack_start,
		unsigned long stack_size,
		int __user *parent_tidptr,
		int __user *child_tidptr,
		unsigned long tls)
{

	struct task_struct *p;
	int trace = 0;
	long nr;
	
	/*
	* Determine whether and which event to report to ptracer. When
	* called from kernel_thread or CLONE_UNTRACED is explicitly
	* requested, no event is reported; otherwise, report if the event
	* for the type of forking is enabled.
	*/
	if (!(clone_flags & CLONE_UNTRACED)) {
	
		if (clone_flags & CLONE_VFORK)
			trace = PTRACE_EVENT_VFORK;
		else if ((clone_flags & CSIGNAL) != SIGCHLD)
			trace = PTRACE_EVENT_CLONE;	
		else
			trace = PTRACE_EVENT_FORK;

		if (likely(!ptrace_event_enabled(current, trace)))		
			trace = 0;
	}
	
	p = copy_process(clone_flags, stack_start, stack_size,
	child_tidptr, NULL, trace, tls, NUMA_NO_NODE);
	add_latent_entropy();
	
	/*
	* Do this prior waking up the new thread - the thread pointer
	* might get invalid after that point, if the thread exits quickly.
	*/

	// 底下這個區域只有 parent process 才會走到
	if (!IS_ERR(p)) {
		struct completion vfork;
		struct pid *pid;
		
		trace_sched_process_fork(current, p);

		// parent process 獲得新的 task struct 的 pid
		pid = get_task_pid(p, PIDTYPE_PID);
		nr = pid_vnr(pid);
		
		if (clone_flags & CLONE_PARENT_SETTID)
			put_user(nr, parent_tidptr);

		// 查看 parent process 是否調用 vfork, 如果是就初始化 vfork_done
		if (clone_flags & CLONE_VFORK) {
			p->vfork_done = &vfork;
			init_completion(&vfork);
			get_task_struct(p);
			
		}

		// 將新的 task_struct 加入 runqueue 中
		wake_up_new_task(p);
		
		/* forking complete and child started to run, tell ptracer */
		if (unlikely(trace))	
			ptrace_event_pid(trace, pid);

		// 因為 vfork 的機制，必須要等 child process 執行完,
		// parent process 的 vfork() 才會返回, 因此 vfork 產生的
		// child process 總是優先於 parent process 執行
		if (clone_flags & CLONE_VFORK) {
			if (!wait_for_vfork_done(p, &vfork))
				ptrace_event_pid(PTRACE_EVENT_VFORK_DONE, pid);
			}
		
		put_pid(pid);
	} else {
		nr = PTR_ERR(p);
	}
	return nr;
}
```

### _do_fork() -> wake_up_new_task(p)
`wake_up_new_task` 的作用是把新創立的 `task_struct` 加入調度的 `runqueue` 當中，實現[如下](https://elixir.bootlin.com/linux/v4.14.259/source/kernel/sched/core.c#L2459):

```c
// 位於 kernel/sched/core.c

/*
* wake_up_new_task - wake up a newly created task for the first time.
*
* This function will do some initial scheduler statistics housekeeping
* that must be done for every newly created context, then puts the task
* on the runqueue and wakes it.
*/
void wake_up_new_task(struct task_struct *p)
{
	struct rq_flags rf;
	struct rq *rq;

	raw_spin_lock_irqsave(&p->pi_lock, rf.flags);
	// 將新的 task_struct 狀態設為 TASK_RUNNING
	p->state = TASK_RUNNING;

#ifdef CONFIG_SMP
	/*
	* Fork balancing, do it here and not earlier because:
	* - cpus_allowed can change in the fork path
	* - any previously selected CPU might disappear through hotplug
	*
	* Use __set_task_cpu() to avoid calling sched_class::migrate_task_rq,
	* as we're not fully set-up yet.
	*/

	// select_task_rq 會調用 CFS 的 select_task_rq 來選擇一個合適的 cpu
	__set_task_cpu(p, select_task_rq(p, task_cpu(p), SD_BALANCE_FORK, 0));
#endif

	// 獲得當前 task_struct 所在的 cpu 的 runqueue
	rq = __task_rq_lock(p, &rf);
	update_rq_clock(rq);
	post_init_entity_util_avg(&p->se);

	// 將 task_struct p 加入 runqueue 當中
	activate_task(rq, p, ENQUEUE_NOCLOCK);
	p->on_rq = TASK_ON_RQ_QUEUED;
	trace_sched_wakeup_new(p);
	// 檢查新的 task_struct 是否滿足搶佔目前執行 process 的條件
	check_preempt_curr(rq, p, WF_FORK);

#ifdef CONFIG_SMP
	if (p->sched_class->task_woken) {
		/*
		* Nothing relies on rq->lock after this, so its fine to
		* drop it.
		*/
		rq_unpin_lock(rq, &rf);
		p->sched_class->task_woken(rq, p);
		rq_repin_lock(rq, &rf);
	}
#endif
	task_rq_unlock(rq, p, &rf);
}
```


### reference
- [_do_fork, do_fork 詳解](https://www.cnblogs.com/linhaostudy/p/9644736.html#autoid-1-4-0)
- [trace 30個基本Linux系統呼叫第七日：fork](https://ithelp.ithome.com.tw/articles/10185342)
- [Day4 橫空出世的 kernel_clone](https://ithelp.ithome.com.tw/articles/10267145)
- [fork 背後隱藏的技術細節](https://zhuanlan.zhihu.com/p/373954153)
- [Linux系统如何标识进程？](https://blog.csdn.net/weijitao/article/details/79918013)
- [kernel_clone](https://blog.csdn.net/jasonactions/article/details/115316642)
- [Linux fork函數](http://blog.chinaunix.net/uid-69947851-id-5826105.html)
- [Linux fork函數總結](http://blog.chinaunix.net/uid-69947851-id-5826110.html)