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
          latitude: {
            type: "number",
            description: "The latitude of the location",
          },
          longitude: {
            type: "number",
            description: "The longitude of the location",
          },
        },
        required: ["latitude", "longitude"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "write_content_to_file",
      description: "Write a content to a file",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The content to write to the file",
          },
          file_path: {
            type: "string",
            description: "The path to the file to write to",
          },
        },
        required: ["content", "file_path"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];
export const claudeTools = [
  {
    name: "get_weather",
    description: "Get the current weather in a given location",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "The city and state, e.g. San Francisco, CA",
        },
      },
      required: ["location"],
    },
  },
  {
    name: "write_content_to_file",
    description: "Write a content to a file",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The content to write to the file",
        },
        file_path: {
          type: "string",
          description: "The path to the file to write to",
        },
      },
      required: ["content", "file_path"],
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
  write_content_to_file: async (params: any) => {
    console.log("write_content_to_file", params);
    return {
      success: true,
    };
  },
};
