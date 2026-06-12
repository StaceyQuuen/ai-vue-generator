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

const StructuredPageZodSchema = z.object({
  pageName: z.string(),
  searchForm: z.object({
    fields: z.array(SearchFormFieldSchema)
  }),
  table: z.object({
    columns: z.array(TableColumnSchema)
  }),
  pagination: z.object({
    total: z.number().optional()
  })
});

const structuredPageSchema = {
  type: "object",
  properties: {
    pageName: {
      type: "string",
      description: "页面名称，如用户管理、订单管理"
    },
    searchForm: {
      type: "object",
      description: "搜索表单，包含2-4个搜索字段",
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
      description: "数据表格，包含4-8个列",
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
      description: "分页组件",
      properties: {
        total: { type: "number", description: "总条数，默认100" }
      }
    }
  },
  required: ["pageName", "searchForm", "table", "pagination"]
};

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
            {
              role: "system",
              content: SYSTEM_PROMPT
            },
            {
              role: "user",
              content: prompt
            }
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
      return res.json({
        success: true,
        data: parsed
      });
    }

    const components = [
      { type: "searchForm", fields: parsed.searchForm.fields },
      { type: "table", columns: parsed.table.columns },
      { type: "pagination", total: parsed.pagination.total || 100 }
    ];

    res.json({
      success: true,
      data: {
        pageName: parsed.pageName,
        components
      }
    });
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
            {
              role: "system",
              content: SYSTEM_PROMPT
            },
            {
              role: "user",
              content: prompt
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
      const components = [
        { type: "searchForm", fields: schemaParsed.searchForm.fields },
        { type: "table", columns: schemaParsed.table.columns },
        { type: "pagination", total: schemaParsed.pagination.total || 100 }
      ];
      result = { success: true, data: { pageName: schemaParsed.pageName, components } };
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
