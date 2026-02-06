import type { OpenClawPluginApi } from "../../../src/plugins/types.js";
import { createAgentTraceTool } from "./src/agenttrace-tool.js";

export default function register(api: OpenClawPluginApi) {
  api.registerTool(createAgentTraceTool(api), { optional: true });
}
