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
// Mock tool implementations
export const toolImplementations = {
  get_weather: async (params: any) => {
    return {
      temperature: 22,
      condition: "晴天",
      forecast: "未来两小时内天气晴朗",
    };
  },
};
