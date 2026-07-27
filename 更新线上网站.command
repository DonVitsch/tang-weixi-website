#!/bin/bash
# 双击这个文件 = 把本机改好的文章推到 GitHub，Cloudflare Pages 会自动更新线上网站。
# 使用前请先在后台写好文章并点「发布」，再双击本文件。

cd "$(dirname "$0")" || exit 1

# 双击运行时 PATH 可能不完整，补上常见 git 位置
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

clear
echo ""
echo "  ┌──────────────────────────────────────────┐"
echo "  │   更新线上网站                            │"
echo "  │   把本地改动推到 GitHub → Cloudflare      │"
echo "  └──────────────────────────────────────────┘"
echo ""

if ! command -v git >/dev/null 2>&1; then
  echo "  ✗ 没找到 git。请先安装 Xcode 命令行工具："
  echo "    终端里运行：xcode-select --install"
  echo ""
  read -r -p "  按回车键关闭..." _
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "  ✗ 当前文件夹还不是 git 仓库，无法推送。"
  echo ""
  read -r -p "  按回车键关闭..." _
  exit 1
fi

# 推送前刷新缓存版本号（给 CSS/JS/文章数据打上新的 ?v=…）
# 这样 Cloudflare / 浏览器不会继续用旧缓存，你也不用开无痕去核对
if command -v node >/dev/null 2>&1; then
  echo "  → 刷新缓存版本号（防止浏览器显示旧页面）…"
  if node server.js --stamp-only; then
    echo "  ✓ 版本号已更新"
  else
    echo "  · 版本号刷新失败（仍会继续推送，但可能要强刷浏览器）"
  fi
  echo ""
else
  echo "  · 没找到 node，跳过缓存版本刷新"
  echo ""
fi

echo "  → 正在检查改动…"
git add -A
echo ""
git status
echo ""

# 没有任何改动（含已暂存）
if git diff --cached --quiet && git diff --quiet; then
  # 也可能有未推送的提交
  if [ -n "$(git log '@{u}..' 2>/dev/null)" ]; then
    echo "  · 工作区没有新改动，但有未推送的提交，继续 push…"
  else
    echo "  ✓ 没有需要提交的改动，线上已经是最新的。"
    echo "    如果刚在后台改了文章，请确认点过「发布 / 保存」，再试一次。"
    echo ""
    read -r -p "  按回车键关闭..." _
    exit 0
  fi
else
  # 生成带日期时间的提交说明
  MSG="更新文章 $(date '+%Y-%m-%d %H:%M')"
  echo "  → 提交：$MSG"
  if ! git commit -m "$MSG"; then
    echo ""
    echo "  ✗ 提交失败。"
    echo ""
    read -r -p "  按回车键关闭..." _
    exit 1
  fi
  echo ""
fi

echo "  → 推送到 GitHub…"
if git push; then
  echo ""
  echo "  ✓ 推送成功！"
  echo "    等 1～2 分钟让 Cloudflare 部署完成，然后普通刷新（⌘R）即可。"
  echo "    已自动换缓存版本号，一般不必再开无痕。"
  echo "    · https://donvitsch-website.pages.dev"
  echo "    · https://donvitsch.blog"
  echo ""
else
  echo ""
  echo "  ✗ 推送失败。常见原因："
  echo "    · 网络不通 / 需要登录 GitHub"
  echo "    · 终端里先手动跑一次：git push，按提示登录"
  echo ""
  read -r -p "  按回车键关闭..." _
  exit 1
fi

echo ""
read -r -p "  按回车键关闭..." _
