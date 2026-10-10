# 开发设计与边界

> 当前实现已增加 `server/` 和网页真实适配器。凭据可从服务端环境变量读取，也可经本机连接页提交，仅保留在服务内存。真实订单路由未实现；完整状态与已实现的会话、购物车规则见 [MCP 集成说明](../MCP_INTEGRATION.md)。以下为设计基线，不能把规划的接口当作已完成。

设计选择，不是已实现功能。Kiro负责实现；不要为此引入云服务、数据库、账号平台或付费模型。

## 最小技术方案

TypeScript统一类型，React＋Vite构建浏览器UI；Node.js＋轻量HTTP服务提供业务API与MCP适配。正式包版本由Kiro锁定，Codex安装与运行后记录，不在设计稿猜最新版。采用官方TypeScript MCP SDK的Streamable HTTP客户端，禁止手写万能转发接口。

建议目录：`src/` UI；`server/` HTTP与MCP适配；`shared/`模型；`data/`已审核的签文与演示资料；`tests/`行为测试；`public/art/`插画。不沿用ESP32/C代码构架。测试建议Vitest＋Playwright，是否安装由实际锁文件决定。

首版运行形态：

1. **公开演示**：只有可公开的演示数据，真实订单路由关闭，浏览器不能切换成开发者账户。
2. **个人本地**：服务绑定127.0.0.1，Token仅从服务端环境读入。用户自行连接本人Token。若要跨设备真实访问，需要另行设计HTTPS与鉴权；不能直接把本地服务开放到公网或局域网当作已安全上线。
3. 公共多用户真实账户/Token托管不在本轮；不得共享单个环境Token给所有访客。

## 应用API

业务路由代替任意MCP工具调用。所有ID、数量、枚举、数组长度在服务端验证，客户端金额完全不可信。

| 路由意图 | 实际行为 |
|---|---|
| 获取模式能力 | 返回demo/live、外送是否实现、建单开关；不返回Token |
| 门店搜索/配送地址选择 | 只使用对应工具；地址只留服务端会话与必要展示 |
| 准备幸运餐 | 根据context和偏好获取候选，完整核价，返回opaque候选ID |
| 揭晓/换口味 | 对已验证候选抽样，返回签文和候选；服务器不靠客户端价钱 |
| 微调并核价 | 检查允许的round配置，失效旧候选，产生新报价 |
| 加购/改量/删除 | 服务端维护版本清单，核价后返回已确认清单 |
| 订单预览 | 按当前购物车重验、重价，产生短期一次性确认凭据 |
| 创建订单 | 验证会话、购物车版本、金额、方式和确认凭据后建单 |
| 订单状态 | 仅查询当前会话所持订单，映射官方实际状态 |

本地模式也校验Origin/Host与会话/CSRF，CORS不是鉴权；禁止跨站页面向本地建单。请求体限大小、写操作限频。Token、Authorization、cookie、地址、手机号、couponCode、支付URL查询串及MCP原始响应均不写默认日志。

## 核心模型

`Context`：mode、storeCode、beType、orderType、addressRef?、beCode?、revision。切门店/方式/地址递增版本，异步旧结果只可丢弃。

`Preference`：mood(`treat|balanced|snack`)、exclusions、revision。没有budget。

`FoodAttribute`：name、value(true/false/unknown)、source、spec、checkedAt。营养单位明确，不把每100g值与每份值混算。

`MealConfiguration`：productCode、quantity、roundList、modification、couponRef?。couponRef是会话内引用，原始券码不发前端。正式名称/图片由匹配到的真实商品返回。

`Quote`：id、contextRevision、cartVersion、configurationHash、amountsInFen、calculatedAt、softExpiresAt、takeWays、couponSummary。采用整数分计算内部金额，接口单位在边界逐字段转换。建议本地软过期2分钟（产品保守策略，非官方有效期承诺），结算前无论时间是否到均重新核价。

`Cart`：version、context、lines、quote、status(`valid|needs_refresh|pricing|invalid`)。前端只缓存无个人资料的偏好与演示清单；真实购物车以服务端为准，重启后要求重新确认。不把地址或券码放localStorage。

`Fortune`：稳定id、grade、title、message、scene。与商品编码、价格、优惠无耦合。

## 有副作用动作的保证

加购去重：每次用户明确“确认加入”生成actionId，服务端短期记录结果；重复请求返回相同结果。新一次主动确认才增加数量。合并键包含商品、完整配置、券适用语义；券数量约束必须重新计算，不无限复制一张券。

建单：

1. 订单预览绑定清单hash、context、报价、取餐方式与会话。
2. 一次性确认nonce，过期/已用/上下文变动即拒绝；按钮禁用之外服务端也锁定。
3. `LIVE_ORDER_ENABLED`默认false。即使true，必须由本次页面确认。
4. 调用前以最小化本地journal记录attemptId与pending，不存凭证/地址/支付串；调用成功记录orderId并标为created。journal在gitignore，权限仅本地用户。
5. 若网络超时或进程中断，不知道服务端是否受理：保留unknown，禁止自动重发；有orderId就查状态，没有就提示在官方订单渠道核对。没有真实服务端幂等支持时不能声称exactly-once。
6. 确认nonce和attempt锁不能因刷新网页失效后重新自动建单；重启读取journal后保守恢复未知状态。

支付链接仅采用官方实际响应的https地址，检查结构和经官方来源确认的允许域名；不得猜域名白名单导致官方合法链接失败，更不得允许javascript/data任意URL。新开页使用noopener/noreferrer。创建成功不是支付成功，返回页也不是支付证明。

## MCP处理

见根目录 `MCP_INTEGRATION.md` 和 `reference/mcp-tools-schema.json`。只提供所需工具schema，不接入其他账户工具/积分/企业功能。MCP调用须同时检查协议错误和业务code，不以HTTP200认定业务成功。初始化失败、会话失效要有有限重连；只读可指数退避，建单不可通用重试。

只读菜单与详情可以同会话缓存；带券/地址的响应不进入公共缓存。storeCode、业务模式、时间等均为缓存键。过期券、停售和报价差异以新核价为准。

## 推荐可解释性

保留candidate生成原因，但不保存用户画像。演示数据明确为fixture；真实模式数据不足只能展示不足，不偷偷降级到样例。用小型可审计规则产生理由，无须LLM推断热量/商品属性。

模式之间不以价格作准入条件，等级与候选选择分别随机。排除条件与属性unknown规则先行。候选集合小于3是正常状态，不补伪造产品。

## 故障与交付

必须实现加载、空、错误、过期、结果未知等状态。边界测试用工具stub，不接真实账户、不消费券、不创建真实订单。Kiro不能因没有Token就把真模式伪装为完成；它可以完成适配器与合同测试，真实集成由Codex后续单独验收。
