/**
 * COMPILE-TIME-ONLY stub for `openclaw/plugin-sdk/plugin-entry`.
 *
 * The real `openclaw` package is not vendored into this plugin directory;
 * this stub lets `tsc` type-check against the fields this plugin actually
 * uses. The emitted dist/index.js keeps the literal import specifier
 * `"openclaw/plugin-sdk/plugin-entry"` so the host gateway resolves it at
 * deploy time, exactly like progress-broadcast-guard.
 */

export interface PluginHookLlmOutputEvent {
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  resolvedRef?: string;
  harnessId?: string;
  prompt?: string;
  assistantTexts: string[];
  lastAssistant?: unknown;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
  reasoningEffort?: string;
  fastMode?: boolean;
}

export interface PluginHookGatewayStopEvent {
  reason?: string;
}

export interface PluginHookRegistrationOptions {
  priority?: number;
  timeoutMs?: number;
}

export interface PluginCommandContext {
  args?: string;
  commandBody: string;
  senderId?: string;
  channel?: string;
  isAuthorizedSender?: boolean;
  [key: string]: unknown;
}

export interface PluginCommandResult {
  text?: string;
  suppressReply?: boolean;
  continueAgent?: boolean;
  [key: string]: unknown;
}

export interface OpenClawPluginCommandDefinition {
  name: string;
  description: string;
  handler: (ctx: PluginCommandContext) => PluginCommandResult | Promise<PluginCommandResult>;
  acceptsArgs?: boolean;
  requireAuth?: boolean;
  [key: string]: unknown;
}

export interface OpenClawPluginApi {
  id: string;
  name: string;
  version?: string;
  pluginConfig?: Record<string, unknown>;
  logger?: {
    debug?: (...args: unknown[]) => void;
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
  on(
    hookName: "llm_output",
    handler: (event: PluginHookLlmOutputEvent) => void | Promise<void>,
    opts?: PluginHookRegistrationOptions
  ): void;
  on(
    hookName: "gateway_stop",
    handler: (event: PluginHookGatewayStopEvent) => void | Promise<void>,
    opts?: PluginHookRegistrationOptions
  ): void;
  registerCommand(command: OpenClawPluginCommandDefinition): void;
}

export interface OpenClawPluginDefinition {
  id: string;
  name: string;
  description: string;
  version?: string;
  register(api: OpenClawPluginApi): void;
}

export declare function definePluginEntry(
  def: OpenClawPluginDefinition
): OpenClawPluginDefinition;
