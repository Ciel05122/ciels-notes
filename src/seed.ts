import type { Note } from './types';

// 首次启动时灌入的示例记录，让首页一进来就长得像设计图。
// 用户删光后不会再生成（store 里用 localStorage 标记控制）。
export function seedNotes(): Note[] {
  const now = new Date();
  const at = (dayOffset: number, h: number, m: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset, h, m);
    return d.getTime();
  };
  const mk = (t: number, p: Partial<Note>): Note => ({
    id: `seed-${t}`,
    text: '',
    createdAt: t,
    updatedAt: t,
    tags: [],
    images: [],
    files: [],
    ...p,
  });

  return [
    mk(at(0, 9, 12), {
      type: 'personal',
      tags: ['散步时'],
      text: '如果把“专注”当成一块肌肉来训练，而不是一种天生的性格，会怎么安排一天？也许应该把最难的那件事放在精力最满的清晨。',
    }),
    mk(at(0, 8, 40), {
      type: 'professional',
      tags: ['课堂总结'],
      text:
        '注意力机制的核心，是让模型自己决定“看哪里”。今天这节把 Q/K/V 讲透了：\n\nQuery 是“我在找什么”，Key 是“我有什么”，Value 是“我能给什么”。三者点积再 softmax，得到的就是注意力权重——谁相关，谁的 Value 就被多取一点。\n\n多头无非是同时开几路这样的“看”，再拼起来，让模型从不同角度看同一句话。',
    }),
    mk(at(1, 22, 30), {
      isGoal: true,
      text: '这个月想读完两本和“决策”有关的书，并各写一篇 300 字的影评式总结。',
    }),
    mk(at(8, 20, 10), {
      type: 'personal',
      tags: ['影评'],
      text: '看完《降临》。它真正讲的不是外星人，而是“如果你能看到结局，你还会开始吗”。',
    }),
    mk(at(16, 21, 0), {
      type: 'personal',
      tags: ['影评'],
      text: '《奥本海默》的剪辑像在替主角的记忆排序，克制得让人窒息。',
    }),
  ];
}
