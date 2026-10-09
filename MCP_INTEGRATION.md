# 麦当劳 MCP 集成

## 状态与价值

2026-10-09已通过官方服务完成只读验证。网页目前使用演示适配器；仓库另包含可运行的本机只读入口`scripts/mcp-draw.mjs`，使用官方TypeScript/JavaScript SDK，不将Token交给浏览器。

## 当前可运行入口

`npm run mcp:check`实际调用`list-nutrition-foods`；`npm run mcp:draw`调用`query-nearby-stores`，确认门店营业后继续`query-meals`→`query-meal-detail`→`calculate-price`，完成核价后独立抽取128条签文。仅支持龙腾大道店两种已知主餐的当前默认配置，不做优惠券、偏好筛选或建单；没有有效结果就停止。

2026-10-09 23:45北京时间，新入口实际连接官方服务并成功读取营养表。随后查询龙腾大道店返回未营业，程序输出store-unavailable，未调用后续核价或订单。该闭店分支已实际验证；新入口的完整实时核价待营业时验证，之前21:37的报价属于较早的独立只读验证。

此实现保留了服务端返回的轮次编码，按实际quantity选默认项，携带特调selected/unselected key，并验证整数分金额。6项合同测试覆盖错误响应、默认项数量、特调、闭店短路、成功工具链与失败不回落样例价。工具白名单不包含create-order或其他写工具。

服务地址：`https://mcp.mcd.cn`；传输：Streamable HTTP；请求头：`Authorization: Bearer ${MCD_MCP_TOKEN}`。实际握手服务名`mcd-mcp`、版本1.0.0、协商协议2024-11-05、35个工具；运行时应重新协商，不把此快照当永久能力清单。

MCP让抽签不止返回随机餐名：推荐必须落到特定门店、真实配置、当前可用优惠和完整报价上。没有有效配置和报价，不能进入可购买结果。

## 工具与流程

| 工具 | 用途 | 当前验证 |
|---|---|---|
| `query-nearby-stores` | 选中门店 | 已验证上海龙腾大道搜索 |
| `query-meals` | 查询门店可选菜单及图片地址 | 已返回菜单；图片URL未全部加载验收 |
| `query-meal-detail` | 套餐轮次、选项、数量与特调 | 已验证3个商品 |
| `query-store-coupons` | 当前账户在店可用券 | 已查询；不是所有账户通用 |
| `list-nutrition-foods` | 营养资料 | 已返回，逐套餐规格匹配未完成 |
| `calculate-price` | 完整配置与券、费用核价 | 已验证4组报价 |
| `create-order` | 最终确认后创建订单 | schema已读取，未调用 |

配送地址/配送店和订单查询的准确工具名与schema见 `reference/mcp-tools-schema.json`。Kiro先依据schema实现stub合同测试；未完成真分支不得显示为实时成功。

```mermaid
sequenceDiagram
    actor U as 用户
    participant W as 网页
    participant S as 本地服务端
    participant M as 麦当劳MCP
    U->>W: 选择门店、方式、心情和偏好
    W->>S: 请求候选
    S->>M: 菜单、优惠、详情、营养
    M-->>S: 实际数据
    S->>S: 过滤、补齐套餐配置
    S->>M: calculate-price
    M-->>S: 价格与可用取餐方式
    S-->>W: 已核价的候选
    W->>W: 抽签动画与文案
    U->>W: 确认加入购物车
    W->>S: 加购并校验
    U->>W: 确认完整清单与最新金额
    W->>S: 一次性订单确认
    S->>M: create-order
    M-->>S: 订单与支付入口
    S-->>W: 待支付状态
```

## 已验证门店与金额

门店：麦当劳上海龙腾大道餐厅；地址：龙腾大道2121号巨无霸魔方1F2F；storeCode `1450398`。查询日期2026-10-09，北京时间21:33–21:37；当前供应与价格需再次查询。

到店：`beType=1`、`orderType=1`，不传配送`beCode`。搜索：`searchType=2`、城市上海、关键词龙腾大道；返回多店，必须核对名称地址，不能取第一条。

菜单125条、15分类，混有非食品、套餐与19个随单购标记项；不是125种可随意抽取的食物。营养返回160行、158不同名称，重复的小杯玉米和盒装牛奶一致。

| 主商品编码 | 配置摘要 | 当次价 |
|---|---|---:|
| 9900005466 | 1100巨无霸＋4810中薯＋3050中可乐 | 3750分 |
| 9900011128 | 1000汉堡＋515106鸡块4块＋6102苹果60g＋3071中无糖可乐 | 2800分 |
| 9900005466 | 1100巨无霸＋4437小玉米＋3071中无糖可乐 | 3650分 |
| 9900014239 | 草莓4900＋当时已有适用券 | 990分，原1400分 |

最后一组券在2026-10-09 23:59:59到期，仅作为条件优惠的历史例子；不附券ID/券码，也不做演示里人人默认享有的券。完整账户响应留在私人验证区，不进入本仓库。

## 实际发现的适配规则

1. `query-meals`类别引用code，商品在`data.meals`映射中；不能把类别或周边误作食物。所有餐品仍须解析当前门店详情。
2. 套餐`rounds`含id/minQuantity/maxQuantity/choices；quote请求使用`roundList[{round, comboItemList:[{code,quantity,modification?}]}]`，以所附schema为准。
3. `isDefault=1`不等于自动选中：麦旋风草莓与奥利奥都标default，但只有草莓quantity=1。须同时校验实际数量和轮次限制。
4. 特调的`selectedKey/unselectedKey/selectedQuantity`按字段要求传递，非空unselectedKey也不能省略。
5. `query-meals.currentPrice`为元字符串；大部分quote金额为整数分；`enjoyed/enjoyable.realDiscount`说明为元。逐字段归一化，禁止全体数字统一除100。
6. 巨无霸菜单原价50.50/现价37.50，quote原价与应付均37.50、discount0。不能把两种口径的差额重复叠加成“省了”。
7. `list-nutrition-foods.data`是紧凑表格文本，不是JSON数组；格式`[160]{productName,...}:\n...`。需解析并验证行数/列数/单位、重复行、名称和规格。无商品ID不能盲按近似名字join，营养表也不证明在售。
8. 本次quote返回`takeWayList`: eat-in（堂食店内用餐）、locker-in（外带店内柜）、locker-out（外带店外柜）。仅展示实际返回的可用项。
9. 外送需`beType=2`、`orderType=2`以及已匹配的addressId/beCode；不复用到店商品上下文。外送全流程尚未验证。
10. 没有独立购物车工具。本应用待购清单由服务端维护，不声称已写入官方App购物车。

## 凭证、模式与交易

配置模板只含环境变量占位符。服务端通过配置解析并持有Token，前端不可读取；未配置真实凭证时只能明确进入demo，不伪装实时。真实数据、Token、couponCode、地址、订单支付串不得提交到GitHub。

默认真实建单关闭。加购、换口味、动画结束均不触发建单；仅完整确认页的明确提交能够调用。建单成功与支付成功分别处理，超时未知结果不能自动重建。具体会话隔离、nonce与恢复规则见 [ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 证据与复现

此包包含实际工具schema的所需子集、已脱敏的设计参考，不包含个人账户响应或有效凭据。历史只读结果的原始证据由项目所有者私下留存。Kiro交付后要在应用里重新跑一个单品和一个套餐的查询—详情—核价—加购，并记录不含个人资料的结果，才能升级为“应用集成已验证”。

参考：[官方 MCP 使用说明](https://github.com/M-China/mcd-mcp-server)、[官方活动规则](https://github.com/M-China/mcd-developer-innovation-challenge/blob/main/activityGuidelines.md)。
