# pi-cache-optimizer-port

OpenClaw 插件:DeepSeek/OpenAI/Anthropic 缓存命中统计(pi-cache-optimizer 算法移植)。

记录每次 LLM 调用的 prompt-cache 命中/未命中 token,落盘 + 命令可查,帮你看清真实缓存命中率(不依赖任何核心补丁,自己解析 llm_output 原始 usage)。

## 功能

- **缓存统计**:llm_output 钩子记录每次调用的缓存命中/未命中输入 token,按 provider/model 汇总
- **落盘**:`~/.openclaw/pi-cache-optimizer-stats.json`(2s 防抖 + 原子写 + 文件锁,多写者安全)
- **命令**:`cache-optimizer-stats` 展示汇总(请求命中率 / 命中 token / 预估节省)
- **多 provider**:DeepSeek(原生 `prompt_cache_hit_tokens`)、OpenAI(`cached_tokens`)、Anthropic(`cache_read_input_tokens`)均支持

## 安装

```bash
openclaw plugins install pi-cache-optimizer-port
```

或手动:复制插件目录到 `~/.openclaw/local-plugins/pi-cache-optimizer-port/`,并在 openclaw.json 注册:

```jsonc
{
  "plugins": {
    "allow": ["pi-cache-optimizer-port"],
    "load": {
      "paths": ["/home/<user>/.openclaw/local-plugins/pi-cache-optimizer-port"]
    },
    "entries": {
      "pi-cache-optimizer-port": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true }
      }
    }
  }
}
```

> ⚠️ `openclaw.plugin.json` 需同时放在插件根目录和 `src/` 下(目录含 `src/` 会触发源码布局解析)。

## 查看命中率

```bash
cat ~/.openclaw/pi-cache-optimizer-stats.json
# 或
openclaw plugin exec cache-optimizer-stats
```

示例输出:

```json
{
  "totalsByModel": {
    "deepseek/deepseek-v4-flash": {
      "totalRequests": 16, "hitRequests": 16,
      "cachedInputTokens": 28835072, "totalInputTokens": 29600000
    }
  }
}
```

## 配置(可选)

| 配置项 | 默认 | 说明 |
|---|---|---|
| `enabled` | true | 总开关 |
| `collectStats` | true | 是否采集统计 |
| `statsPath` | `~/.openclaw/pi-cache-optimizer-stats.json` | 统计文件路径 |
| `debounceMs` | 2000 | 落盘防抖毫秒 |

## 配套建议

配合 DeepSeek 使用效果最佳:在 provider compat 加 `"supportsPromptCacheKey": true`(DeepSeek 是 OpenAI 兼容端点,OpenClaw 不会自动检测,必须手动声明),缓存命中率实测可达 95%+。详见《OpenClaw × DeepSeek 调用优化指南》。

## 开发

```bash
npm run build   # tsc 编译 src → dist
npm test        # node --test test/
```

## License

MIT
