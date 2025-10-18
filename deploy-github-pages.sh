#!/bin/bash

# GitHub Pages 部署腳本

echo "🚀 開始構建..."
pnpm run build

echo "📦 準備部署到 GitHub Pages..."

# 進入構建輸出目錄
cd dist/public

# 創建 .nojekyll 文件（告訴 GitHub Pages 不要使用 Jekyll）
touch .nojekyll

# 初始化 git
git init
git add -A
git commit -m 'Deploy to GitHub Pages'

echo "✅ 構建完成！"
echo ""
echo "📝 接下來的步驟："
echo "1. 在 GitHub 創建一個新的 repository"
echo "2. 執行以下命令推送代碼："
echo ""
echo "   cd dist/public"
echo "   git branch -M main"
echo "   git remote add origin https://github.com/你的用戶名/你的repo名.git"
echo "   git push -u origin main"
echo ""
echo "3. 在 GitHub repo 設置中啟用 GitHub Pages"
echo "   Settings → Pages → Source: Deploy from a branch → Branch: main"
echo ""
echo "🎉 完成後您的網站將在 https://你的用戶名.github.io/你的repo名/ 上線！"

