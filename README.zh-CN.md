[English](https://github.com/shezw/llm-translate-vsc-plugin/blob/main/README.md) | 简体中文

# LLM Translate

LLM Translate 是一个 VS Code 扩展，用于通过可配置的本地或远程 LLM 翻译工作区文件。

## 功能概览

- 为支持的文件类型在编辑器标题栏添加翻译图标。
- 如果编辑器标题栏图标无法提供下拉菜单，则会使用配置中的默认目标语言。
- 右键菜单支持二级菜单，可按文件选择翻译到简体中文、英语、德语、法语、日语或韩语。
- 如果当前文件在默认目标语言下已经存在翻译缓存，则图标切换为刷新。
- 对 Markdown、MDX、TXT、RST、AsciiDoc 等文档类文件执行全文翻译。
- 对代码类文件只提取注释和文档块内容，再分批发送给 LLM 翻译，最后回填到原文件中。
- 将 md5 缓存文件和翻译产物存放在可配置目录中，默认路径为 `~/llm-translate/<user>/`。
- 翻译执行期间会在侧边打开预览窗口，并在完成后刷新内容。

## 缓存和输出

对于工作区中的源文件，扩展会在配置的缓存目录下写入：

- `$cacheRoot/$user/$pwd_$file_$lang.hash`
- `$cacheRoot/$user/$pwd_$file_$lang_llm-trans.$ext`

`.hash` 文件存储当前源文件内容的 md5。当 md5 未变化且翻译结果已存在时，扩展会直接复用缓存，不再请求 LLM。

## 翻译模式

### 文档模式

对整个文档做格式保持型翻译。

当前支持：

- `.md`
- `.markdown`
- `.mdx`
- `.txt`
- `.rst`
- `.adoc`

### 代码模式

只抽取注释内容进行翻译，不会把整个源文件发给模型。扩展内置了常见文件类型的注释规则字典。

当前包括：

- `.c`, `.h`, `.cpp`, `.hpp`, `.cc`, `.hh`
- `.js`, `.jsx`, `.ts`, `.tsx`
- `.java`, `.go`, `.rs`, `.swift`, `.kt`, `.kts`
- `.py`, `.sh`, `.rb`
- `.sql`, `.lua`
- `.html`, `.xml`, `.svg`, `.vue`
- `.css`, `.scss`, `.less`
- `.yaml`, `.yml`, `.toml`, `.ini`, `.conf`, `.properties`

## 配置

在 VS Code 设置中搜索 `LLM Translate`。

必填项：

- `llmTranslate.endpoint`
- `llmTranslate.model`

可选项：

- `llmTranslate.provider`
- `llmTranslate.defaultTargetLanguage`
- `llmTranslate.authMode`
- `llmTranslate.authToken`
- `llmTranslate.authHeaderName`
- `llmTranslate.authHeaderValue`
- `llmTranslate.cacheRoot`
- `llmTranslate.requestTimeoutMs`
- `llmTranslate.temperature`

## 开发

```bash
pnpm install
pnpm exec tsc -p ./
```

在 VS Code 中按 `F5` 启动扩展开发宿主。

## 本地部署快速引导

1. 安装 LM Studio 或 Ollama。
2. 加载并运行一个 0.5B 到 8B 左右的模型，例如 `llama-translate 8B`。
3. 启动本地 API 服务。
4. 打开 VS Code 设置，在 LLM Translate 中填入对应的接口地址、模型名和鉴权方式。
5. 为标题栏按钮设置默认目标语言；如果某个文件临时要翻译到别的语言，可以使用右键 `LLM Translate` 二级菜单。

Ollama 示例：

```json
{
	"llmTranslate.provider": "ollama",
	"llmTranslate.endpoint": "http://127.0.0.1:11434/api/chat",
	"llmTranslate.model": "llama-translate:8b"
}
```

LM Studio 示例：

```json
{
	"llmTranslate.provider": "openai-compatible",
	"llmTranslate.endpoint": "http://127.0.0.1:1234/v1/chat/completions",
	"llmTranslate.model": "llama-translate-8b-instruct"
}
```

## 打包与发布

```bash
pnpm run package
```

发布到 Marketplace：

```bash
npx vsce publish
```

## 联系方式

- 邮箱：hello@shezw.com
- X：https://x.com/shezw_cn
