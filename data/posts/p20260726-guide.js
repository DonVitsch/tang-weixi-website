/* 自动生成，请勿手改 */
window.__POST__ = {
  "id": "p20260726-guide",
  "title": "这个网站怎么用：写第一篇文章的完整指南",
  "summary": "从双击启动到发布上线，五分钟看完。顺便演示一下这个站支持的所有排版元素长什么样。",
  "cover": "",
  "tags": [
    "教程",
    "工具"
  ],
  "date": "2026-07-26",
  "updated": "2026-07-26",
  "readingTime": 2,
  "words": 976,
  "pinned": true,
  "status": "published",
  "externalUrl": "",
  "content": "<p>你正在看的这篇，就是用这个网站自带的后台写出来的。读完它，你就会用了。</p><h2>一、怎么把网站打开</h2><p>找到「唐维西的网站」这个文件夹，<strong>双击里面的「启动.command」</strong>。会弹出一个黑色的终端窗口，然后浏览器自动打开你的网站首页。</p><div class=\"callout\"><span class=\"callout-emoji\">⚠️</span><div class=\"callout-body\">那个黑色窗口<strong>别关</strong>。它就是网站的引擎，关掉网站就停了。写完东西再关。</div></div><p>第一次双击时，Mac 可能会提示「无法打开，因为来自身份不明的开发者」。解决办法：<strong>右键点这个文件 → 选「打开」→ 再点一次「打开」</strong>。只需要做这一次。</p><h2>二、怎么写文章</h2><p>网站首页的<strong>右下角</strong>有个「✍️ 写文章」按钮，点它就进后台了。</p><ul><li>左边是你所有的文章列表，草稿和已发布分开放</li><li>点左上角「新建文章」开始写新的</li><li>中间从上到下依次是：封面、标题、摘要、日期标签栏、正文</li></ul><h3>正文怎么排版</h3><p>这是最好玩的部分。在正文区域<strong>输入一个斜杠 <code>/</code></strong>，会弹出一个菜单，里面有标题、列表、引用、代码块、图片、表格等等，上下键选，回车确认。</p><p>如果你嫌慢，还有更快的写法 —— 直接在行首打这些符号，会自动变形：</p><table><thead><tr><th>你打这个</th><th>自动变成</th></tr></thead><tbody><tr><td><code># </code> 加空格</td><td>大标题</td></tr><tr><td><code>## </code> 加空格</td><td>中标题</td></tr><tr><td><code>- </code> 加空格</td><td>圆点列表</td></tr><tr><td><code>1. </code> 加空格</td><td>数字列表</td></tr><tr><td><code>&gt; </code> 加空格</td><td>引用</td></tr><tr><td>三个反引号</td><td>代码块</td></tr><tr><td><code>---</code></td><td>分割线</td></tr></tbody></table><p>想给某几个字加粗、变色、加链接？<strong>用鼠标选中它们</strong>，上方会浮出一条小工具栏，点一下就行。</p><blockquote><p>这是引用的样子。适合放别人说过的话，或者你想单独强调的一段。</p></blockquote><h3>图片怎么放</h3><p>三种方式，随便挑：</p><ol><li>直接把图片文件<strong>拖进正文</strong></li><li>复制图片后<strong>直接粘贴</strong></li><li>输入 <code>/</code> 选「图片」，弹出文件选择框</li></ol><p>图片会自动存进网站的 <code>uploads</code> 文件夹，不会因为你挪动了原图而失效。</p><h2>三、这些格式我不用自己填</h2><p>后台会帮你自动搞定这些统一格式的东西：</p><div class=\"todo done\"><input type=\"checkbox\" checked=\"\" disabled=\"\"><span class=\"todo-text\"><strong>日期</strong> —— 新建文章时自动填今天，想改就改</span></div><div class=\"todo done\"><input type=\"checkbox\" checked=\"\" disabled=\"\"><span class=\"todo-text\"><strong>阅读时间</strong> —— 按中文 400 字/分钟算，图片和代码另外加权</span></div><div class=\"todo done\"><input type=\"checkbox\" checked=\"\" disabled=\"\"><span class=\"todo-text\"><strong>字数统计</strong> —— 中文按字、英文按词，底部实时显示</span></div><div class=\"todo done\"><input type=\"checkbox\" checked=\"\" disabled=\"\"><span class=\"todo-text\"><strong>摘要</strong> —— 你不写的话，自动截取正文开头 90 字</span></div><div class=\"todo done\"><input type=\"checkbox\" checked=\"\" disabled=\"\"><span class=\"todo-text\"><strong>封面图</strong> —— 你不传的话，按标题生成一张固定配色的渐变封面</span></div><div class=\"todo done\"><input type=\"checkbox\" checked=\"\" disabled=\"\"><span class=\"todo-text\"><strong>NEW 徽章</strong> —— 发布 14 天内的文章自动带上，过期自动消失</span></div><div class=\"todo done\"><input type=\"checkbox\" checked=\"\" disabled=\"\"><span class=\"todo-text\"><strong>自动保存</strong> —— 停手 1.2 秒就存一次，不用怕丢</span></div><h2>四、草稿和发布的区别</h2><p>新建的文章默认是<strong>草稿</strong>：只有你在后台能看见，首页不显示。写好了点右上角<strong>「发布」</strong>，它才会出现在首页。</p><p>发布之后想撤回，点「转为草稿」就行，内容不会丢。</p><h2>五、一些提速的小技巧</h2><ul><li>在首页按 <code>/</code> 键，光标直接跳到搜索框</li><li>后台按 <code>⌘S</code> 立刻保存</li><li>写标题时按回车，光标直接跳到正文</li><li>选中文字按 <code>⌘K</code> 加链接</li><li>在代码块里按 <code>⌘回车</code> 跳出来</li><li>右上角「从网页导入」可以把一篇网页的正文抓进来（记得注明出处）</li></ul><hr><h2>六、以后想发到网上给别人看</h2><p>这套网站是<strong>纯静态</strong>的 —— 说人话就是：整个文件夹原样传到任何一个网站空间上，它就能跑，不需要数据库、不需要服务器。</p><p>免费的选择有 GitHub Pages、Vercel、Netlify。等你想发的时候再研究，现在完全不用管。</p><div class=\"callout\"><span class=\"callout-emoji\">💡</span><div class=\"callout-body\">最后一个建议：<strong>把这篇删掉之前，先自己写一篇练练手</strong>。删除按钮在后台右上角，删了就找不回来了。</div></div>",
  "rtManual": false,
  "hidden": true
};
