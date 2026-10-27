# AI 接口 v1

在家长管理 → AI 接入令牌中创建令牌。选择只读或管理权限，有效期 1～365 天；完整令牌仅显示一次。可以随时撤销。数据库仅保存 SHA-256 摘要，JSON 导出不含令牌信息。令牌允许访问此家庭全部孩子，管理令牌也允许审核和积分操作，请按实际需要授权。

基础地址：`http://NAS的IP:3000/api/ai/v1`。仅接受 `Authorization: Bearer <令牌>`，不接受 URL 参数或家长 Cookie 代替令牌。HTTP 会明文传输令牌，请限受信任的家庭网络使用；远程接入使用 HTTPS 或 VPN。

## 查询

`GET /state`：返回孩子列表、默认孩子的今日任务、活动、积分流水、余额、周目标和奖励。使用 `GET /state?child=<孩子ID>` 查询指定孩子。无论是否只读，查询可能按安排生成今日任务，但不会完成打卡或发分。

```bash
curl http://NAS的IP:3000/api/ai/v1/state \
  -H "Authorization: Bearer $GROWTH_AI_TOKEN"
```

## 修改

管理令牌可使用以下 POST 接口，JSON 请求体都需包含 `child`。`id` 从查询结果中获取。

| 路径 | 其他请求字段 |
| --- | --- |
| /activity | title, icon, points（0～1000）, days（0 周日至 6 周六数组）, period（早晨/放学后/晚上/自由时间）, review（布尔） |
| /edit-activity | id（活动ID）以及与创建活动相同的全部字段 |
| /move-activity | id（活动ID）, direction（up/down）；调整该孩子的活动顺序，任务按时段分组后使用此顺序 |
| /delete-activity | id（活动ID）；移除活动安排与今天尚未完成的任务，保留待审核、已完成和积分历史 |
| /delete-reward | id（奖励ID）；停止提供新兑换，保留已有兑换申请和历史 |
| /toggle | id（活动ID）；切换暂停/启用 |
| /complete | id（今日任务ID）；以家长权限直接确认并计分 |
| /task | id（任务ID）, operation（withdraw/approve/reject/undo） |
| /goal | goal（1～100000） |
| /bonus | points（1～1000）, reason |
| /reward | title, icon, cost（1～100000） |
| /redeem | id（奖励ID）；申请并冻结积分 |
| /redemption | id（兑换申请ID）, operation（approve/reject/deliver/refund） |

所有写请求必须带 `Idempotency-Key` 头（1～100 字符）。每个新操作生成不同的 UUID；重试同一操作必须复用原编号和完全相同的请求体。相同编号和内容只执行一次，返回 `{"ok":true,"replayed":true}`；同一编号用于不同内容返回 409。记录持久化并与令牌绑定，服务重启后仍有效。

```bash
curl -X POST http://NAS的IP:3000/api/ai/v1/complete \
  -H "Authorization: Bearer $GROWTH_AI_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 每次新操作生成的UUID" \
  -d '{"child":"孩子ID","id":"任务ID"}'
```

成功响应 `{"ok":true}`。随后重新查询 /state 获取生成对象的 ID 和更新状态。错误响应 `{"error":"说明"}`，401 表示令牌无效/过期/撤销，403 表示权限不足，400 表示请求不合法，409 表示重复编号冲突。

AI 接口不开放家庭初始化、登录、令牌管理和数据导出。写请求记录令牌 ID、动作、孩子、请求摘要和操作时间；不记录完整令牌。活动撤销等操作的影响与 WebUI 一致。
