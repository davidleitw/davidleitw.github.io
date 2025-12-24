.PHONY: new serve build deploy clean help

# 預設顯示說明
.DEFAULT_GOAL := help

# 建立新文章
# 用法: make new name=my-new-post
new:
ifndef name
	$(error 請指定文章名稱: make new name=your-post-name)
endif
	hugo new post/$(name).md
	@echo "文章已建立: content/post/$(name).md"

# 本地預覽（包含草稿）
serve:
	hugo server -D --bind 0.0.0.0

# 建置靜態檔案
build:
	hugo -d ../docs
	@echo "建置完成: ../docs/"

# 部署到 GitHub Pages
deploy: build
	cd .. && git add . && git commit -m "blog update" && git push
	@echo "部署完成!"

# 清理生成的檔案
clean:
	rm -rf ../docs/*
	rm -rf resources/_gen
	@echo "清理完成"

# 顯示說明
help:
	@echo "Blog 管理指令:"
	@echo ""
	@echo "  make new name=<name>  建立新文章"
	@echo "  make serve            本地預覽 (http://localhost:1313)"
	@echo "  make build            建置靜態檔案"
	@echo "  make deploy           建置並部署到 GitHub Pages"
	@echo "  make clean            清理生成的檔案"
	@echo ""
	@echo "範例:"
	@echo "  make new name=my-first-post"
	@echo "  make serve"
