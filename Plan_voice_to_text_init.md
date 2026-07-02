# 语音转文字功能初始计划

## 目标

给 idol 发布的语音消息增加一段可选的文字稿。用户端在语音条旁边看到“转文字”按钮，点击后展开这段预设文字。

这个版本不做自动语音识别。它更像“语音消息的字幕备注”：idol 发送或后续编辑文字，用户按需查看。

## 当前关键事实

仓库当前没有“编辑消息”的完整链路：

1. `app/api/idol/messages/route.ts` 目前只有 `GET`、`POST`、`DELETE`。
2. `app/api/admin/messages/route.ts` 目前只有 `GET`、`POST`、`DELETE`。
3. `components/IdolConsole.tsx` 目前只有删除入口，没有编辑入口。

所以“idol 发送后修改文字稿”不能当作顺手扩展现有编辑接口，而是一个新增功能：需要新增服务端更新接口、idol 端编辑入口、保存状态和权限校验。

## 建议产品规则

1. 只有 `type = "voice"` 的消息支持转文字。
2. idol 上传语音时，可以填写“音频文字稿”，不填也可以正常发送语音。
3. 语音消息有文字稿时，用户端显示“转文字”按钮。
4. 用户点击“转文字”后，在语音条下方展开文字内容；再次点击收起。
5. 没有文字稿时，不显示按钮，避免用户点开空内容。
6. idol 端支持发送后修改文字稿，但这要作为独立新增能力实现。
7. idol 把文字稿清空后，用户端不再显示“转文字”按钮。
8. 暂不做历史版本记录。MVP 阶段把它当作可编辑说明文字即可。

## 数据库设计

新增字段：

```sql
alter table public.messages
add column if not exists voice_transcript text;
```

字段含义：

- `voice_transcript`：语音消息的人工文字稿。
- `null` 或空字符串：表示没有文字稿。
- 建议只在服务端写入和更新，浏览器不直接写 Supabase。

需要同步更新：

1. `supabase/schema.sql`
2. 新增迁移文件，例如 `supabase/voice-transcript.sql`
3. `lib/types.ts` 的 `ChatMessage`

## 服务端接口计划

### idol 上传语音

涉及文件：

- `app/api/idol/upload/route.ts`
- 如管理员旧入口仍在用，也同步检查 `app/api/admin/upload/route.ts`

计划：

1. 从 `FormData` 读取 `voiceTranscript`。
2. 仅当最终消息类型是 `voice` 时保存。
3. 做基础清理：
   - `trim()`
   - 空字符串转为 `null`
   - 限制长度，例如 2000 字符
4. 插入 `messages` 时写入 `voice_transcript`。

### 新增 idol 更新文字稿接口

涉及文件：

- `app/api/idol/messages/route.ts`
- 如管理员旧入口仍在用，也同步检查 `app/api/admin/messages/route.ts`

计划：

1. 新增 `PATCH` 方法，而不是假设已有编辑接口。
2. 请求体建议：

```json
{
  "id": "message-id",
  "voiceTranscript": "文字稿内容"
}
```

3. 调用 `requireIdol()` 获取当前 idol 身份。
4. 先查询目标消息，确认：
   - 消息存在
   - `idol_id` 等于当前 idol
   - `sender_kind = "admin"`
   - `type = "voice"`
5. 对 `voiceTranscript` 做基础清理：
   - `trim()`
   - 空字符串转为 `null`
   - 限制长度，例如 2000 字符
6. 只更新 `voice_transcript` 字段，不开放修改其他消息字段。
7. 返回更新后的 message，前端据此刷新列表或局部更新。

这个接口相当于给语音消息开一个很窄的小门：只能改文字稿，不能顺便改正文、媒体路径、归属 idol 或用户私信。

## idol 端界面计划

涉及文件：

- `components/IdolComposer.tsx`
- `components/IdolConsole.tsx`

### 发送时填写

1. 当选择“语音”附件后，在语音文件选择区下方展示一个可选文本框。
2. 文案建议：`音频文字稿（可选）`。
3. 上传时把内容作为 `voiceTranscript` 放进 `FormData`。
4. 发送成功后清空该输入框。

### 发送后编辑

这是新增 UI，不是修改已有编辑 UI。

1. 在 `IdolConsole.tsx` 的语音消息操作区增加“编辑文字稿”入口。
2. 点击后展开一个文本框，默认填入当前 `message.voice_transcript || ""`。
3. 提供“保存”和“取消”。
4. 保存时调用新增的 `PATCH /api/idol/messages`。
5. 保存中要禁用按钮，避免重复提交。
6. 保存成功后刷新消息列表，或用返回的 message 局部替换当前消息。
7. 清空并保存表示删除文字稿。
8. 非语音消息不显示这个入口。

## 用户端界面计划

涉及文件：

- `components/ChatBubble.tsx`
- 可能不需要改 `components/VoiceBubble.tsx`

计划：

1. 在语音气泡内部，让 `VoiceBubble` 和“转文字”按钮并排或上下紧凑排列。
2. 只有 `message.voice_transcript?.trim()` 存在时显示按钮。
3. 点击按钮后，在语音条下方展开文字稿。
4. 展开区域使用聊天气泡内的小字号文本，支持换行和长词换行。
5. 按钮状态可在 `转文字` / `收起` 间切换。

## 样式建议

1. 按钮尽量小，避免抢语音播放按钮的位置。
2. 推荐放在语音条右侧或下方右对齐。
3. 展开文字不要做成大卡片，保持像聊天内容的一部分。
4. 对长文字使用 `whitespace-pre-wrap break-words`。

## 实施顺序建议

1. 先做数据库字段、类型和上传时保存文字稿。
2. 再做用户端“转文字”按钮和展开展示。
3. 最后做 idol 端发送后编辑，因为它需要新增 `PATCH` 接口和新增编辑 UI，工作量最大。

这样拆的好处是：第一、二步能先让“发语音时填写文字稿”跑通；第三步再补“发出后修改”，风险更容易控制。

## 验证清单

1. 数据库迁移后，旧语音消息仍能正常展示。
2. idol 上传无文字稿的语音，用户端不显示“转文字”按钮。
3. idol 上传有文字稿的语音，用户端显示按钮并可展开/收起。
4. idol 编辑文字稿后，用户刷新或自动轮询后看到新内容。
5. idol 清空文字稿后，用户端按钮消失。
6. 非当前 idol 不能修改其他 idol 的语音文字稿。
7. 用户私信不能通过该接口被修改。
8. 图片、GIF、实况、文本消息不受影响。
9. `npm run lint` 通过。
10. 如果涉及构建风险，再运行 `npm run build`。

## 暂不做的事

1. 不做自动语音识别。
2. 不做文字稿历史版本。
3. 不做用户端复制、搜索、翻译等扩展功能。
4. 不让前端直接写 Supabase。
5. 不做通用消息编辑系统；本次只做语音文字稿编辑。

## 后续可扩展方向

以后如果要接真正的语音识别，可以继续复用 `voice_transcript` 字段。流程可以升级为：系统自动生成初稿，idol 发送前确认或修改，再展示给用户。
