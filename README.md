<p align="center">
  <img src="docs/images/github-cover.png" alt="今天麦什么：摇一签，让这一餐有点小惊喜。" width="100%" />
</p>

<h1 align="center">🍟 今天麦什么</h1>
<p align="center"><strong>不知道吃什么？摇一签，让薯条帮你选。</strong></p>
<p align="center">mcd-fortune-order · 128 条签文 · 手机 / 电脑</p>

把薯条盒变成签筒，给午饭加一点仪式感。

选好口味，摇出今天的餐点和一句签文。喜欢就加入购物车，不喜欢就换一份。

> **当前为演示版**：网页使用示例餐品和历史价格，购物车与下单均为模拟。仓库另附真实 MCP 查询脚本，尚未接入网页。

## 怎么玩

1. **选个心情**：今日放纵餐、清爽均衡餐，或来点小确幸。再勾选不想吃的东西，不用填预算。
2. **摇出一签**：薯条签筒摇起来，揭晓餐点、示例价格和今天的签文。
3. **自己拍板**：点「就吃这份」加入购物车，或点「换个口味」再摇一次。

## 有什么好玩的

- **128 条签文**：超级大吉、大吉、中吉、小吉，每一签都有一句话送给你。
- **抽签小舞台**：手绘风格的麦麦店铺、薯条签筒和出签动画。
- **大吉庆祝，小吉安慰**：大吉有金色闪光，小吉也有暖暖的陪伴。签的等级不影响餐点价格。
- **手机电脑都能玩**：手机竖着看，电脑并排看舞台和餐点。

> **超级大吉 · 今天你是主角**  
> 先选一份喜欢的，把吃饭时间留给自己。

| 大吉，一起庆祝 | 小吉，慢慢来也很好 |
|---|---|
| ![金色庆祝场景](public/art/shop-celebration.png) | ![温柔陪伴场景](public/art/shop-comfort.png) |

<details>
<summary>查看手机与电脑的界面设计稿</summary>

<img src="docs/images/responsive-design.png" alt="手机与电脑界面设计稿，非运行截图" width="100%" />

</details>

## 本地体验

安装 Node.js 22 或以上版本，下载项目后，在项目文件夹内打开本地 PowerShell：

```powershell
npm ci
npm run dev
```

打开终端显示的地址即可体验，无需麦当劳账号或 Token。

## 麦当劳 MCP 接入

项目提供单独的查询脚本，以**上海龙腾大道餐厅**为例，查询门店、菜单和套餐价格，再抽取签文。当前只支持两种指定套餐的默认搭配，不使用优惠券、不创建订单。

已验证真实连接和门店休息时的提示；完整的实时查价流程仍待营业时验证。接入细节见 [MCP_INTEGRATION.md](MCP_INTEGRATION.md)。

<details>
<summary>运行真实查询（需要自己的 MCP Token）</summary>

完成上面的依赖安装后，在本地 **PowerShell 7** 中运行：

```powershell
$env:MCD_MCP_TOKEN = Read-Host "输入自己的麦当劳 MCP Token" -MaskInput
npm run mcp:check
npm run mcp:draw
Remove-Item Env:MCD_MCP_TOKEN
```

`mcp:check` 检查连接，`mcp:draw` 查询门店和餐点。门店休息或查询失败时会停止。

Token 只在本机使用，不要上传到仓库。客户端配置示例见 [mcp-config.example.json](mcp-config.example.json)。

</details>

## 接下来

- 将真实菜单和价格接入网页。
- 支持优惠券、套餐调整和外送。
- 用户确认餐点与金额后，再进入真实下单。

产品与开发细节：[产品设计](docs/PRODUCT.md) · [界面设计](docs/DESIGN.md) · [技术架构](docs/ARCHITECTURE.md) · [验证记录](docs/VALIDATION.md)

## 说明

本项目为独立创意作品，非麦当劳官方产品。签文仅供娱乐，实际餐品、价格与优惠以官方结果为准。

原创代码采用 [MIT 许可](LICENSE)。插画为用户提供的生成素材；品牌标识、角色及相关图片不包含在代码许可内，详见[素材说明](docs/ASSETS.md)。参赛声明见 [CONTEST_DECLARATION.md](CONTEST_DECLARATION.md)。
