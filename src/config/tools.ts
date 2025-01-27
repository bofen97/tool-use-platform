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
      temperature: -9,
      precipitationProbability: "0%",
      humidity: "27%",
      windSpeed: "10 公里/时",
      condition: "晴朗",
    };
  },
};
