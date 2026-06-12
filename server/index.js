import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";

import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_KEY || "";
const BASE_URL = process.env.BASE_URL || "http://localhost:11434";
const MODEL = process.env.MODEL || "qwen2.5:7b";

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

function buildComponents(parsed) {
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

app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    console.log("Received prompt:", prompt);

    const headers = {
      "Content-Type": "application/json",
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {})
    };

    const response = await fetch(
      `${BASE_URL}/api/chat`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: MODEL,
          format: structuredPageSchema,
          stream: false,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ]
        })
      }
    );

    console.log("API response status:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("API error response:", text);
      return res.status(500).json({
        success: false,
        error: `API returned ${response.status}`,
        detail: text
      });
    }

    const result = await response.json();
    const content = result.message.content;

    let parsed;
    try {
      parsed = StructuredPageZodSchema.parse(JSON.parse(content));
    } catch (e) {
      console.error("Zod parse error:", e.message);
      parsed = { raw: content };
    }

    if (parsed.raw) {
      return res.json({ success: true, data: parsed });
    }

    res.json({ success: true, data: buildComponents(parsed) });
  } catch (error) {
    console.error("API Error:", error);
    console.error("Error cause:", error.cause);

    res.status(500).json({
      success: false,
      error: error.message,
      cause: error.cause?.message || undefined
    });
  }
});

app.post("/generate/stream", async (req, res) => {
  try {
    const { prompt } = req.body;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const headers = {
      "Content-Type": "application/json",
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {})
    };

    const response = await fetch(
      `${BASE_URL}/api/chat`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: MODEL,
          format: structuredPageSchema,
          stream: true,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ]
        })
      }
    );

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

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim());
        const token = parsed.message?.content || "";
        if (token) {
          fullContent += token;
          res.write(`data: ${JSON.stringify({ token, fullContent })}\n\n`);
        }
      } catch {}
    }

    let result;
    try {
      const schemaParsed = StructuredPageZodSchema.parse(JSON.parse(fullContent));
      result = { success: true, data: buildComponents(schemaParsed) };
    } catch {
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

    const headers = {
      "Content-Type": "application/json",
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {})
    };

    const response = await fetch(
      `${BASE_URL}/api/chat`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: MODEL,
          format: structuredPageSchema,
          stream: false,
          messages: [
            { role: "system", content: SYSTEM_PROMPT_ITERATE },
            {
              role: "user",
              content: `当前页面JSON：\n${JSON.stringify(currentSchema, null, 2)}\n\n修改需求：${instruction}`
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({
        success: false,
        error: `API returned ${response.status}`,
        detail: text
      });
    }

    const result = await response.json();
    const content = result.message.content;

    let parsed;
    try {
      parsed = StructuredPageZodSchema.parse(JSON.parse(content));
    } catch (e) {
      console.error("Iterate Zod parse error:", e.message);
      return res.json({ success: true, data: { raw: content } });
    }

    res.json({ success: true, data: buildComponents(parsed) });
  } catch (error) {
    console.error("Iterate API Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post("/iterate/stream", async (req, res) => {
  try {
    const { currentSchema, instruction } = req.body;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const headers = {
      "Content-Type": "application/json",
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {})
    };

    const response = await fetch(
      `${BASE_URL}/api/chat`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: MODEL,
          format: structuredPageSchema,
          stream: true,
          messages: [
            { role: "system", content: SYSTEM_PROMPT_ITERATE },
            {
              role: "user",
              content: `当前页面JSON：\n${JSON.stringify(currentSchema, null, 2)}\n\n修改需求：${instruction}`
            }
          ]
        })
      }
    );

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

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim());
        const token = parsed.message?.content || "";
        if (token) {
          fullContent += token;
          res.write(`data: ${JSON.stringify({ token, fullContent })}\n\n`);
        }
      } catch {}
    }

    let result;
    try {
      const schemaParsed = StructuredPageZodSchema.parse(JSON.parse(fullContent));
      result = { success: true, data: buildComponents(schemaParsed) };
    } catch {
      result = { success: true, data: { raw: fullContent } };
    }

    res.write(`data: ${JSON.stringify({ done: true, result })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Iterate Stream API Error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.post("/analyze-fields", async (req, res) => {
  try {
    const { columns } = req.body;

    const headers = {
      "Content-Type": "application/json",
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {})
    };

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

    const response = await fetch(
      `${BASE_URL}/api/chat`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: MODEL,
          format: fieldAnalysisSchema,
          stream: false,
          messages: [
            {
              role: "system",
              content: "你是字段分析器。分析给定字段列表，返回每个字段的语义类型。"
            },
            {
              role: "user",
              content: JSON.stringify(columns)
            }
          ]
        })
      }
    );

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: `API returned ${response.status}`
      });
    }

    const result = await response.json();
    const content = result.message.content;

    res.json({
      success: true,
      data: JSON.parse(content)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3001, () => {
  console.log("server running on port 3001");
});
