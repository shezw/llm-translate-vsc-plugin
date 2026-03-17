[English](https://github.com/shezw/llm-translate-vsc-plugin/blob/main/README.md) | 简体中文

# LLM Translate

LLM Translate 是一个 VS Code 扩展，用于通过可配置的本地或远程 LLM 翻译工作区文件。

## 功能概览

- 为支持的文件类型在编辑器标题栏添加翻译图标。
- 如果当前文件已经存在翻译缓存，则图标切换为刷新。
- 对 Markdown、MDX、TXT、RST、AsciiDoc 等文档类文件执行全文翻译。
- 对代码类文件只提取注释和文档块内容，再分批发送给 LLM 翻译，最后回填到原文件中。
- 将 md5 缓存文件和翻译产物存放在可配置目录中，默认路径为 `~/llm-translate/<user>/`。
- 翻译执行期间会在侧边打开预览窗口，并在完成后刷新内容。

## 缓存和输出

对于工作区中的源文件，扩展会在配置的缓存目录下写入：

- `$cacheRoot/$user/$pwd_$file.hash`
- `$cacheRoot/$user/$pwd_$file_llm-trans.$ext`

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

## 打包与发布

```bash
pnpm run package
```

发布到 Marketplace：

```bash
npx vsce publish
```
