// src/config/tools.ts
export const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description:
        "Get current temperature for provided coordinates in celsius.",
      parameters: {
        type: "object",
        properties: {
          latitude: { type: "number" },
          longitude: { type: "number" },
        },
        required: ["latitude", "longitude"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];
export const claudeTools = [
  // there is tool schema
  {
    name: "get_weather",
    description: "获取指定位置的当前天气",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "城市和州，例如 San Francisco, CA",
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "温度单位，'celsius' 或 'fahrenheit'",
        },
      },
      required: ["location", "unit"],
    },
  },
  {
    name: "get_time",
    description: "获取指定时区的当前时间",
    input_schema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "IANA 时区名称，例如 America/Los_Angeles",
        },
      },
      required: ["timezone"],
    },
  },
];
// Mock tool implementations
export const toolImplementations = {
  get_weather: async (params: any) => {
    return {
      temperature: -9,
      precipitationProbability: "0%",
      humidity: "27%",
      windSpeed: "10 公里/时",
      condition: "晴朗",
    };
  },
};
