##  学习路线图（6个阶段）
### 🟢 阶段1：理解AI应用的核心架构（概念层）
目标： 建立AI全栈开发的思维模型

你的项目已经体现了AI应用的经典架构：

你需要掌握的3个核心概念：

1. Prompt Engineering（提示词工程）
   
   - 看 server/index.js:19-21 ， SYSTEM_PROMPT 目前非常简陋
   - 看 fieldAnalyzer.ts:16-33 ，这里的system prompt更精细，指定了返回格式和字段类型枚举
2. Structured Output（结构化输出）
   
   - 这是AI应用从"聊天机器人"升级为"产品"的关键
   - 你的项目用了两种方式：
     - 后端：Ollama的 format 参数 + Zod验证（ server/index.js:145-148 ）
     - 前端：OpenAI的 response_format: { type: "json_object" } （ fieldAnalyzer.ts:11-13 ）
3. Schema驱动的开发
   
   - schema.ts 定义了AI输出的数据结构
   - server/index.js 中用Zod做了双重验证
   - 这是 AI全栈的核心模式 ：先定义Schema，再让AI填充数据
### 🟡 阶段2：修复当前项目，让它跑起来（实战层）
目标： 把现有代码跑通，获得第一个成就感

当前项目有几个问题需要修复：

问题1： fieldAnalyzer.ts 缺少 client 的初始化（第8行直接用了 client 但未导入/定义）

问题2： 渲染组件使用了 Element Plus 的组件（ el-table 、 el-form 等），但 package.json 中未安装 Element Plus

问题3： App.vue 中调用了 generateVueCode 但只是 console.log ，没有实际渲染生成的页面

### 🟠 阶段3：深化AI集成（进阶层）
目标： 掌握AI调用的多种模式

- 流式输出（Streaming）： 让用户看到AI"打字"的过程，提升体验
- 多轮对话： 让用户可以迭代修改生成的页面
- Function Calling / Tool Use： 让AI能调用你的业务函数
- RAG（检索增强生成）： 让AI基于你的组件库文档生成代码
### 🔴 阶段4：产品化（工程层）
目标： 把Demo变成真正的产品

- 错误处理与重试机制
- 加载状态与骨架屏
- AI输出的缓存策略
- 成本控制（Token计数、模型选择）
- 用户反馈闭环（对AI输出进行修正）
### 🟣 阶段5：部署与运维（运维层）
目标： 让AI应用上线

- 前后端部署（Vercel / Docker）
- API Key安全管理
- 监控与日志
- 速率限制
### ⚫ 阶段6：高级AI能力（专家层）
- Agent模式（自主决策与执行）
- 多模型协作
- 本地模型微调
- 向量数据库集成