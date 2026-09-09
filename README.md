# Ciel's Notes · 生活记录 PWA

一个自用的个人记录应用：像朋友圈那样按天沉淀，像备忘录那样点开就能写。
手机上添加到主屏幕后当原生 App 用，离线可读可写，联网自动同步。

> 这是一个真实在用的项目，不是练手 Demo。当前云端有 200+ 条真实记录，
> 每隔数天自动生成一份回顾报告。仓库里不含任何个人数据。

**技术栈**：React 19 · TypeScript · Vite · Supabase（Auth / Postgres / Storage）· PWA · Netlify

---

## 为什么做这个

市面上的笔记应用要么太重（打开先选分类、选模板），要么留不住东西（聊天记录式的流水账）。
我想要的是：**入口永远只有一个，点进去就能写**；但写下去的东西能被搜到、能按标签聚合、
能在几个月后被翻出来对照。

所以整个产品只有三个底部标签：首页时间轴、标签、搜索。目标、置顶、日历、计时器
这些都藏在二级入口里——重功能存在，但不占用第一屏的注意力。

## 功能

**记录**
- 单入口写入，自动保存草稿，支持补录过去的时间
- 自由标签、地点、个人/专业分类、目标与完成状态、置顶
- 备注：对同一条记录追加「后来的想法」，各自带自己的时间戳
- 计时器：番茄钟产出的不是一个孤立的计时记录，而是时间轴上的一条普通记录

**图片与附件**
- 本地先压缩出缩略图立刻显示，原图与缩略图并行后台上传
- 多图最多两条并发，避免手机同时解码多张大图而卡顿发热
- 上传失败保留本地文件并提供重试，图片没传完不允许保存记录
- 列表只加载缩略图，灯箱按需加载原图并预取前后两张

**浏览与检索**
- 时间轴按天分组，日期头 sticky 吸顶，无限滚动
- 全文搜索（正文 + 标签 + 地点），最近搜索历史，按最近 30 天词频动态推荐的常用标签
- 标签云、日历总览、目标清单、置顶清单

**AI 定期回顾**（见下）
- 每隔数天自动生成一份基于证据的回顾报告，写回云端，手机上直接读

## 架构

```
浏览器 / PWA
  │  React + TypeScript
  │  本地优先：localStorage(文字) + IndexedDB(图片二进制)
  │
  ├── Supabase Auth ── 邮箱密码登录，会话持久化
  ├── Supabase Postgres ── notes / reviews 表，全部启用 RLS
  └── Supabase Storage ── 图片与附件
        │
Netlify ── 静态托管 + CDN + HTTPS + SPA 路由回退
```

**本地优先的读写顺序**

```
打开应用 → 先读本地缓存，立即渲染 → 恢复登录态 → 拉取云端
        → 按记录 ID 合并，同一条以 updatedAt 较新者为准 → 回写本地
新增/修改 → 先写内存与本地，界面立刻反馈 → 异步提交云端
```

数据安全完全由数据库层的 RLS 保证，而不是靠前端隐藏：
每张表都有逐用户的 select / insert / update / delete 策略，
换一个账号即使手动构造记录 ID 也读不到别人的数据。

## AI 定期回顾

`scripts/analysis/` 是一套**只读**的分析流水线，跑在本机，不需要任何 AI API Key。

```
每天检查一次
  └─ should-review.mjs   只做一次 count 查询，不拉正文
       ├─ 不满足条件 → 静默退出，什么都不做
       └─ 满足条件（累计 ≥12 条且距上次 ≥4 天，或距上次 ≥8 天且 ≥6 条）
            ├─ rebuild-tag-index.mjs  分页读全部历史，重建本机标签关联索引
            ├─ fetch-notes.mjs        取本批记录 + 相关历史候选
            ├─ [生成报告]
            ├─ publish-review.mjs     整套工具唯一的写操作，只 insert 一行
            └─ mark-success.mjs       报告确认生成后才推进游标
```

几个刻意的设计：

- **门槛按真实数据标定。** 统计了 90 天 180 条记录的分布（整体 1.98 条/天，但只有
  48/91 天有记录，是爆发式的），用真实的每日序列模拟了不同阈值下的播报间隔，
  才定下 12 条 / 4 天 / 8 天这组参数。
- **失败不推进游标。** 报告没生成成功就不确认，下次会重新读同一批记录，不会漏。
- **标签别名只认人工确认。** AI 推测的相似标签只能作为候选出现在报告里，
  必须显式运行命令才会写入别名表，且永远不改写原始记录的标签。
- **注入防护。** 记录内容一律作为待分析数据，即使正文里写着像指令的文字也不执行。
- **隐私边界。** 分析只读文字、时间、标签、地点、目标状态、计时器和备注，
  不读取图片与附件；本机索引存在受 ACL 限制的用户目录下，不进仓库也不进构建产物。

## 一些实现上的取舍

**性能**：用了一段时间后手机变卡，定位到是 GPU/内存积压——几十个标签胶囊各自带一层
`backdrop-filter` 是主因。撤掉逐项毛玻璃只保留底栏和弹层两处，列表卡片加
`content-visibility: auto` 让屏外卡片跳过渲染并释放已解码的图片内存。
由此定下一条红线：列表项不加 `backdrop-filter`，列表图必须走缩略图。

**首屏体积**：回顾页需要 `marked` + `dompurify` 渲染 Markdown，直接引入会让首屏包
从 501KB 涨到 575KB。改成 `lazy` 按需加载后首屏回到 503KB（gzip 147KB），
Markdown 相关的 71KB 只在真正打开回顾时才下载。

**搜索状态**：关键词原本只存在组件 state 里，导致从搜索结果进详情页或编辑页后返回，
关键词就丢了。与其在每个出口单独补，不如让关键词随打字防抖同步进 URL（`replace`，
不堆历史记录），所有出口自动正确。

**离线与同步状态**：写入是乐观更新，但界面区分 `本地` / `同步中` / `已同步` / `失败`，
不会在请求还没成功时显示「已同步」。

## 本地运行

```bash
npm install
cp .env.example .env.local   # 填入你自己的 Supabase 项目地址与 key
npm run dev
```

需要先在 Supabase 控制台依次运行仓库根目录的建表脚本：

```
supabase-setup.sql          notes 表 + RLS + storage 桶与策略
supabase-add-comments.sql   备注列
supabase-add-timer.sql      计时器列
supabase-add-reviews.sql    reviews 表 + RLS
```

构建与检查：

```bash
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm run analysis:test
```

## 目录

```
src/
  pages/        Timeline / Write / Search / NoteDetail / Reviews / Tags / Calendar / Goals / Pins / Timer / Login
  components/   NoteCard / ImageGrid+Lightbox / LocationPicker / TabBar / Attachment / Badge
  store.tsx     全局状态：登录态、本地优先读写、云端合并
  cloudNotes.ts 记录的云端读写与行映射（分页读全）
  cloudReviews.ts 回顾报告的读取与删除
  media.ts      图片压缩、缩略图、上传队列
  db.ts         IndexedDB 媒体二进制缓存
  storage.ts    localStorage、标签统计、搜索历史
scripts/analysis/   只读分析流水线 + 本机标签知识库（含单元测试）
```

## 说明

这是个人自用项目，仓库里只有代码与文档，不含任何记录内容、账号或密钥。
`.env.local`、`reports/`、`dist/` 均已排除在版本控制之外。
