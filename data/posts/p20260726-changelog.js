/* 自动生成，请勿手改 */
window.__POST__ = {
  "id": "p20260726-changelog",
  "title": "更新日志：这个网站是怎么一步步长大的",
  "summary": "从修安全漏洞到加友链页，四轮升级的完整记录。以后每次大更新都会追加在这里。",
  "content": "<p>这个网站不是一天建成的。这篇记录它每一轮升级都改了什么 —— 以后每次大更新也会追加在这里，最新的排最上面。</p><h2>2026 年 7 月 26 日 · 第四轮：对标成熟博客</h2><p>去研究了一圈模范个人网站，把还缺的标配功能补齐了。</p><ul><li><strong>新增友链页</strong>：中文博客圈的老传统。朋友们的网站一人一张卡片，没头像会按名字自动配一个渐变色圆标；在后台网站设置里编辑</li><li><strong>全文搜索</strong>：首页搜索从「标题 + 标签」升级为<strong>连正文一起搜</strong>，索引在第一次搜索时才加载，平时不占流量</li><li><strong>回到顶部按钮</strong>：玻璃质感小圆钮，滚过一屏半才出现</li><li><strong>文末分享条</strong>：复制链接 + 调用系统分享面板</li><li><strong>小节锚点</strong>：悬停小标题出现 <code>#</code>，点击复制这一节的直达链接</li><li>正文里的站外链接自动在新标签页打开，不打断阅读</li></ul><h2>2026 年 7 月 26 日 · 第三轮：完整性打磨</h2><ul><li><strong>一键备份</strong>：后台新增「⤓ 备份」按钮，文字 + 图片打包成 zip 存进「备份」文件夹，自动保留最近 10 份</li><li><strong>搜索引擎优化补全</strong>：每篇文章的描述、分享卡片、规范链接、结构化数据全部动态生成；隐藏文章自动标记「不收录」</li><li><strong>手机主屏图标</strong>：加了 PWA 清单和苹果触摸图标，把网站「添加到主屏幕」后有正经图标</li><li><strong>无障碍</strong>：键盘用户按 Tab 会出现「跳到内容」快捷链接</li><li>后台侧栏底部新增全站统计：几篇文章、累计多少字，一眼看到</li></ul><h2>2026 年 7 月 26 日 · 第二轮：后台大升级 + 安全加固</h2><h3>后台更好用了</h3><ul><li>网站设置里的<strong>头像改成实时预览</strong>，点预览图直接上传</li><li>新增<strong>标签库编辑</strong>：写文章时推荐的备选词自己定</li><li>后台左上角显示真实的头像和站名，不再是写死的字</li></ul><h3>安全加固（为上传 GitHub 做准备）</h3><div class=\"todo done\"><input type=\"checkbox\" checked=\"\" disabled=\"\"><span class=\"todo-text\">后台密码加密算法从 SHA-256 升级为 <strong>scrypt</strong> —— 就算密码文件泄露，逐个试密码也贵得离谱；老密码首次登录自动无感迁移</span></div><div class=\"todo done\"><input type=\"checkbox\" checked=\"\" disabled=\"\"><span class=\"todo-text\"><strong>草稿不再生成公开文件</strong> —— 没发布的文章只活在底稿里，传到网上也不会泄露</span></div><div class=\"todo done\"><input type=\"checkbox\" checked=\"\" disabled=\"\"><span class=\"todo-text\">加了 <code>.gitignore</code> —— 用 git 上传时，密码文件、登录令牌、文章底稿自动跳过</span></div><div class=\"todo done\"><input type=\"checkbox\" checked=\"\" disabled=\"\"><span class=\"todo-text\">堵住了几个能绕过防线直接下载底稿的路径写法漏洞</span></div><h2>2026 年 7 月 26 日 · 第一轮：阅读体验</h2><ul><li><strong>代码块复制按钮</strong>：悬停出现，点一下整段拷走，触屏上常驻</li><li><strong>打印样式</strong>：⌘P 存 PDF 时自动去掉界面装饰，只留干净正文</li><li><strong>RSS 修图</strong>：填了正式网址后，订阅里的图片自动转成完整地址，阅读器里不裂图</li><li>分享到微信 / 群里时，每篇文章显示自己的标题和摘要，不再共用同一句话</li></ul><hr><div class=\"callout\"><span class=\"callout-emoji\">📌</span><div class=\"callout-body\">想看现在所有功能的完整清单，读上一篇<strong>《这个网站现在能做什么：功能全览》</strong>。</div></div>",
  "cover": "",
  "tags": [
    "工具",
    "思考"
  ],
  "date": "2026-07-26",
  "updated": "2026-07-26",
  "rtManual": false,
  "pinned": false,
  "status": "published",
  "hidden": true,
  "externalUrl": "",
  "words": 805,
  "readingTime": 2
};
