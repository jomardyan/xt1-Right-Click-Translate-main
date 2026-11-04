SHELL := /bin/sh

NODE ?= node
NPM ?= npm
.DEFAULT_GOAL := help
PACKAGE_NAME = xt1-translate-v$(shell "$(NODE)" -p "require('./manifest.json').version")
DIST_DIR := dist
PACKAGE_FILE := $(DIST_DIR)/$(PACKAGE_NAME).zip

PACKAGE_FILES := \
	manifest.json \
	background.js \
	content.js \
	options.js \
	options.html \
	options.css \
	popup.js \
	popup.html \
	popup.css \
	icons/ \
	_locales/ \
	vendor/

.PHONY: help install dev test lint build package clean FORCE

help:
	@"$(NODE)" -e "console.log('install: locked test tools; dev: unpacked extension instructions; test: Jest; lint: syntax checks; build: validate source; package: local ZIP; clean: generated ZIPs')"

install:
	$(NPM) ci --ignore-scripts

test:
	$(NPM) test -- --runInBand

lint:
	"$(NODE)" --check background.js
	"$(NODE)" --check content.js
	"$(NODE)" --check options.js
	"$(NODE)" --check popup.js

# This browser extension runs directly from source without transpilation.
build: lint

dev: build
	@"$(NODE)" -e "console.log('Load this repository directory using Load unpacked at chrome://extensions/; reload after editing.')"

package: $(PACKAGE_FILE)
	@printf 'Created %s\n' '$(PACKAGE_FILE)'

$(PACKAGE_FILE): build FORCE $(PACKAGE_FILES)
	@mkdir -p '$(DIST_DIR)'
	@rm -f '$@'
	@zip -rq '$@' $(PACKAGE_FILES)

FORCE:

clean:
	@rm -rf '$(DIST_DIR)'
