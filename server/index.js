import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import { ProxyAgent, setGlobalDispatcher } from "undici";

import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

if (process.env.PROXY) {
  setGlobalDispatcher(new ProxyAgent(process.env.PROXY));
  console.log("Proxy configured:", process.env.PROXY);
}

const app = express();

app.use(cors());
app.use(express.json());

const DEFAULT_API_KEY = process.env.API_KEY || "";
const DEFAULT_BASE_URL = process.env.BASE_URL || "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.MODEL || "qwen2.5:7b";
const DEFAULT_PROVIDER = process.env.PROVIDER || "deepseek";

const SYSTEM_PROMPT = `
你是一个前端页面生成器。根据用户需求生成页面JSON。

支持三种页面类型：
1. list - 列表页（搜索表单 + 数据表格 + 分页）
2. form - 表单页（表单字段 + 提交按钮）
3. dashboard - 仪表盘页（统计卡片 + 搜索表单 + 数据表格 + 分页）

根据用户描述自动判断页面类型，生成对应的组件结构。
`;

const SYSTEM_PROMPT_ITERATE = `
你是一个前端页面修改器。用户会给你当前的页面JSON和修改需求，你需要返回修改后的完整页面JSON。

规则：
1. 保持未修改的部分不变
2. 只修改用户要求的部分
3. 返回完整的JSON，不要省略任何字段
4. 必须保持JSON结构合法
`;

const SYSTEM_PROMPT_PROJECT = `
你是一个前端项目生成器。根据用户需求生成包含多个页面的项目JSON。

支持三种页面类型：
1. list - 列表页（搜索表单 + 数据表格 + 分页）
2. form - 表单页（表单字段 + 提交按钮）
3. dashboard - 仪表盘页（统计卡片 + 搜索表单 + 数据表格 + 分页）

根据用户描述生成2-5个相关页面，组成一个完整的管理系统项目。
`;

const SearchFormFieldSchema = z.object({
  label: z.string(),
  prop: z.string(),
  type: z.enum(["input", "select", "date"]).optional(),
  options: z.array(z.string()).optional()
});

const TableColumnSchema = z.object({
  label: z.string(),
  prop: z.string(),
  width: z.number().optional()
});

const StatCardSchema = z.object({
  title: z.string(),
  prop: z.string(),
  icon: z.string().optional(),
  color: z.string().optional()
});

const FormFieldSchema = z.object({
  label: z.string(),
  prop: z.string(),
  type: z.enum(["input", "select", "date", "textarea", "number"]),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  placeholder: z.string().optional()
});

const StructuredPageZodSchema = z.object({
  pageName: z.string(),
  pageType: z.enum(["list", "form", "dashboard"]).optional(),
  searchForm: z.object({
    fields: z.array(SearchFormFieldSchema)
  }).optional(),
  table: z.object({
    columns: z.array(TableColumnSchema)
  }).optional(),
  pagination: z.object({
    total: z.number().optional()
  }).optional(),
  statCards: z.object({
    cards: z.array(StatCardSchema)
  }).optional(),
  form: z.object({
    fields: z.array(FormFieldSchema)
  }).optional()
});

const structuredPageSchema = {
  type: "object",
  properties: {
    pageName: {
      type: "string",
      description: "页面名称，如用户管理、订单管理"
    },
    pageType: {
      type: "string",
      enum: ["list", "form", "dashboard"],
      description: "页面类型：list列表页、form表单页、dashboard仪表盘"
    },
    searchForm: {
      type: "object",
      description: "搜索表单（list和dashboard页面需要），包含2-4个搜索字段",
      properties: {
        fields: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          description: "搜索字段列表",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "字段中文标签" },
              prop: { type: "string", description: "字段英文名，驼峰命名" },
              type: { type: "string", enum: ["input", "select", "date"], description: "输入类型" },
              options: { type: "array", items: { type: "string" }, description: "select类型的选项" }
            },
            required: ["label", "prop"]
          }
        }
      },
      required: ["fields"]
    },
    table: {
      type: "object",
      description: "数据表格（list和dashboard页面需要），包含4-8个列",
      properties: {
        columns: {
          type: "array",
          minItems: 3,
          maxItems: 10,
          description: "表格列定义",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "列标题" },
              prop: { type: "string", description: "列字段名，驼峰命名" },
              width: { type: "number", description: "列宽度" }
            },
            required: ["label", "prop"]
          }
        }
      },
      required: ["columns"]
    },
    pagination: {
      type: "object",
      description: "分页组件（list和dashboard页面需要）",
      properties: {
        total: { type: "number", description: "总条数，默认100" }
      }
    },
    statCards: {
      type: "object",
      description: "统计卡片（dashboard页面需要），包含3-4个统计指标",
      properties: {
        cards: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          description: "统计卡片列表",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "指标名称" },
              prop: { type: "string", description: "指标英文名，驼峰命名" },
              icon: { type: "string", description: "图标emoji" },
              color: { type: "string", enum: ["blue", "green", "orange", "red", "purple", "cyan"], description: "卡片颜色" }
            },
            required: ["title", "prop"]
          }
        }
      },
      required: ["cards"]
    },
    form: {
      type: "object",
      description: "表单（form页面需要），包含4-8个字段",
      properties: {
        fields: {
          type: "array",
          minItems: 3,
          maxItems: 12,
          description: "表单字段列表",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "字段中文标签" },
              prop: { type: "string", description: "字段英文名，驼峰命名" },
              type: { type: "string", enum: ["input", "select", "date", "textarea", "number"], description: "输入类型" },
              options: { type: "array", items: { type: "string" }, description: "select类型的选项" },
              required: { type: "boolean", description: "是否必填" },
              placeholder: { type: "string", description: "占位提示文字" }
            },
            required: ["label", "prop", "type"]
          }
        }
      },
      required: ["fields"]
    }
  },
  required: ["pageName"]
};

const projectSchema = {
  type: "object",
  properties: {
    projectName: {
      type: "string",
      description: "项目名称，如电商管理系统"
    },
    pages: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      description: "页面列表",
      items: structuredPageSchema
    }
  },
  required: ["projectName", "pages"]
};

const COMPONENT_TYPE_MAP = {
  statistics: "statCards",
  "statistics-cards": "statCards",
  statcards: "statCards",
  stats: "statCards",
  filter: "searchForm",
  "filter-form": "searchForm",
  searchform: "searchForm",
  "search-form": "searchForm",
  "data-table": "table",
  datatable: "table",
  list: "table",
  paging: "pagination",
  "edit-form": "form",
  editform: "form",
};

function normalizeComponentType(type) {
  if (!type) return type;
  const lower = type.toLowerCase().replace(/[_\s]/g, "");
  return COMPONENT_TYPE_MAP[lower] || type;
}

function buildComponents(parsed) {
  if (parsed.components && Array.isArray(parsed.components)) {
    const normalized = parsed.components.map(comp => ({
      ...comp,
      type: normalizeComponentType(comp.type)
    }));
    return {
      pageName: parsed.pageName || parsed.title || "未命名页面",
      pageType: parsed.pageType || "list",
      components: normalized
    };
  }

  // 否则从扁平字段格式构建 components
  const components = [];
  const pageType = parsed.pageType || "list";

  if (parsed.statCards) {
    components.push({ type: "statCards", cards: parsed.statCards.cards });
  }
  if (parsed.searchForm) {
    components.push({ type: "searchForm", fields: parsed.searchForm.fields });
  }
  if (parsed.table) {
    components.push({ type: "table", columns: parsed.table.columns });
  }
  if (parsed.pagination) {
    components.push({ type: "pagination", total: parsed.pagination.total || 100 });
  }
  if (parsed.form) {
    components.push({ type: "form", fields: parsed.form.fields });
  }

  return { pageName: parsed.pageName, pageType, components };
}

function getProviderConfig(reqBody) {
  const provider = reqBody.provider || DEFAULT_PROVIDER;
  const baseUrl = reqBody.baseUrl || DEFAULT_BASE_URL;
  const apiKey = reqBody.apiKey || DEFAULT_API_KEY;
  const model = reqBody.model || DEFAULT_MODEL;

  return { provider, baseUrl, apiKey, model };
}

async function callAI({ provider, baseUrl, apiKey, model, messages, format, stream }) {
  if (provider === "deepseek") {
    const headers = {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    };

    const body = {
      model,
      messages,
      stream,
      ...(format ? { response_format: { type: "json_object" } } : {})
    };

    const url = `${baseUrl}/chat/completions`;
    console.log("callAI deepseek URL:", url);
    return { url, headers, body, provider };
  }

  const headers = {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
  };

  const body = {
    model,
    messages,
    stream,
    ...(format ? { format } : {})
  };

  const url = `${baseUrl}/api/chat`;
  return { url, headers, body, provider };
}

function parseAIResponse(parsed, provider) {
  if (provider === "deepseek") {
    return parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || "";
  }
  return parsed.message?.content || "";
}

function isDone(parsed, provider) {
  if (provider === "deepseek") {
    return parsed.choices?.[0]?.finish_reason === "stop";
  }
  return parsed.done === true;
}

function extractJSON(content) {
  try {
    return JSON.parse(content);
  } catch {}
  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch {}
  }
  const braceMatch = content.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {}
  }
  return null;
}

app.get("/config", (req, res) => {
  res.json({
    success: true,
    config: {
      provider: DEFAULT_PROVIDER,
      baseUrl: DEFAULT_BASE_URL,
      model: DEFAULT_MODEL,
      hasApiKey: !!DEFAULT_API_KEY
    }
  });
});

app.get("/models", async (req, res) => {
  try {
    const provider = req.query.provider || DEFAULT_PROVIDER;
    const baseUrl = req.query.baseUrl || DEFAULT_BASE_URL;
    const apiKey = req.query.apiKey || DEFAULT_API_KEY;

    if (provider === "ollama") {
      const headers = {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      };

      const response = await fetch(`${baseUrl}/api/tags`, { headers });

      if (!response.ok) {
        return res.json({ success: true, models: [{ id: DEFAULT_MODEL, name: DEFAULT_MODEL }] });
      }

      const data = await response.json();
      const models = (data.models || []).map(m => ({
        id: m.name,
        name: m.name,
        size: m.size ? `${(m.size / 1024 / 1024 / 1024).toFixed(1)}GB` : undefined
      }));

      res.json({ success: true, models });
    } else {
      const models = [
        { id: DEFAULT_MODEL, name: DEFAULT_MODEL }
      ];
      res.json({ success: true, models });
    }
  } catch {
    res.json({ success: true, models: [{ id: DEFAULT_MODEL, name: DEFAULT_MODEL }] });
  }
});

app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    const config = getProviderConfig(req.body);

    console.log("Received prompt:", prompt, "Provider:", config.provider, "Model:", config.model);

    const { url, headers, body, provider } = await callAI({
      ...config,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      format: structuredPageSchema,
      stream: false
    });

    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ success: false, error: `API returned ${response.status}`, detail: text });
    }

    const result = await response.json();
    const content = parseAIResponse(result, provider);

    const extracted = extractJSON(content);
    if (!extracted) {
      return res.json({ success: true, data: { raw: content } });
    }

    let parsed;
    try {
      parsed = StructuredPageZodSchema.parse(extracted);
    } catch (e) {
      console.error("Zod parse error:", e.message);
      return res.json({ success: true, data: buildComponents(extracted) });
    }

    res.json({ success: true, data: buildComponents(parsed) });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/generate/stream", async (req, res) => {
  try {
    const { prompt } = req.body;
    const config = getProviderConfig(req.body);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const { url, headers, body, provider } = await callAI({
      ...config,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      format: structuredPageSchema,
      stream: true
    });

    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

    if (!response.ok) {
      const text = await response.text();
      res.write(`data: ${JSON.stringify({ error: `API returned ${response.status}`, detail: text })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      if (provider === "deepseek") {
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const token = parseAIResponse(parsed, provider);
            if (token) {
              fullContent += token;
              res.write(`data: ${JSON.stringify({ token, fullContent })}\n\n`);
            }
          } catch {}
        }
      } else {
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed);
            if (parsed.done === true && !parsed.message?.content) continue;
            const token = parsed.message?.content || "";
            if (token) {
              fullContent += token;
              res.write(`data: ${JSON.stringify({ token, fullContent })}\n\n`);
            }
          } catch {}
        }
      }
    }

    let result;
    const extracted = extractJSON(fullContent);
    if (extracted) {
      try {
        const schemaParsed = StructuredPageZodSchema.parse(extracted);
        result = { success: true, data: buildComponents(schemaParsed) };
      } catch {
        result = { success: true, data: buildComponents(extracted) };
      }
    } else {
      result = { success: true, data: { raw: fullContent } };
    }

    res.write(`data: ${JSON.stringify({ done: true, result })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Stream API Error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.post("/iterate", async (req, res) => {
  try {
    const { currentSchema, instruction } = req.body;
    const config = getProviderConfig(req.body);

    const { url, headers, body, provider } = await callAI({
      ...config,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_ITERATE },
        { role: "user", content: `当前页面JSON：\n${JSON.stringify(currentSchema, null, 2)}\n\n修改需求：${instruction}` }
      ],
      format: structuredPageSchema,
      stream: false
    });

    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ success: false, error: `API returned ${response.status}`, detail: text });
    }

    const result = await response.json();
    const content = parseAIResponse(result, provider);

    const extracted = extractJSON(content);
    if (!extracted) {
      return res.json({ success: true, data: { raw: content } });
    }

    let parsed;
    try {
      parsed = StructuredPageZodSchema.parse(extracted);
    } catch (e) {
      return res.json({ success: true, data: buildComponents(extracted) });
    }

    res.json({ success: true, data: buildComponents(parsed) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/iterate/stream", async (req, res) => {
  try {
    const { currentSchema, instruction } = req.body;
    const config = getProviderConfig(req.body);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const { url, headers, body, provider } = await callAI({
      ...config,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_ITERATE },
        { role: "user", content: `当前页面JSON：\n${JSON.stringify(currentSchema, null, 2)}\n\n修改需求：${instruction}` }
      ],
      format: structuredPageSchema,
      stream: true
    });

    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

    if (!response.ok) {
      const text = await response.text();
      res.write(`data: ${JSON.stringify({ error: `API returned ${response.status}`, detail: text })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      if (provider === "deepseek") {
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]" || !trimmed.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const token = parseAIResponse(parsed, provider);
            if (token) {
              fullContent += token;
              res.write(`data: ${JSON.stringify({ token, fullContent })}\n\n`);
            }
          } catch {}
        }
      } else {
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed.done === true && !parsed.message?.content) continue;
            const token = parsed.message?.content || "";
            if (token) {
              fullContent += token;
              res.write(`data: ${JSON.stringify({ token, fullContent })}\n\n`);
            }
          } catch {}
        }
      }
    }

    let result;
    const extracted = extractJSON(fullContent);
    if (extracted) {
      try {
        const schemaParsed = StructuredPageZodSchema.parse(extracted);
        result = { success: true, data: buildComponents(schemaParsed) };
      } catch {
        result = { success: true, data: buildComponents(extracted) };
      }
    } else {
      result = { success: true, data: { raw: fullContent } };
    }

    res.write(`data: ${JSON.stringify({ done: true, result })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.post("/generate-project", async (req, res) => {
  try {
    const { prompt } = req.body;
    const config = getProviderConfig(req.body);

    const { url, headers, body, provider } = await callAI({
      ...config,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_PROJECT },
        { role: "user", content: prompt }
      ],
      format: projectSchema,
      stream: false
    });

    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ success: false, error: `API returned ${response.status}`, detail: text });
    }

    const result = await response.json();
    const content = parseAIResponse(result, provider);

    const parsed = extractJSON(content);
    if (!parsed) {
      return res.json({ success: true, data: { raw: content } });
    }

    if (parsed.pages && Array.isArray(parsed.pages)) {
      const pages = parsed.pages.map(p => {
        try {
          return buildComponents(StructuredPageZodSchema.parse(p));
        } catch {
          return buildComponents(p);
        }
      });
      res.json({ success: true, data: { projectName: parsed.projectName, pages } });
    } else {
      res.json({ success: true, data: buildComponents(parsed) });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/analyze-fields", async (req, res) => {
  try {
    const { columns } = req.body;
    const config = getProviderConfig(req.body);

    const fieldAnalysisSchema = {
      type: "object",
      properties: {
        fields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "字段名" },
              type: { type: "string", enum: ["id", "name", "phone", "email", "money", "date", "status", "orderNo", "text"], description: "字段语义类型" }
            },
            required: ["name", "type"]
          }
        }
      },
      required: ["fields"]
    };

    const { url, headers, body, provider } = await callAI({
      ...config,
      messages: [
        { role: "system", content: "你是字段分析器。分析给定字段列表，返回每个字段的语义类型。" },
        { role: "user", content: JSON.stringify(columns) }
      ],
      format: fieldAnalysisSchema,
      stream: false
    });

    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

    if (!response.ok) {
      return res.status(500).json({ success: false, error: `API returned ${response.status}` });
    }

    const result = await response.json();
    const content = parseAIResponse(result, provider);

    res.json({ success: true, data: JSON.parse(content) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "query_database_stats",
      description: "查询数据库统计信息，如用户总数、订单总数、营收等。用于生成仪表盘页面的统计卡片数据。",
      parameters: {
        type: "object",
        properties: {
          metric: {
            type: "string",
            enum: ["user_count", "order_count", "revenue", "growth_rate", "active_users", "pending_orders", "inventory_count", "category_distribution"],
            description: "要查询的统计指标"
          },
          time_range: {
            type: "string",
            enum: ["today", "week", "month", "quarter", "year", "all"],
            description: "时间范围"
          }
        },
        required: ["metric"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_table_data",
      description: "查询业务数据表的字段和示例数据。用于生成列表页时了解真实数据结构。",
      parameters: {
        type: "object",
        properties: {
          table_name: {
            type: "string",
            enum: ["users", "orders", "products", "categories", "departments", "logs", "notifications"],
            description: "数据表名称"
          },
          fields: {
            type: "array",
            items: { type: "string" },
            description: "需要查询的字段列表（可选，不传则返回所有字段）"
          }
        },
        required: ["table_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_form_config",
      description: "获取表单的推荐字段配置。用于生成表单页面时获取合理的字段类型和验证规则。",
      parameters: {
        type: "object",
        properties: {
          form_type: {
            type: "string",
            enum: ["user_register", "order_create", "product_add", "feedback", "profile_edit", "settings"],
            description: "表单类型"
          }
        },
        required: ["form_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_page_recommendation",
      description: "根据业务场景推荐页面组合方案。用于项目级生成时规划合理的页面结构。",
      parameters: {
        type: "object",
        properties: {
          business_domain: {
            type: "string",
            description: "业务领域，如电商、教育、医疗等"
          },
          scale: {
            type: "string",
            enum: ["small", "medium", "large"],
            description: "项目规模"
          }
        },
        required: ["business_domain"]
      }
    }
  }
];

const mockDatabase = {
  user_count: { value: 12846, label: "总用户数", trend: "+12.5%" },
  order_count: { value: 8432, label: "总订单数", trend: "+8.3%" },
  revenue: { value: 1284600, label: "总营收(元)", trend: "+15.2%" },
  growth_rate: { value: 12.5, label: "月增长率(%)", trend: "+2.1%" },
  active_users: { value: 3256, label: "活跃用户", trend: "+5.8%" },
  pending_orders: { value: 47, label: "待处理订单", trend: "-3.2%" },
  inventory_count: { value: 5623, label: "库存商品", trend: "-1.5%" },
  category_distribution: { value: { "电子产品": 35, "服装鞋帽": 25, "食品饮料": 20, "家居用品": 15, "其他": 5 }, label: "分类分布", trend: "" }
};

const mockTableSchemas = {
  users: {
    table_label: "用户表",
    fields: [
      { prop: "name", label: "姓名", type: "input", search: true },
      { prop: "phone", label: "手机号", type: "input", search: true },
      { prop: "email", label: "邮箱", type: "input" },
      { prop: "department", label: "部门", type: "select", options: ["技术部", "市场部", "财务部", "人事部"], search: true },
      { prop: "status", label: "状态", type: "select", options: ["启用", "禁用"], search: true },
      { prop: "createTime", label: "注册时间", type: "date" }
    ]
  },
  orders: {
    table_label: "订单表",
    fields: [
      { prop: "orderNo", label: "订单号", type: "input", search: true },
      { prop: "productName", label: "商品名称", type: "input" },
      { prop: "customerName", label: "客户", type: "input", search: true },
      { prop: "amount", label: "金额", type: "number" },
      { prop: "status", label: "状态", type: "select", options: ["待付款", "已付款", "已发货", "已完成", "已取消"], search: true },
      { prop: "orderTime", label: "下单时间", type: "date", search: true }
    ]
  },
  products: {
    table_label: "商品表",
    fields: [
      { prop: "productName", label: "商品名称", type: "input", search: true },
      { prop: "category", label: "分类", type: "select", options: ["电子产品", "服装鞋帽", "食品饮料", "家居用品"], search: true },
      { prop: "price", label: "价格", type: "number" },
      { prop: "stock", label: "库存", type: "number" },
      { prop: "status", label: "状态", type: "select", options: ["上架", "下架", "缺货"], search: true }
    ]
  },
  categories: {
    table_label: "分类表",
    fields: [
      { prop: "categoryName", label: "分类名称", type: "input", search: true },
      { prop: "parentCategory", label: "父分类", type: "select", options: ["无", "电子产品", "服装鞋帽"] },
      { prop: "productCount", label: "商品数量", type: "number" },
      { prop: "sort", label: "排序", type: "number" },
      { prop: "status", label: "状态", type: "select", options: ["启用", "禁用"] }
    ]
  },
  departments: {
    table_label: "部门表",
    fields: [
      { prop: "departmentName", label: "部门名称", type: "input", search: true },
      { prop: "manager", label: "负责人", type: "input" },
      { prop: "memberCount", label: "人数", type: "number" },
      { prop: "status", label: "状态", type: "select", options: ["正常", "冻结"] }
    ]
  },
  logs: {
    table_label: "操作日志表",
    fields: [
      { prop: "operator", label: "操作人", type: "input", search: true },
      { prop: "action", label: "操作类型", type: "select", options: ["登录", "新增", "修改", "删除", "导出"], search: true },
      { prop: "content", label: "操作内容", type: "input" },
      { prop: "ip", label: "IP地址", type: "input" },
      { prop: "operateTime", label: "操作时间", type: "date", search: true }
    ]
  },
  notifications: {
    table_label: "通知表",
    fields: [
      { prop: "title", label: "通知标题", type: "input", search: true },
      { prop: "type", label: "类型", type: "select", options: ["系统通知", "业务提醒", "安全警告"], search: true },
      { prop: "content", label: "内容", type: "input" },
      { prop: "status", label: "状态", type: "select", options: ["未读", "已读"] },
      { prop: "createTime", label: "创建时间", type: "date" }
    ]
  }
};

const mockFormConfigs = {
  user_register: {
    fields: [
      { label: "用户名", prop: "username", type: "input", required: true, placeholder: "请输入用户名" },
      { label: "手机号", prop: "phone", type: "input", required: true, placeholder: "请输入手机号" },
      { label: "邮箱", prop: "email", type: "input", required: true, placeholder: "请输入邮箱" },
      { label: "密码", prop: "password", type: "input", required: true, placeholder: "请输入密码" },
      { label: "部门", prop: "department", type: "select", options: ["技术部", "市场部", "财务部", "人事部"], required: true },
      { label: "角色", prop: "role", type: "select", options: ["普通用户", "管理员", "超级管理员"] }
    ]
  },
  order_create: {
    fields: [
      { label: "客户姓名", prop: "customerName", type: "input", required: true, placeholder: "请输入客户姓名" },
      { label: "联系电话", prop: "phone", type: "input", required: true, placeholder: "请输入联系电话" },
      { label: "商品名称", prop: "productName", type: "input", required: true, placeholder: "请输入商品名称" },
      { label: "数量", prop: "quantity", type: "number", required: true },
      { label: "收货地址", prop: "address", type: "textarea", placeholder: "请输入收货地址" },
      { label: "备注", prop: "remark", type: "textarea", placeholder: "请输入备注" }
    ]
  },
  product_add: {
    fields: [
      { label: "商品名称", prop: "productName", type: "input", required: true, placeholder: "请输入商品名称" },
      { label: "分类", prop: "category", type: "select", options: ["电子产品", "服装鞋帽", "食品饮料", "家居用品"], required: true },
      { label: "价格", prop: "price", type: "number", required: true },
      { label: "库存", prop: "stock", type: "number", required: true },
      { label: "商品描述", prop: "description", type: "textarea", placeholder: "请输入商品描述" }
    ]
  },
  feedback: {
    fields: [
      { label: "反馈类型", prop: "type", type: "select", options: ["Bug反馈", "功能建议", "体验问题", "其他"], required: true },
      { label: "标题", prop: "title", type: "input", required: true, placeholder: "请输入反馈标题" },
      { label: "详细描述", prop: "description", type: "textarea", required: true, placeholder: "请详细描述您的问题或建议" },
      { label: "联系方式", prop: "contact", type: "input", placeholder: "请输入联系方式" }
    ]
  },
  profile_edit: {
    fields: [
      { label: "姓名", prop: "name", type: "input", required: true, placeholder: "请输入姓名" },
      { label: "手机号", prop: "phone", type: "input", required: true, placeholder: "请输入手机号" },
      { label: "邮箱", prop: "email", type: "input", placeholder: "请输入邮箱" },
      { label: "部门", prop: "department", type: "select", options: ["技术部", "市场部", "财务部", "人事部"] },
      { label: "个人简介", prop: "bio", type: "textarea", placeholder: "请输入个人简介" }
    ]
  },
  settings: {
    fields: [
      { label: "系统名称", prop: "systemName", type: "input", required: true, placeholder: "请输入系统名称" },
      { label: "语言", prop: "language", type: "select", options: ["中文", "English"], required: true },
      { label: "主题", prop: "theme", type: "select", options: ["默认蓝", "暗夜", "极简"] },
      { label: "通知方式", prop: "notification", type: "select", options: ["站内信", "邮件", "短信", "全部"] }
    ]
  }
};

function executeToolCall(name, args) {
  switch (name) {
    case "query_database_stats": {
      const metric = args.metric;
      const data = mockDatabase[metric];
      if (!data) return { success: false, error: `未知指标: ${metric}` };
      return {
        success: true,
        data: {
          metric,
          label: data.label,
          value: data.value,
          trend: data.trend,
          time_range: args.time_range || "all"
        }
      };
    }
    case "query_table_data": {
      const tableName = args.table_name;
      const tableSchema = mockTableSchemas[tableName];
      if (!tableSchema) return { success: false, error: `未知表: ${tableName}` };
      let fields = tableSchema.fields;
      if (args.fields && args.fields.length > 0) {
        fields = fields.filter(f => args.fields.includes(f.prop));
      }
      return {
        success: true,
        data: {
          table_name: tableName,
          table_label: tableSchema.table_label,
          fields
        }
      };
    }
    case "get_form_config": {
      const formType = args.form_type;
      const config = mockFormConfigs[formType];
      if (!config) return { success: false, error: `未知表单类型: ${formType}` };
      return {
        success: true,
        data: {
          form_type: formType,
          fields: config.fields
        }
      };
    }
    case "get_page_recommendation": {
      const domain = args.business_domain;
      const scale = args.scale || "medium";
      const recommendations = {
        "电商": [
          { pageName: "商品管理", pageType: "list", reason: "核心业务数据管理" },
          { pageName: "订单管理", pageType: "dashboard", reason: "订单监控和数据分析" },
          { pageName: "新增商品", pageType: "form", reason: "商品录入" },
          { pageName: "用户管理", pageType: "list", reason: "用户数据管理" }
        ],
        "教育": [
          { pageName: "课程管理", pageType: "list", reason: "核心课程数据" },
          { pageName: "学员管理", pageType: "list", reason: "学员信息管理" },
          { pageName: "数据看板", pageType: "dashboard", reason: "教学数据分析" },
          { pageName: "课程发布", pageType: "form", reason: "新课程发布" }
        ],
        "医疗": [
          { pageName: "患者管理", pageType: "list", reason: "患者信息管理" },
          { pageName: "挂号管理", pageType: "list", reason: "挂号记录管理" },
          { pageName: "运营看板", pageType: "dashboard", reason: "医院运营数据" },
          { pageName: "预约挂号", pageType: "form", reason: "在线预约" }
        ],
        "OA": [
          { pageName: "员工管理", pageType: "list", reason: "员工信息管理" },
          { pageName: "部门管理", pageType: "list", reason: "部门组织架构" },
          { pageName: "审批中心", pageType: "dashboard", reason: "审批流程监控" },
          { pageName: "请假申请", pageType: "form", reason: "员工请假" }
        ]
      };
      const pages = recommendations[domain] || [
        { pageName: `${domain}管理`, pageType: "list", reason: "核心数据管理" },
        { pageName: `${domain}看板`, pageType: "dashboard", reason: "数据分析" },
        { pageName: `新增${domain}`, pageType: "form", reason: "数据录入" }
      ];
      if (scale === "large") {
        pages.push({ pageName: "系统设置", pageType: "form", reason: "系统配置" });
      }
      return { success: true, data: { business_domain: domain, scale, recommended_pages: pages } };
    }
    default:
      return { success: false, error: `未知工具: ${name}` };
  }
}

const SYSTEM_PROMPT_TOOL = `
你是一个智能前端页面生成器，拥有调用业务工具的能力。

当你需要生成页面时，请先调用合适的工具获取真实业务数据，然后基于工具返回的数据生成更准确的页面Schema。

可用工具：
1. query_database_stats - 查询数据库统计信息（用于仪表盘统计卡片）
2. query_table_data - 查询数据表结构（用于列表页字段定义）
3. get_form_config - 获取表单推荐配置（用于表单页字段定义）
4. get_page_recommendation - 获取页面推荐方案（用于项目级生成）

工作流程：
1. 分析用户需求，判断需要哪些业务数据
2. 在一次回复中并行调用所有需要的工具（不要逐个调用）
3. 基于工具返回的真实数据生成页面Schema

重要：你必须先调用工具获取数据，再生成最终结果。不要凭空编造数据。尽量在一次回复中调用所有需要的工具，避免逐个调用。

返回格式要求：生成最终结果时，必须返回纯JSON对象（不要包含markdown代码块标记），包含以下字段：
{
  "pageName": "页面名称",
  "pageType": "dashboard 或 list 或 form",
  "components": [
    { "type": "statCards", "cards": [{ "title": "标题", "prop": "属性名", "icon": "图标", "color": "颜色", "value": 数值, "trend": "趋势如+12.5%", "suffix": "单位如元、%" }] }, 
    { "type": "searchForm", "fields": [{ "label": "标签", "prop": "属性名", "type": "input或select或date", "options": ["选项1"] }] },
    { "type": "table", "columns": [{ "label": "标签", "prop": "属性名", "width": 120 }] },
    { "type": "pagination", "total": 100 },
    { "type": "form", "fields": [{ "label": "标签", "prop": "属性名", "type": "input或select或date或textarea或number", "options": ["选项1"], "required": true, "placeholder": "提示" }] }
  ]
}

关键：statCards的每个card必须包含value和trend字段，值必须来自工具返回的真实数据，不要编造。例如工具返回{value:12846,trend:"+12.5%"}，则card中写"value":12846,"trend":"+12.5%"。

注意：components中的type必须是以下之一：statCards、searchForm、table、pagination、form。不要使用其他类型名。
`;

app.post("/generate-with-tools", async (req, res) => {
  try {
    const { prompt } = req.body;
    const config = getProviderConfig(req.body);
    const toolCallsLog = [];

    const messages = [
      { role: "system", content: SYSTEM_PROMPT_TOOL },
      { role: "user", content: prompt }
    ];

    const maxRounds = 10;

    for (let round = 0; round < maxRounds; round++) {

      // ---- 构建请求 ----
      const isDeepseek = config.provider === "deepseek";
      const requestUrl = isDeepseek
        ? `${config.baseUrl}/chat/completions`
        : `${config.baseUrl}/api/chat`;
      const requestHeaders = {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
      };
      const requestBody = isDeepseek
        ? { model: config.model, messages, tools: toolDefinitions, tool_choice: "auto", stream: false }
        : { model: config.model, messages, stream: false, format: structuredPageSchema };

      // ---- 调用 AI ----
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(500).json({
          success: false,
          error: `API returned ${response.status}`,
          detail: text
        });
      }

      const result = await response.json();

      // ---- DeepSeek：支持工具调用的多轮循环 ----
      if (isDeepseek) {
        const message = result.choices?.[0]?.message;
        if (!message) {
          return res.json({ success: false, error: "AI 未返回有效响应" });
        }

        console.log(`Round ${round}: tool_calls=${!!message.tool_calls}, finish_reason=${result.choices?.[0]?.finish_reason}, content_length=${(message.content || "").length}`);
        if (message.tool_calls) {
          console.log(`  Tool calls: ${message.tool_calls.map(tc => tc.function.name).join(", ")}`);
        }

        // 将 AI 回复加入上下文（包含 tool_calls 或 content）
        messages.push(message);

        // 如果 AI 请求调用工具，执行工具并继续下一轮
        if (message.tool_calls && message.tool_calls.length > 0) {
          for (const toolCall of message.tool_calls) {
            const toolName = toolCall.function.name;
            let toolArgs;
            try {
              toolArgs = JSON.parse(toolCall.function.arguments);
            } catch {
              toolArgs = {};
            }

            const toolResult = executeToolCall(toolName, toolArgs);
            console.log(toolResult, 'toolResult====》')

            toolCallsLog.push({ name: toolName, args: toolArgs, result: toolResult });

            // 将工具结果加入上下文，供下一轮 AI 参考
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult)
            });
          }
          continue;
        }

        // AI 没有调用工具，说明已经生成最终答案
        return res.json({
          success: true,
          data: buildPageResult(message.content || "", toolCallsLog),
          toolCalls: toolCallsLog
        });
      }

      // ---- Ollama：不支持工具调用，直接解析结果 ----
      const content = parseAIResponse(result, "ollama");
      return res.json({
        success: true,
        data: buildPageResult(content, toolCallsLog),
        toolCalls: toolCallsLog
      });
    }

    // 超过最大轮次仍未生成最终答案
    res.json({ success: false, error: "工具调用轮次超限", toolCalls: toolCallsLog });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 将 AI 返回的文本内容解析为页面数据
 * 支持单页面和项目级（多页面）两种格式
 */
function buildPageResult(content, toolCallsLog) {
  const parsed = extractJSON(content);
  if (!parsed) {
    return { raw: content };
  }

  // 项目级：包含多个页面
  if (parsed.pages && Array.isArray(parsed.pages)) {
    const pages = parsed.pages.map(p => buildComponents(p));
    return { projectName: parsed.projectName, pages };
  }

  // 单页面
  return buildComponents(parsed);
}

app.get("/tools", (req, res) => {
  res.json({
    success: true,
    tools: toolDefinitions.map(t => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters
    }))
  });
});

app.listen(3001, () => {
  console.log("server running on port 3001");
});
